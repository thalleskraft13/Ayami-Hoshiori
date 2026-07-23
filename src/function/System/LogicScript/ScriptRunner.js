'use strict';


const { Lexer, LexerError }            = require('./Lexer.js');
const { Parser, ParseError }            = require('./Parser.js');
const { Interpreter, RuntimeError }     = require('./Interpreter.js');
const { db: lsDb }                      = require('./Database.js');
const { LogicScriptModel, LogicRunLogModel } = require('../../../Mongodb/logicScript.js');
const { LogicScriptConfig }             = require('../../../Mongodb/logicScriptConfig.js');

const SCRIPT_CACHE_TTL  = 30_000;   
const CONFIG_CACHE_TTL  = 60_000;   

class ScriptRunner {
  constructor(client) {
    this.client = client;

    this._handlerCache  = new Map();  
    this._cacheExpiry   = new Map();  

    this._configCache   = new Map();  
    this._configExpiry  = new Map();  

    this._concurrent    = new Map();  
    this._MAX_CONCURRENT = 20;
  }

  async start() {
    console.log('[LogicScript] ScriptRunner v2 iniciado (modo prefixo).');
  }

  async _getConfig(guildId) {
    const expiry = this._configExpiry.get(guildId);
    if (expiry && Date.now() < expiry) return this._configCache.get(guildId);

    let cfg = await LogicScriptConfig.findOne({ guildId }).lean();
    if (!cfg) cfg = { guildId, prefix: '!', enabled: true, ignoreBots: true };

    this._configCache.set(guildId, cfg);
    this._configExpiry.set(guildId, Date.now() + CONFIG_CACHE_TTL);
    return cfg;
  }

  async handleGateway(payload) {
    const { t: event, d: data } = payload;
    if (!event || !data) return;

    const guildId = data.guild_id;
    if (!guildId) return;

    const config = await this._getConfig(guildId);
    if (!config.enabled) return;

    if (config.ignoreBots && data.author?.bot) return;

    const ctx = this._buildContext(event, data, config);
    if (!ctx) return;

    if ((this._concurrent.get(guildId) ?? 0) >= this._MAX_CONCURRENT) return;

    const handlers = await this._getEventHandlers(guildId);
    const lsEvents = this._gatewayToLsEvents(event, data, config, ctx);

    for (const lsEvent of lsEvents) {
      const list = handlers.get(lsEvent) ?? [];
      for (const handler of list) {
        if (!this._eventMatches(lsEvent, handler, data, ctx)) continue;
        this._runHandler(handler, ctx, lsEvent).catch(err =>
          console.error(`[LogicScript] Erro em '${lsEvent}':`, err.message)
        );
      }
    }
  }

  _buildContext(event, data, config) {
    const guildId = data.guild_id;
    const ctx = { guildId, prefix: config.prefix ?? '!' };

    switch (event) {
      case 'MESSAGE_CREATE':
      case 'MESSAGE_UPDATE':
      case 'MESSAGE_DELETE':
        ctx.channelId = data.channel_id;
        ctx.userId    = data.author?.id ?? data.user_id;
        ctx.message   = data;
        if (data.content) {
          const content = data.content.trim();
          if (content.startsWith(ctx.prefix)) {
            const withoutPrefix = content.slice(ctx.prefix.length).trim();
            const parts         = withoutPrefix.split(/\s+/);
            ctx.commandName     = parts[0]?.toLowerCase() ?? '';
            ctx.commandArgs     = parts.slice(1);
            ctx.commandRaw      = withoutPrefix;
          }
        }
        break;

      case 'GUILD_MEMBER_ADD':
      case 'GUILD_MEMBER_REMOVE':
      case 'GUILD_MEMBER_UPDATE':
        ctx.userId = data.user?.id;
        break;

      case 'INTERACTION_CREATE':
        ctx.channelId   = data.channel_id;
        ctx.userId      = data.member?.user?.id ?? data.user?.id;
        ctx.interaction = data;
        break;

      case 'MESSAGE_REACTION_ADD':
      case 'MESSAGE_REACTION_REMOVE':
        ctx.channelId = data.channel_id;
        ctx.userId    = data.user_id;
        ctx.message   = { id: data.message_id, channel_id: data.channel_id };
        ctx.emoji     = data.emoji;
        break;

      case 'GUILD_BAN_ADD':
      case 'GUILD_BAN_REMOVE':
        ctx.userId = data.user?.id;
        break;

      case 'CHANNEL_CREATE':
      case 'CHANNEL_DELETE':
        ctx.channelId   = data.id;
        ctx.channelData = data;
        break;

      case 'VOICE_STATE_UPDATE':
        ctx.userId    = data.user_id;
        ctx.channelId = data.channel_id;
        break;

      default: return null;
    }

    return ctx;
  }

