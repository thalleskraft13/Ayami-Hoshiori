'use strict';

const CreatorAccountLink = require('../../../Mongodb/creatorAccountLink.js');
const { STATUSES } = CreatorAccountLink;

async function getLink(discordUserId, platform) {
  return CreatorAccountLink.findOne({
    discordUserId,
    platform,
    status: { $ne: STATUSES.DISCONNECTED },
  }).lean();
}

async function isLinked(discordUserId, platform) {
  const link = await getLink(discordUserId, platform);
  return !!link && link.status === STATUSES.CONNECTED;
}

async function resolveDiscordUserId(platform, platformUserId) {
  const link = await CreatorAccountLink.findOne({
    platform,
    platformUserId,
    status: STATUSES.CONNECTED,
  }).lean();

  return link?.discordUserId ?? null;
}

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

async function markLinkStatus(linkId, status, lastError = null) {
  if (!Object.values(STATUSES).includes(status)) return null;
  return CreatorAccountLink.findByIdAndUpdate(linkId, {
    $set: { status, lastError: lastError ? String(lastError) : null },
  }, { new: true }).lean();
}

module.exports = { getLink, isLinked, resolveDiscordUserId, updateOauthTokens, markLinkStatus };
