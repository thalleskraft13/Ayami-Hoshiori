'use strict';

// Catálogo estático de sementes plantáveis no Jardim.
// custoRecursos: o que é consumido do inventário para plantar.
// colheita: recursos gerados quando a planta está pronta e é colhida.
module.exports = {

  flor_estelar: {
    id: 'flor_estelar',
    nome: 'Flor Estelar',
    emoji: '🌸',
    tempoMinutos: 30,
    custoRecursos: {},
    colheita: { flores: 3 }
  },

  cogumelo_lunar: {
    id: 'cogumelo_lunar',
    nome: 'Cogumelo Lunar',
    emoji: '🍄',
    tempoMinutos: 20,
    custoRecursos: {},
    colheita: { cogumelos: 3 }
  },

  arvore_pequena: {
    id: 'arvore_pequena',
    nome: 'Arvorezinha',
    emoji: '🌱',
    tempoMinutos: 90,
    custoRecursos: { madeira: 2 },
    colheita: { madeira: 6 }
  },

  cristal_bruto: {
    id: 'cristal_bruto',
    nome: 'Broto de Cristal',
    emoji: '💎',
    tempoMinutos: 180,
    custoRecursos: { poeiraEstelar: 2 },
    colheita: { cristais: 4, poeiraEstelar: 1 }
  }

};
