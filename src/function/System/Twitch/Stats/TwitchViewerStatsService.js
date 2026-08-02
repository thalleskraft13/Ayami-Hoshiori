'use strict';

const TwitchViewerStatDb = require('../../../../Mongodb/twitchViewerStat.js');
const CreatorAccountLink = require('../../../../Mongodb/creatorAccountLink.js');

const PLATFORM = 'twitch';

/**
 * Estatísticas por Espectador (Fase 7).
 *
 * ESPELHA EXATAMENTE ayami-fixed/services/twitchViewerStatsService.js
 * do Dashboard — os dois lêem o MESMO documento Mongo
 * (`twitch_viewer_stats`). A ESCRITA, porém, só acontece aqui (Bot,
 * via TwitchChatBot.js) — a Dashboard é somente leitura pra esta
 * estatística, igual ao padrão já usado pelo histórico de lives
 * (`TwitchHistory`, escrito só pelo TwitchMonitorService).
 */

async function recordMessage(guildId, viewer) {
  await TwitchViewerStatDb.findOneAndUpdate(
    { guildId, platform: PLATFORM, viewerTwitchId: viewer.id },
    {
      $inc: { messageCount: 1 },
      $set: {
        viewerLogin: viewer.login,
        viewerDisplayName: viewer.displayName,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/**
 * Chamado periodicamente (a cada amostragem de "Get Chatters") pra
 * cada espectador presente no chat de uma live em andamento.
 * `sampleSeconds` é o intervalo desde a última amostragem (ex.: 300).
 */
async function recordWatchSample(guildId, viewer, streamId, sampleSeconds) {
  const existente = await TwitchViewerStatDb.findOne(
    { guildId, platform: PLATFORM, viewerTwitchId: viewer.id },
  ).lean();

  const jaContadaNestaLive = existente?.lastCountedStreamId === streamId;

  await TwitchViewerStatDb.findOneAndUpdate(
    { guildId, platform: PLATFORM, viewerTwitchId: viewer.id },
    {
      $inc: {
        watchSeconds: sampleSeconds,
        ...(jaContadaNestaLive ? {} : { livesWatched: 1 }),
      },
      $set: {
        viewerLogin: viewer.login,
        viewerDisplayName: viewer.displayName,
        lastCountedStreamId: streamId,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/** Resolve o vínculo Discord (se existir) pra uma lista de viewerTwitchIds. */
async function _resolveDiscordLinks(viewerTwitchIds) {
  if (!viewerTwitchIds.length) return new Map();

  const links = await CreatorAccountLink.find({
    platform: PLATFORM,
    platformUserId: { $in: viewerTwitchIds },
    status: { $ne: 'disconnected' },
  }).lean();

  return new Map(links.map((l) => [l.platformUserId, l]));
}

function _withAverages(stat) {
  const mediaMensagens = stat.livesWatched > 0
    ? Math.round((stat.messageCount / stat.livesWatched) * 10) / 10
    : stat.messageCount;

  return { ...stat, averageMessagesPerLive: mediaMensagens };
}

async function getRanking(guildId, limit = 10) {
  const stats = await TwitchViewerStatDb.find({ guildId, platform: PLATFORM })
    .sort({ watchSeconds: -1 })
    .limit(limit)
    .lean();

  const links = await _resolveDiscordLinks(stats.map((s) => s.viewerTwitchId));

  return stats.map((s) => ({
    ..._withAverages(s),
    discord: links.has(s.viewerTwitchId) ? {
      discordUserId: links.get(s.viewerTwitchId).discordUserId,
      displayName: links.get(s.viewerTwitchId).displayName,
      avatarUrl: links.get(s.viewerTwitchId).avatarUrl,
    } : null,
  }));
}

async function getViewerStat(guildId, viewerTwitchId) {
  const stat = await TwitchViewerStatDb.findOne(
    { guildId, platform: PLATFORM, viewerTwitchId },
  ).lean();
  if (!stat) return null;

  const links = await _resolveDiscordLinks([viewerTwitchId]);
  const link = links.get(viewerTwitchId) || null;

  return {
    ..._withAverages(stat),
    discord: link ? {
      discordUserId: link.discordUserId,
      displayName: link.displayName,
      avatarUrl: link.avatarUrl,
    } : null,
  };
}

module.exports = {
  recordMessage,
  recordWatchSample,
  getRanking,
  getViewerStat,
};
