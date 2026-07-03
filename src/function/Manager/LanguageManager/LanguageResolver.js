// src/functions/Managers/LanguageManager/LanguageResolver.js

/**
 * Stateless — não guarda estado entre chamadas.
 * Seguro para múltiplos shards usarem a mesma lógica.
 */

const SUPPORTED_LOCALES = new Set(["pt-BR", "en-US", "es-ES"]);
const FALLBACK_LOCALE   = "en-US";

class LanguageResolver {
  constructor(fallback = FALLBACK_LOCALE) {
    this.fallback = fallback;
  }

  /**
   * Resolve o melhor locale para o contexto
   * Ordem: user → guild → interaction.locale → fallback
   *
   * @param {object} ctx
   * @returns {string}
   */
  resolve(ctx = {}) {
    const candidates = [
      ctx?.user?.language,
      ctx?.guild?.language,
      ctx?.system?.locale,
      this.fallback,
    ];

    for (const candidate of candidates) {
      if (candidate && SUPPORTED_LOCALES.has(candidate)) {
        return candidate;
      }
    }

    return this.fallback;
  }

  /**
   * Fallback em cadeia:
   * "es-ES" → "es" → "en-US"
   * Preparado para future locales parciais
   */
  resolveChain(locale) {
    const chain = [locale];
    const base  = locale?.split("-")[0];

    if (base && base !== locale && SUPPORTED_LOCALES.has(base)) {
      chain.push(base);
    }

    chain.push(this.fallback);
    return [...new Set(chain)];
  }

  isSupported(locale) {
    return SUPPORTED_LOCALES.has(locale);
  }

  getSupportedLocales() {
    return [...SUPPORTED_LOCALES];
  }

  /**
   * Adiciona locale em runtime (marketplace de novos idiomas)
   */
  registerLocale(locale) {
    SUPPORTED_LOCALES.add(locale);
  }
}

module.exports = { LanguageResolver };