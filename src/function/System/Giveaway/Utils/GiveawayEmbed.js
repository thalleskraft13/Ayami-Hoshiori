'use strict';

const E = Object.freeze({
  feliz:    '<:ayamifeliz:1513904597649981561>',
  animada:  '<:ayamianimada:1513895694824378408>',
  festa:    '<:ayamifesta:1513895771676737746>',
  pensando: '<:ayamipensando:1513891183036989533>',
});

class GiveawayEmbed {

  static _t(client, key, extra = {}) {
    if (client?.t) return client.t(`sorteio.${key}`, extra);
    return key; 
  }


  static buildActive(doc, client) {

    const t = (key, extra) => this._t(client, key, extra);
    const endsTs    = Math.floor(doc.endsAt.getTime() / 1000);
    const totalPart = doc.participants.length;
    const isPaused  = doc.status === 'paused';

    const fields = [
      {
        name:   t('embed_field_ends'),
        value:  isPaused
          ? t('embed_ends_paused')
          : `<t:${endsTs}:R> (<t:${endsTs}:F>)`,
        inline: true,
      },
      {
        name:   t('embed_field_winners'),
        value:  String(doc.winners),
        inline: true,
      },
      {
        name:   t('embed_field_participants'),
        value:  String(totalPart),
        inline: true,
      },
    ];

    if (doc.bonusEntries?.length) {
      fields.push({
        name: t('embed_field_bonus'),
        value: doc.bonusEntries
          .map(b => `<@&${b.roleId}> → +${b.entries}`)
          .join('\n'),
      });
    }

    if (doc.requirements?.length) {
      fields.push({
        name: t('embed_field_reqs'),
        value: doc.requirements
          .map(r => `• ${this._reqLabel(r, client)}`)
          .join('\n')
          .slice(0, 1000),
      });
    }

    if (doc.customMessage) {
      fields.push({
        name:  t('embed_field_msg'),
        value: doc.customMessage.slice(0, 500),
      });
    }

    if (doc.isMultiServer) {
      fields.push({
        name:  t('embed_field_multi'),
        value: t('embed_multi_mode_line', {
          modo: doc.multiMode === 'global' ? t('embed_multi_mode_global') : t('embed_multi_mode_separate'),
          count: doc.multiServers.length + 1,
        }),
      });
    }

    return {
      title: `${E.animada} ${doc.prize}`,
      description:
        doc.description
          ? `${doc.description}\n\n${t('embed_join_hint')}`
          : t('embed_join_hint'),
      color:     doc.color ?? 0xFFB7C5,
      fields,
      footer:    { text: t('embed_footer_active', { id: doc.giveawayId, status: isPaused ? t('embed_footer_status_paused') : t('embed_footer_status_active') }) },
      timestamp: doc.endsAt.toISOString(),
      thumbnail: doc.thumbnail ? { url: doc.thumbnail } : undefined,
      image:     doc.banner    ? { url: doc.banner }    : undefined,
    };
  }


  static buildEnded(doc, result, client) {

    const t = (key, extra) => this._t(client, key, extra);

    const winnersMention = result.winners.length
      ? result.winners.map(w => `<@${w.userId}>`).join(', ')
      : t('embed_ended_no_winner');

    return {
      title:       `${E.festa} ${t('embed_ended_title', { prize: doc.prize })}`,
      description: t('embed_ended_desc', { winners: winnersMention }),
      color:       0x57F287,
      footer:      { text: t('embed_footer_active', { id: doc.giveawayId, status: t('embed_footer_status_ended') }) },
      timestamp:   doc.endedAt?.toISOString() ?? new Date().toISOString(),
    };
  }


  static buildEndReport(doc, result, client) {

    const t = (key, extra) => this._t(client, key, extra);

    const {
      winners,
      disqualified,
      wouldHaveWon,
      totalParticipants,
      disqualifiedCount,
    } = result;

    const winnerLines = winners.length
      ? winners.map(w => `🏆 <@${w.userId}>`).join('\n')
      : t('embed_report_no_winner');

    const fields = [
      {
        name:   t('embed_report_field_winners'),
        value:  winnerLines,
        inline: false,
      },
      {
        name:   t('embed_report_field_total'),
        value:  String(totalParticipants),
        inline: true,
      },
      {
        name:   t('embed_report_field_eligible'),
        value:  String(winners.length),
        inline: true,
      },
      {
        name:   t('embed_report_field_disq'),
        value:  String(disqualifiedCount),
        inline: true,
      },
    ];

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
        .slice(0, 10) 
        .join('\n');

      fields.push({
        name:  t('embed_report_history_field'),
        value: historyLines || '—',
      });
    }

    if (wouldHaveWon?.length) {
      const wouldLines = wouldHaveWon
        .map(w => `• <@${w.userId}> — ${w.reason || t('embed_would_no_reason')}`)
        .slice(0, 5)
        .join('\n');

      fields.push({
        name:  `${E.pensando} ${t('embed_report_would_have_won_field')}`,
        value: wouldLines,
      });
    }

    return {
      title:       `${E.festa} ${t('embed_report_title', { prize: doc.prize })}`,
      description: t('embed_report_desc', { festa: E.festa }),
      color:   0xFFB7C5,
      fields,
      footer:  { text: `ID: ${doc.giveawayId}` },
      timestamp: doc.endedAt?.toISOString() ?? new Date().toISOString(),
    };
  }


  static _reqLabel(req, client) {
    const t = (key, extra) => this._t(client, key, extra);
    const labels = {
      REQUIRED_ROLE:              t('embed_req_required_role'),
      FORBIDDEN_ROLE:             t('embed_req_forbidden_role'),
      MIN_MESSAGES:               t('embed_req_min_messages', { value: req.value }),
      MIN_DAYS_IN_SERVER:         t('embed_req_min_days_server', { value: req.value }),
      MIN_ACCOUNT_AGE:            t('embed_req_min_account_age', { value: req.value }),
      IN_SERVER:                  t('embed_req_in_server'),
      REQUIRED_ROLE_IN_SERVER:    t('embed_req_required_role_ext'),
      FORBIDDEN_ROLE_IN_SERVER:   t('embed_req_forbidden_role_ext'),
      MIN_DAYS_IN_EXT_SERVER:     t('embed_req_min_days_ext', { value: req.value }),
      MIN_MESSAGES_IN_EXT_SERVER: t('embed_req_min_msgs_ext', { value: req.value }),
      MIN_HOURS_IN_CALL:          t('embed_req_min_hours_call', { value: req.value }),
      MIN_LEVEL:                  t('embed_req_min_level', { value: req.value }),
      MIN_XP:                     t('embed_req_min_xp', { value: req.value }),
      HAS_BOOSTER_ROLE:           t('embed_req_booster'),
      HAS_SUPPORTER_ROLE:         t('embed_req_supporter'),
    };
    return labels[req.type] || req.type;
  }
}

module.exports = GiveawayEmbed;
