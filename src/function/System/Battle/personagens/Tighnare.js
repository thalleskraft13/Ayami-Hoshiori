'use strict';

/**
 * Tighnari
 * Elemento: Dendro | Raridade: 5 estrelas
 * Role: DPS, Sub-DPS
 *
 * Mecânicas únicas:
 * - Atira flechas Dendro de carregamento rápido após habilidade
 * - Altamente escalável com Proficiência Elemental
 */
module.exports = {
    nome:     'Tighnari',
    raridade: '5',
    elemento: 'dendro',

    roles: ['dps', 'sub_dps'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'proficiencia',
        multiplicador: 0.9,
    },

    stats: {
        hp:          10850,
        atk:         267,
        def:         630,
        proficiencia: 868,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  40,
    },

    constelacoes: {
        1: {
            nome:       'Julgamento do Observador',
            bonusStats: { proficiencia: 200 },
        },
        2: {
            nome:       'Inteligência da Floresta',
            bonusStats: { critRate: 10, proficiencia: 100 },
        },
        3: {
            nome:       'Sabedoria Vegetal',
            bonusStats: { proficiencia: 200, critDano: 15 },
        },
        4: {
            nome:       'Protetor da Floresta',
            bonusStats: { proficiencia: 200 },
            trigger: 'reacao_elemental',
            efeitos: [
                { tipo: 'buff', alvo: 'time', stat: 'proficiencia', valor: 150, duracao: 2 },
            ],
        },
        5: {
            nome:       'Guardião Verde',
            bonusStats: { proficiencia: 400, critRate: 8 },
        },
        6: {
            nome:       'Eco da Floresta Vasta',
            bonusStats: { proficiencia: 600, critDano: 30 },
        },
    },

    ataqueNormal: {
        nome:       'Flecha Khanda',
        frases: [
            'Conheço bem este terreno.',
            'Uma análise precisa.',
            'A floresta sempre vence.',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'dendro',
                valor:    1.5,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Vijnana-Phala Mine',
        frases: [
            'Observe a natureza.',
            'A floresta responde.',
            'Dendro em sua forma pura.',
        ],
        geraEnergia: 8,
        cooldown:    2,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'dendro',
                valor:    2.8,
            },
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'proficiencia',
                valor:  300,
                duracao: 3,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'def',
                valor:  20,
                duracao: 2,
            },
        ],
    },

    supremo: {
        nome:            'Fashioner\'s Tanglevine Shaft',
        energiaNecessaria: 40,
        cooldown:        4,
        frases: [
            'A floresta reclamará o que é seu.',
            'Dendro absoluto.',
            'Isso acabará rapidamente.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'dendro',
                valor:    5.5,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'proficiencia',
                valor:  400,
                duracao: 4,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'def',
                valor:  30,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'Instinto da Floresta',
            trigger: 'reacao_elemental',
            efeitos: [
                {
                    tipo:   'buff',
                    alvo:   'self',
                    stat:   'critRate',
                    valor:  10,
                    duracao: 2,
                },
            ],
        },
        {
            nome:    'Observação Precisa',
            trigger: 'fim_turno',
            efeitos: [
                {
                    tipo:   'energia',
                    alvo:   'self',
                    valor:  4,
                },
            ],
        },
    ],
};
