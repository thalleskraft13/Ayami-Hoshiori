'use strict';

const { PersistentVarModel } = require('../../../Mongodb/flow.js');
const DiscordRequest = require('../../DiscordRequest.js');

class ExecutionContext {

  constructor({ flow, discordCtx, client }) {
    this.flow    = flow;
    this.discord = discordCtx;
    this.client  = client;

    this._vars       = new Map();
    this._userVars   = new Map();
    this._persistent = new Map();

    this._guildData   = null;
    this._userData    = null;
    this._memberData  = null;
    this._channelData = null;

    for (const v of flow.variables || []) {
      this._vars.set(v.name, v.defaultValue ?? null);
    }

    this.cancelled     = false;
    this.stopExecution = false;
    this.lastMessageId = null;
    this.lastChannelId = discordCtx.channelId || null;
  }

  async _fetchGuild() {
    if (this._guildData !== null) return this._guildData;
    if (!this.discord.guildId) return null;
    this._guildData = await DiscordRequest(`/guilds/${this.discord.guildId}`).catch(() => null);
    return this._guildData;
  }

  async _fetchUser() {
    if (this._userData !== null) return this._userData;
    if (!this.discord.userId) return null;
    this._userData = await DiscordRequest(`/users/${this.discord.userId}`).catch(() => null);
    return this._userData;
  }

  async _fetchMember() {
    if (this._memberData !== null) return this._memberData;
    if (!this.discord.guildId || !this.discord.userId) return null;
    this._memberData = await DiscordRequest(
      `/guilds/${this.discord.guildId}/members/${this.discord.userId}`
    ).catch(() => null);
    return this._memberData;
  }

  async _fetchChannel() {
    if (this._channelData !== null) return this._channelData;
    if (!this.discord.channelId) return null;
    this._channelData = await DiscordRequest(`/channels/${this.discord.channelId}`).catch(() => null);
    return this._channelData;
  }

  _avatarUrl(userId, avatarHash, discriminator = '0') {
    if (!avatarHash) {
      const idx = discriminator && discriminator !== '0'
        ? Number(discriminator) % 5
        : Number((BigInt(userId || '0') >> 22n) % 6n);
      return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
    }
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=1024`;
  }

  _guildIconUrl(guildId, iconHash) {
    if (!iconHash) return null;
    const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=1024`;
  }

