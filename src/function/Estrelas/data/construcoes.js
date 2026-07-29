'use strict';

module.exports = {

  construcoes: {
    canteiro_extra: {
      id: 'canteiro_extra',
      nome: 'Canteiro Extra',
      emoji: '🪴',
      descricao: 'Adiciona 1 novo canteiro ao seu jardim.',
      custoEstrelas: 500,
      custoRecursos: { madeira: 10, pedra: 5 }
    },
    cerca_decorativa: {
      id: 'cerca_decorativa',
      nome: 'Cerca Decorativa',
      emoji: '🪵',
      descricao: 'Uma cerca simples para embelezar o jardim.',
      custoEstrelas: 150,
      custoRecursos: { madeira: 5 }
    }
  },

  decoracoes: {
    lanterna_estelar: {
      id: 'lanterna_estelar',
      nome: 'Lanterna Estelar',
      emoji: '🏮',
      custoEstrelas: 200,
      custoRecursos: { poeiraEstelar: 1 }
    },
    banco_de_pedra: {
      id: 'banco_de_pedra',
      nome: 'Banco de Pedra',
      emoji: '🪨',
      custoEstrelas: 120,
      custoRecursos: { pedra: 4 }
    }
  }

};
