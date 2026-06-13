'use strict';

/**
 * Lisa
 * Elemento: Electro | Raridade: 4 estrelas
 * Role: Sub-DPS, Debuffer
 *
 * Mecânicas únicas:
 * - Acumula cargas de Conduta nos inimigos
 * - Supremo reduz DEF dos inimigos massivamente
 */
module.exports = {
    nome:     'Lisa',
    raridade: '4',
    elemento: 'electro',

    roles: ['sub_dps', 'debuffer'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:          9570,
        atk:         232,
        def:         573,
        proficiencia: 96,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  80,
    },

    constelacoes: {
        1: {
            nome:       'Infinite Circuit',
            bonusStats: { recarga: 15 },
            trigger: 'reacao_elemental',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 6 },
            ],
        },
        2: {
            nome:       'Electromagnetic Field',
            bonusStats: { atk: 80, proficiencia: 100 },
        },
        3: {
            nome:       'Overloaded',
            bonusStats: { atk: 120 },
        },
        4: {
            nome:       'Plasma Eruption',
            bonusStats: { atk: 150, proficiencia: 150 },
        },
        5: {
            nome:       'Electrocute',
            bonusStats: { atk: 200, critRate: 8 },
        },
        6: {
            nome:       'Pulsating Witch',
            bonusStats: { atk: 250, proficiencia: 200 },
            trigger: 'supremo_aliado',
            efeitos: [
                { tipo: 'debuff', alvo: 'todos_inimigos', stat: 'def', valor: 40, duracao: 3 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Lightning Touch',
        frases: [
            'Não teste minha paciência.',
            'Deixe-me verificar sua carga elétrica.',
            'Isso vai doer um pouquinho.',
        ],
        geraEnergia: 4,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'electro',
                valor:    1.4,
            },
            {
                tipo:   'marca',
                alvo:   'proximo_ativo',
                id:     'conduta',
                valor:  60,
                duracao: 2,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Violet Arc',
        frases: [
            'Carga total!',
            'Arco violeta!',
            'Sinta o poder do raio.',
        ],
        geraEnergia: 12,
        cooldown:    3,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'electro',
                valor:    3.2,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'def',
                valor:  25,
                duracao: 2,
            },
        ],
    },

    supremo: {
        nome:            'Lightning Rose',
        energiaNecessaria: 80,
        cooldown:        6,
        frases: [
            'Rosa de raios!',
            'O campo elétrico domina tudo.',
            'Que a eletricidade julgue a todos.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'electro',
                valor:    5.0,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'def',
                valor:  50,
                duracao: 4,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'atk',
                valor:  200,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'General Pharmaceutics',
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 5 },
            ],
        },
        {
            nome:    'Induced Aftershock',
            trigger: 'reacao_elemental',
            efeitos: [
                {
                    tipo:   'buff',
                    alvo:   'self',
                    stat:   'atk',
                    valor:  200,
                    duracao: 2,
                },
            ],
        },
    ],
};
