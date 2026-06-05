'use strict';

const { PersistentVarModel } = require('../../../Mongodb/flow.js');

class ExecutionContext {

  constructor({ flow, discordCtx, client }) {
    this.flow    = flow;
    this.discord = discordCtx;
    this.client  = client;

    this._vars       = new Map();
    this._userVars   = new Map();
    this._persistent = new Map();

    for (const v of flow.variables || []) {
      this._vars.set(v.name, v.defaultValue ?? null);
    }

    this.cancelled     = false;
    this.stopExecution = false;
    this.lastMessageId = null;
    this.lastChannelId = discordCtx.channelId || null;
  }

  async loadPersistent() {
    const { PersistentVarModel, UserVarModel } = require('../../../Mongodb/flow.js');
    const defs = this.flow.variables || [];

    // variáveis de fluxo persistentes
    const flowDefs = defs.filter(v => v.persistent && v.scope === 'flow');
    if (flowDefs.length) {
      const docs = await PersistentVarModel.find({
        guildId: this.discord.guildId,
        name:    { $in: flowDefs.map(v => v.name) }
      });
      for (const doc of docs) {
        this._persistent.set(doc.name, doc.value);
        this._vars.set(doc.name, doc.value);
      }
    }

    // variáveis de usuário
    const userDefs = defs.filter(v => v.scope === 'user');
    if (userDefs.length && this.discord.userId) {
      const docs = await UserVarModel.find({
        guildId: this.discord.guildId,
        userId:  this.discord.userId,
        name:    { $in: userDefs.map(v => v.name) }
      });
      for (const doc of docs) {
        this._userVars.set(doc.name, doc.value);
        this._vars.set(doc.name, doc.value);
      }
    }
  }

  async savePersistent() {
    const { PersistentVarModel, UserVarModel } = require('../../../Mongodb/flow.js');
    const defs = this.flow.variables || [];

    // salva variáveis de fluxo persistentes
    for (const def of defs.filter(v => v.persistent && v.scope === 'flow')) {
      const current = this._vars.get(def.name);
      if (current === this._persistent.get(def.name)) continue;
      await PersistentVarModel.findOneAndUpdate(
        { guildId: this.discord.guildId, name: def.name },
        { value: current, updatedAt: new Date() },
        { upsert: true }
      );
      this._persistent.set(def.name, current);
    }

    // salva variáveis de usuário
    if (!this.discord.userId) return;
    for (const def of defs.filter(v => v.scope === 'user')) {
      const current = this._vars.get(def.name);
      if (current === this._userVars.get(def.name)) continue;
      await UserVarModel.findOneAndUpdate(
        { guildId: this.discord.guildId, userId: this.discord.userId, name: def.name },
        { value: current, updatedAt: new Date() },
        { upsert: true }
      );
      this._userVars.set(def.name, current);
    }
  }

  getVar(name) {
    return this._vars.has(name) ? this._vars.get(name) : null;
  }

  setVar(name, value) {
    this._vars.set(name, value);
  }

  addVar(name, value) {
    const current = Number(this._vars.get(name)) || 0;
    this._vars.set(name, current + Number(value));
  }

  subVar(name, value) {
    const current = Number(this._vars.get(name)) || 0;
    this._vars.set(name, current - Number(value));
  }

  mulVar(name, value) {
    const current = Number(this._vars.get(name)) || 0;
    this._vars.set(name, current * Number(value));
  }

  divVar(name, value) {
    const current = Number(this._vars.get(name)) || 0;
    const divisor = Number(value);
    if (divisor === 0) return;
    this._vars.set(name, current / divisor);
  }

  randomVar(name, min, max) {
    const val = Math.floor(Math.random() * (max - min + 1)) + min;
    this._vars.set(name, val);
  }
  
  pushVar(name, value) {
  const current = this._vars.get(name);
  const list    = Array.isArray(current) ? current : [];
  list.push(value);
  this._vars.set(name, list);
}

removeVarItem(name, value) {
  const current = this._vars.get(name);
  if (!Array.isArray(current)) return;
  const idx = current.indexOf(value);
  if (idx !== -1) current.splice(idx, 1);
  this._vars.set(name, current);
}

removeVarIndex(name, index) {
  const current = this._vars.get(name);
  if (!Array.isArray(current)) return;
  current.splice(Number(index), 1);
  this._vars.set(name, current);
}

randomFromVar(name) {
  const current = this._vars.get(name);
  if (!Array.isArray(current) || !current.length) return null;
  return current[Math.floor(Math.random() * current.length)];
}

