'use strict';

const House = require('../../../Mongodb/house.js');

class HouseConfigService {

  async getOrCreate(guildId) {
    let doc = await House.findOne({ guildId });
    if (!doc) doc = await House.create({ guildId });
    return doc;
  }

  async get(guildId) {
    return House.findOne({ guildId });
  }

  async setEnabled(guildId, enabled) {
    const doc = await this.getOrCreate(guildId);
    doc.enabled = enabled;
    await doc.save();
    return doc;
  }

  async updateReceptionRoles(guildId, { unregisteredRoleId, registeredRoleId }) {
    const doc = await this.getOrCreate(guildId);
    if (unregisteredRoleId !== undefined) doc.reception.unregisteredRoleId = unregisteredRoleId;
    if (registeredRoleId !== undefined) doc.reception.registeredRoleId = registeredRoleId;
    await doc.save();
    return doc;
  }

  async updateReceptionChannel(guildId, channelId) {
    const doc = await this.getOrCreate(guildId);
    doc.reception.channelId = channelId;
    await doc.save();
    return doc;
  }

  async updateLogChannel(guildId, channelId) {
    const doc = await this.getOrCreate(guildId);
    doc.reception.logChannelId = channelId || null;
    await doc.save();
    return doc;
  }

  async updateWelcomeMessage(guildId, { type, content, embed }) {
    const doc = await this.getOrCreate(guildId);
    if (type !== undefined) doc.reception.welcomeMessage.type = type;
    if (content !== undefined) doc.reception.welcomeMessage.content = content;
    if (embed !== undefined) doc.reception.welcomeMessage.embed = embed;
    doc.markModified('reception.welcomeMessage');
    await doc.save();
    return doc;
  }

  async updateCharacterSelection(guildId, { enabled, required, stepName, description }) {
    const doc = await this.getOrCreate(guildId);
    if (enabled !== undefined) doc.reception.characterSelection.enabled = enabled;
    if (required !== undefined) doc.reception.characterSelection.required = required;
    if (stepName !== undefined) doc.reception.characterSelection.stepName = stepName;
    if (description !== undefined) doc.reception.characterSelection.description = description;
    doc.markModified('reception.characterSelection');
    await doc.save();
    return doc;
  }

  async addStep(guildId, step) {
    const doc = await this.getOrCreate(guildId);
    doc.reception.steps.push(step);
    doc.markModified('reception.steps');
    await doc.save();
    return doc;
  }

  async removeStep(guildId, stepId) {
    const doc = await this.getOrCreate(guildId);
    doc.reception.steps = doc.reception.steps.filter(s => s.id !== stepId);
    doc.markModified('reception.steps');
    await doc.save();
    return doc;
  }

  async updateDecoration(guildId, { enabled, format, emojiEnabled }) {
    const doc = await this.getOrCreate(guildId);
    if (enabled !== undefined) doc.decoration.enabled = enabled;
    if (format !== undefined) doc.decoration.format = format;
    if (emojiEnabled !== undefined) doc.decoration.emojiEnabled = emojiEnabled;
    await doc.save();
    return doc;
  }

  async updateFinalMessage(guildId, { type, content, embed }) {
    const doc = await this.getOrCreate(guildId);
    if (type !== undefined) doc.reception.finalMessage.type = type;
    if (content !== undefined) doc.reception.finalMessage.content = content;
    if (embed !== undefined) doc.reception.finalMessage.embed = embed;
    doc.markModified('reception.finalMessage');
    await doc.save();
    return doc;
  }

  async addDecorationFormat(guildId, format) {
    const doc = await this.getOrCreate(guildId);
    const list = doc.decoration.formats ?? [];
    if (!format || list.length >= 25) return { ok: false, doc };

    list.push(format);
    doc.decoration.formats = list;
    doc.markModified('decoration.formats');
    await doc.save();
    return { ok: true, doc };
  }

  async removeDecorationFormat(guildId, index) {
    const doc = await this.getOrCreate(guildId);
    const list = doc.decoration.formats ?? [];
    if (index >= 0 && index < list.length) list.splice(index, 1);
    doc.decoration.formats = list;
    doc.markModified('decoration.formats');
    await doc.save();
    return doc;
  }

  async updateCallChannel(guildId, channelId) {
    const doc = await this.getOrCreate(guildId);
    doc.call.channelId = channelId;
    await doc.save();
    return doc;
  }

  async updateCallNotifyRole(guildId, roleId) {
    const doc = await this.getOrCreate(guildId);
    doc.call.notifyRoleId = roleId || null;
    await doc.save();
    return doc;
  }

  async updateCallLogChannel(guildId, channelId) {
    const doc = await this.getOrCreate(guildId);
    doc.call.logChannelId = channelId || null;
    await doc.save();
    return doc;
  }

  async updateCallSchedule(guildId, { enabled, hour, minute } = {}) {
    const doc = await this.getOrCreate(guildId);
    if (enabled !== undefined) doc.call.schedule.enabled = enabled;
    if (hour !== undefined)    doc.call.schedule.hour    = hour;
    if (minute !== undefined)  doc.call.schedule.minute  = minute;
    doc.markModified('call.schedule');
    await doc.save();
    return doc;
  }

  async updateCallInactivity(guildId, { enabled, days, punish } = {}) {
    const doc = await this.getOrCreate(guildId);
    if (enabled !== undefined) doc.call.inactivity.enabled = enabled;
    if (days !== undefined)    doc.call.inactivity.days    = days;
    if (punish !== undefined)  doc.call.inactivity.punish  = punish;
    doc.markModified('call.inactivity');
    await doc.save();
    return doc;
  }

  async updatePermissionRoles(guildId, level, roleIds) {
    const doc = await this.getOrCreate(guildId);
    if (!['admin', 'recepcionista', 'aprovador', 'visualizador'].includes(level)) return doc;
    doc.permissions[level] = roleIds;
    doc.markModified('permissions');
    await doc.save();
    return doc;
  }
}

module.exports = HouseConfigService;
