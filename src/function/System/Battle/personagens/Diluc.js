'use strict';

/**
 * Diluc
 * Elemento: Pyro | Raridade: 5 estrelas
 * Role: DPS principal
 *
 * Mecânicas únicas:
 * - Habilidade Elemental pode ser usada 3 vezes em sequência
 * - Infunde Pyro no ataque normal após usar o Supremo
 */
module.exports = {
    nome:     'Diluc',
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
        hp:          12981,
        atk:         335,
        def:         784,
        proficiencia: 0,
        recarga:     100,
        critRate:    5,
        critDano:    88.4,
        velocidade:  10,
        energiaMax:  40,
    },

    constelacoes: {
        1: {
            nome:       'Visão Ardente',
            bonusStats: { critRate: 15 },
        },
        2: {
            nome:       'Fogo Indomável',
            bonusStats: { atk: 150 },
        },
        3: {
            nome:       'Chamas do Passado',
            bonusStats: { critDano: 20 },
        },
        4: {
            nome:       'Herdeiro da Noite',
            bonusStats: { atk: 200 },
            trigger: 'supremo_aliado',
            efeitos: [
                { tipo: 'buff', alvo: 'self', stat: 'atk', valor: 500, duracao: 3 },
            ],
        },
        5: {
            nome:       'Lorde de Mondstadt',
            bonusStats: { atk: 300, critRate: 8 },
        },
        6: {
            nome:       'Fênix Negra',
            bonusStats: { critDano: 50, atk: 400 },
        },
    },

    ataqueNormal: {
        nome:       'Técnica de Espada do Favonius',
        frases: [
            'Não me faça repetir isso.',
            'Mondstadt não cairá.',
            'Fogo e determinação.',
        ],
        geraEnergia: 5,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'pyro',
                valor:    2.2,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Sear',
        frases: [
            'Queime.',
            'Reduza a cinzas.',
            'O fogo não mente.',
        ],
        geraEnergia: 8,
        cooldown:    2,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'pyro',
                valor:    3.8,
            },
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'pyro',
                valor:    1.5,
            },
        ],
    },

    supremo: {
        nome:            'Dawn',
        energiaNecessaria: 40,
        cooldown:        4,
        frases: [
            'Que o amanhecer queime tudo.',
            'O Favonius nunca se apaga.',
            'Nenhuma escuridão sobrevive ao amanhecer.',
            'É isso que protejo.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'pyro',
                valor:    7.0,
            },
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'atk',
                valor:  600,
                duracao: 4,
            },
            {
                tipo:   'debuff',
                alvo:   'todos_inimigos',
                stat:   'def',
                valor:  25,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'Maestria Ardente',
            trigger: 'reacao_elemental',
            efeitos: [
                {
                    tipo:   'buff',
                    alvo:   'self',
                    stat:   'atk',
                    valor:  300,
                    duracao: 2,
                },
            ],
        },
        {
            nome:    'Determinação do Cavaleiro',
            trigger: 'inicio_turno',
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
