
class LanguageCache {
  constructor() {
    this._store = new Map();

    this._meta = new Map();
  }


  _key(systemId, version, locale) {
    return `${systemId}@${version}:${locale}`;
  }


  has(systemId, version, locale) {
    return this._store.has(this._key(systemId, version, locale));
  }

  get(systemId, version, locale) {
    return this._store.get(this._key(systemId, version, locale)) ?? null;
  }

  set(systemId, version, locale, pack) {
    this._store.set(this._key(systemId, version, locale), pack);
    this._updateMeta(systemId, version, locale);
  }


  invalidateVersion(systemId, version) {
    const meta = this._meta.get(systemId);
    if (!meta) return;

    for (const locale of meta.locales) {
      this._store.delete(this._key(systemId, version, locale));
    }

    this._meta.delete(systemId);
  }

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

  snapshot() {
    const result = {};
    for (const [systemId, meta] of this._meta.entries()) {
      result[systemId] = { ...meta };
    }
    return result;
  }
}

module.exports = { LanguageCache };