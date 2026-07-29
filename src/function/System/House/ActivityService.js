'use strict';

const HouseActivity = require('../../../Mongodb/houseActivity.js');

class ActivityService {

  async _getOrCreate(guildId, userId) {
    let doc = await HouseActivity.findOne({ guildId, userId });
    if (!doc) doc = await HouseActivity.create({ guildId, userId });
    return doc;
  }

  async get(guildId, userId) {
    return this._getOrCreate(guildId, userId);
  }

  async registerPresence(guildId, userId) {
    const doc = await this._getOrCreate(guildId, userId);
    doc.presenceCount += 1;
    doc.lastActivityAt = new Date();
    await doc.save();
    return doc;
  }

  async registerAbsence(guildId, userId) {
    const doc = await this._getOrCreate(guildId, userId);
    doc.absenceCount += 1;
    await doc.save();
    return doc;
  }

  async touch(guildId, userId) {
    const doc = await this._getOrCreate(guildId, userId);
    doc.lastActivityAt = new Date();
    await doc.save();
    return doc;
  }

  async top(guildId, { limit = 10 } = {}) {
    return HouseActivity.find({ guildId }).sort({ presenceCount: -1 }).limit(limit);
  }
}

module.exports = ActivityService;
