"use strict";

/**
 * Monta o `ctx` que o LanguageManager espera, a partir de uma interaction
 * raw do Discord Gateway.
 *
 * O Discord já manda o idioma do cliente do usuário em `interaction.locale`
 * usando os mesmos códigos que a Ayami suporta (pt-BR, en-US, en-GB, es-ES),
 * então usamos isso como fonte de verdade — sem precisar guardar preferência
 * no banco. Se no futuro existir um idioma salvo por usuário/guilda, é só
 * preencher `extra.user.language` / `extra.guild.language` que o Resolver
 * já prioriza esses campos automaticamente.
 *
 * @param {object} interaction Interação raw do Discord (com `.locale`)
 * @param {object} [extra]     Dados extras pra interpolar no texto traduzido
 * @returns {object}
 */
function localeCtx(interaction, extra = {}) {
  return {
    system: { locale: interaction?.locale },
    ...extra,
  };
}

module.exports = { localeCtx };
