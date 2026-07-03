'use strict';

/* ═══════════════════════════════════════════
   LOGIC SCRIPT — INTERPRETER v2
   Mudanças:
   - Sistema de comandos via PREFIXO (não slash)
   - EmbedBuilder estilo discord.js (new EmbedBuilder())
   - Embeds em sendMessage, reply, followUp, etc.
   - Contexto de prefixo injetado automaticamente
   ═══════════════════════════════════════════ */

const DiscordRequest = require('../../DiscordRequest.js');

class ReturnSignal  { constructor(v) { this.value = v; } }
class BreakSignal   {}
class ContinueSignal {}
class RuntimeError extends Error {
  constructor(msg, line) {
    super(`[Logic Script] Erro${line ? ` (linha ${line})` : ''}: ${msg}`);
    this.line = line;
  }
}

const MAX_STEPS   = 50_000;
const MAX_DEPTH   = 200;
const MAX_WAIT_MS = 30_000;

/* ══════════════════════════════════════
   ENVIRONMENT
   ══════════════════════════════════════ */
class Environment {
  constructor(parent = null) {
    this._vars  = new Map();
    this.parent = parent;
  }
  get(name) {
    if (this._vars.has(name)) return this._vars.get(name);
    return this.parent ? this.parent.get(name) : undefined;
  }
  set(name, value) {
    if (this._vars.has(name)) { this._vars.set(name, value); return; }
    if (this.parent && this.parent._has(name)) { this.parent.set(name, value); return; }
    this._vars.set(name, value);
  }
  define(name, value) { this._vars.set(name, value); }
  _has(name) {
    if (this._vars.has(name)) return true;
    return this.parent ? this.parent._has(name) : false;
  }
}

/* ══════════════════════════════════════
   EMBED BUILDER (estilo discord.js)
   new EmbedBuilder()
   ══════════════════════════════════════ */
class EmbedBuilder {
  constructor() {
    this._data = {};
    this._type = 'embed';
  }

  setTitle(v)       { this._data.title = String(v); return this; }
  setDescription(v) { this._data.description = String(v); return this; }
  setColor(v) {
    if (typeof v === 'string' && v.startsWith('#'))
      this._data.color = parseInt(v.slice(1), 16);
    else if (typeof v === 'string' && /^\d+$/.test(v))
      this._data.color = parseInt(v);
    else if (typeof v === 'number')
      this._data.color = v;
    else {
      // Nomes de cores comuns
      const COLORS = {
        Red: 0xED4245, Green: 0x57F287, Blue: 0x3498DB,
        Yellow: 0xFEE75C, Orange: 0xE67E22, Purple: 0x9B59B6,
        Gold: 0xF1C40F, White: 0xFFFFFF, Black: 0x000000,
        Blurple: 0x5865F2, Fuchsia: 0xEB459E, Greyple: 0x99AAB5,
        DarkGrey: 0x2C2F33, DarkerGrey: 0x23272A, NotQuiteBlack: 0x010101,
        LuminousVividPink: 0xE91E63, Aqua: 0x1ABC9C, Navy: 0x34495E,
        Dark: 0x11806A, Random: Math.floor(Math.random() * 0xFFFFFF),
      };
      this._data.color = COLORS[v] ?? 0x5865F2;
    }
    return this;
  }
  setURL(v)          { this._data.url = String(v); return this; }
  setTimestamp(v)    { this._data.timestamp = v ? new Date(v).toISOString() : new Date().toISOString(); return this; }
  setThumbnail(v)    { this._data.thumbnail = { url: String(v) }; return this; }
  setImage(v)        { this._data.image = { url: String(v) }; return this; }
  setAuthor(opts)    {
    if (typeof opts === 'string') this._data.author = { name: opts };
    else this._data.author = { name: opts.name, url: opts.url, icon_url: opts.iconURL ?? opts.icon_url };
    return this;
  }
  setFooter(opts)    {
    if (typeof opts === 'string') this._data.footer = { text: opts };
    else this._data.footer = { text: opts.text, icon_url: opts.iconURL ?? opts.icon_url };
    return this;
  }
  addFields(...fields) {
    if (!this._data.fields) this._data.fields = [];
    const list = Array.isArray(fields[0]) ? fields[0] : fields;
    for (const f of list) {
      this._data.fields.push({
        name:   String(f.name),
        value:  String(f.value),
        inline: Boolean(f.inline ?? false),
      });
    }
    return this;
  }
  spliceFields(index, deleteCount, ...fields) {
    if (!this._data.fields) this._data.fields = [];
    this._data.fields.splice(index, deleteCount, ...fields.map(f => ({
      name: String(f.name), value: String(f.value), inline: Boolean(f.inline ?? false),
    })));
    return this;
  }
  setFields(...fields) {
    this._data.fields = [];
    return this.addFields(...fields);
  }

