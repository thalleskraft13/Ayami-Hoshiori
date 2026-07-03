// src/functions/Managers/LanguageManager/LanguageLoader.js

const fs   = require("node:fs");
const path = require("node:path");

class LanguageLoader {
  constructor(systemsBasePath) {
    this.basePath = systemsBasePath;
  }

  // ── Manifest ───────────────────────────────────────

  /**
   * Lê o manifest.json do system
   * Retorna null se não existir (systems legados sem manifest)
   *
   * @param {string} systemId
   * @returns {{ id, version, locales, ... } | null}
   */
  loadManifest(systemId) {
    const manifestPath = path.join(
      this._resolveSystemDir(systemId),
      "manifest.json"
    );

    if (!fs.existsSync(manifestPath)) {
      console.warn(
        `[LanguageLoader] ⚠️  manifest.json ausente em "${systemId}" — ` +
        `usando version "0.0.0"`
      );
      return { id: systemId, version: "0.0.0", locales: [] };
    }

    try {
      const raw = fs.readFileSync(manifestPath, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      console.error(
        `[LanguageLoader] ❌ manifest.json inválido em "${systemId}":`,
        err.message
      );
      return { id: systemId, version: "0.0.0", locales: [] };
    }
  }

  // ── Carregamento ───────────────────────────────────

  /**
   * Carrega todos os arquivos de idioma de um system.
   * Retorna { manifest, localeMap }
   *
   * @param {string} systemId
   * @returns {{ manifest: object, localeMap: Map<string, Map<string, Function>> }}
   */
  loadSystem(systemId) {
    const manifest  = this.loadManifest(systemId);
    const langDir   = this._resolveLangDir(systemId);
    const localeMap = new Map();

    if (!fs.existsSync(langDir)) {
      console.warn(
        `[LanguageLoader] ⚠️  Pasta language não encontrada: ${langDir}`
      );
      return { manifest, localeMap };
    }

    const files = fs.readdirSync(langDir).filter((f) => f.endsWith(".js"));

    for (const file of files) {
      const locale   = path.basename(file, ".js");
      const filePath = path.join(langDir, file);
      const entryMap = this._loadFile(filePath, file);

      if (entryMap.size > 0) {
        localeMap.set(locale, entryMap);
      }
    }

    return { manifest, localeMap };
  }

  // ── Reload Controlado ──────────────────────────────

  /**
   * Recarrega apenas um locale específico de um system.
   * Mais seguro que recarregar tudo — mínimo impacto em produção.
   *
   * @param {string} systemId
   * @param {string} locale
   * @returns {Map<string, Function> | null}
   */
  reloadLocale(systemId, locale) {
    const filePath = path.join(
      this._resolveLangDir(systemId),
      `${locale}.js`
    );

    if (!fs.existsSync(filePath)) return null;

    return this._loadFile(filePath, `${locale}.js`);
  }

  // ── Internos ───────────────────────────────────────

  _loadFile(filePath, label) {
    const entryMap = new Map();

    try {
      // Limpa cache do require para reload funcionar
      delete require.cache[require.resolve(filePath)];

      const raw     = require(filePath);
      const entries = this._normalize(raw);

      for (const entry of entries) {
        if (entry?.id && typeof entry?.render === "function") {
          entryMap.set(entry.id, entry.render);
        } else {
          console.warn(
            `[LanguageLoader] ⚠️  Entrada inválida em ${label}:`,
            entry
          );
        }
      }
    } catch (err) {
      console.error(
        `[LanguageLoader] ❌ Erro ao carregar ${label}:`,
        err.message
      );
    }

    return entryMap;
  }

  _normalize(raw) {
    const value = raw?.default ?? raw;
    if (Array.isArray(value))                           return value;
    if (value && typeof value === "object" && value.id) return [value];
    if (value && typeof value === "object")             return Object.values(value);
    return [];
  }

  _resolveSystemDir(systemId) {
    return path.join(this.basePath, systemId.replace(/_/g, "-"));
  }

  _resolveLangDir(systemId) {
    return path.join(this._resolveSystemDir(systemId), "language");
  }
}

module.exports = { LanguageLoader };