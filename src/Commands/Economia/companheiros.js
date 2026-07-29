'use strict';

const Companion      = require("../../function/Estrelas/Companion.js");
const CATALOGO       = require("../../function/Estrelas/data/companheiros.js");
const UserGlobalDb   = require("../../Mongodb/userglobal.js");
const CV2            = require("../../function/Messages/CV2.js");
const {
  economyContext, respondErrorCV2, replyCV2, updateCV2
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0xAB47BC;

module.exports = {
  info: {
    name: 'companheiros',
    description: 'Companheiros da Ayami'
  },

  data: {
    name: 'companheiros',
    description: 'Veja, ative, alimente e evolua seus companheiros',
    name_localizations: { 'en-US': 'companions', 'en-GB': 'companions', 'es-ES': 'companeros' },
    description_localizations: {
      'en-US': 'View, activate, feed and evolve your companions',
      'en-GB': 'View, activate, feed and evolve your companions',
      'es-ES': 'Ve, activa, alimenta y evoluciona tus compañeros',
    },
    options: [
      {
        type: 1,
        name: 'ver',
        description: 'Abre o painel interativo dos seus companheiros',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    const companion = new Companion(userId, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver': return await handleVer(interaction, client, companion, userId);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/companheiros]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

async function ativoDoUsuario(userId) {
  const user = await UserGlobalDb.findOne({ userId });
  return user?.companheiroAtivo ?? null;
}

function buildPainelVazio(client, userId) {
  return CV2.container([
    CV2.text('🐾 **Seus Companheiros**'),
    CV2.text('Você ainda não tem nenhum companheiro. Explore regiões com `/explorar regioes` para descobrir um!')
  ], { accentColor: 0x808080 });
}

async function buildPainelCompanheiros(client, userId, companion) {
  const lista = await companion.listar();

  if (!lista.length) {
    return buildPainelVazio(client, userId);
  }

  const ativo = await ativoDoUsuario(userId);

  const linhas = lista.map(c =>
    `${c.catalogo?.emoji ?? '🐾'} **${c.catalogo?.nome ?? c.companheiroId}**${ativo === c.companheiroId ? ' — ativo ✅' : ''}\nNível **${c.nivel}** • Felicidade **${c.felicidade}/100**`
  ).join('\n\n');

  const select = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '🐾 Selecione um companheiro',
      options: lista.map(c => ({
        label: c.catalogo?.nome ?? c.companheiroId,
        value: c.companheiroId,
        emoji: { name: c.catalogo?.emoji ?? '🐾' },
        description: `Nível ${c.nivel} • Felicidade ${c.felicidade}/100`
      }))
    },
    funcao: async (si) => {
      const listaFresca = await companion.listar();
      const alvo = listaFresca.find(c => c.companheiroId === si.data.values[0]);
      return updateCV2(si, await buildPainelDetalhe(client, userId, companion, alvo));
    }
  });

  return CV2.container([
    CV2.text('🐾 **Seus Companheiros**'),
    CV2.separator(),
    CV2.text(linhas),
    CV2.separator(),
    CV2.row(select)
  ], { accentColor: ACCENT });
}

async function buildPainelDetalhe(client, userId, companion, c) {
  const catalogo = CATALOGO[c.companheiroId];
  const ativo = await ativoDoUsuario(userId);
  const isAtivo = ativo === c.companheiroId;

  const botoes = [];

  if (!isAtivo) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Ativar', style: 3, emoji: { name: '✅' } },
      funcao: async (bi) => {
        await companion.ativar(c.companheiroId);
        return updateCV2(bi, await buildPainelCompanheiros(client, userId, companion));
      }
    }));
  }

  if (c.felicidade < 100) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Alimentar (2 Cogumelos)', style: 1, emoji: { name: '🍄' } },
      funcao: async (bi) => {
        try {
          const atualizado = await companion.alimentar(c.companheiroId);
          return updateCV2(bi, await buildPainelDetalhe(client, userId, companion, atualizado));
        } catch (err) {
          return updateCV2(bi, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    }));
  }

  if (c.felicidade >= 100 && c.nivel < 5) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Evoluir', style: 4, emoji: { name: '✨' } },
      funcao: async (bi) => {
        try {
          const atualizado = await companion.evoluir(c.companheiroId);
          return updateCV2(bi, await buildPainelDetalhe(client, userId, companion, atualizado));
        } catch (err) {
          return updateCV2(bi, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    }));
  }

  botoes.push(client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelCompanheiros(client, userId, companion))
  }));

  return CV2.container([
    CV2.text(`${catalogo.emoji} **${catalogo.nome}**${isAtivo ? ' — ativo ✅' : ''}`),
    CV2.text(catalogo.descricao),
    CV2.separator(),
    CV2.text(`**Nível:** ${c.nivel}/5`),
    CV2.text(`**Felicidade:** ${c.felicidade}/100`),
    CV2.row(...botoes)
  ], { accentColor: ACCENT });
}

async function handleVer(interaction, client, companion, userId) {
  return replyCV2(interaction, await buildPainelCompanheiros(client, userId, companion));
}