  _gatewayToLsEvents(event, data, config, ctx) {
    const events = [];

    switch (event) {
      case 'MESSAGE_CREATE':
        events.push('messageCreate');
        if (ctx.commandName) events.push('command');
        break;
      case 'MESSAGE_UPDATE':       events.push('messageEdit');   break;
      case 'MESSAGE_DELETE':       events.push('messageDelete'); break;
      case 'GUILD_MEMBER_ADD':     events.push('memberJoin');    break;
      case 'GUILD_MEMBER_REMOVE':  events.push('memberLeave');   break;
      case 'GUILD_MEMBER_UPDATE':  events.push('memberUpdate');  break;
      case 'MESSAGE_REACTION_ADD': events.push('reactionAdd');   break;
      case 'MESSAGE_REACTION_REMOVE': events.push('reactionRemove'); break;
      case 'GUILD_BAN_ADD':        events.push('banAdd');        break;
      case 'GUILD_BAN_REMOVE':     events.push('banRemove');     break;
      case 'CHANNEL_CREATE':       events.push('channelCreate'); break;
      case 'CHANNEL_DELETE':       events.push('channelDelete'); break;
      case 'VOICE_STATE_UPDATE':
        events.push(data.channel_id ? 'voiceJoin' : 'voiceLeave'); break;
      case 'INTERACTION_CREATE':
        if (data.type === 3) {
          const customId = data.data?.custom_id;
          if (this.client.interactions?.isReservedCustomId(customId)) break;
          if (data.data?.component_type === 2) events.push('buttonClick');
          if (data.data?.component_type === 3) events.push('selectMenu');
        }
        break;
    }

    return events;
  }

  _eventMatches(lsEvent, handler, data, ctx) {
    if (lsEvent === 'command' && handler.commandName) {
      if ((ctx.commandName ?? '') !== handler.commandName.toLowerCase()) return false;
    }
    return true;
  }

  async _runHandler(handler, ctx, eventName) {
    const { guildId } = ctx;
    const startMs     = Date.now();
    let status = 'ok', errMsg = null, errLine = null, steps = 0, printLog = [];

    this._concurrent.set(guildId, (this._concurrent.get(guildId) ?? 0) + 1);

    let interp = null;
    try {
      const modules = await this._loadModules(guildId, handler.imports ?? []);
      interp = new Interpreter({
        client:     this.client,
        discordCtx: ctx,
        db:         lsDb,
        modules,
      });

      const env      = interp._globals;

      if (handler.setup?.length) await interp._execBlock(handler.setup, env);

      const eventArgs = this._buildEventArgs(eventName, ctx, interp);
      (handler.params ?? []).forEach((p, i) => env.define(p, eventArgs[i] ?? null));

      await interp._execBlock(handler.body, env);
      steps = interp._steps;

    } catch (err) {
      errMsg = err.message;
      errLine = err.line ?? null;
      status = err.message?.includes('Limite') ? 'timeout' : 'error';
      console.error(`[LogicScript] ${err.message}`);
    } finally {
      this._concurrent.set(guildId, Math.max(0, (this._concurrent.get(guildId) ?? 1) - 1));
      printLog = interp?._printLog ?? [];
    }

    LogicRunLogModel.create({
      guildId,
      scriptPath: handler.scriptPath,
      event:      eventName,
      status, error: errMsg, errorLine: errLine, steps,
      logs:       printLog,
      durationMs: Date.now() - startMs,
    }).catch(() => {});
  }

  _buildEventArgs(eventName, ctx, interp) {
    const msg         = ctx.message;
    const interaction = ctx.interaction;

    switch (eventName) {
      case 'messageCreate':
      case 'messageEdit':
      case 'messageDelete':
        return [interp._buildMessageObj(msg)];

      case 'command': {
        const rawArgs = ctx.commandArgs ?? [];
        const argsObj = Object.fromEntries(rawArgs.map((a, i) => [String(i), a]));
        argsObj._ = rawArgs;
        return [interp._buildMessageObj(msg), argsObj];
      }

      case 'memberJoin':
      case 'memberLeave':
      case 'memberUpdate':
      case 'banAdd':
      case 'banRemove':
      case 'voiceJoin':
      case 'voiceLeave':
        return [{ id: ctx.userId }];

      case 'channelCreate':
      case 'channelDelete': {
        const d = ctx.channelData ?? {};
        return [{ id: ctx.channelId, name: d.name, type: d.type, category: d.parent_id }];
      }

      case 'buttonClick':
      case 'selectMenu':
        return [interp._buildInteractionObj(interaction)];

      case 'reactionAdd':
      case 'reactionRemove':
        return [ctx.emoji, { id: ctx.userId }, interp._buildMessageObj(msg)];

      case 'ticketUpdate':
      case 'activitySpike':
        return [ctx.customData ?? {}];

      default: return [];
    }
  }

