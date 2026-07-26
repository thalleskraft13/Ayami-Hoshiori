'use strict';

const UserGlobalDb = require('../../Mongodb/userglobal.js');
const { getItemDef, CATEGORIAS, CATEGORIA_PARA_ID } = require('./data/itemCatalog.js');

function vazio() {
  const out = {};
  for (const cat of CATEGORIAS) out[cat.id] = [];
  return out;
}

async function getInventario(userId) {
  const user = await UserGlobalDb.findOne({ userId });
  const categorias = vazio();

  const recursos = user?.recursos instanceof Map
    ? Object.fromEntries(user.recursos)
    : (user?.recursos ?? {});

  for (const [chave, quantidade] of Object.entries(recursos)) {
    if (!quantidade) continue;
    const def = getItemDef(chave);
    const catId = CATEGORIA_PARA_ID[def.categoria] ?? 'especiais';
    categorias[catId].push({ ...def, quantidade, obtidoEm: null });
  }

  for (const entrada of user?.inventario?.itens ?? []) {
    const def = getItemDef(entrada.itemId);
    const catId = CATEGORIA_PARA_ID[def.categoria] ?? 'especiais';
    categorias[catId].push({ ...def, quantidade: entrada.quantidade ?? 1, obtidoEm: entrada.obtidoEm ?? null });
  }

  for (const entrada of user?.inventario?.decoracoes ?? []) {
    const def = getItemDef(entrada.itemId);
    categorias.decoracoes.push({ ...def, quantidade: entrada.quantidade ?? 1, obtidoEm: entrada.obtidoEm ?? null });
  }

  for (const entrada of user?.inventario?.ferramentas ?? []) {
    const def = getItemDef(entrada.itemId);
    categorias.especiais.push({
      ...def,
      quantidade: 1,
      obtidoEm: entrada.obtidoEm ?? null,
      descricao: `${def.descricao} Durabilidade: ${entrada.durabilidade ?? 100}/100.`
    });
  }

  for (const catId of Object.keys(categorias)) {
    categorias[catId].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  return categorias;
}

function contarTotais(categorias) {
  return CATEGORIAS.reduce((acc, cat) => {
    acc[cat.id] = categorias[cat.id]?.length ?? 0;
    return acc;
  }, {});
}

module.exports = { getInventario, contarTotais };
