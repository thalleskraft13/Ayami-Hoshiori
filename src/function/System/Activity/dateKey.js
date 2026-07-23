'use strict';


function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function dateKeyDaysAgo(days, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return dateKey(d);
}

function dateKeyRange(startDate, endDate) {
  const keys = [];
  const cur = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cur <= end) {
    keys.push(dateKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

function utcHour(date = new Date()) {
  return date.getUTCHours();
}

function weekdayOfDateKey(key) {
  return new Date(`${key}T00:00:00.000Z`).getUTCDay();
}

function shiftDateKey(key, days) {
  if (!days) return key;
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKey(d);
}

function localizeDailyStats(dailyStats, offsetHours = 0) {
  const offset = ((Number(offsetHours) || 0) % 24 + 24) % 24; 
  const hourTotals = Array(24).fill(0);
  const weekdayTotals = Array(7).fill(0);
  const byLocalDate = new Map();

  for (const doc of dailyStats) {
    const hours = doc.messagesByHour || Array(24).fill(0);
    for (let utcH = 0; utcH < 24; utcH++) {
      const count = hours[utcH] || 0;
      if (!count) continue;

      const localHour = (utcH + offset) % 24;
      const dayShift = Math.floor((utcH + offset) / 24);
      const localDate = shiftDateKey(doc.date, dayShift);

      hourTotals[localHour] += count;
      weekdayTotals[weekdayOfDateKey(localDate)] += count;

      if (!byLocalDate.has(localDate)) {
        byLocalDate.set(localDate, { date: localDate, messageCount: 0, hourTotals: Array(24).fill(0) });
      }
      const bucket = byLocalDate.get(localDate);
      bucket.messageCount += count;
      bucket.hourTotals[localHour] += count;
    }
  }

  return { hourTotals, weekdayTotals, byLocalDate };
}

module.exports = {
  dateKey, dateKeyDaysAgo, dateKeyRange, utcHour, weekdayOfDateKey,
  shiftDateKey, localizeDailyStats
};
