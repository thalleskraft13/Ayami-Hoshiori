

const SUPPORTED_LOCALES = new Set(["pt-BR", "en-US", "en-GB", "es-ES"]);
const FALLBACK_LOCALE   = "pt-BR";

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

  registerLocale(locale, chain = []) {
    SUPPORTED_LOCALES.add(locale);
    FALLBACK_CHAINS[locale] = chain;
  }
}

module.exports = { LanguageResolver };