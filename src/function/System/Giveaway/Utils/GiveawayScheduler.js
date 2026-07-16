'use strict';

const GiveawayDb   = require('../../../../Mongodb/giveaway.js');
const GiveawayDraw = require('./GiveawayDraw.js');
const GiveawayEmbed = require('./GiveawayEmbed.js');
const DiscordRequest = require('../../../DiscordRequest.js');

/**
 * GiveawayScheduler
 *
 * Gerencia o encerramento automático de sorteios.
 *
 * Estratégia:
 *  - Ao iniciar o bot, recarrega todos os sorteios ativos do banco
 *  - Agenda um setTimeout para cada um baseado no tempo restante
 *  - Ao criar um sorteio, registrar via GiveawayScheduler.schedule()
 *  - Ao pausar/editar tempo, reagendar via reschedule()
 */
class GiveawayScheduler {

  constructor(client) {
    this.client  = client;
    this._timers = new Map(); // giveawayId → NodeJS.Timeout
  }

  /* ─────────────────────────────────────────
     BOOT — recarregar sorteios ativos
  ───────────────────────────────────────── */

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

  /* ─────────────────────────────────────────
     AGENDAR
  ───────────────────────────────────────── */

  /**
   * @param {object} doc  Documento lean ou Mongoose
   */
  schedule(doc) {

    this.cancel(doc.giveawayId); // limpar timer anterior se existir

    const remaining = new Date(doc.endsAt).getTime() - Date.now();

    if (remaining <= 0) {
      // Já deveria ter encerrado
      setImmediate(() => this._end(doc.giveawayId));
      return;
    }

    const timer = setTimeout(() => this._end(doc.giveawayId), remaining);

    // Node.js: impede que o timer sozinho mantenha o processo vivo
    if (timer.unref) timer.unref();

    this._timers.set(doc.giveawayId, timer);

    console.log(
      `[GiveawayScheduler] Agendado: ${doc.giveawayId} → ` +
      `encerra em ${Math.ceil(remaining / 1000)}s`
    );
  }

  /**
   * Recarregar timer após edição de tempo ou reabrir.
   */
  async reschedule(giveawayId) {

    const doc = await GiveawayDb.findOne({ giveawayId }).lean();
    if (!doc || doc.status !== 'active') return;

    this.schedule(doc);
  }

  /**
   * Cancelar timer (ao pausar ou encerrar manualmente).
   */
  cancel(giveawayId) {

    const timer = this._timers.get(giveawayId);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(giveawayId);
    }
  }

  /* ─────────────────────────────────────────
     ENCERRAMENTO AUTOMÁTICO
  ───────────────────────────────────────── */

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

    // Executar sorteio
    const result = await GiveawayDraw.draw(doc, this.client);
    await doc.save();

    // Enviar resultado no canal
    await this._sendResult(doc, result);

    // Multi-servidor
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

    // Mensagem de resultado
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

    // Atualizar mensagem original
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
