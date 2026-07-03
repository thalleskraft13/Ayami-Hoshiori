'use strict';

const E = Object.freeze({
  feliz:    '<:ayamifeliz:1513904597649981561>',
  animada:  '<:ayamianimada:1513895694824378408>',
  festa:    '<:ayamifesta:1513895771676737746>',
  pensando: '<:ayamipensando:1513891183036989533>',
});

/**
 * GiveawayEmbed
 *
 * Centraliza a construção de todas as embeds relacionadas a sorteios,
 * garantindo visual consistente e personalidade da Ayami.
 */
class GiveawayEmbed {

  /* ─────────────────────────────────────────
     SORTEIO ATIVO
  ───────────────────────────────────────── */

  static buildActive(doc) {

    const endsTs    = Math.floor(doc.endsAt.getTime() / 1000);
    const totalPart = doc.participants.length;
    const isPaused  = doc.status === 'paused';

    const fields = [
      {
        name:   '⏰ Encerramento',
        value:  isPaused
          ? `⏸ Pausado`
          : `<t:${endsTs}:R> (<t:${endsTs}:F>)`,
        inline: true,
      },
      {
        name:   '🏆 Vencedores',
        value:  String(doc.winners),
        inline: true,
      },
      {
        name:   '👥 Participantes',
        value:  String(totalPart),
        inline: true,
      },
    ];

    if (doc.bonusEntries?.length) {
      fields.push({
        name: '✨ Entradas Bônus',
        value: doc.bonusEntries
          .map(b => `<@&${b.roleId}> → +${b.entries}`)
          .join('\n'),
      });
    }

    if (doc.requirements?.length) {
      fields.push({
        name: '📋 Requisitos',
        value: doc.requirements
          .map(r => `• ${this._reqLabel(r)}`)
          .join('\n')
          .slice(0, 1000),
      });
    }

    if (doc.customMessage) {
      fields.push({
        name:  '📨 Mensagem',
        value: doc.customMessage.slice(0, 500),
      });
    }

    if (doc.isMultiServer) {
      fields.push({
        name:  '🌐 Multi-Servidor',
        value: `Modo: ${doc.multiMode === 'global' ? 'Global' : 'Separado'} • ${doc.multiServers.length + 1} servidor(es)`,
      });
    }

    return {
      title: `${E.animada} ${doc.prize}`,
      description:
        doc.description
          ? `${doc.description}\n\n` +
            `Clique no botão abaixo para participar!`
          : `Clique no botão abaixo para participar!`,
      color:     doc.color ?? 0xFFB7C5,
      fields,
      footer:    { text: `ID: ${doc.giveawayId} • ${isPaused ? '⏸ Pausado' : '🟢 Ativo'}` },
      timestamp: doc.endsAt.toISOString(),
      thumbnail: doc.thumbnail ? { url: doc.thumbnail } : undefined,
      image:     doc.banner    ? { url: doc.banner }    : undefined,
    };
  }

  /* ─────────────────────────────────────────
     SORTEIO ENCERRADO (mensagem original)
  ───────────────────────────────────────── */

  static buildEnded(doc, result) {

    const winnersMention = result.winners.length
      ? result.winners.map(w => `<@${w.userId}>`).join(', ')
      : 'Nenhum vencedor elegível.';

    return {
      title:       `${E.festa} ${doc.prize} — Encerrado!`,
      description: `**Vencedor(es):** ${winnersMention}`,
      color:       0x57F287,
      footer:      { text: `ID: ${doc.giveawayId} • 🔴 Encerrado` },
      timestamp:   doc.endedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /* ─────────────────────────────────────────
     RELATÓRIO DE ENCERRAMENTO
  ───────────────────────────────────────── */

  static buildEndReport(doc, result) {

    const {
      winners,
      disqualified,
      wouldHaveWon,
      totalParticipants,
      disqualifiedCount,
    } = result;

    const winnerLines = winners.length
      ? winners.map(w => `🏆 <@${w.userId}>`).join('\n')
      : 'Nenhum vencedor elegível encontrado.';

    const fields = [
      {
        name:   '🏆 Vencedores',
        value:  winnerLines,
        inline: false,
      },
      {
        name:   '👥 Total de participantes',
        value:  String(totalParticipants),
        inline: true,
      },
      {
        name:   '✅ Elegíveis',
        value:  String(winners.length),
        inline: true,
      },
      {
        name:   '❌ Desclassificados',
        value:  String(disqualifiedCount),
        inline: true,
      },
    ];

    // Histórico de sorteio
    if (result.drawHistory?.length) {
      const historyLines = result.drawHistory
        .map(h => {
          const icon = h.status === 'winner'
            ? '🏆'
            : h.status === 'would_have_won'
            ? `${E.pensando}`
            : '❌';
          return `\`#${h.position}\` ${icon} <@${h.userId}>${h.reason ? ` — ${h.reason}` : ''}`;
        })
        .slice(0, 10) // máx 10 linhas para não estourar o limite
        .join('\n');

      fields.push({
        name:  '📜 Histórico do Sorteio',
        value: historyLines || '—',
      });
    }

    // Quem teria vencido
    if (wouldHaveWon?.length) {
      const wouldLines = wouldHaveWon
        .map(w => `• <@${w.userId}> — ${w.reason || 'Sem motivo'}`)
        .slice(0, 5)
        .join('\n');

      fields.push({
        name:  `${E.pensando} Teriam Vencido (se elegíveis)`,
        value: wouldLines,
      });
    }

    return {
      title:       `${E.festa} Sorteio Encerrado! — ${doc.prize}`,
      description:
        `O sorteio foi encerrado!\n\n` +
        `Parabéns aos vencedores! ${E.festa}`,
      color:   0xFFB7C5,
      fields,
      footer:  { text: `ID: ${doc.giveawayId}` },
      timestamp: doc.endedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /* ─────────────────────────────────────────
     HELPER
  ───────────────────────────────────────── */

  static _reqLabel(req) {
    const labels = {
      REQUIRED_ROLE:             `Cargo obrigatório`,
      FORBIDDEN_ROLE:            `Sem cargo específico`,
      MIN_MESSAGES:              `Mínimo ${req.value} mensagem(s)`,
      MIN_DAYS_IN_SERVER:        `${req.value} dia(s) no servidor`,
      MIN_ACCOUNT_AGE:           `Conta com ${req.value}+ dia(s)`,
      IN_SERVER:                 `Estar no servidor parceiro`,
      REQUIRED_ROLE_IN_SERVER:   `Cargo em servidor externo`,
      FORBIDDEN_ROLE_IN_SERVER:  `Sem cargo em servidor externo`,
      MIN_DAYS_IN_EXT_SERVER:    `${req.value} dia(s) em servidor externo`,
      MIN_MESSAGES_IN_EXT_SERVER:`${req.value} msg em servidor externo`,
      MIN_HOURS_IN_CALL:         `${req.value}h em call`,
      MIN_LEVEL:                 `Nível ${req.value}+`,
      MIN_XP:                    `${req.value} XP+`,
      HAS_BOOSTER_ROLE:          `Cargo Booster`,
      HAS_SUPPORTER_ROLE:        `Cargo Apoiador`,
    };
    return labels[req.type] || req.type;
  }
}

module.exports = GiveawayEmbed;
