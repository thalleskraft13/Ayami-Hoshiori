// src/functions/Managers/LanguageManager/LanguageResolver.js

/**
 * Stateless — não guarda estado entre chamadas.
 * Seguro para múltiplos shards usarem a mesma lógica.
 */

// Idiomas permitidos pela Ayami. pt-BR é o padrão — todo o "jeito" de
// personalidade da Ayami nasce em pt-BR e as demais traduções devem
// preservar esse mesmo tom, só mudando o idioma.
const SUPPORTED_LOCALES = new Set(["pt-BR", "en-US", "en-GB", "es-ES"]);
const FALLBACK_LOCALE   = "pt-BR";

// Cadeia de fallback explícita por locale (além do fallback global).
// en-GB e en-US compartilham a mesma "família", então en-GB tenta
// en-US antes de cair pro padrão pt-BR.
const FALLBACK_CHAINS = {
  "en-GB": ["en-US"],
  "en-US": [],
  "es-ES": [],
  "pt-BR": [],
};

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
   * "en-GB" → "en-US" → "pt-BR"
   * "es-ES" → "pt-BR"
   * Usa FALLBACK_CHAINS para rotas específicas antes do fallback global.
   */
  resolveChain(locale) {
    const chain = [locale, ...(FALLBACK_CHAINS[locale] ?? []), this.fallback];
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
   *
   * @param {string} locale
   * @param {string[]} [chain] Fallbacks extras antes do fallback global
   */
  registerLocale(locale, chain = []) {
    SUPPORTED_LOCALES.add(locale);
    FALLBACK_CHAINS[locale] = chain;
  }
}

module.exports = { LanguageResolver };