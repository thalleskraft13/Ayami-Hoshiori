'use strict';

const DiscordRequest = require('../../DiscordRequest.js');

class DecorationService {

  constructor(client) {
    this.client = client;
  }

  build(format, vars = {}) {
    if (!format) return vars.name ?? vars.user ?? '';

    return format
      .replaceAll('{name}', vars.name ?? '')
      .replaceAll('{user}', vars.user ?? '')
      .replaceAll('{character}', vars.character ?? '')
      .replaceAll('{emoji}', vars.emoji ?? '')
      .replaceAll('{faction}', vars.faction ?? '')
      .replaceAll('{house}', vars.house ?? '');
  }

  /**
   * Valida se um texto enviado pelo membro é um emoji utilizável na decoração:
   * um emoji customizado do Discord (<:nome:id> / <a:nome:id>) ou um emoji unicode
   * "simples" (incluindo sequências com ZWJ/variation selectors, ex.: 👨‍👩‍👧).
   */
  isValidEmoji(str) {
    if (!str) return false;
    const trimmed = String(str).trim();
    if (!trimmed || trimmed.length > 40) return false;

    if (/^<a?:\w{2,32}:\d{17,20}>$/.test(trimmed)) return true;

    const stripped = trimmed.replace(/[\u{FE00}-\u{FE0F}\u{200D}]/gu, '');
    return /^\p{Extended_Pictographic}+$/u.test(stripped);
  }

  /**
   * Escolhe um formato entre as opções configuradas (até 25 — recurso de assinantes).
   * Mantém compatibilidade com o campo legado `format` quando `formats` estiver vazio.
   */
  pickFormat(decoration = {}) {
    const lista = (decoration.formats && decoration.formats.length)
      ? decoration.formats
      : [decoration.format];
    const validos = lista.filter(Boolean);
    if (!validos.length) return '{name}';
    return validos[Math.floor(Math.random() * validos.length)];
  }

  /**
   * Corta a string respeitando clusters de grafemas (ou, no mínimo, pares substitutos),
   * para não quebrar ao meio símbolos compostos por vários caracteres — muito comuns
   * nas decorações de nome (ex.: emojis com ZWJ, variation selectors, acentos combinados).
   */
  _safeTruncate(str, maxLen) {
    if (str.length <= maxLen) return str;

    const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
      ? new Intl.Segmenter('pt', { granularity: 'grapheme' })
      : null;

    const clusters = segmenter
      ? Array.from(segmenter.segment(str), (s) => s.segment)
      : Array.from(str); // fallback: ao menos respeita pares substitutos (emojis simples)

    let result = '';
    for (const cluster of clusters) {
      if ((result.length + cluster.length) > maxLen) break;
      result += cluster;
    }
    return result;
  }

  async applyNickname(guildId, userId, nickname) {
    if (!nickname) return;
    const trimmed = this._safeTruncate(nickname, 32);

    try {
      await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
        method: 'PATCH',
        body: { nick: trimmed },
      });
    } catch (err) {
      console.warn(`[House/DecorationService] Não foi possível renomear ${userId}:`, err?.message);
    }
  }
}

module.exports = DecorationService;
