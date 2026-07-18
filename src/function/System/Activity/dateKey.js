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

module.exports = { dateKey, dateKeyDaysAgo, dateKeyRange, utcHour, weekdayOfDateKey };
