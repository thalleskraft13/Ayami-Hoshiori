'use strict';

const DiscordRequest       = require('../../../DiscordRequest.js');
const GiveawayRequirements = require('./GiveawayRequirements.js');

/**
 * GiveawayDraw
 *
 * Responsável por executar o sorteio, validar requisitos de cada
 * participante sorteado e registrar o histórico completo de forma
 * transparente.
 *
 * Fluxo:
 *  1. Montar pool ponderado (totalEntries por participante)
 *  2. Sortear aleatoriamente
 *  3. Verificar requisitos
 *  4. Se OK → vencedor; se não → desclassificado + reroll automático
 *  5. Repetir até encontrar vencedores suficientes ou esgotar o pool
 *  6. Retornar resultado completo
 */
class GiveawayDraw {

  /**
   * @param {object}  doc            Documento Mongoose do sorteio
   * @param {object}  client         Instância do cliente Discord
   * @param {object}  [opts]
   * @param {boolean} [opts.reroll]  Se true, reinicia o sorteio mantendo desclassificados
   */
  static async draw(doc, client, opts = {}) {

    const neededWinners = this._resolveNeededWinners(doc);
    const pool          = this._buildPool(doc, opts.reroll);

    const winners        = [];
    const disqualified   = [];
    const wouldHaveWon   = []; // desclassificados que teriam vencido
    const drawHistory    = [];

    let position = 0;

    while (winners.length < neededWinners && pool.length > 0) {

      position++;

      const idx        = Math.floor(Math.random() * pool.length);
      const participant = pool.splice(idx, 1)[0];

      // Evitar duplicados (pode ter múltiplas entradas)
      const alreadyPicked =
        winners.find(w => w.userId === participant.userId) ||
        disqualified.find(d => d.userId === participant.userId);

      if (alreadyPicked) continue;

      // Verificar requisitos
      const check = await GiveawayRequirements.verify(participant, doc, client);

      const entry = {
        position,
        userId: participant.userId,
        guildId: participant.guildId,
        status: check.ok ? 'winner' : 'disqualified',
        reason: check.ok ? null : check.reason,
      };

      drawHistory.push(entry);

      // Atualizar status no doc
      const docParticipant = doc.participants.find(
        p => p.userId === participant.userId && p.guildId === participant.guildId
      );

      if (check.ok) {
        winners.push(entry);
        if (docParticipant) docParticipant.status = 'winner';
      } else {
        disqualified.push(entry);
        if (docParticipant) {
          docParticipant.status           = 'disqualified';
          docParticipant.disqualifyReason = check.reason;
          docParticipant.drawPosition     = position;
        }

        // O primeiro desclassificado de cada posição vira "would_have_won"
        if (!wouldHaveWon.find(w => w.userId === participant.userId)) {
          wouldHaveWon.push(entry);
          if (docParticipant) docParticipant.status = 'would_have_won';
        }
      }

      if (docParticipant && check.ok) {
        docParticipant.drawPosition = position;
      }
    }

    // Persistir histórico no documento
    doc.drawHistory = drawHistory;

    return {
      winners,
      disqualified,
      wouldHaveWon,
      drawHistory,
      totalParticipants:  doc.participants.length,
      eligibleCount:      winners.length,
      disqualifiedCount:  disqualified.length,
    };
  }

  /* ─────────────────────────────────────────
     HELPERS INTERNOS
  ───────────────────────────────────────── */

  /**
   * Monta o pool de participantes ponderado por totalEntries.
   * Cada entrada do participante = 1 slot no pool.
   */
  static _buildPool(doc, reroll = false) {

    const pool = [];

    for (const p of doc.participants) {

      // Em reroll, excluir vencedores anteriores mas manter os demais
      if (reroll && p.status === 'winner') continue;

      // Participantes ativos ou que foram desclassificados entram no pool
      if (!['participating', 'disqualified', 'would_have_won'].includes(p.status)) continue;

      const slots = p.totalEntries ?? 1;

      for (let i = 0; i < slots; i++) {
        pool.push({
          userId:  p.userId,
          guildId: p.guildId,
        });
      }
    }

    // Fisher-Yates shuffle para aleatoriedade justa
    for (let i = pool.length - 1; i > 0; i--) {
      const j        = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool;
  }

  /**
   * Em sorteios multi-servidor com modo "separate",
   * cada servidor tem sua cota de vencedores.
   * Para simplificar, retornamos o total de vencedores globais aqui.
   * A lógica separada por servidor pode ser implementada iterando
   * por doc.multiServers e chamando draw() filtrado por guildId.
   */
  static _resolveNeededWinners(doc) {
    if (!doc.isMultiServer || doc.multiMode === 'global') {
      return doc.winners;
    }

    // Modo separado: soma de vencedores de cada servidor
    return doc.multiServers.reduce((acc, s) => acc + (s.winners || 1), 0);
  }
}

module.exports = GiveawayDraw;
