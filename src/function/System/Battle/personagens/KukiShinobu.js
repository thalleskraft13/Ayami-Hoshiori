'use strict';

module.exports = {
    nome:     'KukiShinobu',
    raridade: '4',
    elemento: 'electro',

    roles: ['healer', 'sub_dps', 'support'],

    modoCombate: {
        principal: true,
        offField:  true,
    },

    scaling: {
        stat:          'hp',
        multiplicador: 0.75,
    },

    stats: {
        hp:          15349,
        atk:         175,
        def:         703,
        proficiencia: 76,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  60,
    },

    constelacoes: {
        1: {
            nome:       'To Cloister Compassion',
            bonusStats: { hp: 1500 },
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'cura', alvo: 'time', valor: 300 },
            ],
        },
        2: {
            nome:       'To Forsake Fortune',
            bonusStats: { hp: 2000, recarga: 15 },
        },
        3: {
            nome:       'To Sequester Sorrow',
            bonusStats: { hp: 2500 },
        },
        4: {
            nome:       'To Sever Serenity',
            bonusStats: { hp: 3000 },
            trigger: 'habilidade_aliada',
            efeitos: [
                { tipo: 'cura', alvo: 'ativo', valor: 500 },
                { tipo: 'energia', alvo: 'self', valor: 6 },
            ],
        },
        5: {
            nome:       'To Cease Courtesies',
            bonusStats: { hp: 3500, critRate: 5 },
        },
        6: {
            nome:       'To Forgo Forbearance',
            bonusStats: { hp: 4000 },
            trigger: 'inicio_turno',
            condicao: { tipo: 'hp_abaixo', valor: 25 },
            efeitos: [
                { tipo: 'dano', alvo: 'todos_inimigos', elemento: 'electro', valor: 3.5, escala: 'hp' },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Shinobu\'s Shadowsword',
        frases: [
            'Pelo juramento que fiz.',
            'Subtil e preciso.',
            'Eficiência acima de tudo.',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'electro',
                valor:    1.2,
                escala:   'hp',
            },
            {
                tipo:   'cura',
                alvo:   'ativo',
                valor:  300,
                escala: 'hp',
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Sanctifying Ring',
        frases: [
            'Anel de proteção!',
            'Cura e punição.',
            'O anel julga e cura.',
        ],
        geraEnergia: 12,
        cooldown:    3,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'electro',
                valor:    2.0,
                escala:   'hp',
            },
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  1000,
                escala: 'hp',
            },
        ],
    },

    supremo: {
        nome:            'Gyoei Narukami Kariyama Rite',
        energiaNecessaria: 60,
        cooldown:        5,
        frases: [
            'Rito Narukami!',
            'Electro absoluto!',
            'Pelo bem do grupo.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'electro',
                valor:    4.5,
                escala:   'hp',
            },
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  2500,
                escala: 'hp',
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'recarga',
                valor:  25,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'Breaking Free',
            trigger: 'ataque_aliado',
            efeitos: [
                { tipo: 'cura', alvo: 'ativo', valor: 250, escala: 'hp' },
                { tipo: 'dano', alvo: 'proximo_ativo', elemento: 'electro', valor: 0.5, escala: 'hp' },
            ],
        },
        {
            nome:    'Mending Solidarity',
            trigger: 'fim_turno',
            efeitos: [
                { tipo: 'cura', alvo: 'time', valor: 200 },
                { tipo: 'energia', alvo: 'self', valor: 4 },
            ],
        },
    ],
};
