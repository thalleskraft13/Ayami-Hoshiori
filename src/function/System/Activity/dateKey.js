'use strict';

/**
 * Helpers de data para o módulo de Análise de Atividade.
 *
 * Tudo é bucketizado em UTC (não no fuso do processo) para que os
 * buckets diários sejam estáveis independente de onde/como o bot está
 * rodando (múltiplos clusters/workers, servidores em fusos diferentes).
 */

/** 'YYYY-MM-DD' em UTC, a partir de um Date (padrão: agora). */
function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Mesmo formato de `dateKey`, mas N dias no passado a partir de hoje. */
function dateKeyDaysAgo(days, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return dateKey(d);
}

/** Lista de dateKeys entre `startDate` e `endDate` (inclusive), em ordem. */
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

/** Hora do dia em UTC (0-23) a partir de um Date (padrão: agora). */
function utcHour(date = new Date()) {
  return date.getUTCHours();
}

/** Dia da semana em UTC (0 = domingo ... 6 = sábado) a partir de um dateKey. */
function weekdayOfDateKey(key) {
  return new Date(`${key}T00:00:00.000Z`).getUTCDay();
}

/** Desloca um dateKey ('YYYY-MM-DD') em N dias (pode ser negativo). */
function shiftDateKey(key, days) {
  if (!days) return key;
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKey(d);
}

/**
 * Reconverte um conjunto de documentos diários (armazenados em buckets
 * UTC, como sempre foi) para o fuso horário configurado do servidor
 * (`offsetHours`, um deslocamento fixo em horas — ex: -3 para
 * America/Sao_Paulo). Isso NÃO muda como os dados são gravados (o
 * armazenamento continua em UTC, estável entre processos/clusters) —
 * só corrige a LEITURA, que é onde "Horários de Pico" e "Dias Mais
 * Movimentados" precisam refletir o horário real vivido pelos membros,
 * não o horário do servidor onde o bot roda.
 *
 * Por que isso importa: um servidor com público majoritariamente em
 * UTC-3 tem sua "noite" (21h-23h59 local) caindo already no dia UTC
 * seguinte (00h-02h59 UTC). Sem essa correção, "Dias Mais Movimentados"
 * jogava essas mensagens no dia da semana ERRADO (ex: mensagens de
 * segunda à noite apareciam contadas como terça-feira), e "Horários de
 * Pico" mostrava só UTC, que raramente bate com o horário de pico real
 * de conversa do servidor.
 *
 * @param {Array<{date:string, messagesByHour?:number[]}>} dailyStats
 * @param {number} offsetHours  Deslocamento fixo (-12 a +14) a somar ao
 *                              horário UTC para chegar no horário local.
 * @returns {{
 *   hourTotals: number[24],         // total por hora-do-dia LOCAL (para picos)
 *   weekdayTotals: number[7],       // total por dia-da-semana LOCAL (0=domingo)
 *   byLocalDate: Map<string, {date:string, messageCount:number, hourTotals:number[24]}>
 * }}
 */
function localizeDailyStats(dailyStats, offsetHours = 0) {
  const offset = ((Number(offsetHours) || 0) % 24 + 24) % 24; // normaliza pra 0..23
  const hourTotals = Array(24).fill(0);
  const weekdayTotals = Array(7).fill(0);
  const byLocalDate = new Map();

  for (const doc of dailyStats) {
    const hours = doc.messagesByHour || Array(24).fill(0);
    for (let utcH = 0; utcH < 24; utcH++) {
      const count = hours[utcH] || 0;
      if (!count) continue;

      const localHour = (utcH + offset) % 24;
      // dia local = dia UTC do bucket + 1 se a hora "vazou" pra o próximo dia
      // ao somar o offset (ex: 23h UTC + offset 3 = 26 => dia seguinte, 02h local)
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
