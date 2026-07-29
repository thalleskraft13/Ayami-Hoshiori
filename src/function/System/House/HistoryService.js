'use strict';

const HouseHistory = require('../../../Mongodb/houseHistory.js');

class HistoryService {

  async log(guildId, { action, userId = null, staffId = null, detail = null, result = 'sucesso' }) {
    return HouseHistory.create({ guildId, action, userId, staffId, detail, result });
  }

  async list(guildId, { limit = 10, skip = 0 } = {}) {
    return HouseHistory.find({ guildId }).sort({ at: -1 }).skip(skip).limit(limit);
  }

  async count(guildId) {
    return HouseHistory.countDocuments({ guildId });
  }
}

module.exports = HistoryService;
