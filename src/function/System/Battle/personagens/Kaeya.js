'use strict';

/**
 * Kaeya
 * Elemento: Cryo | Raridade: 4 estrelas
 * Role: Sub-DPS, suporte
 *
 * Mecânicas únicas:
 * - Glacial Waltz: icicles que orbitam e atacam automaticamente
 * - Excelente gerador de energia para o time
 */
module.exports = {
    nome:     'Kaeya',
    raridade: '4',
    elemento: 'cryo',

    roles: ['sub_dps', 'support', 'battery'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:          11636,
        atk:         223,
        def:         792,
        proficiencia: 0,
        recarga:     116,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  60,
    },

    constelacoes: {
        1: {
            nome:       'Perigo Congelante',
            bonusStats: { recarga: 15 },
            trigger: 'reacao_elemental',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 5 },
            ],
        },
        2: {
            nome:       'Gelo Cortante',
            bonusStats: { atk: 80, critRate: 5 },
        },
        3: {
            nome:       'Tática do Cavalheiro',
            bonusStats: { atk: 100 },
        },
        4: {
            nome:       'Batalha no Gelo',
            bonusStats: { recarga: 20, atk: 100 },
        },
        5: {
            nome:       'Lança de Gelo',
            bonusStats: { atk: 150, critDano: 15 },
        },
        6: {
            nome:       'Glacial Waltz Aprimorada',
            bonusStats: { atk: 200, critRate: 10 },
            trigger: 'ataque_aliado',
            efeitos: [
                { tipo: 'dano', alvo: 'proximo_ativo', elemento: 'cryo', valor: 0.8 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Técnica de Espada Fria',
        frases: [
            'Que frio, não é?',
            'Deixe-me lidar com isso.',
            'Simples e eficiente.',
        ],
        geraEnergia: 4,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'cryo',
                valor:    1.5,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Frostgnaw',
        frases: [
            'Congele.',
            'O frio paralisa a vontade.',
            'Gelo eterno.',
        ],
        geraEnergia: 12,
        cooldown:    3,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'cryo',
                valor:    2.8,
            },
            {
                tipo:   'debuff',
                alvo:   'proximo_ativo',
                stat:   'velocidade',
                valor:  2,
                duracao: 2,
            },
        ],
    },

    supremo: {
        nome:            'Glacial Waltz',
        energiaNecessaria: 60,
        cooldown:        5,
        frases: [
            'Uma dança no gelo.',
            'Glacial Waltz!',
            'Dance comigo... no frio eterno.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'cryo',
                valor:    4.5,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'recarga',
                valor:  30,
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
            nome:    'Cold-Blooded Strike',
            trigger: 'ataque_aliado',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 4 },
            ],
        },
        {
            nome:    'Glacial Heart',
            trigger: 'reacao_elemental',
            efeitos: [
                {
                    tipo:   'buff',
                    alvo:   'self',
                    stat:   'atk',
                    valor:  150,
                    duracao: 2,
                },
            ],
        },
    ],
};
