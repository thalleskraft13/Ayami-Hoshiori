'use strict';

const DiscordRequest = require('../../function/DiscordRequest.js');
const { localeCtx }  = require('../../function/Utils/ctxLocale.js');

function cv2Text(content) {
  return { type: 10, content };
}

function cv2Container(blocks, opts = {}) {
  return { type: 17, accent_color: opts.accentColor ?? 0x7C8FFF, components: blocks };
}

function cv2Payload(blocks, opts = {}) {
  return { flags: (1 << 15) | (opts.ephemeral === false ? 0 : 64), components: [cv2Container(blocks, opts)] };
}

async function reply(interaction, blocks, opts = {}) {
  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: 'POST', body: { type: 4, data: cv2Payload(blocks, opts) },
  });
}

module.exports = {

  data: {
    name: 'house',
    description: 'Comandos do sistema Houses',
    name_localizations: { 'en-US': 'house', 'en-GB': 'house', 'es-ES': 'house' },
    description_localizations: {
      'en-US': 'Houses system commands',
      'en-GB': 'Houses system commands',
      'es-ES': 'Comandos del sistema Houses',
    },
    type: 1,
    options: [
      {
        name: 'chamada',
        name_localizations: { 'en-US': 'call', 'en-GB': 'call', 'es-ES': 'llamada' },
        description: 'Confirme sua presença na chamada atual da House',
        description_localizations: {
          'en-US': 'Confirm your presence in the current House roll call',
          'en-GB': 'Confirm your presence in the current House roll call',
          'es-ES': 'Confirma tu presencia en la llamada actual de la House',
        },
        type: 1,
      },
    ],
  },

  async execute(interaction, client) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const ctx     = localeCtx(interaction);

    if (!guildId) {
      return reply(interaction, [cv2Text(client.t('house.only_in_guild', ctx))], { accentColor: 0xED4245 });
    }

    const cfg = await client.houseSystem.config.get(guildId);
    if (!cfg?.enabled) {
      return reply(interaction, [cv2Text(client.t('house.chamada_desativada', ctx))], { accentColor: 0xED4245 });
    }

    const openCall = await client.houseSystem.call.getOpen(guildId);
    if (!openCall) {
      return reply(interaction, [cv2Text(client.t('house.chamada_sem_aberta', ctx))], { accentColor: 0xED4245 });
    }

    await client.houseSystem.call.confirmPresence(guildId, userId);
    await client.houseSystem.activity.registerPresence(guildId, userId);

    return reply(interaction, [cv2Text(client.t('house.call_presence_confirmed_toast', ctx))], { accentColor: 0x57F287 });
  },
};
