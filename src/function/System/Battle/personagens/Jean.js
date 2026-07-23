'use strict';

module.exports = {
    nome:     'Jean',
    raridade: '5',
    elemento: 'anemo',

    roles: ['healer', 'support', 'buffer'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:          14695,
        atk:         239,
        def:         769,
        proficiencia: 0,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  80,
    },

    constelacoes: {
        1: {
            nome:       'Proteção do General',
            bonusStats: { recarga: 20 },
            trigger: 'habilidade_aliada',
            efeitos: [
                { tipo: 'cura', alvo: 'ativo', valor: 300 },
            ],
        },
        2: {
            nome:       'Gentileza do Líder',
            bonusStats: { atk: 100 },
        },
        3: {
            nome:       'Compaixão da Cavalaria',
            bonusStats: { atk: 150, recarga: 20 },
        },
        4: {
            nome:       'Cura do Vento',
            bonusStats: {},
            // C4: Supremo cura o time inteiro (implementado no supremo diretamente)
        },
        5: {
            nome:       'Espírito do Cavaleiro',
            bonusStats: { atk: 200, critRate: 5 },
        },
        6: {
            nome:       'Bênção do Dandelion',
            bonusStats: { atk: 300, recarga: 30 },
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'cura', alvo: 'time', valor: 200 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Técnica de Espada Favonius',
        frases: [
            'Meu dever chama.',
            'Em nome de Mondstadt!',
            'Eu não cedo.',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'anemo',
                valor:    1.4,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Sopro de Dandélion',
        frases: [
            'Que o vento te guie!',
            'Dandelion, carregue-os!',
            'Recue agora.',
        ],
        geraEnergia: 15,
        cooldown:    3,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'anemo',
                valor:    3.0,
            },
            {
                tipo:   'cura',
                alvo:   'ativo',
                valor:  600,
            },
            {
                tipo:   'buff',
                alvo:   'ativo',
                stat:   'velocidade',
                valor:  3,
                duracao: 2,
            },
        ],
    },

    supremo: {
        nome:            'Campo Dandelion',
        energiaNecessaria: 80,
        cooldown:        6,
        frases: [
            'Que este campo nos proteja.',
            'Mondstadt sempre renascerá.',
            'Dandelions... sempre voltam a florescer.',
            'A liberdade do vento pertence a todos.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'anemo',
                valor:    4.0,
            },
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  1200,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'def',
                valor:  300,
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
            nome:    'Bênção do Líder',
            trigger: 'inicio_turno',
            efeitos: [
                {
                    tipo:   'cura',
                    alvo:   'time',
                    valor:  180,
                },
            ],
        },
        {
            nome:    'Cura em Batalha',
            trigger: 'personagem_derrotado',
            efeitos: [
                {
                    tipo:   'cura',
                    alvo:   'time',
                    valor:  800,
                },
                {
                    tipo:   'buff',
                    alvo:   'time',
                    stat:   'def',
                    valor:  200,
                    duracao: 3,
                },
            ],
        },
        {
            nome:    'Resolução do General',
            trigger: 'habilidade_aliada',
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
