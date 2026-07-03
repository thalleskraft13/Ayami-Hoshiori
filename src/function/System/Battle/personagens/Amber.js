'use strict';

/**
 * Amber
 * Elemento: Pyro | Raridade: 4 estrelas
 * Role: Sub-DPS, suporte básico
 *
 * Mecânicas únicas:
 * - Barão Coelho: isca que explode
 * - Chuva de Flechas: dano em área com aplicação Pyro
 */
module.exports = {
    nome:     'Amber',
    raridade: '4',
    elemento: 'pyro',

    roles: ['sub_dps', 'support'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:          9461,
        atk:         223,
        def:         601,
        proficiencia: 0,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  40,
    },

    constelacoes: {
        1: {
            nome:       'Dois Barões Coelho',
            bonusStats: { atk: 80 },
        },
        2: {
            nome:       'Explosão Dupla',
            bonusStats: { critRate: 10 },
        },
        3: {
            nome:       'Coelho Ágil',
            bonusStats: { atk: 100 },
        },
        4: {
            nome:       'Fogo Cruzado',
            bonusStats: { atk: 150 },
            trigger: 'supremo_aliado',
            efeitos: [
                { tipo: 'buff', alvo: 'time', stat: 'atk', valor: 200, duracao: 2 },
            ],
        },
        5: {
            nome:       'Flecha Certeira',
            bonusStats: { atk: 200, critRate: 8 },
        },
        6: {
            nome:       'Flechas do Amanhecer',
            bonusStats: { atk: 250, critDano: 30 },
        },
    },

    ataqueNormal: {
        nome:       'Disparo Sharpshooting',
        frases: [
            'Nunca erro o alvo!',
            'Cavaleiros de Favonius, avante!',
            'Simples assim!',
        ],
        geraEnergia: 4,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'pyro',
                valor:    1.6,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Explosão do Barão Coelho',
        frases: [
            'Barão Coelho, é sua hora!',
            'Surpresa!',
            'Boom!',
        ],
        geraEnergia: 8,
        cooldown:    2,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'pyro',
                valor:    2.5,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'atk',
                valor:  150,
                duracao: 2,
            },
        ],
    },

    supremo: {
        nome:            'Chuva de Flechas Ígneas',
        energiaNecessaria: 40,
        cooldown:        3,
        frases: [
            'Chuva de fogo!',
            'O céu está pegando fogo!',
            'Flecha após flecha!',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'pyro',
                valor:    4.5,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'atk',
                valor:  250,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'Paixão pelo Fogo',
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
        {
            nome:    'Olho de Águia',
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 4 },
            ],
        },
    ],
};
