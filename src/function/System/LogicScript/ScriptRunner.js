'use strict';

/* ═══════════════════════════════════════════
   LOGIC SCRIPT — SCRIPT RUNNER v2
   Mudanças:
   - Comandos por PREFIXO em messageCreate
   - Carrega configuração (prefix) por guild do banco
   - Cache de config separado do cache de handlers
   - (patch) _loadModules normaliza o path do import
     pra sempre bater com o padrão usado pelo site
     (que sempre salva com barra na frente: "/x.logic")
   ═══════════════════════════════════════════ */

const { Lexer, LexerError }            = require('./Lexer.js');
const { Parser, ParseError }            = require('./Parser.js');
const { Interpreter, RuntimeError }     = require('./Interpreter.js');
const { db: lsDb }                      = require('./Database.js');
const { LogicScriptModel, LogicRunLogModel } = require('../../../Mongodb/logicScript.js');
const { LogicScriptConfig }             = require('../../../Mongodb/logicScriptConfig.js');

const SCRIPT_CACHE_TTL  = 30_000;   // 30s
const CONFIG_CACHE_TTL  = 60_000;   // 1min

class ScriptRunner {
  constructor(client) {
    this.client = client;

    // Cache de handlers por guild
    this._handlerCache  = new Map();  // guildId → Map<eventName, handler[]>
    this._cacheExpiry   = new Map();  // guildId → timestamp

    // Cache de configuração (prefix etc.)
    this._configCache   = new Map();  // guildId → { prefix, enabled, … }
    this._configExpiry  = new Map();  // guildId → timestamp

    // Concorrência
    this._concurrent    = new Map();  // guildId → number
    this._MAX_CONCURRENT = 20;
  }

  async start() {
    console.log('[LogicScript] ScriptRunner v2 iniciado (modo prefixo).');
  }

  /* ══════════════════════════════════════
     CONFIGURAÇÃO POR GUILD
     ══════════════════════════════════════ */
  async _getConfig(guildId) {
    const expiry = this._configExpiry.get(guildId);
    if (expiry && Date.now() < expiry) return this._configCache.get(guildId);

    let cfg = await LogicScriptConfig.findOne({ guildId }).lean();
    if (!cfg) cfg = { guildId, prefix: '!', enabled: true, ignoreBots: true };

    this._configCache.set(guildId, cfg);
    this._configExpiry.set(guildId, Date.now() + CONFIG_CACHE_TTL);
    return cfg;
  }

