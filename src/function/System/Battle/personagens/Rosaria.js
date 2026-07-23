'use strict';

module.exports = {
    nome:     'Rosaria',
    raridade: '4',
    elemento: 'cryo',

    roles: ['sub_dps', 'support', 'buffer'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:          12289,
        atk:         240,
        def:         710,
        proficiencia: 0,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  60,
    },

    constelacoes: {
        1: {
            nome:       'Unholy Revelation',
            bonusStats: { critRate: 10 },
            trigger: 'ataque_aliado',
            efeitos: [
                { tipo: 'buff', alvo: 'self', stat: 'atk', valor: 100, duracao: 2 },
            ],
        },
        2: {
            nome:       'Land Without Promise',
            bonusStats: { critDano: 16 },
        },
        3: {
            nome:       'The Wages of Sin',
            bonusStats: { atk: 100, critRate: 5 },
        },
        4: {
            nome:       'Painful Grace',
            bonusStats: { recarga: 25 },
            trigger: 'habilidade_aliada',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 8 },
            ],
        },
        5: {
            nome:       'Last Rites',
            bonusStats: { atk: 150, critRate: 8 },
        },
        6: {
            nome:       'Divine Retribution',
            bonusStats: { atk: 200, critDano: 25 },
            trigger: 'supremo_aliado',
            efeitos: [
                { tipo: 'debuff', alvo: 'todos_inimigos', stat: 'def', valor: 30, duracao: 3 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Spear of the Church',
        frases: [
            'Confissão... ou morte.',
            'A Cryo-Igreja julga a todos.',
            'Peça perdão antes.',
        ],
        geraEnergia: 4,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'cryo',
                valor:    1.6,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Ravaging Confession',
        frases: [
            'Confissão forçada.',
            'Gelo e aço.',
            'Teleporte nas sombras.',
        ],
        geraEnergia: 10,
        cooldown:    2,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'cryo',
                valor:    2.8,
            },
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'critRate',
                valor:  12,
                duracao: 3,
            },
        ],
    },

    supremo: {
        nome:            'Rite of Termination',
        energiaNecessaria: 60,
        cooldown:        5,
        frases: [
            'Rito final.',
            'Que o gelo eterno te consuma.',
            'Não há misericórdia aqui.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'cryo',
                valor:    4.8,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'critRate',
                valor:  15,
                duracao: 4,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'def',
                valor:  20,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'Regina Probationum',
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'buff', alvo: 'time', stat: 'critRate', valor: 8, duracao: 2 },
            ],
        },
        {
            nome:    'Shadow Samaritan',
            trigger: 'reacao_elemental',
            efeitos: [
                { tipo: 'buff', alvo: 'self', stat: 'atk', valor: 180, duracao: 2 },
            ],
        },
    ],
};
