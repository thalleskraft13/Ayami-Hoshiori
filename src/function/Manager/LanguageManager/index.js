
const path = require("node:path");

const { LanguageCache }       = require("./LanguageCache");
const { LanguageLoader }      = require("./LanguageLoader");
const { LanguageResolver }    = require("./LanguageResolver");
const { LanguageSyncManager } = require("./LanguageSyncManager");

class LanguageManager {
  constructor(options = {}) {
    this.systemsPath    = options.systemsPath ?? path.resolve(__dirname, "../../../systems");
    this.fallbackLocale = options.fallbackLocale ?? "pt-BR";
    this.shardId        = options.shardId ?? "local";

    this.cache    = new LanguageCache();
    this.loader   = new LanguageLoader(this.systemsPath);
    this.resolver = new LanguageResolver(this.fallbackLocale);
    this.sync     = new LanguageSyncManager({
      adapter: options.syncAdapter ?? null,
      shardId: this.shardId,
    });

    this._loadedSystems = new Map(); 

    this.sync.listenReloads((systemId, version) => {
      console.info(
        `[LanguageManager] 🔄 Shard ${this.shardId} recebeu reload: ` +
        `"${systemId}@${version}"`
      );
      this._reloadSystem(systemId);
    });
  }


  translate(key, ctx = {}) {
    const { systemId, entryId } = this._parseKey(key);

    if (!systemId || !entryId) {
      console.warn(`[LanguageManager] ⚠️  Chave inválida: "${key}"`);
      return this._safe(key);
    }

    this._ensureLoaded(systemId);

    const version = this._loadedSystems.get(systemId) ?? "0.0.0";
    const locale  = this.resolver.resolve(ctx);

    const result = this._render(systemId, version, locale, entryId, ctx);
    if (result !== null) return result;

    for (const fallback of this.resolver.resolveChain(locale)) {
      if (fallback === locale) continue;
      const fb = this._render(systemId, version, fallback, entryId, ctx);
      if (fb !== null) return fb;
    }

    return this._safe(key);
  }


  preload(...systemIds) {
    for (const id of systemIds) {
      this._ensureLoaded(id);
    }
    console.info(
      `[LanguageManager] 🚀 Shard ${this.shardId} — ` +
      `pré-carregamento: [${systemIds.join(", ")}]`
    );
  }

  reload(systemId) {
    const oldVersion = this._loadedSystems.get(systemId);

    if (oldVersion) {
      this.cache.invalidateVersion(systemId, oldVersion);
      this._loadedSystems.delete(systemId);
    }

    this._ensureLoaded(systemId);

    const newVersion = this._loadedSystems.get(systemId) ?? "0.0.0";

    this.sync.broadcastReload(systemId, newVersion).catch(() => {});
    this.sync.registerVersion(systemId, newVersion).catch(() => {});
  }

  stats() {
    return {
      shardId:        this.shardId,
      fallbackLocale: this.fallbackLocale,
      cachedPacks:    this.cache.size,
      loadedSystems:  Object.fromEntries(this._loadedSystems),
      cacheSnapshot:  this.cache.snapshot(),
      syncMode:       this.sync.mode,
    };
  }


  _ensureLoaded(systemId) {
    if (this._loadedSystems.has(systemId)) return;

    try {
      const { manifest, localeMap } = this.loader.loadSystem(systemId);
      const version = manifest.version ?? "0.0.0";

      for (const [locale, entryMap] of localeMap.entries()) {
        this.cache.set(systemId, version, locale, entryMap);
      }

      this._loadedSystems.set(systemId, version);

      this.sync.registerVersion(systemId, version).catch(() => {});

      console.info(
        `[LanguageManager] ✅ "${systemId}@${version}" carregado ` +
        `(${localeMap.size} locale(s)) — shard ${this.shardId}`
      );
    } catch (err) {
      console.error(
        `[LanguageManager] ❌ Falha ao carregar "${systemId}":`,
        err.message
      );
    }
  }

  _reloadSystem(systemId) {
    const oldVersion = this._loadedSystems.get(systemId);
    if (oldVersion) {
      this.cache.invalidateVersion(systemId, oldVersion);
      this._loadedSystems.delete(systemId);
    }
    this._ensureLoaded(systemId);
  }

  _render(systemId, version, locale, entryId, ctx) {
    const pack = this.cache.get(systemId, version, locale);
    if (!pack) return null;

    const renderFn = pack.get(entryId);
    if (!renderFn) return null;

    try {
      const out = renderFn(ctx);
      return typeof out === "string" ? out : String(out);
    } catch (err) {
      console.error(
        `[LanguageManager] ❌ render() — ${systemId}.${entryId} [${locale}]:`,
        err.message
      );
      return null;
    }
  }

  _parseKey(key) {
    if (typeof key !== "string") return {};
    const dot = key.indexOf(".");
    if (dot === -1) return {};
    return { systemId: key.slice(0, dot), entryId: key.slice(dot + 1) };
  }

  _safe(key) {
    return `[${key}]`;
  }
}

module.exports = { LanguageManager };