'use strict';

const DiscordRequest = require("../DiscordRequest.js");

const ALL_PERMISSIONS = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 1n << 41n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSIONS: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n
};

function bitfieldToArray(bitfield) {
  const perms = [];
  for (const [name, value] of Object.entries(ALL_PERMISSIONS)) {
    if ((bitfield & value) === value) {
      perms.push(name);
    }
  }
  return perms;
}

/**
 * Resolve as permissões efetivas de um membro (ou do bot) num servidor/canal.
 *
 *  Qiando um `client`
 * (DiscordGatewayClient) é passado, os dados são lidos via `client.guilds`
 * (GuildManager) — que já mantém cache em memória atualizado pelo gateway —
 * em vez de bater direto na API REST do Discord a cada chamada.
 *
 * Retrocompatível: se `client` não for passado, cai de volta pro
 * comportamento antigo (DiscordRequest puro), então nenhum call site quebra
 * enquanto a migração dos demais arquivos não é concluída.
 *
 * @param {object}  opts
 * @param {boolean} [opts.channel=false] Se true, também resolve overwrites do canal `id`.
 * @param {string}  opts.id              ID do usuário (ou do canal, se `channel`+`bot`).
 * @param {string}  opts.guildId         ID do servidor.
 * @param {boolean} [opts.bot=false]     Se true, resolve as permissões do próprio bot.
 * @param {import('../DiscordGatewayClient.js')} [opts.client] Instância do client (recomendado).
 */
async function getPerm({ channel = false, id, guildId, bot = false, client = null }) {

  const useCache = !!client?.guilds;

  const userId = bot
    ? (useCache ? client.clientId : (await DiscordRequest(`/users/@me`)).id)
    : id;

  const member = useCache
    ? await client.guilds.fetchMember(guildId, userId)
    : await DiscordRequest(`/guilds/${guildId}/members/${userId}`);

  const guild = useCache
    ? await client.guilds.fetch(guildId)
    : await DiscordRequest(`/guilds/${guildId}`);

  const ownerId = useCache ? guild.ownerId : guild.owner_id;
  if (ownerId === userId) {
    return Object.keys(ALL_PERMISSIONS);
  }

  const roles = useCache
    ? Array.from((await client.guilds.fetchRoles(guildId)).values()).map(r => ({ id: r.id, permissions: r.permissions }))
    : await DiscordRequest(`/guilds/${guildId}/roles`);

  const memberRoles = useCache ? member.roles : member.roles;

  let permissions = BigInt(
    roles.find(r => r.id === guildId).permissions
  );

  for (const roleId of memberRoles) {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      permissions |= BigInt(role.permissions);
    }
  }

  if ((permissions & ALL_PERMISSIONS.ADMINISTRATOR) === ALL_PERMISSIONS.ADMINISTRATOR) {
    return Object.keys(ALL_PERMISSIONS);
  }

  if (channel) {

    const channelData = useCache
      ? await client.guilds.fetchChannel(id)
      : await DiscordRequest(`/channels/${id}`);

    const overwrites = (useCache ? channelData.permissionOverwrites : channelData.permission_overwrites) || [];

    let allow = 0n;
    let deny = 0n;

    for (const overwrite of overwrites) {

      // user overwrite
      if (overwrite.id === userId) {
        allow |= BigInt(overwrite.allow);
        deny |= BigInt(overwrite.deny);
      }

      // role overwrite
      if (memberRoles.includes(overwrite.id)) {
        allow |= BigInt(overwrite.allow);
        deny |= BigInt(overwrite.deny);
      }

      // @everyone overwrite
      if (overwrite.id === guildId) {
        allow |= BigInt(overwrite.allow);
        deny |= BigInt(overwrite.deny);
      }
    }

    permissions &= ~deny;
    permissions |= allow;
  }

  return bitfieldToArray(permissions);
}

module.exports = getPerm;
module.exports.ALL_PERMISSIONS = ALL_PERMISSIONS;
module.exports.bitfieldToArray = bitfieldToArray;
