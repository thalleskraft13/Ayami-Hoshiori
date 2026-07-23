"use strict";

function localeCtx(interaction, extra = {}) {
  return {
    system: { locale: interaction?.locale },
    ...extra,
  };
}

module.exports = { localeCtx };
