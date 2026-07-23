'use strict';

const DiscordRequest       = require('../../../DiscordRequest.js');
const GiveawayRequirements = require('./GiveawayRequirements.js');

class GiveawayDraw {

  static async draw(doc, client, opts = {}) {

    const neededWinners = this._resolveNeededWinners(doc);
    const pool          = this._buildPool(doc, opts.reroll);

    const winners        = [];
    const disqualified   = [];
    const wouldHaveWon   = []; 
    const drawHistory    = [];

    let position = 0;

    while (winners.length < neededWinners && pool.length > 0) {

      position++;

      const idx        = Math.floor(Math.random() * pool.length);
      const participant = pool.splice(idx, 1)[0];

      const alreadyPicked =
        winners.find(w => w.userId === participant.userId) ||
        disqualified.find(d => d.userId === participant.userId);

      if (alreadyPicked) continue;

      const check = await GiveawayRequirements.verify(participant, doc, client);

      const entry = {
        position,
        userId: participant.userId,
        guildId: participant.guildId,
        status: check.ok ? 'winner' : 'disqualified',
        reason: check.ok ? null : check.reason,
      };

      drawHistory.push(entry);

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

        if (!wouldHaveWon.find(w => w.userId === participant.userId)) {
          wouldHaveWon.push(entry);
          if (docParticipant) docParticipant.status = 'would_have_won';
        }
      }

      if (docParticipant && check.ok) {
        docParticipant.drawPosition = position;
      }
    }

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


  static _buildPool(doc, reroll = false) {

    const pool = [];

    for (const p of doc.participants) {

      if (reroll && p.status === 'winner') continue;

      if (!['participating', 'disqualified', 'would_have_won'].includes(p.status)) continue;

      const slots = p.totalEntries ?? 1;

      for (let i = 0; i < slots; i++) {
        pool.push({
          userId:  p.userId,
          guildId: p.guildId,
        });
      }
    }

    for (let i = pool.length - 1; i > 0; i--) {
      const j        = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool;
  }

  static _resolveNeededWinners(doc) {
    if (!doc.isMultiServer || doc.multiMode === 'global') {
      return doc.winners;
    }

    return doc.multiServers.reduce((acc, s) => acc + (s.winners || 1), 0);
  }
}

module.exports = GiveawayDraw;
