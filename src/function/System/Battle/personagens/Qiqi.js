'use strict';

module.exports = {
    nome:     'Qiqi',
    raridade: '5',
    elemento: 'cryo',

    roles: ['healer', 'support'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:          12368,
        atk:         287,
        def:         922,
        proficiencia: 0,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  8,
        energiaMax:  80,
    },

    constelacoes: {
        1: {
            nome:       'Vozes dos Mortos-Vivos',
            bonusStats: { recarga: 25 },
        },
        2: {
            nome:       'Anseio dos Mortos-Vivos',
            bonusStats: { atk: 80 },
            trigger: 'habilidade_aliada',
            efeitos: [
                { tipo: 'cura', alvo: 'time', valor: 300 },
            ],
        },
        3: {
            nome:       'Consolo dos Mortos-Vivos',
            bonusStats: { atk: 120 },
        },
        4: {
            nome:       'Resistência dos Mortos-Vivos',
            bonusStats: { def: 200 },
        },
        5: {
            nome:       'Glória dos Mortos-Vivos',
            bonusStats: { atk: 200, recarga: 20 },
        },
        6: {
            nome:       'Despertar dos Mortos-Vivos',
            bonusStats: { atk: 300 },
            trigger: 'personagem_derrotado',
            efeitos: [
                { tipo: 'reviver', alvo: 'aliado_morto', hp: 1500 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Espada Ancestral',
        frases: [
            'Não se aproxime...',
            'Eu vou te curar.',
            'Fique quieto.',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'cryo',
                valor:    1.2,
            },
            {
                tipo:   'cura',
                alvo:   'ativo',
                valor:  350,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Adeptus Arte: Cryo Heraldo',
        frases: [
            'Fique parado, vou curar você.',
            'A neve traz calma.',
            'Não sinta dor.',
        ],
        geraEnergia: 14,
        cooldown:    3,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'cryo',
                valor:    2.2,
            },
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  800,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'def',
                valor:  200,
                duracao: 3,
            },
        ],
    },

    supremo: {
        nome:            'Adeptus Arte: Preceito Cryo',
        energiaNecessaria: 80,
        cooldown:        6,
        frases: [
            'Durma... e acorde curado.',
            'O frio cura todas as feridas.',
            'Descanse agora.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'cryo',
                valor:    3.5,
            },
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  2500,
            },
            {
                tipo:   'marca',
                alvo:   'todos_inimigos',
                id:     'talismã_cura',
                valor:  400,
                duracao: 4,
            },
        ],
    },

    passivas: [
        {
            nome:    'Receita Médica',
            trigger: 'inicio_turno',
            efeitos: [
                {
                    tipo:   'cura',
                    alvo:   'time',
                    valor:  250,
                },
            ],
        },
        {
            nome:    'Talismã de Cura',
            trigger: 'ataque_aliado',
            efeitos: [
                {
                    tipo:   'cura',
                    alvo:   'ativo',
                    valor:  300,
                },
            ],
        },
    ],
};
