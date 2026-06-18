// src/functions/Managers/LanguageManager/LanguageCache.js

/**
 * Cache LOCAL por shard — stateless entre processos.
 *
 * Chave: "system_id@version:locale"
 * Ex:    "level_system@1.2.0:pt-BR"
 *
 * Cada shard tem sua própria instância.
 * Nunca compartilhado entre shards — isso é intencional.
 */
class LanguageCache {
  constructor() {
    this._store = new Map();

    // Metadados: systemId → { version, loadedAt, locales[] }
    this._meta = new Map();
  }

  // ── Chave interna ──────────────────────────────────

  _key(systemId, version, locale) {
    return `${systemId}@${version}:${locale}`;
  }

  // ── Operações de pack ──────────────────────────────

  has(systemId, version, locale) {
    return this._store.has(this._key(systemId, version, locale));
  }

  get(systemId, version, locale) {
    return this._store.get(this._key(systemId, version, locale)) ?? null;
  }

  /**
   * @param {string} systemId
   * @param {string} version
   * @param {string} locale
   * @param {Map<string, Function>} pack
   */
  set(systemId, version, locale, pack) {
    this._store.set(this._key(systemId, version, locale), pack);
    this._updateMeta(systemId, version, locale);
  }

  // ── Invalidação ────────────────────────────────────

  /**
   * Remove todos os locales de uma versão específica
   */
  invalidateVersion(systemId, version) {
    const meta = this._meta.get(systemId);
    if (!meta) return;

    for (const locale of meta.locales) {
      this._store.delete(this._key(systemId, version, locale));
    }

    this._meta.delete(systemId);
  }

  /**
   * Remove TUDO de um system (todas as versões)
   */
  invalidateSystem(systemId) {
    for (const [key] of this._store) {
      if (key.startsWith(`${systemId}@`)) {
        this._store.delete(key);
      }
    }
    this._meta.delete(systemId);
  }

  clear() {
    this._store.clear();
    this._meta.clear();
  }

  // ── Metadados ──────────────────────────────────────

  _updateMeta(systemId, version, locale) {
    const existing = this._meta.get(systemId) ?? {
      version,
      loadedAt: Date.now(),
      locales: [],
    };

    if (!existing.locales.includes(locale)) {
      existing.locales.push(locale);
    }

    this._meta.set(systemId, existing);
  }

  getMeta(systemId) {
    return this._meta.get(systemId) ?? null;
  }

  get size() {
    return this._store.size;
  }

  /**
   * Snapshot do estado atual — usado pelo SyncManager
   */
  snapshot() {
    const result = {};
    for (const [systemId, meta] of this._meta.entries()) {
      result[systemId] = { ...meta };
    }
    return result;
  }
}

module.exports = { LanguageCache };