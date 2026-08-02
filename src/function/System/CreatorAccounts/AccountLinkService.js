'use strict';

const CreatorAccountLink = require('../../../Mongodb/creatorAccountLink.js');
const { STATUSES } = CreatorAccountLink;

/**
 * Ponto único, do lado do Bot, para consultar vínculos Discord ↔
 * Plataforma (CreatorAccountLink). A escrita do FLUXO OAUTH (criar/
 * desvincular um vínculo) continua acontecendo só na Dashboard
 * (site/services/creatorAccountLinkService.js) — o Bot não reimplementa
 * isso. A única escrita que o Bot faz aqui é a RENOVAÇÃO do token de
 * usuário já vinculado (`oauth.accessToken`/`refreshToken`/`expiresAt`),
 * necessária pro polling de Follow (Alertas) poder chamar a Helix sem
 * depender da Dashboard estar de pé — sempre no MESMO documento, nunca
 * um token paralelo.
 *
 * Resto do uso (Missões, resolução de espectador) continua só leitura:
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

/**
 * Grava um access_token/refresh_token renovado no MESMO documento
 * `CreatorAccountLink` (nunca cria um registro de token paralelo).
 * Usado exclusivamente pelo polling de Follow depois de chamar
 * `TwitchApiService.refreshUserToken` — o resto do vínculo (linkAccount/
 * unlinkAccount) continua sendo escrito só pela Dashboard.
 */
async function updateOauthTokens(linkId, { accessToken, refreshToken, expiresAt }) {
  return CreatorAccountLink.findByIdAndUpdate(linkId, {
    $set: {
      'oauth.accessToken':  accessToken,
      'oauth.refreshToken': refreshToken,
      'oauth.expiresAt':    expiresAt,
      status:               STATUSES.CONNECTED,
      lastError:            null,
    },
  }, { new: true }).lean();
}

/**
 * Marca o vínculo como `error`/`expired` quando a renovação do token
 * falha (refresh_token inválido ou revogado pelo usuário na Twitch) —
 * mesmos valores do enum `STATUSES` do model. O usuário precisa
 * reconectar em Contas Conectadas (Dashboard) pra voltar a `connected`.
 */
async function markLinkStatus(linkId, status, lastError = null) {
  if (!Object.values(STATUSES).includes(status)) return null;
  return CreatorAccountLink.findByIdAndUpdate(linkId, {
    $set: { status, lastError: lastError ? String(lastError) : null },
  }, { new: true }).lean();
}

module.exports = { getLink, isLinked, resolveDiscordUserId, updateOauthTokens, markLinkStatus };