  /* ══════════════════════════════════════
     GATEWAY HANDLER
     ══════════════════════════════════════ */
  async handleGateway(payload) {
    const { t: event, d: data } = payload;
    if (!event || !data) return;

    const guildId = data.guild_id;
    if (!guildId) return;

    // Verificar se o sistema está ativo para esta guild
    const config = await this._getConfig(guildId);
    if (!config.enabled) return;

    // Ignorar bots
    if (config.ignoreBots && data.author?.bot) return;

    const ctx = this._buildContext(event, data, config);
    if (!ctx) return;

    // Concorrência
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

  /* ══════════════════════════════════════
     MAPEAMENTO GATEWAY → EVENTOS LS
     ══════════════════════════════════════ */
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
        // Extrair comando e args do conteúdo da mensagem
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
        ctx.channelId = data.id;
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
        // Se a mensagem começa com o prefixo → também dispara 'command'
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
          if (data.data?.component_type === 2) events.push('buttonClick');
          if (data.data?.component_type === 3) events.push('selectMenu');
        }
        break;
    }

    return events;
  }

  _eventMatches(lsEvent, handler, data, ctx) {
    if (lsEvent === 'command' && handler.commandName) {
      // Comparar com o nome do comando extraído da mensagem
      if ((ctx.commandName ?? '') !== handler.commandName.toLowerCase()) return false;
    }
    return true;
  }

  /* ══════════════════════════════════════
     EXECUÇÃO DE HANDLER
     ══════════════════════════════════════ */
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

      // Roda primeiro tudo que está fora do `on(...)` no mesmo arquivo
      // (function, export function, let/const de topo, import) — é isso
      // que faz `addCoins()` e afins existirem quando o handler roda.
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

  /* ══════════════════════════════════════
     ARGS DE EVENTO
     ══════════════════════════════════════ */
  _buildEventArgs(eventName, ctx, interp) {
    const msg         = ctx.message;
    const interaction = ctx.interaction;

    switch (eventName) {
      case 'messageCreate':
      case 'messageEdit':
      case 'messageDelete':
        return [interp._buildMessageObj(msg)];

      case 'command': {
        // Montar objeto de args a partir do texto da mensagem
        // ex: !ban 123456 spam  → args = { _: ["123456", "spam"], 0: "123456", 1: "spam" }
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
        return [{ id: ctx.userId }];

      case 'buttonClick':
      case 'selectMenu':
        return [interp._buildInteractionObj(interaction)];

      case 'reactionAdd':
      case 'reactionRemove':
        return [ctx.emoji, { id: ctx.userId }, interp._buildMessageObj(msg)];

      default: return [];
    }
  }

  /* ══════════════════════════════════════
     CARREGAR / COMPILAR SCRIPTS
     ══════════════════════════════════════ */
  async _getEventHandlers(guildId) {
    const expiry = this._cacheExpiry.get(guildId);
    if (expiry && Date.now() < expiry) return this._handlerCache.get(guildId) ?? new Map();

    const scripts  = await LogicScriptModel.find({ guildId, enabled: true, isFolder: false }).lean();
    const handlers = new Map();

    for (const script of scripts) {
      try {
        const ast     = this._compile(script.content, script.path);
        const imports = ast.body.filter(n => n.type === 'Import').map(n => n.source);

        // Tudo que NÃO é um bloco `on(...)` — function/export function,
        // let/const de topo, import — precisa rodar ANTES do corpo do
        // evento, senão funções declaradas no mesmo arquivo (fora do
        // `on`) não existem quando o handler dispara (cada evento roda
        // num Interpreter/Environment novo, do zero).
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

  /**
   * Normaliza o path de um import pro mesmo padrão usado pelo site
   * (routes/logicScriptApi.js): TODO path salvo no Mongo começa com "/"
   * — é imposto pela regex `SAFE_PATH_RE = /^\/[a-zA-Z0-9 _\-./]*$/` no
   * momento de salvar. Sem essa normalização, um `import ... from
   * "economia.logic"` (sem barra) nunca batia com o `/economia.logic`
   * salvo, o findOne voltava vazio, e o import falhava — antes, em
   * silêncio (isso também foi corrigido no Interpreter.js).
   */
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

  /* ══════════════════════════════════════
     API PÚBLICA
     ══════════════════════════════════════ */

  /** Invalida cache de handlers (após salvar script) */
  invalidateCache(guildId) {
    this._handlerCache.delete(guildId);
    this._cacheExpiry.delete(guildId);
  }

  /** Invalida cache de config (após salvar prefix) */
  invalidateConfig(guildId) {
    this._configCache.delete(guildId);
    this._configExpiry.delete(guildId);
  }

  /** Valida sintaxe sem executar */
  validate(source) {
    try {
      this._compile(source, '<validate>');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /** Executa manualmente (dashboard) */
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
      // Inclui os prints que rodaram até o erro acontecer
      throw Object.assign(err, { logs: interp._printLog });
    }
  }

  /** Dispara evento personalizado */
  async emitCustomEvent(guildId, eventName, discordCtx = {}) {
    const config   = await this._getConfig(guildId);
    const handlers = await this._getEventHandlers(guildId);
    for (const h of (handlers.get(eventName) ?? [])) {
      await this._runHandler(h, { guildId, prefix: config.prefix, ...discordCtx }, eventName);
    }
  }
}

module.exports = { ScriptRunner };
