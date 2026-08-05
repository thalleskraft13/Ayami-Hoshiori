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

async function replyContainers(interaction, containers, opts = {}) {
  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: 'POST',
    body: {
      type: 4,
      data: { flags: (1 << 15) | (opts.ephemeral === false ? 0 : 64), components: containers },
    },
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
      {
        name: 'iniciar',
        name_localizations: { 'en-US': 'start', 'en-GB': 'start', 'es-ES': 'iniciar' },
        description: 'Inicia uma chamada da House usando as configurações do painel',
        description_localizations: {
          'en-US': 'Starts a House roll call using the panel settings',
          'en-GB': 'Starts a House roll call using the panel settings',
          'es-ES': 'Inicia una llamada de House usando la configuración del panel',
        },
        type: 1,
      },
      {
        type: 2,
        name: 'personagens',
        name_localizations: { 'en-US': 'characters', 'en-GB': 'characters', 'es-ES': 'personajes' },
        description: 'Consulte os personagens da House',
        description_localizations: {
          'en-US': 'Look up House characters',
          'en-GB': 'Look up House characters',
          'es-ES': 'Consulta los personajes de la House',
        },
        options: [
          {
            type: 1,
            name: 'lista',
            name_localizations: { 'en-US': 'list', 'en-GB': 'list', 'es-ES': 'lista' },
            description: 'Lista os personagens cadastrados na House',
            description_localizations: {
              'en-US': 'Lists the characters registered in the House',
              'en-GB': 'Lists the characters registered in the House',
              'es-ES': 'Lista los personajes registrados en la House',
            },
            options: [
              {
                type: 4,
                name: 'pagina',
                name_localizations: { 'en-US': 'page', 'en-GB': 'page', 'es-ES': 'pagina' },
                description: 'Número da página (padrão: 1)',
                description_localizations: {
                  'en-US': 'Page number (default: 1)',
                  'en-GB': 'Page number (default: 1)',
                  'es-ES': 'Número de página (predeterminado: 1)',
                },
                required: false,
                min_value: 1,
              },
            ],
          },
          {
            type: 1,
            name: 'usuario',
            name_localizations: { 'en-US': 'user', 'en-GB': 'user', 'es-ES': 'usuario' },
            description: 'Mostra o personagem atribuído a um membro',
            description_localizations: {
              'en-US': "Shows a member's assigned character",
              'en-GB': "Shows a member's assigned character",
              'es-ES': 'Muestra el personaje asignado a un miembro',
            },
            options: [
              {
                type: 6,
                name: 'membro',
                name_localizations: { 'en-US': 'member', 'en-GB': 'member', 'es-ES': 'miembro' },
                description: 'O membro a consultar',
                description_localizations: {
                  'en-US': 'The member to look up',
                  'en-GB': 'The member to look up',
                  'es-ES': 'El miembro a consultar',
                },
                required: true,
              },
            ],
          },
        ],
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

    const primeiro = interaction.data.options?.[0];
    const isGrupo  = primeiro?.type === 2;
    const sub      = isGrupo ? primeiro.options?.[0]?.name : primeiro?.name;
    const opts     = isGrupo ? (primeiro.options?.[0]?.options ?? []) : (primeiro?.options ?? []);
    const getOpt   = (name) => opts.find(o => o.name === name)?.value;

    if (sub === 'chamada') return this._chamada(interaction, client, guildId, userId, ctx);
    if (sub === 'iniciar') return this._iniciar(interaction, client, guildId, userId, ctx);
    if (sub === 'lista')   return this._personagensLista(interaction, client, guildId, userId, ctx, getOpt('pagina'));
    if (sub === 'usuario') return this._personagensUsuario(interaction, client, guildId, userId, ctx, getOpt('membro'));

    return reply(interaction, [cv2Text(client.t('house.unexpected_error', ctx))], { accentColor: 0xED4245 });
  },

  async _chamada(interaction, client, guildId, userId, ctx) {
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

  async _iniciar(interaction, client, guildId, userId, ctx) {
    const cfg = await client.houseSystem.config.getOrCreate(guildId);
    if (!cfg?.enabled) {
      return reply(interaction, [cv2Text(client.t('house.chamada_desativada', ctx))], { accentColor: 0xED4245 });
    }

    const canManage = await client.houseSystem.permissions.hasAtLeast(guildId, userId, 'recepcionista', cfg);
    if (!canManage) {
      return reply(interaction, [cv2Text(client.t('house.chamada_sem_permissao', ctx))], { accentColor: 0xED4245 });
    }

    if (!cfg.call.channelId) {
      return reply(interaction, [cv2Text(client.t('house.call_channel_missing', ctx))], { accentColor: 0xED4245 });
    }

    const existing = await client.houseSystem.call.getOpen(guildId);
    if (existing) {
      return reply(interaction, [cv2Text(client.t('house.chamada_ja_aberta', ctx))], { accentColor: 0xED4245 });
    }

    const started = await client.houseSystem.callScheduler.startManualCall(guildId, userId, cfg);
    if (!started.ok) {
      return reply(interaction, [cv2Text(client.t('house.chamada_ja_aberta', ctx))], { accentColor: 0xED4245 });
    }

    return reply(interaction, [cv2Text(client.t('house.chamada_iniciada_msg', ctx))], { accentColor: 0x57F287 });
  },

  async _personagensLista(interaction, client, guildId, userId, ctx, paginaOpt) {
    const cfg = await client.houseSystem.config.getOrCreate(guildId);
    if (!cfg?.enabled) {
      return reply(interaction, [cv2Text(client.t('house.chamada_desativada', ctx))], { accentColor: 0xED4245 });
    }

    const canView = await client.houseSystem.permissions.hasAtLeast(guildId, userId, 'visualizador', cfg);
    if (!canView) {
      return reply(interaction, [cv2Text(client.t('house.no_permission_area', ctx))], { accentColor: 0xED4245 });
    }

    const pagina = Number.isInteger(paginaOpt) && paginaOpt > 0 ? paginaOpt : 1;
    const container = await client.houseSystem._personagensListaContainer(guildId, userId, pagina - 1, ctx);
    return replyContainers(interaction, [container]);
  },

  async _personagensUsuario(interaction, client, guildId, userId, ctx, membroId) {
    const cfg = await client.houseSystem.config.getOrCreate(guildId);
    if (!cfg?.enabled) {
      return reply(interaction, [cv2Text(client.t('house.chamada_desativada', ctx))], { accentColor: 0xED4245 });
    }

    const canView = await client.houseSystem.permissions.hasAtLeast(guildId, userId, 'visualizador', cfg);
    if (!canView) {
      return reply(interaction, [cv2Text(client.t('house.no_permission_area', ctx))], { accentColor: 0xED4245 });
    }

    const container = await client.houseSystem._characterUserContainer(guildId, membroId, ctx);
    return replyContainers(interaction, [container]);
  },
};
