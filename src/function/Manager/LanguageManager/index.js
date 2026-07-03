// src/functions/Managers/LanguageManager/index.js

const path = require("node:path");

const { LanguageCache }       = require("./LanguageCache");
const { LanguageLoader }      = require("./LanguageLoader");
const { LanguageResolver }    = require("./LanguageResolver");
const { LanguageSyncManager } = require("./LanguageSyncManager");

class LanguageManager {
  /**
   * @param {object} options
   * @param {string}  [options.systemsPath]      Caminho absoluto de /systems
   * @param {string}  [options.fallbackLocale]   Locale padrão global
   * @param {string}  [options.shardId]          ID do shard (para logs)
   * @param {object}  [options.syncAdapter]      Adapter Redis/DB (opcional)
   */
  constructor(options = {}) {
    this.systemsPath    = options.systemsPath ?? path.resolve(__dirname, "../../../systems");
    this.fallbackLocale = options.fallbackLocale ?? "en-US";
    this.shardId        = options.shardId ?? "local";

    // ── Módulos internos (todos stateless entre shards) ──
    this.cache    = new LanguageCache();
    this.loader   = new LanguageLoader(this.systemsPath);
    this.resolver = new LanguageResolver(this.fallbackLocale);
    this.sync     = new LanguageSyncManager({
      adapter: options.syncAdapter ?? null,
      shardId: this.shardId,
    });

    // Registro local: systemId → version carregada
    // NÃO é verdade global — é estado LOCAL deste shard
    this._loadedSystems = new Map(); // systemId → version

    // Escuta reloads de outros shards (quando adapter presente)
    this.sync.listenReloads((systemId, version) => {
      console.info(
        `[LanguageManager] 🔄 Shard ${this.shardId} recebeu reload: ` +
        `"${systemId}@${version}"`
      );
      this._reloadSystem(systemId);
    });
  }

  // ─────────────────────────────────────────────────
  // 🔑 API PÚBLICA
  // ─────────────────────────────────────────────────

  /**
   * Resolve e renderiza um texto traduzido.
   * Único ponto de entrada — nunca quebra o bot.
   *
   * @param {string} key  "system_id.entry_id"
   * @param {object} ctx  Contexto padrão da Ayami
   * @returns {string}
   */
  translate(key, ctx = {}) {
    const { systemId, entryId } = this._parseKey(key);

    if (!systemId || !entryId) {
      console.warn(`[LanguageManager] ⚠️  Chave inválida: "${key}"`);
      return this._safe(key);
    }

    this._ensureLoaded(systemId);

    const version = this._loadedSystems.get(systemId) ?? "0.0.0";
    const locale  = this.resolver.resolve(ctx);

    // Tenta com locale resolvido
    const result = this._render(systemId, version, locale, entryId, ctx);
    if (result !== null) return result;

    // Fallback em cadeia (es-ES → es → en-US)
    for (const fallback of this.resolver.resolveChain(locale)) {
      if (fallback === locale) continue;
      const fb = this._render(systemId, version, fallback, entryId, ctx);
      if (fb !== null) return fb;
    }

    return this._safe(key);
  }

  // ─────────────────────────────────────────────────
  // 🛠️  LIFECYCLE
  // ─────────────────────────────────────────────────

  /**
   * Pré-carrega systems no boot do shard.
   * Evita lazy-load durante eventos reais.
   *
   * @param {...string} systemIds
   */
  preload(...systemIds) {
    for (const id of systemIds) {
      this._ensureLoaded(id);
    }
    console.info(
      `[LanguageManager] 🚀 Shard ${this.shardId} — ` +
      `pré-carregamento: [${systemIds.join(", ")}]`
    );
  }

  /**
   * Reload controlado de um system.
   * Invalida cache da versão antiga, carrega nova versão.
   * Após reload, faz broadcast para outros shards.
   *
   * @param {string} systemId
   */
  reload(systemId) {
    const oldVersion = this._loadedSystems.get(systemId);

    if (oldVersion) {
      this.cache.invalidateVersion(systemId, oldVersion);
      this._loadedSystems.delete(systemId);
    }

    this._ensureLoaded(systemId);

    const newVersion = this._loadedSystems.get(systemId) ?? "0.0.0";

    // Broadcast para outros shards (se adapter estiver plugado)
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

  // ─────────────────────────────────────────────────
  // 🔧 INTERNOS
  // ─────────────────────────────────────────────────

  _ensureLoaded(systemId) {
    if (this._loadedSystems.has(systemId)) return;

    try {
      const { manifest, localeMap } = this.loader.loadSystem(systemId);
      const version = manifest.version ?? "0.0.0";

      for (const [locale, entryMap] of localeMap.entries()) {
        this.cache.set(systemId, version, locale, entryMap);
      }

      this._loadedSystems.set(systemId, version);

      // Registra versão no store global (async, não bloqueia)
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