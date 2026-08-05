'use strict';

const TwitchHistoryDb        = require('../../../../Mongodb/twitchHistory.js');
const CreatorMissionProgress = require('../../../../Mongodb/creatorMissionProgress.js');
const CreatorMissionService  = require('../../Missions/CreatorMissionService.js');

const PLATFORM = 'twitch';

async function getStatsOverview(guildId) {
  const [missions, historyDocs] = await Promise.all([
    CreatorMissionService.listMissions(guildId, PLATFORM),
    TwitchHistoryDb.find({ guildId }).sort({ startedAt: -1 }).lean(),
  ]);

  const missionIds = missions.map((m) => m._id);
  const completedCount = missionIds.length
    ? await CreatorMissionProgress.countDocuments({ missionId: { $in: missionIds }, status: 'completed' })
    : 0;
  const participantsCount = missionIds.length
    ? (await CreatorMissionProgress.distinct('discordUserId', { missionId: { $in: missionIds } })).length
    : 0;

  const livesCount = historyDocs.length;

  const totalSeconds = historyDocs.reduce((sum, h) => sum + (h.durationSeconds || 0), 0);
  const hoursStreamed = livesCount ? Math.round((totalSeconds / 3600) * 10) / 10 : 0;

  const lastLiveAt = historyDocs[0]?.startedAt ?? null;

  const gameCounts = new Map();
  for (const h of historyDocs) {
    const game = (h.category || '').trim();
    if (!game) continue;
    gameCounts.set(game, (gameCounts.get(game) || 0) + 1);
  }
  const topGames = [...gameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const streamDays = new Set(
    historyDocs.map((h) => new Date(h.startedAt).toISOString().slice(0, 10)),
  );
  let streakDays = 0;
  {
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    if (!streamDays.has(cursor.toISOString().slice(0, 10))) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    while (streamDays.has(cursor.toISOString().slice(0, 10))) {
      streakDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  return {
    livesCount,
    hoursStreamed,
    lastLiveAt,
    topGames,
    streakDays,
    missionsCompleted: completedCount,
    missionParticipants: participantsCount,
  };
}

module.exports = { getStatsOverview };
