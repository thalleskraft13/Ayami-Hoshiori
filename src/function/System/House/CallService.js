'use strict';

const HouseCall = require('../../../Mongodb/houseCall.js');

class CallService {

  async start(guildId, startedBy, channelId = null, durationMinutes = null) {
    const existing = await HouseCall.findOne({ guildId, status: 'aberta' });
    if (existing) return { ok: false, reason: 'chamada_em_andamento', call: existing };

    const closesAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60000) : null;
    const call = await HouseCall.create({ guildId, startedBy, channelId, closesAt });
    return { ok: true, call };
  }

  async getOpen(guildId) {
    return HouseCall.findOne({ guildId, status: 'aberta' });
  }

  async confirmPresence(guildId, userId) {
    const call = await this.getOpen(guildId);
    if (!call) return { ok: false, reason: 'sem_chamada_aberta' };

    if (!call.presentUserIds.includes(userId)) call.presentUserIds.push(userId);
    call.absentUserIds = call.absentUserIds.filter(id => id !== userId);
    await call.save();

    return { ok: true, call };
  }

  async registerAbsence(guildId, userId) {
    const call = await this.getOpen(guildId);
    if (!call) return { ok: false, reason: 'sem_chamada_aberta' };

    if (!call.absentUserIds.includes(userId)) call.absentUserIds.push(userId);
    call.presentUserIds = call.presentUserIds.filter(id => id !== userId);
    await call.save();

    return { ok: true, call };
  }

  async close(guildId) {
    const call = await this.getOpen(guildId);
    if (!call) return { ok: false, reason: 'sem_chamada_aberta' };

    call.status = 'encerrada';
    call.endedAt = new Date();
    await call.save();

    return { ok: true, call };
  }

  async closeAndSummarize(guildId, expectedUserIds = []) {
    const call = await this.getOpen(guildId);
    if (!call) return { ok: false, reason: 'sem_chamada_aberta' };

    const presentSet = new Set(call.presentUserIds);
    const absentSet  = new Set(expectedUserIds.filter(id => !presentSet.has(id)));

    call.absentUserIds = Array.from(absentSet);
    call.status  = 'encerrada';
    call.endedAt = new Date();
    await call.save();

    return { ok: true, call, stats: this.stats(call, expectedUserIds.length) };
  }

  async closeByTimeout(guildId, expectedUserIds = []) {
    const call = await this.getOpen(guildId);
    if (!call) return { ok: false, reason: 'sem_chamada_aberta' };

    const presentSet = new Set(call.presentUserIds);
    const absentSet  = new Set(expectedUserIds.filter(id => !presentSet.has(id)));

    call.absentUserIds = Array.from(absentSet);
    call.status  = 'encerrada';
    call.endedAt = new Date();
    call.autoClosed = true;
    await call.save();

    return { ok: true, call, stats: this.stats(call, expectedUserIds.length) };
  }

  stats(call, totalMembers = 0) {
    const present = call.presentUserIds?.length ?? 0;
    const absent  = call.absentUserIds?.length ?? 0;
    const total   = totalMembers > 0 ? totalMembers : (present + absent);
    const percent = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, percent };
  }

  async history(guildId, { limit = 10 } = {}) {
    return HouseCall.find({ guildId }).sort({ startedAt: -1 }).limit(limit);
  }
}

module.exports = CallService;
