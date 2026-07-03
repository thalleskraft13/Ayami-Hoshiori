'use strict';

/**
 * Sethos
 * Elemento: Electro | Raridade: 4 estrelas
 * Role: DPS, Sub-DPS
 *
 * Mecânicas únicas:
 * - Consome energia para ampliar dano das flechas carregadas
 * - Altamente eficiente em equipes de Intensificação (Electro + Dendro)
 */
module.exports = {
    nome:     'Sethos',
    raridade: '4',
    elemento: 'electro',

    roles: ['dps', 'sub_dps'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'atk',
        multiplicador: 1,
    },

    stats: {
        hp:          10822,
        atk:         251,
        def:         653,
        proficiencia: 115,
        recarga:     100,
        critRate:    5,
        critDano:    50,
        velocidade:  9,
        energiaMax:  60,
    },

    constelacoes: {
        1: {
            nome:       'Arakaali\'s Gaze',
            bonusStats: { critRate: 8 },
        },
        2: {
            nome:       'Venom of the Asp',
            bonusStats: { atk: 100, proficiencia: 100 },
        },
        3: {
            nome:       'Embalmed Vitality',
            bonusStats: { atk: 150, critDano: 15 },
        },
        4: {
            nome:       'Scarlet Sands Unleashed',
            bonusStats: { proficiencia: 200 },
            trigger: 'reacao_elemental',
            efeitos: [
                { tipo: 'buff', alvo: 'self', stat: 'atk', valor: 200, duracao: 2 },
            ],
        },
        5: {
            nome:       'Death Arrives',
            bonusStats: { atk: 200, critRate: 10 },
        },
        6: {
            nome:       'Labyrinth Quicksand',
            bonusStats: { atk: 250, critDano: 30, proficiencia: 200 },
        },
    },

    ataqueNormal: {
        nome:       'Royal Reed Archery',
        frases: [
            'A flecha do deserto não erra.',
            'Pelo Deus dos Mortos.',
            'Silêncio eterno.',
        ],
        geraEnergia: 4,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'electro',
                valor:    1.6,
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Ancient Rite: The Thundering Sands',
        frases: [
            'Areia e raio!',
            'O deserto consome tudo.',
            'Rito ancestral!',
        ],
        geraEnergia: 10,
        cooldown:    2,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'electro',
                valor:    2.8,
            },
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'critRate',
                valor:  10,
                duracao: 3,
            },
        ],
    },

    supremo: {
        nome:            'Secret Rite: Twilight Shadowpiercer',
        energiaNecessaria: 60,
        cooldown:        5,
        frases: [
            'Sombra do crepúsculo!',
            'Nenhuma defesa resiste.',
            'O deserto engole tudo.',
        ],
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'todos_inimigos',
                elemento: 'electro',
                valor:    5.2,
            },
            {
                tipo:   'buff',
                alvo:   'self',
                stat:   'atk',
                valor:  400,
                duracao: 3,
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'proficiencia',
                valor:  150,
                duracao: 3,
            },
        ],
    },

    passivas: [
        {
            nome:    'Black Kite\'s Enigma',
            trigger: 'reacao_elemental',
            efeitos: [
                { tipo: 'energia', alvo: 'self', valor: 6 },
                { tipo: 'buff', alvo: 'self', stat: 'critDano', valor: 15, duracao: 2 },
            ],
        },
        {
            nome:    'Dunes of Remembrance',
            trigger: 'fim_turno',
            efeitos: [
                { tipo: 'buff', alvo: 'self', stat: 'atk', valor: 150, duracao: 2 },
            ],
        },
    ],
};
