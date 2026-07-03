'use strict';

const MessageStats = require('../../../../Mongodb/giveawayMessageStats.js');

/* ─────────────────────────────────────────
   TRACKER

   Registre no handler de MESSAGE_CREATE:

     client.giveaway.messageTracker.onMessage(message);

   O GiveawayRequirements.js já chama:

     client.giveaway.messageTracker.getCount(userId, guildId)
───────────────────────────────────────── */

class GiveawayMessageTracker {

  constructor() {
    // Buffer em memória para não bater no banco a cada mensagem
    // Flush a cada 30s ou a cada 50 msgs acumuladas por user/guild
    this._buffer  = new Map(); // `${userId}:${guildId}` → count
    this._flushMs = 30_000;
    this._flushAt = 50;       // flush se acumular 50 msgs de um user

    setInterval(() => this._flush(), this._flushMs).unref();
  }

  /* ─────────────────────────────────────────
     Chamado no evento MESSAGE_CREATE
  ───────────────────────────────────────── */

  onMessage(message) {

    // Ignora bots, DMs e mensagens sem guild
    if (message.author?.bot) return;
    if (!message.guild_id)   return;

    const key = `${message.author.id}:${message.guild_id}`;
    this._buffer.set(key, (this._buffer.get(key) || 0) + 1);

    // Flush antecipado se acumulou muito
    if (this._buffer.get(key) >= this._flushAt) {
      this._flush();
    }
  }

  /* ─────────────────────────────────────────
     Flush do buffer para o MongoDB
  ───────────────────────────────────────── */

  async _flush() {

    if (!this._buffer.size) return;

    const snapshot = new Map(this._buffer);
    this._buffer.clear();

    const ops = [];

    for (const [key, count] of snapshot) {
      const [userId, guildId] = key.split(':');
      ops.push({
        updateOne: {
          filter: { userId, guildId },
          update: {
            $inc: { count },
            $set: { updatedAt: new Date() },
          },
          upsert: true,
        }
      });
    }

    try {
      await MessageStats.bulkWrite(ops, { ordered: false });
    } catch (err) {
      console.error('[GiveawayMessageTracker] Erro no flush:', err);
      // Recoloca no buffer para não perder os dados
      for (const [key, count] of snapshot) {
        this._buffer.set(key, (this._buffer.get(key) || 0) + count);
      }
    }
  }

  /* ─────────────────────────────────────────
     Consultar contagem (usado pelo GiveawayRequirements)
  ───────────────────────────────────────── */

  async getCount(userId, guildId) {

    // Soma o que já está no banco + o que está no buffer ainda não flushed
    const bufferCount = this._buffer.get(`${userId}:${guildId}`) || 0;

    const doc = await MessageStats.findOne({ userId, guildId }).lean();
    return (doc?.count || 0) + bufferCount;
  }

  /* ─────────────────────────────────────────
     Resetar contagem de um usuário (opcional)
  ───────────────────────────────────────── */

  async resetUser(userId, guildId) {
    this._buffer.delete(`${userId}:${guildId}`);
    await MessageStats.deleteOne({ userId, guildId });
  }

  /* ─────────────────────────────────────────
     Flush manual (ao desligar o bot)
  ───────────────────────────────────────── */

  async shutdown() {
    await this._flush();
  }
}

module.exports = { GiveawayMessageTracker, MessageStats };
