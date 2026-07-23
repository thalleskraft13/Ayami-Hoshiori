'use strict';

const GiveawayDb   = require('../../../../Mongodb/giveaway.js');
const GiveawayDraw = require('./GiveawayDraw.js');
const GiveawayEmbed = require('./GiveawayEmbed.js');
const DiscordRequest = require('../../../DiscordRequest.js');

class GiveawayScheduler {

  constructor(client) {
    this.client  = client;
    this._timers = new Map(); 
  }


  async boot() {

    const actives = await GiveawayDb.find({
      status: 'active',
      endsAt: { $gt: new Date() },
    }).lean();

    let scheduled = 0;

    for (const doc of actives) {
      this.schedule(doc);
      scheduled++;
    }

    console.log(`[GiveawayScheduler] ${scheduled} sorteio(s) reagendado(s) no boot.`);
  }


  schedule(doc) {

    this.cancel(doc.giveawayId); 

    const remaining = new Date(doc.endsAt).getTime() - Date.now();

    if (remaining <= 0) {
      setImmediate(() => this._end(doc.giveawayId));
      return;
    }

    const timer = setTimeout(() => this._end(doc.giveawayId), remaining);

    if (timer.unref) timer.unref();

    this._timers.set(doc.giveawayId, timer);

    console.log(
      `[GiveawayScheduler] Agendado: ${doc.giveawayId} → ` +
      `encerra em ${Math.ceil(remaining / 1000)}s`
    );
  }

  async reschedule(giveawayId) {

    const doc = await GiveawayDb.findOne({ giveawayId }).lean();
    if (!doc || doc.status !== 'active') return;

    this.schedule(doc);
  }

  cancel(giveawayId) {

    const timer = this._timers.get(giveawayId);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(giveawayId);
    }
  }


  async _end(giveawayId) {

    this._timers.delete(giveawayId);

    const doc = await GiveawayDb.findOne({ giveawayId });

    if (!doc) {
      console.warn(`[GiveawayScheduler] Sorteio ${giveawayId} não encontrado.`);
      return;
    }

    if (doc.status !== 'active') {
      console.warn(`[GiveawayScheduler] Sorteio ${giveawayId} não está mais ativo (${doc.status}).`);
      return;
    }

    console.log(`[GiveawayScheduler] Encerrando: ${giveawayId}`);

    doc.status  = 'ended';
    doc.endedAt = new Date();
    await doc.save();

    const result = await GiveawayDraw.draw(doc, this.client);
    await doc.save();

    await this._sendResult(doc, result);

    if (doc.isMultiServer) {
      for (const server of doc.multiServers) {
        if (!server.channelId) continue;
        await this._sendResult(doc, result, server.channelId, server.messageId).catch(() => {});
      }
    }
  }

  async _sendResult(doc, result, channelId = null, messageId = null) {

    const ch  = channelId  ?? doc.channelId;
    const mid = messageId  ?? doc.messageId;

    const winnersMention = result.winners.length
      ? result.winners.map(w => `<@${w.userId}>`).join(' ')
      : this.client.t('sorteio.embed_ended_no_winner', {});

    await DiscordRequest(`/channels/${ch}/messages`, {
      method: 'POST',
      body:   {
        content: `🎉 ${winnersMention}`,
        embeds:  [GiveawayEmbed.buildEndReport(doc, result, this.client)],
      },
    }).catch(err => console.error('[GiveawayScheduler] Erro ao enviar resultado:', err));

    if (mid) {
      await DiscordRequest(`/channels/${ch}/messages/${mid}`, {
        method: 'PATCH',
        body:   {
          embeds:     [GiveawayEmbed.buildEnded(doc, result, this.client)],
          components: [],
        },
      }).catch(() => {});
    }
  }
}

module.exports = GiveawayScheduler;
