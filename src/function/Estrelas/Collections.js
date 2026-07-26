'use strict';

const CollectionDb = require("../../Mongodb/collection.js");
const RECURSOS     = require("./data/recursos.js");
const RECEITAS     = require("./data/receitas.js");
const REGIOES      = require("./data/regioes.js");
const COMPANHEIROS = require("./data/companheiros.js");

// Categorias nativas da V4. Novas categorias podem ser registradas livremente
// via Collections.registrar(userId, categoria, itemId) mesmo sem estarem
// listadas aqui — CATALOGOS só existe para mostrar "X/Y descobertos" quando
// há um catálogo fechado de referência.
const CATALOGOS = {
  recursos:     { nomes: RECURSOS,     resolver: (id) => RECURSOS[id]?.nome ?? id },
  itens:        { nomes: RECEITAS,     resolver: (id) => Object.values(RECEITAS).find(r => r.resultado.itemId === id)?.nome ?? id },
  receitas:     { nomes: RECEITAS,     resolver: (id) => RECEITAS[id]?.nome ?? id },
  regioes:      { nomes: REGIOES,      resolver: (id) => REGIOES[id]?.nome ?? id },
  companheiros: { nomes: COMPANHEIROS, resolver: (id) => COMPANHEIROS[id]?.nome ?? id },
  criacoes:     { nomes: null,         resolver: (id) => id }
};

const ORDEM_CATEGORIAS = ['recursos', 'itens', 'receitas', 'regioes', 'companheiros', 'criacoes'];
const NOME_CATEGORIA = {
  recursos: 'Recursos coletados',
  itens: 'Itens fabricados',
  receitas: 'Receitas aprendidas',
  regioes: 'Regiões descobertas',
  companheiros: 'Companheiros obtidos',
  criacoes: 'Criações publicadas'
};

class Collections {

  static async registrar(userId, categoria, itemId) {
    try {
      if (!userId || !categoria || !itemId) return { novo: false };

      let doc = await CollectionDb.findOne({ userId });
      if (!doc) doc = await CollectionDb.create({ userId });

      const lista = doc.categorias.get(categoria) ?? [];
      if (lista.some(e => e.itemId === itemId)) return { novo: false };

      lista.push({ itemId, obtidoEm: Date.now() });
      doc.categorias.set(categoria, lista);
      doc.markModified('categorias');
      await doc.save();

      return { novo: true };
    } catch (err) {
      console.error('[Collections.registrar]', err);
      return { novo: false };
    }
  }

  static async obter(userId, categoriaFiltro = 'todas') {
    const doc = await CollectionDb.findOne({ userId });
    const categorias = categoriaFiltro === 'todas' ? ORDEM_CATEGORIAS : [categoriaFiltro];

    return categorias.map(categoria => {
      const catalogo = CATALOGOS[categoria];
      const obtidos = (doc?.categorias.get(categoria) ?? []).slice().sort((a, b) => a.obtidoEm - b.obtidoEm);
      const total = catalogo?.nomes ? Object.keys(catalogo.nomes).length : null;

      return {
        categoria,
        nome: NOME_CATEGORIA[categoria] ?? categoria,
        total,
        obtidos: obtidos.map(e => ({
          itemId: e.itemId,
          nome: catalogo?.resolver ? catalogo.resolver(e.itemId) : e.itemId,
          obtidoEm: e.obtidoEm
        }))
      };
    });
  }
}

module.exports = Collections;