  // Legado (compatibilidade com a sintaxe antiga do Logic Script)
  title(v)       { return this.setTitle(v); }
  description(v) { return this.setDescription(v); }
  color(v)       { return this.setColor(v); }
  footer(t, i)   { return this.setFooter({ text: t, iconURL: i }); }
  author(n, u, i){ return this.setAuthor({ name: n, url: u, iconURL: i }); }
  thumbnail(v)   { return this.setThumbnail(v); }
  image(v)       { return this.setImage(v); }
  field(n, v, i) { return this.addFields({ name: n, value: v, inline: i }); }
  timestamp(v)   { return this.setTimestamp(v); }
  url(v)         { return this.setURL(v); }

  toJSON() { return this._data; }
}

/* ══════════════════════════════════════
   HELPERS DE MENSAGEM
   ══════════════════════════════════════ */

function resolveEmbed(embed) {
  if (!embed) return null;
  if (embed instanceof EmbedBuilder) return embed.toJSON();
  if (embed._type === 'embed' && embed._data) return embed._data;
  if (typeof embed === 'object' && !Array.isArray(embed)) return embed;
  return null;
}

function resolveComponents(comps) {
  if (!comps) return [];
  const list = Array.isArray(comps) ? comps : [comps];
  const rows = [];

  for (const c of list) {
    if (!c) continue;
    if (c._type === 'button') {
      rows.push({ type: 1, components: [c._data] });
    } else if (c._type === 'selectmenu') {
      rows.push({ type: 1, components: [c._data] });
    } else if (c._type === 'modal') {
      // modal é tratado separadamente
    } else if (c.type === 1) {
      rows.push(c); // row já montada
    }
  }

  return rows;
}

function buildMessageBody(content, opts = {}) {
  const body = {};
  if (content != null && content !== '') body.content = String(content);

  // Embed(s)
  if (opts.embed) {
    const resolved = resolveEmbed(opts.embed);
    if (resolved) body.embeds = [resolved];
  }
  if (opts.embeds) {
    body.embeds = opts.embeds.map(resolveEmbed).filter(Boolean);
  }

  // Componentes
  const comps = resolveComponents(opts.components ?? opts.component);
  if (comps.length) body.components = comps;

  // Flags
  if (opts.ephemeral) body.flags = 64;

  return body;
}

/* ══════════════════════════════════════
   INTERPRETER
   ══════════════════════════════════════ */
class Interpreter {
  /**
   * @param {object} opts
   * @param {object} opts.client       — DiscordGatewayClient
   * @param {object} opts.discordCtx   — { guildId, channelId, userId, message, interaction, prefix }
   * @param {object} opts.db           — LogicScriptDB
   * @param {Map}    opts.modules      — módulos importados
   */
  constructor(opts = {}) {
    this.client     = opts.client     ?? null;
    this.discordCtx = opts.discordCtx ?? {};
    this.db         = opts.db         ?? null;
    this.modules    = opts.modules    ?? new Map();

    this._steps     = 0;
    this._depth     = 0;
    this._totalWait = 0;
    this._printLog  = [];   // buffer de saídas print() — usado pelo console do dashboard

    this._globals   = new Environment();
    this._setupGlobals();
  }

