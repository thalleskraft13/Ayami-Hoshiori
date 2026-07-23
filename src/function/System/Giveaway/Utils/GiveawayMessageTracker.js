'use strict';

const MessageStats = require('../../../../Mongodb/giveawayMessageStats.js');


class GiveawayMessageTracker {

  constructor() {
    this._buffer  = new Map(); 
    this._flushMs = 30_000;
    this._flushAt = 50;       

    setInterval(() => this._flush(), this._flushMs).unref();
  }


  onMessage(message) {

    if (message.author?.bot) return;
    if (!message.guild_id)   return;

    const key = `${message.author.id}:${message.guild_id}`;
    this._buffer.set(key, (this._buffer.get(key) || 0) + 1);

    if (this._buffer.get(key) >= this._flushAt) {
      this._flush();
    }
  }


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
      for (const [key, count] of snapshot) {
        this._buffer.set(key, (this._buffer.get(key) || 0) + count);
      }
    }
  }


  async getCount(userId, guildId) {

    const bufferCount = this._buffer.get(`${userId}:${guildId}`) || 0;

    const doc = await MessageStats.findOne({ userId, guildId }).lean();
    return (doc?.count || 0) + bufferCount;
  }


  async resetUser(userId, guildId) {
    this._buffer.delete(`${userId}:${guildId}`);
    await MessageStats.deleteOne({ userId, guildId });
  }


  async shutdown() {
    await this._flush();
  }
}

module.exports = { GiveawayMessageTracker, MessageStats };
