'use strict';

/* ═══════════════════════════════════════════
   LOGIC SCRIPT — INTERPRETER v2
   Mudanças:
   - Sistema de comandos via PREFIXO (não slash)
   - EmbedBuilder estilo discord.js (new EmbedBuilder())
   - Embeds em sendMessage, reply, followUp, etc.
   - Contexto de prefixo injetado automaticamente
   - (novo) schedule()/cancelSchedule()/listSchedules() —
     agendamento persistido via TaskManager (delay, "1h", "HH:MM",
     com ou sem recorrência)
   - (novo) cooldown()/cooldownRestante() — usando db.user() já existente
   ═══════════════════════════════════════════ */

const DiscordRequest = require('../../DiscordRequest.js');
const msLib          = require('ms');
const TaskModel       = require('../../../Mongodb/tarefas.js');
const { safeRequest, SafeHttpError } = require('../../Utils/SafeHttp.js');
const PremiumManager  = require('../../Utils/PremiumManager.js');
const { getPlan }     = require('../../Utils/PremiumPlans.js');

/**
 * Aceita tanto um ID puro (`"123456789012345678"`) quanto uma menção
 * do Discord (`<#id>` canal, `<@&id>` cargo, `<@id>`/`<@!id>` usuário)
 * e sempre devolve só o ID numérico como string.
 *
 * Existe porque o autocomplete do editor (#canal, @cargo, dentro de
 * strings) insere a menção pronta — sem isso, quem copia/cola o
 * resultado do autocomplete em getChannel()/addRole()/etc. receberia
 * um ID "sujo" que a API do Discord rejeitaria.
 */
