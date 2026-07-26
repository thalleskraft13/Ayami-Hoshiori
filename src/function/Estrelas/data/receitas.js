'use strict';

// Catálogo estático de receitas da Oficina.
// custoRecursos / custoEstrelas: o que é consumido para fabricar 1 unidade.
// resultado: item produzido e guardado em inventario.itens.
// Estrutura pensada para permitir novas receitas sem alterar o serviço (Workshop.js).
module.exports = {

  tabua_madeira: {
    id: 'tabua_madeira',
    nome: 'Tábua de Madeira',
    custoRecursos: { madeira: 4 },
    custoEstrelas: 0,
    resultado: { itemId: 'tabua_madeira', quantidade: 1 }
  },

  lingote_ferro: {
    id: 'lingote_ferro',
    nome: 'Lingote de Ferro',
    custoRecursos: { ferro: 3, pedra: 1 },
    custoEstrelas: 0,
    resultado: { itemId: 'lingote_ferro', quantidade: 1 }
  },

  po_de_cristal: {
    id: 'po_de_cristal',
    nome: 'Pó de Cristal',
    custoRecursos: { cristais: 2 },
    custoEstrelas: 0,
    resultado: { itemId: 'po_de_cristal', quantidade: 1 }
  },

  pergaminho_estelar: {
    id: 'pergaminho_estelar',
    nome: 'Pergaminho Estelar',
    custoRecursos: { livros: 2, poeiraEstelar: 1 },
    custoEstrelas: 10,
    resultado: { itemId: 'pergaminho_estelar', quantidade: 1 }
  },

  amuleto_lunar: {
    id: 'amuleto_lunar',
    nome: 'Amuleto Lunar',
    custoRecursos: { reliquias: 1, cogumelos: 3 },
    custoEstrelas: 25,
    resultado: { itemId: 'amuleto_lunar', quantidade: 1 }
  }

};