  _systemVars() {
    const d = this.discord;
    return {
      '{user}':         d.member?.user?.username || d.username || '',
      '{user_id}':      d.userId || '',
      '{user_mention}': d.userId ? `<@${d.userId}>` : '',
      '{guild}':        d.guildName || d.guildId || '',
      '{guild_id}':     d.guildId || '',
      '{channel}':      d.channelName ? `#${d.channelName}` : (d.channelId ? `<#${d.channelId}>` : ''),
      '{channel_id}':   d.channelId || '',
      '{message}':      d.message?.content || '',
      '{message_id}':   d.message?.id || '',
      '{role}':         d.role?.name || '',
      '{role_id}':      d.role?.id || '',
      '{count}':        String(d.customData?.count || 0),
      '{timestamp}':    String(Date.now()),
      '{date}':         new Date().toLocaleDateString('pt-BR'),
      '{time}':         new Date().toLocaleTimeString('pt-BR'),
      '{aleatorio}': '',
      '{args}':  d.customData?.args?.join(' ') || '',
      '{arg0}':  d.customData?.args?.[0]       || '',
      '{arg1}':  d.customData?.args?.[1]       || '',
      '{arg2}':  d.customData?.args?.[2]       || '',
      '{arg3}':  d.customData?.args?.[3]       || '',
      '{arg4}':  d.customData?.args?.[4]       || '',
    };
  }

  async interpolate(template) {
  if (typeof template !== 'string') return template;

  const sysVars = this._systemVars();
  let result = template;

  // 1. resolve variáveis de sistema ({user_id}, {arg0}, etc.)
  for (const [key, value] of Object.entries(sysVars)) {
    result = result.replaceAll(key, value ?? '');
  }

  // 2. coleta todas as referências {var:nome:qualquercoisa} para buscar no banco
  const userVarMatches = [];
  result.replace(/\{var:([^:}]+):([^}]*)\}/g, (_, name, rawPart) => {
    // ignora :aleatorio e índices numéricos puros
    if (rawPart === 'aleatorio' || /^\d+$/.test(rawPart)) return;

    // extrai ID de menção <@123> ou <@!123>
    const mentionMatch = rawPart.match(/^<@!?(\d{17,20})>$/);
    let userId = mentionMatch ? mentionMatch[1] : rawPart.trim();

    // se vazio ou inválido, usa o authorId de quem disparou
    if (!userId || !/^\d{17,20}$/.test(userId)) {
      userId = this.discord.userId || '';
    }

    if (/^\d{17,20}$/.test(userId)) {
      userVarMatches.push({ name, rawPart, userId });
    }
  });

  // busca todas no banco em paralelo
  if (userVarMatches.length) {
    const { UserVarModel } = require('../../../Mongodb/flow.js');
    const results = await Promise.all(
      userVarMatches.map(({ name, userId }) =>
        UserVarModel.findOne({ guildId: this.discord.guildId, userId, name }).lean()
      )
    );
    userVarMatches.forEach(({ name, rawPart }, idx) => {
      const value = results[idx]?.value !== undefined ? String(results[idx].value) : '';
      result = result.replaceAll(`{var:${name}:${rawPart}}`, value);
    });
  }

  // 3. resolve {var:...} restantes (locais, user, persistent)
  result = result.replace(/\{var:([^}]+)\}/g, (_, expr) => {

    // {var:nome:aleatorio} — aleatório de lista
    if (expr.endsWith(':aleatorio')) {
      const name = expr.slice(0, -10);
      const val  = this._vars.get(name) ?? this._userVars.get(name) ?? this._persistent.get(name);
      if (Array.isArray(val) && val.length) return String(val[Math.floor(Math.random() * val.length)]);
      return '';
    }

    // {var:nome:N} — índice específico da lista
    const parts = expr.split(':');
    if (parts.length === 2 && !isNaN(parts[1])) {
      const name  = parts[0];
      const index = Number(parts[1]);
      const val   = this._vars.get(name) ?? this._userVars.get(name) ?? this._persistent.get(name);
      if (Array.isArray(val)) return String(val[index] ?? '');
      return '';
    }

    // {var:nome} — valor normal
    const val = this._vars.get(expr) ?? this._userVars.get(expr) ?? this._persistent.get(expr);
    return val !== null && val !== undefined ? String(val) : '';
  });

  // 4. {aleatorio:a,b,c}
  result = result.replace(/\{aleatorio:([^}]+)\}/g, (_, content) => {
    const options = content.split(',').map(v => v.trim()).filter(Boolean);
    if (!options.length) return '';
    return options[Math.floor(Math.random() * options.length)];
  });

  // 5. {aleatorio:MIN-MAX}
  result = result.replace(/\{aleatorio:(\d+)-(\d+)\}/g, (_, min, max) => {
    const n = Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min);
    return String(n);
  });

  return result;
}

  async interpolateParams(params) {
    if (typeof params === 'string') return this.interpolate(params);
    if (typeof params !== 'object' || params === null) return params;
    if (Array.isArray(params)) return params.map(v => this.interpolateParams(v));

    const result = {};
    for (const [key, value] of Object.entries(params)) {
      result[key] = await this.interpolateParams(value);
    }
    return result;
  }

  cancel() {
    this.cancelled     = true;
    this.stopExecution = true;
  }

  stop() {
    this.stopExecution = true;
  }

  shouldStop() {
    return this.stopExecution || this.cancelled;
  }
}

module.exports = ExecutionContext;