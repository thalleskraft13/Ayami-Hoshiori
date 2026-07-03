'use strict';

/* ═══════════════════════════════════════════
   LOGIC SCRIPT — DATABASE
   Banco de dados persistente por guild.
   Integrado ao MongoDB do bot via Mongoose.
   ═══════════════════════════════════════════ */

const { Schema, model } = require('mongoose');

/* ─── Schema ─── */
const lsVarSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  scope:   { type: String, enum: ['global', 'user', 'guild'], default: 'global' },
  ownerId: { type: String, default: null },  // userId para scope 'user'
  key:     { type: String, required: true },
  value:   { type: Schema.Types.Mixed, default: null },
  updatedAt: { type: Date, default: Date.now },
});
lsVarSchema.index({ guildId: 1, scope: 1, ownerId: 1, key: 1 }, { unique: true });

const LSVariable = model('LogicScriptVar', lsVarSchema);

/* ─── LogicScriptDB ─── */
class LogicScriptDB {

  /* ═══ GLOBAL ═══ */

  async setGlobal(guildId, key, value) {
    await LSVariable.findOneAndUpdate(
      { guildId, scope: 'global', ownerId: null, key },
      { value, updatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  async getGlobal(guildId, key) {
    const doc = await LSVariable.findOne({ guildId, scope: 'global', ownerId: null, key }).lean();
    return doc?.value ?? null;
  }

  async hasGlobal(guildId, key) {
    return !!(await LSVariable.exists({ guildId, scope: 'global', ownerId: null, key }));
  }

  async deleteGlobal(guildId, key) {
    await LSVariable.deleteOne({ guildId, scope: 'global', ownerId: null, key });
  }

  /* ═══ USER ═══ */

  async setUser(guildId, userId, key, value) {
    await LSVariable.findOneAndUpdate(
      { guildId, scope: 'user', ownerId: userId, key },
      { value, updatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  async getUser(guildId, userId, key) {
    const doc = await LSVariable.findOne({ guildId, scope: 'user', ownerId: userId, key }).lean();
    return doc?.value ?? null;
  }

  async hasUser(guildId, userId, key) {
    return !!(await LSVariable.exists({ guildId, scope: 'user', ownerId: userId, key }));
  }

  async addUser(guildId, userId, key, amount) {
    const current = (await this.getUser(guildId, userId, key)) ?? 0;
    const next    = Number(current) + amount;
    await this.setUser(guildId, userId, key, next);
    return next;
  }

  /* ═══ GUILD ═══ */

  async setGuild(guildId, key, value) {
    await LSVariable.findOneAndUpdate(
      { guildId, scope: 'guild', ownerId: null, key },
      { value, updatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  async getGuild(guildId, key) {
    const doc = await LSVariable.findOne({ guildId, scope: 'guild', ownerId: null, key }).lean();
    return doc?.value ?? null;
  }

  /* ═══ ADMIN ═══ */

  /** Lista todas as variáveis de uma guild (para o dashboard). */
  async listAll(guildId, opts = {}) {
    const query = { guildId };
    if (opts.scope) query.scope = opts.scope;
    if (opts.ownerId) query.ownerId = opts.ownerId;
    return LSVariable.find(query).lean();
  }

  /** Limpa todas as variáveis de uma guild (reset). */
  async clearGuild(guildId) {
    await LSVariable.deleteMany({ guildId });
  }

  /** Exclui uma variável específica por ID (admin do dashboard). */
  async deleteById(id) {
    await LSVariable.deleteOne({ _id: id });
  }
}

const db = new LogicScriptDB();
module.exports = { LogicScriptDB, LSVariable, db };
