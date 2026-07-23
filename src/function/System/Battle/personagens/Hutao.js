'use strict';

module.exports = {
    nome:     'Hutao',
    raridade: '5',
    elemento: 'pyro',

    roles: ['dps'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'hp',
        multiplicador: 0.9,
    },

    stats: {
        hp:          15552,
        atk:         106,
        def:         876,
        proficiencia: 0,
        recarga:     100,
        critRate:    5,
        critDano:    88.4,
        velocidade:  10,
        energiaMax:  60,
    },

    constelacoes: {
        1: {
            nome:       'Nó Vermelho',
            bonusStats: { critRate: 12 },
        },
        2: {
            nome:       'Flor Carmesim',
            bonusStats: { hp: 2000 },
        },
        3: {
            nome:       'Trilha das Almas',
            bonusStats: { critDano: 20 },
        },
        4: {
            nome:       'Flores do Além',
            bonusStats: { hp: 3000 },
            trigger: 'personagem_derrotado',
            efeitos: [
                { tipo: 'cura', alvo: 'self', valor: 1500 },
            ],
        },
        5: {
            nome:       'Guardião do Caminho',
            bonusStats: { critDano: 30, critRate: 8 },
        },
        6: {
            nome:       'Borboleta\'s Embrace',
            bonusStats: { critRate: 100, critDano: 50 },
        },
    },

    ataqueNormal: {
        nome:       'Lança de Herança',
        frases: [
            'Venha comigo para o outro lado!',
            'Não tenha medo da morte.',
            'Cada fim é um novo começo.',
        ],
        geraEnergia: 4,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'pyro',
                valor:    2.0,
                escala:   'hp',
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Guia das Almas',
        frases: [
            'Deixe-me guiá-lo...',
            'O mundo dos mortos está chamando.',
            'Sua hora chegou!',
        ],
        geraEnergia: 10,
        cooldown:    4,
        efeitos: [
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'atk',
                valor:  800,
                duracao: 4,
            },
            {
                tipo:   'debuff',
                alvo:   'self',
                stat:   'hp',
                valor:  1500, // Sacrifica HP
                duracao: 1,
            },
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'pyro',
                valor:    3.5,
                escala:   'hp',
            },
        ],
    },

    supremo: {
        nome:            'Espírito da Borboleta Carmesim',
        energiaNecessaria: 60,
        cooldown:        5,
        frases: [
            'As borboletas guiam os mortos...',
            'Que sua alma encontre paz.',
            'Hutao ri pela última vez!',
            'Adeus, e boa viagem!',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'pyro',
                valor:    6.0,
                escala:   'hp',
            },
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  2000,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'critRate',
                valor:  12,
                duracao: 4,
            },
        ],
    },

    passivas: [
        {
            nome:    'Flor do Além',
            trigger: 'inicio_turno',
            condicao: { tipo: 'hp_abaixo', valor: 50 },
            efeitos: [
                {
                    tipo:   'buff',
                    alvo:   'self',
                    stat:   'critRate',
                    valor:  12,
                    duracao: 2,
                },
            ],
        },
        {
            nome:    'Lamento das Almas',
            trigger: 'reacao_elemental',
            efeitos: [
                {
                    tipo:   'energia',
                    alvo:   'self',
                    valor:  6,
                },
            ],
        },
    ],
};
