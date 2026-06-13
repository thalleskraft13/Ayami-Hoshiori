'use strict';

/**
 * Xingqiu
 * Elemento: Hydro | Raridade: 4 estrelas
 * Role: Sub-DPS off-field, suporte, redutor de dano
 *
 * Mecânicas únicas:
 * - Espadas de Chuva: ataques coordenados massivos off-field
 * - Escudo de Redução de Dano via espadas
 * - C6: Espadas de Chuva aplicam Hydro continuamente
 */
module.exports = {
    nome:     'Xingqiu',
    raridade: '4',
    elemento: 'hydro',

    roles: ['sub_dps', 'support', 'battery'],

    modoCombate: {
        principal: false,
        offField:  true, // Xingqiu é um clássico off-field
    },

    scaling: {
        stat:          'atk',
        multiplicador: 0.9,
    },

    stats: {
        hp:          10222,
        atk:         202,
        def:         758,
        proficiencia: 20,
        recarga:     130,
        critRate:    5,
        critDano:    50,
        velocidade:  8,
        energiaMax:  80,
    },

    constelacoes: {
        1: {
            nome:       'O Peso das Páginas',
            bonusStats: { recarga: 20 },
        },
        2: {
            nome:       'Chuva Consoladora',
            bonusStats: { atk: 50 },
            // C2: Espadas de Chuva reduzem dano recebido pelo aliado ativo
            trigger: 'ataque_aliado',
            efeitos: [
                { tipo: 'escudo', alvo: 'ativo', valor: 300, duracao: 1 },
            ],
        },
        3: {
            nome:       'Torrente de Sabers',
            bonusStats: { atk: 80 },
        },
        4: {
            nome:       'Estudo Dedicado',
            bonusStats: { recarga: 30, atk: 50 },
        },
        5: {
            nome:       'Leituras Noturnas',
            bonusStats: { atk: 100 },
        },
        6: {
            nome:       'Orvalho da Madrugada',
            bonusStats: { atk: 150, proficiencia: 100 },
            // C6: Espadas de Chuva sempre aplicam Hydro
            trigger: 'ataque_aliado',
            efeitos: [
                { tipo: 'dano', alvo: 'proximo_ativo', elemento: 'hydro', valor: 0.6 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Toque da Talude',
        frases: [
            'Modéstia acima de tudo.',
            'A chuva lava tudo.',
            'Cada golpe conta uma história.',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'hydro',
                valor:    1.3,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Guarda-Chuva de Seda de Ouro',
        frases: [
            'A chuva de outono cai suavemente.',
            'Cada gota é uma palavra de bênção.',
        ],
        geraEnergia: 15,
        cooldown:    3,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'hydro',
                valor:    2.8,
            },
            {
                tipo:   'cura',
                alvo:   'ativo',
                valor:  500,
            },
        ],
    },

    supremo: {
        nome:            'Donjon da Lâmina de Fuso',
        energiaNecessaria: 80,
        cooldown:        6,
        frases: [
            'Que as espadas de chuva protejam nosso caminho.',
            'As lâminas de chuva seguem a vontade do destino.',
            'Leia... e depois, lute.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'hydro',
                valor:    4.5,
            },
            {
                tipo:   'escudo',
                alvo:   'time',
                valor:  800,
                duracao: 4,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'atk',
                valor:  200,
                duracao: 4,
            },
        ],
    },

    passivas: [
        {
            nome:    'Espadas de Chuva',
            trigger: 'ataque_aliado',
            // Ativação off-field: toda vez que o aliado ativo ataca, Xingqiu responde
            efeitos: [
                {
                    tipo:     'dano',
                    alvo:     'proximo_ativo',
                    elemento: 'hydro',
                    valor:    1.1, // 110% ATK Xingqiu
                },
                {
                    tipo:   'cura',
                    alvo:   'ativo',
                    valor:  150,
                },
            ],
        },
        {
            nome:    'Leitura à Luz da Vela',
            trigger: 'fim_turno',
            efeitos: [
                {
                    tipo:   'energia',
                    alvo:   'self',
                    valor:  5,
                },
            ],
        },
        {
            nome:    'Véu de Chuva',
            trigger: 'troca_personagem',
            // Quando troca para campo, cria escudo temporário
            efeitos: [
                {
                    tipo:   'escudo',
                    alvo:   'ativo',
                    valor:  400,
                    duracao: 2,
                },
            ],
        },
    ],
};