  _guildBannerUrl(guildId, bannerHash) {
    if (!bannerHash) return null;
    return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.png?size=1024`;
  }

  async loadPersistent() {
    const { PersistentVarModel, UserVarModel } = require('../../../Mongodb/flow.js');
    const defs = this.flow.variables || [];

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

  resolveTargetUserId(rawTargetUserId) {
    let id = (rawTargetUserId ?? '').toString().trim();
    const mentionMatch = id.match(/^<@!?(\d{17,20})>$/);
    if (mentionMatch) id = mentionMatch[1];
    if (!/^\d{17,20}$/.test(id)) id = this.discord.userId || '';
    return id;
  }

  async withTargetVar(name, rawTargetUserId, mutate) {
    const targetUserId = this.resolveTargetUserId(rawTargetUserId);
    const varDef = (this.flow.variables || []).find(v => v.name === name);
    const isUserScope = varDef?.scope === 'user';
    const isOtherUser = isUserScope && targetUserId && targetUserId !== this.discord.userId;

    if (!isOtherUser) {
      const current = this._vars.has(name) ? this._vars.get(name) : (varDef?.defaultValue ?? null);
      const updated = mutate(current);
      this._vars.set(name, updated);
      return updated;
    }

    const { UserVarModel } = require('../../../Mongodb/flow.js');
    const guildId = this.discord.guildId;

    const doc = await UserVarModel.findOne({ guildId, userId: targetUserId, name }).lean();
    const current = doc?.value !== undefined ? doc.value : (varDef?.defaultValue ?? null);
    const updated = mutate(current);

    await UserVarModel.findOneAndUpdate(
      { guildId, userId: targetUserId, name },
      { value: updated, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    return updated;
  }

  async _systemVars() {
    const d = this.discord;

    const [guild, user, member, channel] = await Promise.all([
      this._fetchGuild(),
      this._fetchUser(),
      this._fetchMember(),
      this._fetchChannel(),
    ]);

    const username      = user?.username || d.member?.user?.username || d.username || '';
    const discriminator = user?.discriminator || '0';
    const globalName    = user?.global_name || username;
    const nickname       = member?.nick || globalName;
    const userAvatarHash = member?.avatar || user?.avatar || d.member?.user?.avatar || null;
    const userAvatarUrl  = this._avatarUrl(d.userId, userAvatarHash, discriminator);

    const guildName   = guild?.name || d.guildName || d.guildId || '';
    const guildIcon    = this._guildIconUrl(d.guildId, guild?.icon);
    const guildBanner  = this._guildBannerUrl(d.guildId, guild?.banner);
    const memberCount  = guild?.approximate_member_count ?? guild?.member_count ?? '';
    const boostTier    = guild?.premium_tier ?? '';
    const boostCount   = guild?.premium_subscription_count ?? '';
    const ownerId      = guild?.owner_id || '';

    const channelName  = channel?.name || d.channelName || '';
    const channelTopic = channel?.topic || '';

    return {
      '{user}':              username,
      '{user_id}':           d.userId || '',
      '{user_mention}':      d.userId ? `<@${d.userId}>` : '',
      '{user_tag}':          discriminator !== '0' ? `${username}#${discriminator}` : username,
      '{user_global_name}':  globalName,
      '{user_nickname}':     nickname,
      '{user_avatar}':       userAvatarUrl,
      '{user_created_at}':   d.userId ? new Date(Number((BigInt(d.userId) >> 22n) + 1420070400000n)).toLocaleDateString('pt-BR') : '',

      '{guild}':             guildName,
      '{guild_id}':          d.guildId || '',
      '{guild_icon}':        guildIcon || '',
      '{guild_banner}':      guildBanner || '',
      '{guild_members}':     String(memberCount),
      '{guild_boost_tier}':  String(boostTier),
      '{guild_boost_count}': String(boostCount),
      '{guild_owner_id}':    ownerId,

      '{channel}':           channelName ? `#${channelName}` : (d.channelId ? `<#${d.channelId}>` : ''),
      '{channel_id}':        d.channelId || '',
      '{channel_name}':      channelName,
      '{channel_topic}':     channelTopic,
      '{channel_mention}':   d.channelId ? `<#${d.channelId}>` : '',

      '{message}':           d.message?.content || '',
      '{message_id}':        d.message?.id || '',

      '{role}':               d.role?.name || '',
      '{role_id}':             d.role?.id || '',
      '{role_mention}':        d.role?.id ? `<@&${d.role.id}>` : '',

      '{count}':              String(d.customData?.count || 0),
      '{timestamp}':           String(Date.now()),
      '{date}':                new Date().toLocaleDateString('pt-BR'),
      '{time}':                new Date().toLocaleTimeString('pt-BR'),
      '{aleatorio}':           '',

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

  const sysVars = await this._systemVars();
  let result = template;

  for (const [key, value] of Object.entries(sysVars)) {
    result = result.replaceAll(key, value ?? '');
  }

  const userVarMatches = [];
  result.replace(/\{var:([^:}]+):([^}]*)\}/g, (_, name, rawPart) => {
    if (rawPart === 'aleatorio' || /^\d+$/.test(rawPart)) return;

    const mentionMatch = rawPart.match(/^<@!?(\d{17,20})>$/);
    let userId = mentionMatch ? mentionMatch[1] : rawPart.trim();

    if (!userId || !/^\d{17,20}$/.test(userId)) {
      userId = this.discord.userId || '';
    }

    if (/^\d{17,20}$/.test(userId)) {
      userVarMatches.push({ name, rawPart, userId });
    }
  });

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

  result = result.replace(/\{var:([^}]+)\}/g, (_, expr) => {

    if (expr.endsWith(':aleatorio')) {
      const name = expr.slice(0, -10);
      const val  = this._vars.get(name) ?? this._userVars.get(name) ?? this._persistent.get(name);
      if (Array.isArray(val) && val.length) return String(val[Math.floor(Math.random() * val.length)]);
      return '';
    }

    const parts = expr.split(':');
    if (parts.length === 2 && !isNaN(parts[1])) {
      const name  = parts[0];
      const index = Number(parts[1]);
      const val   = this._vars.get(name) ?? this._userVars.get(name) ?? this._persistent.get(name);
      if (Array.isArray(val)) return String(val[index] ?? '');
      return '';
    }

    const val = this._vars.get(expr) ?? this._userVars.get(expr) ?? this._persistent.get(expr);
    return val !== null && val !== undefined ? String(val) : '';
  });

  result = result.replace(/\{aleatorio:([^}]+)\}/g, (_, content) => {
    const options = content.split(',').map(v => v.trim()).filter(Boolean);
    if (!options.length) return '';
    return options[Math.floor(Math.random() * options.length)];
  });

  result = result.replace(/\{aleatorio:(\d+)-(\d+)\}/g, (_, min, max) => {
    const n = Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min);
    return String(n);
  });

  return result;
}

  async interpolateParams(params) {
    if (typeof params === 'string') return this.interpolate(params);
    if (typeof params !== 'object' || params === null) return params;
    if (Array.isArray(params)) return Promise.all(params.map(v => this.interpolateParams(v)));

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