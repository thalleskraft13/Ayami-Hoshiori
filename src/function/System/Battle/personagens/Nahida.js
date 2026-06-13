'use strict';

/**
 * Nahida
 * Elemento: Dendro | Raridade: 5 estrelas
 * Role: Sub-DPS, suporte, off-field
 *
 * Mecânicas únicas:
 * - Karma Elemental: aplica marcas que explodem com reações
 * - Extremamente eficaz em campo (on e off-field)
 * - C1: Karma aumenta dano de Electro e Hydro do time
 */
module.exports = {
    nome:     'Nahida',
    raridade: '5',
    elemento: 'dendro',

    roles: ['sub_dps', 'support', 'debuffer'],

    modoCombate: {
        principal: true,
        offField:  true, // Nahida pode agir off-field
    },

    scaling: {
        stat:          'proficiencia',
        multiplicador: 0.8,
    },

    stats: {
        hp:          10360,
        atk:         794,
        def:         630,
        proficiencia: 960,
        recarga:     120,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  50,
    },

    constelacoes: {
        1: {
            nome:       'Aglomerado do Corpo Físico',
            bonusStats: { proficiencia: 200 },
            // Karma aumenta dano de aliados com Electro/Hydro
            trigger: 'habilidade_aliada',
            efeitos: [
                { tipo: 'buff', alvo: 'ativo', stat: 'atk', valor: 150, duracao: 2 },
            ],
        },
        2: {
            nome:       'Acumulação de Carma',
            bonusStats: { proficiencia: 200, critRate: 8 },
        },
        3: {
            nome:       'Dharma do Cosmos',
            bonusStats: { proficiencia: 300 },
        },
        4: {
            nome:       'Karma Infinito',
            bonusStats: { proficiencia: 200 },
            trigger: 'reacao_elemental',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 10 },
            ],
        },
        5: {
            nome:       'Visão da Sabedoria',
            bonusStats: { proficiencia: 400, critDano: 20 },
        },
        6: {
            nome:       'Iluminação Plena',
            bonusStats: { proficiencia: 600, critRate: 20 },
        },
    },

    ataqueNormal: {
        nome:       'Varas de Princípio Budista',
        frases: [
            'Tudo é interconectado.',
            'O conhecimento é o verdadeiro tesouro.',
            'Eu observo tudo.',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'dendro',
                valor:    1.2,
            },
            {
                tipo:   'marca',
                alvo:   'proximo_ativo',
                id:     'karma_elemental',
                valor:  80,
                duracao: 2,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Apreensão do Todo-Conhecimento',
        frases: [
            'Cada ação tem consequência.',
            'O carma se acumula...',
            'Que o conhecimento te guie.',
        ],
        geraEnergia: 10,
        cooldown:    2,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'dendro',
                valor:    2.5,
            },
            {
                tipo:   'marca',
                alvo:   'todos_inimigos',
                id:     'karma_elemental',
                valor:  120,
                duracao: 3,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'proficiencia',
                valor:  200,
                duracao: 2,
            },
        ],
    },

    supremo: {
        nome:            'Iluminação Ilimitada: Mandala de Sakara',
        energiaNecessaria: 50,
        cooldown:        5,
        frases: [
            'Que todos os seres sejam iluminados.',
            'O mundo inteiro é minha biblioteca.',
            'Eu vejo tudo, sei tudo... e mesmo assim, aqui estou.',
            'Sakara se abre — contemplem o verdadeiro conhecimento.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'dendro',
                valor:    4.8,
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
                valor:  25,
                duracao: 4,
            },
        ],
    },

    passivas: [
        {
            nome:    'Mente do Lótus',
            trigger: 'ataque_aliado',
            // Off-field: Nahida aplica Dendro em ataques de aliados
            efeitos: [
                {
                    tipo:     'dano',
                    alvo:     'proximo_ativo',
                    elemento: 'dendro',
                    valor:    0.8, // 80% da proficiência de Nahida
                },
            ],
        },
        {
            nome:    'Sabedoria Eterna',
            trigger: 'reacao_elemental',
            efeitos: [
                {
                    tipo:   'buff',
                    alvo:   'ativo',
                    stat:   'proficiencia',
                    valor:  100,
                    duracao: 2,
                },
            ],
        },
        {
            nome:    'Dharma Vigilante',
            trigger: 'fim_turno',
            // Karma acumulado explode se ainda estiver no inimigo
            efeitos: [
                {
                    tipo:     'dano',
                    alvo:     'proximo_ativo',
                    elemento: 'dendro',
                    valor:    0.6,
                },
            ],
        },
    ],
};