  /* ══════════════════════════════════════
     GLOBALS
     ══════════════════════════════════════ */
  _setupGlobals() {
    const G   = this._globals;
    const ctx = this.discordCtx;

    /* ── Utilitários ── */
    G.define('print',    (...a) => {
      const text = a.map(v => this._str(v)).join(' ');
      console.log('[LS]', text);
      this._printLog.push(text);
      // Limite de segurança: evita buffer gigante em loops
      if (this._printLog.length > 200) this._printLog.shift();
      return null;
    });
    G.define('length',   s => String(s).length);
    G.define('contains', (s, sub) => String(s).includes(String(sub)));
    G.define('replace',  (s, a, b) => String(s).replaceAll(String(a), String(b)));
    G.define('split',    (s, sep) => String(s).split(String(sep ?? '')));
    G.define('join',     (a, sep) => (Array.isArray(a) ? a : []).join(String(sep ?? '')));
    G.define('lower',    s => String(s).toLowerCase());
    G.define('upper',    s => String(s).toUpperCase());
    G.define('trim',     s => String(s).trim());
    G.define('tostring', v => this._str(v));
    G.define('tonumber', v => Number(v));
    G.define('type',     v => Array.isArray(v) ? 'array' : typeof v);
    G.define('random',   (min, max) => min === undefined ? Math.random() : Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min));
    G.define('round',    n => Math.round(Number(n)));
    G.define('floor',    n => Math.floor(Number(n)));
    G.define('ceil',     n => Math.ceil(Number(n)));
    G.define('abs',      n => Math.abs(Number(n)));
    G.define('max',      (...a) => Math.max(...a.map(Number)));
    G.define('min',      (...a) => Math.min(...a.map(Number)));
    G.define('push',     (a, v) => { if (Array.isArray(a)) a.push(v); return a; });
    G.define('pop',      a => Array.isArray(a) ? a.pop() : null);
    G.define('insert',   (a, i, v) => { if (Array.isArray(a)) a.splice(i, 0, v); return a; });
    G.define('remove',   (a, i) => { if (Array.isArray(a)) a.splice(i, 1); return a; });
    G.define('size',     v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0));
    G.define('keys',     obj => obj && typeof obj === 'object' ? Object.keys(obj) : []);
    G.define('values',   obj => obj && typeof obj === 'object' ? Object.values(obj) : []);
    G.define('json',     { encode: v => JSON.stringify(v), decode: s => { try { return JSON.parse(s); } catch { return null; } } });
    G.define('wait',     async ms => {
      const n = Math.min(Number(ms) || 0, MAX_WAIT_MS);
      this._totalWait += n;
      if (this._totalWait > MAX_WAIT_MS) throw new RuntimeError('Limite de wait() excedido');
      await new Promise(r => setTimeout(r, n));
    });

    /* ── Prefixo ── */
    G.define('PREFIX', ctx.prefix ?? '!');

    /* ── EmbedBuilder (estilo discord.js) ── */
    const self = this;
    G.define('EmbedBuilder', function() { return new EmbedBuilder(); });

    /* ── Legado: Embed() ── */
    G.define('Embed', function() { return new EmbedBuilder(); });

    /* ── Button ── */
    G.define('Button', () => this._makeButton());

    /* ── SelectMenu ── */
    G.define('SelectMenu', () => this._makeSelectMenu());

    /* ── Objetos Discord ── */
    G.define('getUser',        async () => this._buildUserObj(ctx.userId));
    G.define('getChannel',     async (id) => this._buildChannelObj(id ?? ctx.channelId));
    G.define('getGuild',       async () => this._buildGuildObj(ctx.guildId));
    G.define('getInteraction', () => this._buildInteractionObj(ctx.interaction));
    G.define('getMessage',     () => this._buildMessageObj(ctx.message));

    /* ── sendMessage ── */
    G.define('sendMessage', async (channel, content, opts) => {
      const chId = typeof channel === 'object' ? channel?.id : String(channel ?? ctx.channelId);
      return this._sendToChannel(chId, content, opts);
    });

    /* ── sendDM ── */
    G.define('sendDM', async (user, content, opts) => {
      const uid = typeof user === 'object' ? user?.id : String(user);
      const dm  = await DiscordRequest('/users/@me/channels', { method: 'POST', body: { recipient_id: uid } }).catch(() => null);
      if (!dm?.id) return null;
      return this._sendToChannel(dm.id, content, opts);
    });

    /* ── Banco de dados ── */
    G.define('db', this._buildDbObj());
  }

  /* ══════════════════════════════════════
     ENVIO DE MENSAGEM (centralizado)
     ══════════════════════════════════════ */
  async _sendToChannel(channelId, content, opts = {}) {
    if (!channelId) return null;

    // Segurança: canal deve pertencer à guild
    try {
      const ch = await DiscordRequest(`/channels/${channelId}`);
      if (ch?.guild_id && ch.guild_id !== this.discordCtx.guildId) return null;
    } catch { return null; }

    const body = buildMessageBody(content, opts);
    const msg  = await DiscordRequest(`/channels/${channelId}/messages`, { method: 'POST', body }).catch(() => null);
    return msg?.id ? this._buildMessageObj(msg) : null;
  }

  /* ══════════════════════════════════════
     EXECUÇÃO
     ══════════════════════════════════════ */
  async run(ast, env = null) {
    return this._execBlock(ast.body ?? ast, env ?? this._globals);
  }

  async _execBlock(stmts, env) {
    for (const stmt of stmts) {
      const r = await this._execStmt(stmt, env);
      if (r instanceof ReturnSignal || r instanceof BreakSignal || r instanceof ContinueSignal) return r;
    }
    return null;
  }

  async _execStmt(node, env) {
    this._steps++;
    if (this._steps > MAX_STEPS) throw new RuntimeError('Limite de execução atingido (loop infinito?)');

    switch (node.type) {
      case 'VarDecl': {
        const val = await this._eval(node.init, env);
        env.define(node.name, val);
        return null;
      }
      case 'Assign': {
        env.set(node.target.name, await this._eval(node.value, env));
        return null;
      }
      case 'AssignMember': {
        const val = await this._eval(node.value, env);
        const obj = await this._eval(node.target.object, env);
        if (obj && typeof obj === 'object') obj[node.target.prop] = val;
        return null;
      }
      case 'FunctionDecl': {
        const fn = this._makeFunction(node.params, node.body, env);
        env.define(node.name, fn);
        if (node.isExported) { if (!env._exports) env._exports = {}; env._exports[node.name] = fn; }
        return null;
      }
      case 'Return': {
        const val = node.value ? await this._eval(node.value, env) : null;
        return new ReturnSignal(val);
      }
      case 'Break':    return new BreakSignal();
      case 'Continue': return new ContinueSignal();
      case 'If': {
        if (this._truthy(await this._eval(node.test, env))) return this._execBlock(node.consequent, new Environment(env));
        for (const alt of (node.alternates ?? [])) {
          if (this._truthy(await this._eval(alt.test, env))) return this._execBlock(alt.body, new Environment(env));
        }
        if (node.elseBody) return this._execBlock(node.elseBody, new Environment(env));
        return null;
      }
      case 'While': {
        while (this._truthy(await this._eval(node.test, env))) {
          this._steps++;
          if (this._steps > MAX_STEPS) throw new RuntimeError('Limite de iterações atingido');
          const r = await this._execBlock(node.body, new Environment(env));
          if (r instanceof BreakSignal) break;
          if (r instanceof ReturnSignal) return r;
        }
        return null;
      }
      case 'ForIn': {
        const iter = await this._eval(node.iter, env);
        const arr  = Array.isArray(iter) ? iter : Object.values(iter ?? {});
        for (const item of arr) {
          this._steps++;
          if (this._steps > MAX_STEPS) throw new RuntimeError('Limite de iterações atingido');
          const lenv = new Environment(env);
          lenv.define(node.var, item);
          const r = await this._execBlock(node.body, lenv);
          if (r instanceof BreakSignal) break;
          if (r instanceof ReturnSignal) return r;
        }
        return null;
      }
      case 'ForNum': {
        const start = Number(await this._eval(node.start, env));
        const limit = Number(await this._eval(node.limit, env));
        const step  = node.step ? Number(await this._eval(node.step, env)) : 1;
        for (let i = start; step > 0 ? i <= limit : i >= limit; i += step) {
          this._steps++;
          if (this._steps > MAX_STEPS) throw new RuntimeError('Limite de iterações atingido');
          const lenv = new Environment(env);
          lenv.define(node.var, i);
          const r = await this._execBlock(node.body, lenv);
          if (r instanceof BreakSignal) break;
          if (r instanceof ReturnSignal) return r;
        }
        return null;
      }
      case 'Import': {
        // Antes: se o módulo (path) ou o nome importado não existisse, o
        // import virava um no-op silencioso — e só ia dar erro confuso lá
        // na frente, na hora de CHAMAR a função ("'addCoins' não é uma
        // função"), sem nenhuma pista de que o problema era o import.
        //
        // BUG do fix anterior: o ScriptRunner guarda os módulos no Map com
        // a chave NORMALIZADA (com barra: "/economia.logic"), mas aqui a
        // busca usava `node.source` cru (sem barra) — nunca batia, mesmo
        // com o módulo carregado corretamente. Normaliza aqui também.
        const source = node.source.startsWith('/') ? node.source : '/' + node.source;
        const mod = this.modules.get(source);
        if (!mod) {
          throw new RuntimeError(`Módulo '${node.source}' não encontrado (confira o path do arquivo importado)`, node.line);
        }
        if (node.default) {
          if (mod.__default === undefined)
            throw new RuntimeError(`'${node.source}' não tem export default`, node.line);
          env.define(node.default, mod.__default);
        }
        if (node.names) {
          for (const n of node.names) {
            if (mod[n] === undefined)
              throw new RuntimeError(`'${n}' não é exportado por '${node.source}'`, node.line);
            env.define(n, mod[n]);
          }
        }
        return null;
      }
      case 'OnEvent': return null; // tratado pelo ScriptRunner
      case 'ExprStmt': { await this._eval(node.expr, env); return null; }
      default: throw new RuntimeError(`Statement desconhecido: ${node.type}`, node.line);
    }
  }

  async _eval(node, env) {
    switch (node.type) {
      case 'Literal':    return node.value;
      case 'Identifier': return env.get(node.name) ?? null;
      case 'BinOp': {
        const L = await this._eval(node.left, env);
        if (node.op === 'and') return this._truthy(L) ? this._eval(node.right, env) : L;
        if (node.op === 'or')  return this._truthy(L) ? L : this._eval(node.right, env);
        const R = await this._eval(node.right, env);
        switch (node.op) {
          case '+':  return Number(L) + Number(R);
          case '-':  return Number(L) - Number(R);
          case '*':  return Number(L) * Number(R);
          case '/':  return R === 0 ? 0 : Number(L) / Number(R);
          case '%':  return Number(L) % Number(R);
          case '..': return this._str(L) + this._str(R);
          case '==': return L === R;
          case '!=': return L !== R;
          case '<':  return Number(L) < Number(R);
          case '>':  return Number(L) > Number(R);
          case '<=': return Number(L) <= Number(R);
          case '>=': return Number(L) >= Number(R);
          default:   throw new RuntimeError(`Operador desconhecido: ${node.op}`);
        }
      }
      case 'UnaryOp': {
        const val = await this._eval(node.operand, env);
        if (node.op === 'not') return !this._truthy(val);
        if (node.op === '-')   return -Number(val);
        break;
      }
      case 'ArrayLiteral': {
        const items = [];
        for (const el of node.elements) items.push(await this._eval(el, env));
        return items;
      }
      case 'ObjectLiteral': {
        const obj = {};
        for (const { key, value } of node.props) obj[await this._eval(key, env)] = await this._eval(value, env);
        return obj;
      }
      case 'MemberAccess': {
        const obj = await this._eval(node.object, env);
        if (obj == null) return null;
        return obj[node.prop] ?? null;
      }
      case 'IndexAccess': {
        const obj = await this._eval(node.object, env);
        const key = await this._eval(node.key, env);
        if (obj == null) return null;
        return obj[key] ?? null;
      }
      case 'FunctionCall': {
        const fn   = env.get(node.name);
        if (typeof fn !== 'function' && !(fn instanceof EmbedBuilder))
          throw new RuntimeError(`'${node.name}' não é uma função`, node.line);
        const args = [];
        for (const a of node.args) args.push(await this._eval(a, env));
        return this._callFn(fn, args, node.line);
      }
      case 'MethodCall': {
        const obj = await this._eval(node.object, env);
        if (obj == null) throw new RuntimeError(`Chamada de método em valor nulo`, node.line);
        const method = obj[node.method];
        if (typeof method !== 'function') throw new RuntimeError(`'${node.method}' não é um método`, node.line);
        const args = [];
        for (const a of node.args) args.push(await this._eval(a, env));
        return method.apply(obj, args);
      }
      case 'NewExpression': {
        // new EmbedBuilder()
        const cls = env.get(node.name);
        if (typeof cls !== 'function') throw new RuntimeError(`'${node.name}' não é uma classe`, node.line);
        const args = [];
        for (const a of node.args) args.push(await this._eval(a, env));
        return new cls(...args);
      }
      case 'FunctionExpr': return this._makeFunction(node.params, node.body, env);
      default: throw new RuntimeError(`Expressão desconhecida: ${node.type}`, node.line);
    }
  }

  async _callFn(fn, args, line) {
    if (typeof fn !== 'function') throw new RuntimeError('Não é uma função', line);
    this._depth++;
    if (this._depth > MAX_DEPTH) throw new RuntimeError('Limite de recursão atingido', line);
    try { return (await fn(...args)) ?? null; }
    finally { this._depth--; }
  }

  _makeFunction(params, body, closure) {
    const interp = this;
    return async function (...args) {
      const fnEnv = new Environment(closure);
      params.forEach((p, i) => fnEnv.define(p, args[i] ?? null));
      const r = await interp._execBlock(body, fnEnv);
      return r instanceof ReturnSignal ? r.value : null;
    };
  }

  _truthy(v) { return v !== false && v !== null && v !== undefined && v !== 0 && v !== ''; }
  _str(v) {
    if (v === null || v === undefined) return 'nil';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v instanceof EmbedBuilder) return '[EmbedBuilder]';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  /* ══════════════════════════════════════
     DISCORD OBJECTS
     ══════════════════════════════════════ */

  _buildMessageObj(msg) {
    if (!msg) return null;
    const self = this;
    return {
      id:      msg.id,
      content: msg.content,
      author:  msg.author,
      channel: msg.channel_id,

      edit: async (content, opts) => {
        const body = buildMessageBody(content, opts ?? {});
        return DiscordRequest(`/channels/${msg.channel_id}/messages/${msg.id}`, { method: 'PATCH', body });
      },
      delete: async () => DiscordRequest(`/channels/${msg.channel_id}/messages/${msg.id}`, { method: 'DELETE' }),
      reply:  async (content, opts) => {
        const body = buildMessageBody(content, opts ?? {});
        body.message_reference = { message_id: msg.id };
        const res = await DiscordRequest(`/channels/${msg.channel_id}/messages`, { method: 'POST', body }).catch(() => null);
        return res?.id ? self._buildMessageObj(res) : null;
      },
      react:  async emoji => DiscordRequest(`/channels/${msg.channel_id}/messages/${msg.id}/reactions/${encodeURIComponent(emoji)}/@me`, { method: 'PUT' }),
      pin:    async () => DiscordRequest(`/channels/${msg.channel_id}/pins/${msg.id}`, { method: 'PUT' }),
      unpin:  async () => DiscordRequest(`/channels/${msg.channel_id}/pins/${msg.id}`, { method: 'DELETE' }),
    };
  }

  async _buildUserObj(userId) {
    if (!userId) return null;
    const user   = await DiscordRequest(`/users/${userId}`).catch(() => null);
    const member = await DiscordRequest(`/guilds/${this.discordCtx.guildId}/members/${userId}`).catch(() => null);
    const self   = this;
    return {
      id:          userId,
      username:    user?.username,
      nickname:    member?.nick,
      avatar:      user?.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` : null,
      roles:       member?.roles ?? [],
      createdAt:   new Date(Number((BigInt(userId) >> 22n) + 1420070400000n)).toISOString(),
      joinedAt:    member?.joined_at,
      isBot:       user?.bot ?? false,
      permissions: member?.permissions,
      send:        async (c, o) => self._sendToChannel(`@dm:${userId}`, c, o),
      addRole:     async id => DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}/roles/${id}`, { method: 'PUT' }),
      removeRole:  async id => DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}/roles/${id}`, { method: 'DELETE' }),
      timeout:     async ms => DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}`, { method: 'PATCH', body: { communication_disabled_until: new Date(Date.now() + ms).toISOString() } }),
      removeTimeout: async () => DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}`, { method: 'PATCH', body: { communication_disabled_until: null } }),
      ban:         async reason => DiscordRequest(`/guilds/${self.discordCtx.guildId}/bans/${userId}`, { method: 'PUT', body: { reason } }),
      kick:        async () => DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}`, { method: 'DELETE' }),
    };
  }

  async _buildChannelObj(channelId) {
    if (!channelId) return null;
    const ch   = await DiscordRequest(`/channels/${channelId}`).catch(() => null);
    const self = this;
    return {
      id:       channelId,
      name:     ch?.name,
      type:     ch?.type,
      category: ch?.parent_id,
      send:     async (c, o) => self._sendToChannel(channelId, c, o),
      rename:   async name => DiscordRequest(`/channels/${channelId}`, { method: 'PATCH', body: { name } }),
      lock:     async () => DiscordRequest(`/channels/${channelId}`, { method: 'PATCH', body: { permission_overwrites: [{ id: self.discordCtx.guildId, type: 0, deny: '2048' }] } }),
      unlock:   async () => DiscordRequest(`/channels/${channelId}`, { method: 'PATCH', body: { permission_overwrites: [{ id: self.discordCtx.guildId, type: 0, allow: '2048' }] } }),
    };
  }

  async _buildGuildObj(guildId) {
    if (!guildId) return null;
    const guild = await DiscordRequest(`/guilds/${guildId}`).catch(() => null);
    return {
      id:          guildId,
      name:        guild?.name,
      memberCount: guild?.approximate_member_count ?? guild?.member_count,
      owner:       guild?.owner_id,
      roles:       guild?.roles?.map(r => r.id) ?? [],
      channels:    guild?.channels?.map(c => c.id) ?? [],
    };
  }

  _buildInteractionObj(interaction) {
    if (!interaction) return null;
    const self  = this;
    const token = interaction.token;
    const id    = interaction.id;
    const appId = this.client?.clientId ?? interaction.application_id;

    return {
      customId: interaction.data?.custom_id,
      values:   interaction.data?.values ?? [],
      userId:   interaction.member?.user?.id ?? interaction.user?.id,
      user:     async () => self._buildUserObj(interaction.member?.user?.id ?? interaction.user?.id),
      reply: async (content, opts = {}) => {
        const data = buildMessageBody(content, opts);
        return DiscordRequest(`/interactions/${id}/${token}/callback`, { method: 'POST', body: { type: 4, data } });
      },
      update: async (content, opts = {}) => {
        const data = buildMessageBody(content, opts);
        return DiscordRequest(`/interactions/${id}/${token}/callback`, { method: 'POST', body: { type: 7, data } });
      },
      defer:    async (ephemeral) => DiscordRequest(`/interactions/${id}/${token}/callback`, { method: 'POST', body: { type: 5, data: { flags: ephemeral ? 64 : 0 } } }),
      edit:     async (content, opts = {}) => {
        const body = buildMessageBody(content, opts);
        return DiscordRequest(`/webhooks/${appId}/${token}/messages/@original`, { method: 'PATCH', body });
      },
      followUp: async (content, opts = {}) => {
        const body = buildMessageBody(content, opts);
        return DiscordRequest(`/webhooks/${appId}/${token}`, { method: 'POST', body });
      },
    };
  }

  /* ══════════════════════════════════════
     UI BUILDERS
     ══════════════════════════════════════ */
  /**
   * Gera um custom_id "neutro" pra componentes que nunca foram ligados a
   * nada (nem setCustomId, nem onClick). Não é registrado em lugar nenhum
   * de propósito: clicar nele simplesmente não faz nada (Discord mostra
   * "essa interação falhou"), em vez de mentir dizendo que "expirou" como
   * acontecia antes.
   */
  _looseId(prefix) {
    return `ls_${prefix}_` + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Resolve o parâmetro `user` de onClick()/opts.user:
   *  - true      → restringe ao usuário que disparou o evento atual (ctx.userId)
   *  - string/obj → id explícito (ou objeto com .id)
   *  - undefined → sem restrição (qualquer um pode clicar)
   */
  _resolveInteractionOwner(user) {
    if (user === true) return this.discordCtx.userId ?? undefined;
    if (user && typeof user === 'object') return user.id ?? undefined;
    if (user === undefined || user === null) return undefined;
    return String(user);
  }

  _makeButton() {
    const data = { type: 2, style: 1, label: 'Botão', custom_id: this._looseId('btn') };
    const self = this;
    const obj  = {
      _type: 'button', _data: data,
      setLabel:    v => { data.label = String(v); return obj; },
      setStyle:    v => { const s = { Primary:1,Secondary:2,Success:3,Danger:4,Link:5,primary:1,secondary:2,success:3,danger:4,link:5 }; data.style = s[v] ?? Number(v) ?? 1; return obj; },

      /** Interação PERMANENTE: id fixo escolhido pelo autor do script.
       *  Nunca expira; é tratada por on(buttonClick)/on(selectMenu),
       *  comparando interaction.customId dentro do handler. Continua
       *  funcionando mesmo depois de a Ayami reiniciar. */
      setCustomId: v => { data.custom_id = String(v); return obj; },

      /** Interação TEMPORÁRIA: registra o botão de verdade no
       *  InteractionManager (mesmo cache com TTL usado pelo resto do bot).
       *  `fn` é chamada com o objeto de interação assim que o botão for
       *  clicado. Expira sozinha (padrão 10min) e some do cache.
       *  opts: { user: true|id, ttl: ms } */
      onClick: (fn, opts = {}) => {
        if (typeof fn !== 'function') {
          throw new RuntimeError('Button().onClick() espera uma função como argumento.');
        }
        if (!self.client?.interactions) {
          throw new RuntimeError('Interações temporárias indisponíveis (InteractionManager não carregado).');
        }
        const built = self.client.interactions.createButton({
          user:  self._resolveInteractionOwner(opts.user),
          tempo: opts.ttl ? Number(opts.ttl) : undefined,
          data:  { style: data.style, label: data.label },
          funcao: async (interaction) => { await fn(self._buildInteractionObj(interaction)); },
        });
        data.custom_id = built.custom_id;
        return obj;
      },

      setEmoji:    e => { data.emoji = typeof e === 'string' ? { name: e } : e; return obj; },
      setDisabled: v => { data.disabled = Boolean(v); return obj; },
      setURL:      v => { data.url = String(v); data.style = 5; delete data.custom_id; return obj; },
      // Legado
      label:    v => { data.label = String(v); return obj; },
      style:    v => obj.setStyle(v),
      customId: v => obj.setCustomId(v),
      emoji:    e => obj.setEmoji(e),
      disabled: v => { data.disabled = Boolean(v); return obj; },
    };
    return obj;
  }

  _makeSelectMenu() {
    const data = { type: 3, custom_id: this._looseId('menu'), options: [], placeholder: 'Selecione...' };
    const self = this;
    const obj  = {
      _type: 'selectmenu', _data: data,

      /** Interação PERMANENTE — ver Button().setCustomId(). */
      setCustomId: v => { data.custom_id = String(v); return obj; },

      /** Interação TEMPORÁRIA — ver Button().onClick(). `fn` recebe o
       *  objeto de interação (com .values contendo as opções escolhidas). */
      onClick: (fn, opts = {}) => {
        if (typeof fn !== 'function') {
          throw new RuntimeError('SelectMenu().onClick() espera uma função como argumento.');
        }
        if (!self.client?.interactions) {
          throw new RuntimeError('Interações temporárias indisponíveis (InteractionManager não carregado).');
        }
        const built = self.client.interactions.createSelect({
          user:  self._resolveInteractionOwner(opts.user),
          tempo: opts.ttl ? Number(opts.ttl) : undefined,
          data:  {
            placeholder: data.placeholder,
            min_values:  data.min_values,
            max_values:  data.max_values,
            options:     data.options,
          },
          funcao: async (interaction) => { await fn(self._buildInteractionObj(interaction)); },
        });
        data.custom_id = built.custom_id;
        return obj;
      },

      setPlaceholder: v => { data.placeholder = String(v); return obj; },
      setMinValues:   v => { data.min_values = Number(v); return obj; },
      setMaxValues:   v => { data.max_values = Number(v); return obj; },
      addOptions:     (...opts) => {
        const list = Array.isArray(opts[0]) ? opts[0] : opts;
        for (const o of list) data.options.push({ label: String(o.label), value: String(o.value), description: o.description, emoji: o.emoji ? (typeof o.emoji === 'string' ? { name: o.emoji } : o.emoji) : undefined });
        return obj;
      },
      // Legado
      customId:    v => obj.setCustomId(v),
      placeholder: v => obj.setPlaceholder(v),
      minValues:   v => obj.setMinValues(v),
      maxValues:   v => obj.setMaxValues(v),
      addOption:   (label, value, desc, emoji) => obj.addOptions({ label, value, description: desc, emoji }),
    };
    return obj;
  }

  /* ══════════════════════════════════════
     DATABASE
     ══════════════════════════════════════ */
  _buildDbObj() {
    const db      = this.db;
    const guildId = this.discordCtx.guildId;
    const noop    = async () => null;
    if (!db) return { set: noop, get: noop, has: async () => false, delete: noop, user: () => ({ set: noop, get: noop, add: noop, sub: noop, has: async () => false }), guild: () => ({ set: noop, get: noop }) };

    return {
      set:    (k, v) => db.setGlobal(guildId, k, v),
      get:    k      => db.getGlobal(guildId, k),
      has:    k      => db.hasGlobal(guildId, k),
      delete: k      => db.deleteGlobal(guildId, k),
      user: user => {
        const uid = typeof user === 'object' ? user?.id : String(user);
        return {
          set: (k, v) => db.setUser(guildId, uid, k, v),
          get: k      => db.getUser(guildId, uid, k),
          add: (k, a) => db.addUser(guildId, uid, k, Number(a)),
          sub: (k, a) => db.addUser(guildId, uid, k, -Number(a)),
          has: k      => db.hasUser(guildId, uid, k),
        };
      },
      guild: () => ({
        set: (k, v) => db.setGuild(guildId, k, v),
        get: k      => db.getGuild(guildId, k),
      }),
    };
  }
}

module.exports = { Interpreter, RuntimeError, ReturnSignal, EmbedBuilder, buildMessageBody };
