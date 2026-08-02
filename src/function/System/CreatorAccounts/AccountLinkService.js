'use strict';

const CreatorAccountLink = require('../../../Mongodb/creatorAccountLink.js');
const { STATUSES } = CreatorAccountLink;

/**
 * Ponto único, do lado do Bot, para consultar vínculos Discord ↔
 * Plataforma (CreatorAccountLink). A escrita (fluxo OAuth) acontece
 * na Dashboard (site/services/creatorAccountLinkService.js) — o Bot só
 * PRECISA LER esse mesmo documento Mongo pra:
 *   - decidir se uma Missão de Twitch pode ser concluída;
 *   - resolver "qual Discord User ID corresponde a este espectador da
 *     live" (sempre via platformUserId, nunca via nome/login).
 *
 * Não duplicar esta lógica em cada system (Missões, Twitch, YouTube...)
 * — sempre importar daqui.
 */

/** Vínculo ativo e conectado de um usuário Discord numa plataforma. */
async function getLink(discordUserId, platform) {
  return CreatorAccountLink.findOne({
    discordUserId,
    platform,
    status: { $ne: STATUSES.DISCONNECTED },
  }).lean();
}

/** true somente se o vínculo existe e está com status "connected". */
async function isLinked(discordUserId, platform) {
  const link = await getLink(discordUserId, platform);
  return !!link && link.status === STATUSES.CONNECTED;
}

/**
 * Resolve o Discord User ID de um espectador a partir do ID oficial da
 * plataforma (ex.: ID numérico da Twitch vindo do EventSub/chat).
 * Retorna null se o espectador nunca vinculou a conta — quem chamar
 * deve tratar isso pedindo pra vincular em Dashboard → Contas Conectadas,
 * nunca inferindo identidade por nome.
 */
async function resolveDiscordUserId(platform, platformUserId) {
  const link = await CreatorAccountLink.findOne({
    platform,
    platformUserId,
    status: STATUSES.CONNECTED,
  }).lean();

  return link?.discordUserId ?? null;
}

module.exports = { getLink, isLinked, resolveDiscordUserId };