  async _getEventHandlers(guildId) {
    const expiry = this._cacheExpiry.get(guildId);
    if (expiry && Date.now() < expiry) return this._handlerCache.get(guildId) ?? new Map();

    const scripts  = await LogicScriptModel.find({ guildId, enabled: true, isFolder: false }).lean();
    const handlers = new Map();

    for (const script of scripts) {
      try {
        const ast     = this._compile(script.content, script.path);
        const imports = ast.body.filter(n => n.type === 'Import').map(n => n.source);

        const setup = ast.body.filter(n => n.type !== 'OnEvent');

        for (const node of ast.body) {
          if (node.type !== 'OnEvent') continue;
          const evName = node.event;
          if (!handlers.has(evName)) handlers.set(evName, []);
          handlers.get(evName).push({
            event:       evName,
            commandName: node.commandName ?? null,
            params:      node.params,
            body:        node.body,
            setup,
            scriptPath:  script.path,
            imports,
          });
        }
      } catch (err) {
        console.error(`[LogicScript] Erro ao compilar '${script.path}':`, err.message);
      }
    }

    this._handlerCache.set(guildId, handlers);
    this._cacheExpiry.set(guildId, Date.now() + SCRIPT_CACHE_TTL);
    return handlers;
  }

  _normalizeImportPath(rawPath) {
    return rawPath.startsWith('/') ? rawPath : '/' + rawPath;
  }

  async _loadModules(guildId, importPaths) {
    const modules = new Map();
    for (const rawPath of importPaths) {
      const path = this._normalizeImportPath(rawPath);
      if (modules.has(path)) continue;
      const script = await LogicScriptModel.findOne({ guildId, path }).lean();
      if (!script) continue;
      try {
        const ast    = this._compile(script.content, path);
        const interp = new Interpreter({ client: this.client, discordCtx: { guildId }, db: lsDb, modules });
        await interp._execBlock(ast.body, interp._globals);
        modules.set(path, interp._globals._exports ?? {});
      } catch (err) {
        console.error(`[LogicScript] Módulo '${path}':`, err.message);
      }
    }
    return modules;
  }

  _compile(source, path = '<script>') {
    const tokens = new Lexer(source).tokenize();
    return new Parser(tokens).parse();
  }


  invalidateCache(guildId) {
    this._handlerCache.delete(guildId);
    this._cacheExpiry.delete(guildId);
  }

  invalidateConfig(guildId) {
    this._configCache.delete(guildId);
    this._configExpiry.delete(guildId);
  }

  validate(source) {
    try {
      this._compile(source, '<validate>');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async runManual(guildId, scriptPath, discordCtx = {}) {
    const config = await this._getConfig(guildId);
    const script = await LogicScriptModel.findOne({ guildId, path: scriptPath }).lean();
    if (!script) throw new Error(`Script '${scriptPath}' não encontrado.`);

    const ast    = this._compile(script.content, scriptPath);
    const mods   = await this._loadModules(guildId, ast.body.filter(n => n.type === 'Import').map(n => n.source));
    const interp = new Interpreter({
      client:     this.client,
      discordCtx: { guildId, prefix: config.prefix, ...discordCtx },
      db:         lsDb,
      modules:    mods,
    });

    try {
      await interp.run(ast);
      return { ok: true, steps: interp._steps, logs: interp._printLog };
    } catch (err) {
      throw Object.assign(err, { logs: interp._printLog });
    }
  }

  async emitCustomEvent(guildId, eventName, discordCtx = {}) {
    const config   = await this._getConfig(guildId);
    const handlers = await this._getEventHandlers(guildId);
    for (const h of (handlers.get(eventName) ?? [])) {
      await this._runHandler(h, { guildId, prefix: config.prefix, ...discordCtx }, eventName);
    }
  }
}

module.exports = { ScriptRunner };