function extractId(raw) {
  if (raw == null) return raw;
  const s = String(raw).trim();
  const m = /^<(?:#|@[!&]?)(\d+)>$/.exec(s);
  return m ? m[1] : s;
}

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
  if (opts.components !== undefined || opts.component !== undefined) {
    body.components = resolveComponents(opts.components ?? opts.component);
  }

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

    // Contador de requisições HTTP desta execução (compartilhado entre
    // todas as chamadas de http()/webhook() deste run — ver SafeHttp.js)
    this._httpRequestCounter = { count: 0 };

    // Cache do plano premium da guild (resolvido uma vez por execução,
    // sob demanda — só quando algo que depende de plano é chamado).
    this._planCache = null;

    this._globals   = new Environment();
    this._setupGlobals();
  }

  /* ══════════════════════════════════════
     PREMIUM / LOGS
     ══════════════════════════════════════ */

  /** Resolve (e cacheia por execução) o plano premium da guild atual. */
  async _getGuildPlan() {
    if (this._planCache) return this._planCache;
    const guildId = this.discordCtx.guildId;
    let planId = null;
    try {
      const premium = await PremiumManager.getGuildPremium(guildId);
      if (premium.status) planId = premium.planId;
    } catch { /* sem premium ativo — segue com FREE */ }
    this._planCache = getPlan(planId);
    return this._planCache;
  }

  /**
   * Lança um RuntimeError amigável se a guild não tiver o recurso do plano.
   * `planLabel` é o plano mínimo exibido na mensagem — por padrão 🌙 Lua
   * Crescente (recursos httpAccess/webhookAccess/canRunFlowById), mas
   * recursos liberados num patamar mais baixo (ex: premiumEvents, a
   * partir do 🌟 Nova Estrela) devem passar o próprio label.
   */
  async _requireLogicScriptFeature(feature, friendlyName, planLabel = '🌙 Lua Crescente') {
    const plan = await this._getGuildPlan();
    if (!plan.logicScript?.[feature]) {
      throw new RuntimeError(
        `${friendlyName} é um recurso Premium (a partir do plano ${planLabel}). ` +
        `Plano atual do servidor: ${plan.emoji} ${plan.name}. Veja /premium para assinar.`
      );
    }
    return plan;
  }

  /**
   * Registra uma ação no log da execução (mostrado no dashboard/`/logic script`).
   * Só deve ser chamado para operações que de fato mudam algo ou saem pra
   * rede (mensagem enviada/editada/apagada, ban/kick/timeout, cargo,
   * canal, requisição HTTP não-GET, webhook) — NUNCA para leituras de
   * cache (getUser/getChannel/getGuild/etc.), que não batem na API do
   * Discord e não precisam de log (ver seção "Logs do Logic Script").
   */
  _logAction(tag, text) {
    const line = `[${tag}] ${text}`;
    this._printLog.push(line);
    if (this._printLog.length > 200) this._printLog.shift();
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

    /* ── Agendamento (schedule) ──
       Reaproveita o TaskManager que já existe (mesma infra de lembrete,
       birthday_check, etc) — persiste no Mongo, sobrevive a restart. */
    G.define('schedule', async (tempo, channel, texto, opts = {}) => {
      if (!this.client?.taskManager) {
        throw new RuntimeError('Agendamento indisponível (TaskManager não carregado).');
      }

      const chId = typeof channel === 'object' ? channel?.id : extractId(String(channel ?? ctx.channelId));
      const parsed = this._parseTime(tempo);
      const recorrente = !!opts?.recorrente;

      const dados = { guildId: ctx.guildId, channelId: chId, texto: this._str(texto) };
      let repeat = false, repeatDelay = null;

      if (recorrente) {
        repeat = true;
        if (parsed.clockTime) {
          // "todo dia às HH:MM" — se autogerencia dentro do TaskManager,
          // recalculando pra amanhã no mesmo horário a cada execução
          // (ver case 'logicscript_message' no TaskManager.js).
          dados.dailyAt = parsed.clockTime;
        } else {
          // "a cada X" — usa o mecanismo genérico de repeat/repeatDelay
          // que o TaskManager já aplica pra qualquer tipo de task.
          repeatDelay = parsed.delayMs;
        }
      }

      const task = await this.client.taskManager.create({
        tipo:  'logicscript_message',
        delay: parsed.delayMs,
        dados,
        repeat,
        repeatDelay,
      });

      return task.taskId;
    });

    G.define('cancelSchedule', async jobId => {
      if (!this.client?.taskManager) return false;
      return this.client.taskManager.cancel(String(jobId));
    });

    G.define('listSchedules', async () => {
      const tasks = await TaskModel.find({
        tipo:   'logicscript_message',
        'dados.guildId': ctx.guildId,
        status: 'pending',
      }).lean();

      return tasks.map(t => ({
        id:         t.taskId,
        channelId:  t.dados?.channelId,
        texto:      t.dados?.texto,
        executeAt:  t.executeAt?.getTime?.() ?? null,
        recorrente: !!t.repeat,
      }));
    });

    /* ── Cooldown (por usuário, por guild) ──
       Usa o mesmo db.user() de baixo nível — não precisa de collection
       nova, guarda o timestamp de expiração como mais uma chave do usuário. */
    G.define('cooldown', async (chave, tempo) => {
      if (!this.db) return true; // sem banco configurado, nunca bloqueia
      const { delayMs } = this._parseTime(tempo);
      const key = `_cooldown_${chave}`;
      const expiraEm = await this.db.getUser(ctx.guildId, ctx.userId, key);
      const now = Date.now();
      if (expiraEm && now < Number(expiraEm)) return false;
      await this.db.setUser(ctx.guildId, ctx.userId, key, now + delayMs);
      return true;
    });

    G.define('cooldownRestante', async (chave) => {
      if (!this.db) return 0;
      const key = `_cooldown_${chave}`;
      const expiraEm = await this.db.getUser(ctx.guildId, ctx.userId, key);
      if (!expiraEm) return 0;
      const restante = Number(expiraEm) - Date.now();
      return restante > 0 ? restante : 0;
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

    /* ── Modal ── */
    G.define('Modal', () => this._makeModal());

    /* ── Objetos Discord ── */
    G.define('getUser',        async () => this._buildUserObj(ctx.userId));
    G.define('getChannel',     async (id) => this._buildChannelObj(extractId(id) ?? ctx.channelId));
    G.define('getGuild',       async () => this._buildGuildObj(ctx.guildId));
    G.define('getInteraction', () => this._buildInteractionObj(ctx.interaction));
    G.define('getMessage',     () => this._buildMessageObj(ctx.message));

    /* ── sendMessage ── */
    G.define('sendMessage', async (channel, content, opts) => {
      const chId = typeof channel === 'object' ? channel?.id : extractId(String(channel ?? ctx.channelId));
      return this._sendToChannel(chId, content, opts);
    });

    /* ── sendDM ── */
    G.define('sendDM', async (user, content, opts) => {
      const uid = typeof user === 'object' ? user?.id : extractId(String(user));
      const dm  = await DiscordRequest('/users/@me/channels', { method: 'POST', body: { recipient_id: uid } }).catch(() => null);
      if (!dm?.id) return null;
      return this._sendToChannel(dm.id, content, opts);
    });

    /* ── HTTP (GET/POST/PUT/PATCH/DELETE) ──
       Premium: bloqueado no 🌟 Nova Estrela, liberado a partir do
       🌙 Lua Crescente. Sempre passa pelo SafeHttp (rate limit, timeout,
       limite de tamanho, bloqueio de localhost/IP privado, limite de
       requisições por execução). */
    const httpMethod = (method) => async (url, a, b) => {
      await this._requireLogicScriptFeature('httpAccess', 'Requisições HTTP');

      // get(url, opts) vs post/put/patch(url, body, opts)
      const hasBody = !['GET', 'HEAD', 'DELETE'].includes(method);
      const body    = hasBody ? a : undefined;
      const opts    = hasBody ? (b ?? {}) : (a ?? {});

      if (method !== 'GET' && method !== 'HEAD') {
        this._logAction('HTTP', `${method} ${url}`);
      }

      try {
        const res = await safeRequest(url, {
          method,
          headers: opts.headers,
          body,
          guildId: this.discordCtx.guildId,
          requestCounter: this._httpRequestCounter,
        });
        return { ok: res.ok, status: res.status, headers: res.headers, body: res.json ?? res.text, json: res.json, text: res.text };
      } catch (err) {
        if (err instanceof SafeHttpError) throw new RuntimeError(err.message);
        throw new RuntimeError(`Falha na requisição HTTP: ${err.message}`);
      }
    };

    G.define('http', {
      get:    httpMethod('GET'),
      post:   httpMethod('POST'),
      put:    httpMethod('PUT'),
      patch:  httpMethod('PATCH'),
      delete: httpMethod('DELETE'),
    });

    /* ── Webhook ──
       Premium: bloqueado no 🌟 Nova Estrela, liberado (personalizado)
       a partir do 🌙 Lua Crescente. */
    G.define('webhook', {
      send: async (url, content, opts = {}) => {
        await this._requireLogicScriptFeature('webhookAccess', 'Webhooks');
        this._logAction('WEBHOOK', `POST ${url}`);

        const body = { username: opts.username, avatar_url: opts.avatarUrl };
        if (content) body.content = String(content);
        if (opts.embed) { const e = resolveEmbed(opts.embed); if (e) body.embeds = [e]; }

        try {
          const res = await safeRequest(url, {
            method: 'POST',
            body,
            guildId: this.discordCtx.guildId,
            requestCounter: this._httpRequestCounter,
          });
          return { ok: res.ok, status: res.status };
        } catch (err) {
          if (err instanceof SafeHttpError) throw new RuntimeError(err.message);
          throw new RuntimeError(`Falha ao enviar webhook: ${err.message}`);
        }
      },
    });

    /* ── Executar Fluxo do Logic Builder por ID ──
       Premium: bloqueado no 🌟 Nova Estrela, liberado a partir do
       🌙 Lua Crescente. Usa o mesmo mecanismo interno do LogicEngine
       (client.logicEngine), compartilhando o contexto atual (guild/canal/
       usuário) com o fluxo executado. */
    G.define('runFlow', async (flowId) => {
      await this._requireLogicScriptFeature('canRunFlowById', 'Executar Fluxo do Logic Builder');

      if (!flowId) throw new RuntimeError('runFlow() precisa do ID do fluxo.');
      if (!this.client?.logicEngine) {
        throw new RuntimeError('Logic Builder indisponível no momento.');
      }

      this._logAction('RUN_FLOW', `flowId=${flowId}`);

      const result = await this.client.logicEngine.runFlowById(String(flowId), {
        guildId:   this.discordCtx.guildId,
        channelId: this.discordCtx.channelId,
        userId:    this.discordCtx.userId,
      }).catch(err => ({ ok: false, error: err.message }));

      if (!result || result.ok === false) {
        throw new RuntimeError(`Não foi possível executar o fluxo '${flowId}': ${result?.error ?? 'fluxo não encontrado'}`);
      }

      return { ok: true };
    });

    /* ── abrirTicket ──
       Premium: bloqueado no 🌑 Gratuito, liberado a partir do 🌟 Nova
       Estrela — mesmo patamar dos eventos ticketUpdate/activitySpike
       (flag `logicScript.premiumEvents`). Abre um ticket de um painel
       já configurado em /painel sem precisar de clique em botão —
       pensado pra scripts abrirem ticket automaticamente (ex: após um
       comando, uma condição, ou em resposta a outro evento). */
    G.define('abrirTicket', async (panelId, userId) => {
      await this._requireLogicScriptFeature('premiumEvents', 'abrirTicket()', '🌟 Nova Estrela');

      if (!panelId) throw new RuntimeError('abrirTicket() precisa do ID do painel.');
      if (!this.client?.ticketSystem) {
        throw new RuntimeError('Sistema de Tickets indisponível no momento.');
      }

      const targetUserId = extractId(userId) ?? this.discordCtx.userId;
      if (!targetUserId) {
        throw new RuntimeError('abrirTicket() precisa de um usuário (não foi possível identificar quem abre o ticket).');
      }

      this._logAction('OPEN_TICKET', `panel=${panelId} user=${targetUserId}`);

      const result = await this.client.ticketSystem
        .createTicketFromScript(this.discordCtx.guildId, String(panelId), { userId: targetUserId })
        .catch(err => { throw new RuntimeError(`abrirTicket(): ${err.message}`); });

      return { id: result.channelId, channelId: result.channelId, panelId: result.panelId };
    });

    /* ── Banco de dados ── */
    G.define('db', this._buildDbObj());
  }

  /* ══════════════════════════════════════
     PARSER DE TEMPO — número (ms), duração ("1h"/"30m"/"10s"/"2d")
     ou horário fixo ("10:20"). Usado por schedule()/cooldown().
     ══════════════════════════════════════ */
  _parseTime(tempo) {
    if (typeof tempo === 'number') return { delayMs: tempo, clockTime: null };

    const s = String(tempo).trim();

    // Formato "HH:MM" — horário fixo do dia
    const clockMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
    if (clockMatch) {
      const hour   = Number(clockMatch[1]);
      const minute = Number(clockMatch[2]);
      const delayMs = this.client?.taskManager
        ? this.client.taskManager._msAteHorario(hour, minute)
        : (() => {
            const now = new Date();
            const alvo = new Date();
            alvo.setHours(hour, minute, 0, 0);
            if (alvo <= now) alvo.setDate(alvo.getDate() + 1);
            return alvo - now;
          })();
      return { delayMs, clockTime: { hour, minute } };
    }

    // Formato de duração ("1h", "30m", "10s", "2d") via lib `ms`
    const parsedMs = msLib(s);
    if (typeof parsedMs !== 'number' || Number.isNaN(parsedMs)) {
      throw new RuntimeError(`Formato de tempo inválido: '${tempo}' (use ms, "1h"/"30m"/"10s" ou "HH:MM")`);
    }
    return { delayMs: parsedMs, clockTime: null };
  }

  /* ══════════════════════════════════════
     ENVIO DE MENSAGEM (centralizado)
     ══════════════════════════════════════ */
  async _sendToChannel(channelId, content, opts = {}) {
    channelId = extractId(channelId);
    if (!channelId) return null;

    // Segurança: canal deve pertencer à guild
    try {
      const ch = await DiscordRequest(`/channels/${channelId}`);
      if (ch?.guild_id && ch.guild_id !== this.discordCtx.guildId) return null;
    } catch { return null; }

    this._logAction('MSG_SEND', `channel=${channelId}`);

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
        self._logAction('MSG_EDIT', `channel=${msg.channel_id} message=${msg.id}`);
        return DiscordRequest(`/channels/${msg.channel_id}/messages/${msg.id}`, { method: 'PATCH', body });
      },
      delete: async () => {
        self._logAction('MSG_DELETE', `channel=${msg.channel_id} message=${msg.id}`);
        return DiscordRequest(`/channels/${msg.channel_id}/messages/${msg.id}`, { method: 'DELETE' });
      },
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
    userId = extractId(userId);
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
      // Antes: chamava _sendToChannel("@dm:"+userId), um "canal" que não
      // existe pra API do Discord — user.send() nunca funcionava (sempre
      // retornava null em silêncio). Corrigido pra abrir o DM primeiro,
      // igual o global sendDM() já fazia corretamente.
      send:        async (c, o) => {
        const dm = await DiscordRequest('/users/@me/channels', { method: 'POST', body: { recipient_id: userId } }).catch(() => null);
        if (!dm?.id) return null;
        this._logAction('DM_SEND', `user=${userId}`);
        const body = buildMessageBody(c, o ?? {});
        const msg  = await DiscordRequest(`/channels/${dm.id}/messages`, { method: 'POST', body }).catch(() => null);
        return msg?.id ? this._buildMessageObj(msg) : null;
      },
      addRole:     async id => { self._logAction('ROLE_ADD', `user=${userId} role=${extractId(id)}`); return DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}/roles/${extractId(id)}`, { method: 'PUT' }); },
      removeRole:  async id => { self._logAction('ROLE_REMOVE', `user=${userId} role=${extractId(id)}`); return DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}/roles/${extractId(id)}`, { method: 'DELETE' }); },
      timeout:     async ms => { self._logAction('TIMEOUT', `user=${userId} ms=${ms}`); return DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}`, { method: 'PATCH', body: { communication_disabled_until: new Date(Date.now() + ms).toISOString() } }); },
      removeTimeout: async () => { self._logAction('TIMEOUT_REMOVE', `user=${userId}`); return DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}`, { method: 'PATCH', body: { communication_disabled_until: null } }); },
      ban:         async reason => { self._logAction('BAN', `user=${userId} reason=${reason ?? ''}`); return DiscordRequest(`/guilds/${self.discordCtx.guildId}/bans/${userId}`, { method: 'PUT', body: { reason } }); },
      kick:        async () => { self._logAction('KICK', `user=${userId}`); return DiscordRequest(`/guilds/${self.discordCtx.guildId}/members/${userId}`, { method: 'DELETE' }); },
    };
  }

  async _buildChannelObj(channelId) {
    channelId = extractId(channelId);
    if (!channelId) return null;
    const ch   = await DiscordRequest(`/channels/${channelId}`).catch(() => null);
    const self = this;
    return {
      id:       channelId,
      name:     ch?.name,
      type:     ch?.type,
      category: ch?.parent_id,
      send:     async (c, o) => self._sendToChannel(channelId, c, o),
      rename:   async name => { self._logAction('CHANNEL_RENAME', `channel=${channelId} name=${name}`); return DiscordRequest(`/channels/${channelId}`, { method: 'PATCH', body: { name } }); },
      lock:     async () => { self._logAction('CHANNEL_LOCK', `channel=${channelId}`); return DiscordRequest(`/channels/${channelId}`, { method: 'PATCH', body: { permission_overwrites: [{ id: self.discordCtx.guildId, type: 0, deny: '2048' }] } }); },
      unlock:   async () => { self._logAction('CHANNEL_UNLOCK', `channel=${channelId}`); return DiscordRequest(`/channels/${channelId}`, { method: 'PATCH', body: { permission_overwrites: [{ id: self.discordCtx.guildId, type: 0, allow: '2048' }] } }); },
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
        interaction._lsResponded = true;
        return DiscordRequest(`/interactions/${id}/${token}/callback`, { method: 'POST', body: { type: 4, data } });
      },
      update: async (content, opts = {}) => {
        const data = buildMessageBody(content, opts);
        interaction._lsResponded = true;
        return DiscordRequest(`/interactions/${id}/${token}/callback`, { method: 'POST', body: { type: 7, data } });
      },
      defer:    async (ephemeral) => {
        interaction._lsResponded = true;
        return DiscordRequest(`/interactions/${id}/${token}/callback`, { method: 'POST', body: { type: 5, data: { flags: ephemeral ? 64 : 0 } } });
      },
      /**
       * Abre um Modal (formulário popup) em resposta a essa interação.
       * `modal` é o objeto retornado por Modal()...onSubmit(fn) — precisa
       * ter passado por onSubmit() antes, senão não tem handler nenhum
       * registrado pra tratar o envio.
       *
       * Limitação do Discord: só funciona em resposta a uma interação já
       * existente (buttonClick, selectMenu) — não dá pra abrir modal a
       * partir de on(command), que é baseado em mensagem comum, sem
       * token de interação.
       */
      showModal: async (modal) => {
        if (!modal?._data?.custom_id) {
          throw new RuntimeError('showModal() precisa de um Modal() que já passou por .onSubmit(fn).');
        }
        if (!self.client?.interactions) {
          throw new RuntimeError('Modais indisponíveis (InteractionManager não carregado).');
        }
        interaction._lsResponded = true;
        return self.client.interactions.showModal(interaction, {
          custom_id:  modal._data.custom_id,
          title:      modal._data.title,
          components: modal._data.components,
        });
      },
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

  /**
   * Modal (formulário popup). Só pode ser aberto via
   * `interaction.showModal(modal)` — dentro de on(buttonClick)/on(selectMenu)
   * — nunca a partir de on(command), que não tem interação de verdade por
   * trás (é só uma mensagem comum).
   */
  _makeModal() {
    const data = { title: 'Formulário', components: [] };
    const self = this;
    const obj  = {
      _type: 'modal', _data: data,

      setTitle: v => { data.title = String(v).slice(0, 45); return obj; },

      /**
       * Adiciona um campo de texto.
       * opts: { style: 'short'|'long', placeholder, required, minLength, maxLength, value }
       * `style: 'short'` (padrão) é uma linha; `'long'` é um parágrafo.
       */
      addTextInput: (customId, label, opts = {}) => {
        const STYLE = { short: 1, long: 2 };
        data.components.push({
          type: 1,
          components: [{
            type:        4,
            custom_id:   String(customId),
            label:       String(label).slice(0, 45),
            style:       STYLE[opts.style] ?? 1,
            placeholder: opts.placeholder ? String(opts.placeholder).slice(0, 100) : undefined,
            required:    opts.required ?? true,
            min_length:  opts.minLength !== undefined ? Number(opts.minLength) : undefined,
            max_length:  opts.maxLength !== undefined ? Number(opts.maxLength) : undefined,
            value:       opts.value !== undefined ? String(opts.value) : undefined,
          }],
        });
        return obj;
      },

      /**
       * Registra quem trata o envio do formulário (mesmo InteractionManager
       * usado por Button/SelectMenu — cache com TTL, expira sozinho).
       * `fn(interaction, fields)` — `fields` é um objeto com o valor de
       * cada campo, indexado pelo customId dado em addTextInput().
       * opts: { user: true|id, ttl: ms }
       */
      onSubmit: (fn, opts = {}) => {
        if (typeof fn !== 'function') {
          throw new RuntimeError('Modal().onSubmit() espera uma função como argumento.');
        }
        if (!data.components.length) {
          throw new RuntimeError('Modal() precisa de pelo menos um addTextInput() antes de onSubmit().');
        }
        if (!self.client?.interactions) {
          throw new RuntimeError('Modais indisponíveis (InteractionManager não carregado).');
        }
        const built = self.client.interactions.createModal({
          user:       self._resolveInteractionOwner(opts.user),
          tempo:      opts.ttl ? Number(opts.ttl) : undefined,
          title:      data.title,
          components: data.components,
          funcao: async (interaction, client, fields) => {
            await fn(self._buildInteractionObj(interaction), fields);
          },
        });
        data.custom_id = built.custom_id;
        return obj; // segue sendo o "modal pronto" pra interaction.showModal(modal)
      },
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
