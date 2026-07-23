'use strict';

module.exports = {
    nome:     'Noelle',
    raridade: '4',
    elemento: 'geo',

    roles: ['tank', 'shielder', 'healer', 'dps'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'def',
        multiplicador: 1,
    },

    stats: {
        hp:          12071,
        atk:         191,
        def:         1116,
        proficiencia: 0,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  8,
        energiaMax:  60,
    },

    constelacoes: {
        1: {
            nome:       'I Got Your Back',
            bonusStats: { def: 100 },
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'escudo', alvo: 'ativo', valor: 500, duracao: 2 },
            ],
        },
        2: {
            nome:       'Combat Maid',
            bonusStats: { def: 150, atk: 50 },
        },
        3: {
            nome:       'Maid\'s Knighthood',
            bonusStats: { def: 200 },
        },
        4: {
            nome:       'To Be Cleaned',
            bonusStats: { def: 250 },
            trigger: 'habilidade_aliada',
            efeitos: [
                { tipo: 'cura', alvo: 'time', valor: 400 },
            ],
        },
        5: {
            nome:       'Favonius Sweeper Master',
            bonusStats: { def: 300, atk: 100 },
        },
        6: {
            nome:       'Must Be Spotless',
            bonusStats: { def: 400 },
            trigger: 'supremo_aliado',
            efeitos: [
                { tipo: 'buff', alvo: 'self', stat: 'atk', valor: 600, duracao: 4 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Favonius Bladework — Maid',
        frases: [
            'Deixa comigo!',
            'Vou limpar essa bagunça!',
            'Um cavaleiro nunca desiste!',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'geo',
                valor:    1.4,
                escala:   'def',
            },
            {
                tipo:   'cura',
                alvo:   'ativo',
                valor:  200,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Breastplate',
        frases: [
            'Vou proteger todos!',
            'Escudo de pedra!',
            'Ninguém passa por mim!',
        ],
        geraEnergia: 10,
        cooldown:    3,
        efeitos: [
            {
                tipo:   'escudo',
                alvo:   'time',
                valor:  1200,
                elemento: 'geo',
                duracao: 4,
            },
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'geo',
                valor:    2.0,
                escala:   'def',
            },
        ],
    },

    supremo: {
        nome:            'Sweeping Time',
        energiaNecessaria: 60,
        cooldown:        5,
        frases: [
            'Hora de varrer!',
            'A vassoura da justiça!',
            'Nenhuma sujeira sobreviverá!',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'geo',
                valor:    4.5,
                escala:   'def',
            },
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'atk',
                valor:  500,
                duracao: 4,
            },
            {
                tipo:   'escudo',
                alvo:   'time',
                valor:  1500,
                elemento: 'geo',
                duracao: 4,
            },
        ],
    },

    passivas: [
        {
            nome:    'Devotion',
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'escudo', alvo: 'ativo', valor: 400, duracao: 2 },
                { tipo: 'cura',   alvo: 'ativo', valor: 200 },
            ],
        },
        {
            nome:    'Nice and Clean',
            trigger: 'personagem_derrotado',
            efeitos: [
                { tipo: 'cura',   alvo: 'time',  valor: 800 },
                { tipo: 'escudo', alvo: 'time',  valor: 800, duracao: 3 },
            ],
        },
    ],
};
