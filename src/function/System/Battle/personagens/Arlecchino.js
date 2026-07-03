'use strict';

/**
 * Arlecchino
 * Elemento: Pyro | Raridade: 5 estrelas
 * Role: DPS principal, off-field debuffer via Marcas do Senhor da Morte
 *
 * Mecânicas únicas:
 * - Marca do Senhor da Morte: destrói a vida de inimigos via marcas acumuladas
 * - C1: Ataque Normal aplica aura Pyro adicional
 * - C2: Habilidade Elemental ganha cooldown reduzido
 */
module.exports = {
    nome:     'Arlecchino',
    raridade: '5',
    elemento: 'pyro',

    roles: ['dps'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:         13103,
        atk:        1339,
        def:        778,
        proficiencia: 0,
        recarga:    100,
        critRate:   19.2,
        critDano:   88.4,
        velocidade: 10,
        energiaMax: 60,
    },

    constelacoes: {
        1: {
            nome:       'Linhagem dos Réquiems',
            bonusStats: { critRate: 10 },
            // Efeito extra: Ataque Normal aplica aura Pyro
            trigger: null,
        },
        2: {
            nome:       'Sangue da Meia-Noite',
            bonusStats: { atk: 200 },
        },
        3: {
            nome:       'Senhor das Almas',
            bonusStats: { critDano: 20 },
        },
        4: {
            nome:       'A Morte Inevitável',
            bonusStats: { hp: 2000 },
        },
        5: {
            nome:       'Ceifadora de Almas',
            bonusStats: { atk: 300, critRate: 5 },
        },
        6: {
            nome:       'Il Capitano',
            bonusStats: { critDano: 40, atk: 500 },
            // C6: Supremo não tem cooldown
            trigger: 'supremo_aliado',
            efeitos: [
                { tipo: 'buff', alvo: 'self', stat: 'atk', valor: 800, duracao: 3 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Ceifa da Rainha da Casa',
        frases: [
            'Isso vai doer.',
            'Você não está à altura disso.',
            'Interessante... mas insuficiente.',
        ],
        geraEnergia: 4,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'pyro',
                valor:    1.8, // 180% ATK
            },
            {
                tipo:  'marca',
                alvo:  'proximo_ativo',
                id:    'marca_morte',
                valor: 50,
                duracao: 3,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Senhor da Morte: Legado Sanguinário',
        frases: [
            'Não ouse resistir.',
            'Sua alma pertence à Casa da Lareira.',
            'A chama sempre encontra seu alvo.',
        ],
        geraEnergia: 12,
        cooldown:    3,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'pyro',
                valor:    3.2, // 320% ATK
            },
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'pyro',
                valor:    1.5,
            },
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'atk',
                valor:  400,
                duracao: 3,
            },
        ],
    },

    supremo: {
        nome:            'Flagelo da Obliteração',
        energiaNecessaria: 60,
        cooldown:        4,
        frases: [
            'Isso é o fim.',
            'Nenhuma chama arde para sempre... exceto a minha.',
            'Eu sou o julgamento e a sentença.',
            'Que sua cinza sirva de aviso aos outros.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'pyro',
                valor:    5.5, // 550% ATK
            },
            {
                tipo:    'debuff',
                alvo:    'todos_inimigos',
                stat:    'def',
                valor:   30,
                duracao: 3,
            },
            {
                tipo:    'buff',
                alvo:    'self',
                stat:    'critDano',
                valor:   50,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'Sangue da Herdeira',
            trigger: 'inicio_turno',
            efeitos: [
                // Cada turno consome marcas de morte para curar Arlecchino
                {
                    tipo:   'cura',
                    alvo:   'self',
                    valor:  200,
                    escala: 'hp', // 200 flat + escala de HP
                },
            ],
        },
        {
            nome:    'Maldição da Lareira',
            trigger: 'personagem_derrotado',
            efeitos: [
                {
                    tipo:   'buff',
                    alvo:   'self',
                    stat:   'atk',
                    valor:  600,
                    duracao: 4,
                },
            ],
        },
        {
            nome:    'Fogo Eterno',
            trigger: 'reacao_elemental',
            efeitos: [
                {
                    tipo:   'energia',
                    alvo:   'self',
                    valor:  8,
                },
            ],
        },
    ],
};
