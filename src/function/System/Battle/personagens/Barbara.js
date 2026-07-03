'use strict';

/**
 * Barbara
 * Elemento: Hydro | Raridade: 4 estrelas
 * Role: Healer principal
 *
 * Mecânicas únicas:
 * - Melodia Idol: cura contínua enquanto ativa
 * - Aplica Hydro no time (cuidado com Cryo/Electro)
 * - C6: Revive um aliado automaticamente
 */
module.exports = {
    nome:     'Barbara',
    raridade: '4',
    elemento: 'hydro',

    roles: ['healer', 'support'],

    modoCombate: {
        principal: true,
        offField:  false,
    },

    scaling: {
        stat:          'hp',
        multiplicador: 0.8,
    },

    stats: {
        hp:          13700,
        atk:         121,
        def:         669,
        proficiencia: 0,
        recarga:     160,
        critRate:    5,
        critDano:    50,
        velocidade:  8,
        energiaMax:  80,
    },

    constelacoes: {
        1: {
            nome:       'Apenas Para Você',
            bonusStats: { recarga: 25 },
        },
        2: {
            nome:       'Estrela Nascente',
            bonusStats: { hp: 1500 },
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'cura', alvo: 'time', valor: 200 },
            ],
        },
        3: {
            nome:       'Promessa ao Público',
            bonusStats: { hp: 2000, recarga: 20 },
        },
        4: {
            nome:       'Longa Vida',
            bonusStats: { hp: 2500 },
        },
        5: {
            nome:       'Estrela Perfeita',
            bonusStats: { hp: 3000, recarga: 30 },
        },
        6: {
            nome:       'Um Milagre',
            bonusStats: { hp: 3500 },
            trigger: 'personagem_derrotado',
            efeitos: [
                { tipo: 'reviver', alvo: 'aliado_morto', hp: 2000 },
            ],
        },
    },

    ataqueNormal: {
        nome:       'Canção da Água',
        frases: [
            'Deixa eu te ajudar!',
            'Aguenta firme!',
            'Eu estarei do seu lado!',
        ],
        geraEnergia: 3,
        cooldown:    0,
        efeitos: [
            {
                tipo:     'dano',
                alvo:     'proximo_ativo',
                elemento: 'hydro',
                valor:    0.9,
            },
            {
                tipo:   'cura',
                alvo:   'ativo',
                valor:  400,
                escala: 'hp',
            },
        ],
    },

    habilidadeElemental: {
        nome:       'Melodia Idol',
        frases: [
            'Ouçam minha canção!',
            'A música cura a alma!',
            'Vamos lá, todos juntos!',
        ],
        geraEnergia: 12,
        cooldown:    3,
        efeitos: [
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  1200,
                escala: 'hp',
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'def',
                valor:  150,
                duracao: 3,
            },
        ],
    },

    supremo: {
        nome:            'Shining Miracle',
        energiaNecessaria: 80,
        cooldown:        6,
        frases: [
            'Milagre brilhante!',
            'Que todos sejam curados!',
            'Minha canção alcança todos!',
        ],
        efeitos: [
            {
                tipo:   'cura',
                alvo:   'time',
                valor:  4000,
                escala: 'hp',
            },
            {
                tipo:   'buff',
                alvo:   'time',
                stat:   'hp',
                valor:  2000,
                duracao: 4,
            },
        ],
    },

    passivas: [
        {
            nome:    'Voz da Esperança',
            trigger: 'inicio_turno',
            efeitos: [
                { tipo: 'cura', alvo: 'time', valor: 300 },
            ],
        },
        {
            nome:    'Canção de Cura',
            trigger: 'habilidade_aliada',
            efeitos: [
                { tipo: 'cura', alvo: 'ativo', valor: 250 },
                { tipo: 'energia', alvo: 'self', valor: 5 },
            ],
        },
    ],
};
