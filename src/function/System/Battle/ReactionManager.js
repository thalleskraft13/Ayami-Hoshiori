'use strict';

/**
 * ReactionManager
 *
 * Processa reações elementais baseado nas auras existentes no alvo.
 * Totalmente separado da engine — recebe alvo, atacante e retorna resultado.
 *
 * Para adicionar nova reação: adicione uma entrada em REACOES e implemente o método.
 */

const ELEMENTOS = Object.freeze({
    PYRO:    'pyro',
    HYDRO:   'hydro',
    ELECTRO: 'electro',
    CRYO:    'cryo',
    DENDRO:  'dendro',
    ANEMO:   'anemo',
    GEO:     'geo',
});

/**
 * Tabela de reações: chave = `${elementoAplicado}+${auraExistente}`
 * Cada entrada define o tipo de reação.
 */
const TABELA_REACOES = {
    // Vaporização
    [`${ELEMENTOS.PYRO}+${ELEMENTOS.HYDRO}`]:    'vaporizacao_pyro',
    [`${ELEMENTOS.HYDRO}+${ELEMENTOS.PYRO}`]:    'vaporizacao_hydro',

    // Derretimento
    [`${ELEMENTOS.PYRO}+${ELEMENTOS.CRYO}`]:     'derretimento_pyro',
    [`${ELEMENTOS.CRYO}+${ELEMENTOS.PYRO}`]:     'derretimento_cryo',

    // Eletricamente Carregado
    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.HYDRO}`]: 'eletricamenteCarregado',
    [`${ELEMENTOS.HYDRO}+${ELEMENTOS.ELECTRO}`]: 'eletricamenteCarregado',

    // Sobrecarga
    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.PYRO}`]:  'sobrecarga',
    [`${ELEMENTOS.PYRO}+${ELEMENTOS.ELECTRO}`]:  'sobrecarga',

    // Supercondutor
    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.CRYO}`]:  'supercondutor',
    [`${ELEMENTOS.CRYO}+${ELEMENTOS.ELECTRO}`]:  'supercondutor',

    // Florescimento
    [`${ELEMENTOS.HYDRO}+${ELEMENTOS.DENDRO}`]:  'florescimento',
    [`${ELEMENTOS.DENDRO}+${ELEMENTOS.HYDRO}`]:  'florescimento',

    // Intensificação
    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.DENDRO}`]:'intensificacao',
    [`${ELEMENTOS.DENDRO}+${ELEMENTOS.ELECTRO}`]:'intensificacao',

    // Redução (Anemo)
    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.PYRO}`]:    'reducao_pyro',
    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.HYDRO}`]:   'reducao_hydro',
    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.ELECTRO}`]: 'reducao_electro',
    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.CRYO}`]:    'reducao_cryo',

    // Cristalização (Geo)
    [`${ELEMENTOS.GEO}+${ELEMENTOS.PYRO}`]:      'cristalizacao',
    [`${ELEMENTOS.GEO}+${ELEMENTOS.HYDRO}`]:     'cristalizacao',
    [`${ELEMENTOS.GEO}+${ELEMENTOS.ELECTRO}`]:   'cristalizacao',
    [`${ELEMENTOS.GEO}+${ELEMENTOS.CRYO}`]:      'cristalizacao',
};

class ReactionManager {
    /**
     * Verifica se há reação entre o elemento aplicado e as auras do alvo.
     * Retorna um objeto de resultado ou null se não houver reação.
     *
     * @param {string} elementoAplicado
     * @param {BattleCharacter} alvo
     * @param {number} danoBase
     * @param {number} proficiencia - Proficiência elemental do atacante
     * @returns {object|null}
     */
    processar(elementoAplicado, alvo, danoBase, proficiencia = 0) {
        for (const aura of alvo.auras) {
            const chave   = `${elementoAplicado}+${aura}`;
            const reacao  = TABELA_REACOES[chave];
            if (!reacao) continue;

            const resultado = this._executarReacao(reacao, alvo, danoBase, proficiencia, aura, elementoAplicado);
            if (resultado) {
                // Consome a aura usada na reação (exceto intensificação que mantém)
                if (reacao !== 'intensificacao') alvo.removerAura(aura);
                return { reacao, ...resultado };
            }
        }

        // Sem reação: aplica/sobrepõe aura (exceto Anemo e Geo que não deixam aura)
        if (elementoAplicado !== ELEMENTOS.ANEMO && elementoAplicado !== ELEMENTOS.GEO) {
            alvo.aplicarAura(elementoAplicado);
        }

        return null;
    }

    _executarReacao(reacao, alvo, danoBase, proficiencia, auraConsumir, elementoAplicado) {
        switch (reacao) {

            case 'vaporizacao_pyro':
                return this._vaporizacao(danoBase, 1.5, proficiencia, 'Vaporização (Pyro)');

            case 'vaporizacao_hydro':
                return this._vaporizacao(danoBase, 2.0, proficiencia, 'Vaporização (Hydro)');

            case 'derretimento_pyro':
                return this._vaporizacao(danoBase, 2.0, proficiencia, 'Derretimento (Pyro)');

            case 'derretimento_cryo':
                return this._vaporizacao(danoBase, 1.5, proficiencia, 'Derretimento (Cryo)');

            case 'eletricamenteCarregado':
                return this._eletricamenteCarregado(danoBase, proficiencia);

            case 'sobrecarga':
                return this._sobrecarga(danoBase, proficiencia);

            case 'supercondutor':
                return this._supercondutor(alvo, proficiencia);

            case 'florescimento':
                return this._florescimento(proficiencia);

            case 'intensificacao':
                return this._intensificacao(danoBase, proficiencia);

            case 'reducao_pyro':
            case 'reducao_hydro':
            case 'reducao_electro':
            case 'reducao_cryo':
                return this._reducao(alvo, auraConsumir, proficiencia);

            case 'cristalizacao':
                return this._cristalizacao(auraConsumir, proficiencia);

            default:
                return null;
        }
    }

    // ─── Implementações das reações ───────────────────────────────────────────

    _vaporizacao(danoBase, multiplicador, proficiencia, nome) {
        const bonus      = 2.78 * proficiencia / (proficiencia + 1400);
        const multiplicadorFinal = multiplicador * (1 + bonus);
        const dano = Math.round(danoBase * multiplicadorFinal);

        return {
            nome,
            danoAdicional: dano - danoBase,
            multiplicador: multiplicadorFinal,
            descricao: `**${nome}!** ×${multiplicadorFinal.toFixed(2)} de dano`,
        };
    }

    _eletricamenteCarregado(danoBase, proficiencia) {
        const danoCondicao = Math.round(40 + 4 * proficiencia / (proficiencia + 50));
        return {
            nome: 'Eletricamente Carregado',
            danoAdicional: danoCondicao,
            efeito: { tipo: 'dano_continuo', valor: danoCondicao, duracao: 2, elemento: 'electro' },
            descricao: `**Eletricamente Carregado!** Dano elétrico contínuo por 2 turnos`,
        };
    }

    _sobrecarga(danoBase, proficiencia) {
        const danoExplosao = Math.round(125 + 5 * proficiencia / (proficiencia + 720));
        return {
            nome: 'Sobrecarga',
            danoAdicional: danoExplosao,
            descricao: `**Sobrecarga!** Explosão de +${danoExplosao} de dano`,
        };
    }

    _supercondutor(alvo, proficiencia) {
        const reducaoDef = 40; // % redução de defesa
        alvo.aplicarDebuff({ tipo: 'def', valor: reducaoDef, duracao: 2, fonte: 'supercondutor' });
        return {
            nome: 'Supercondutor',
            danoAdicional: 0,
            efeito: { tipo: 'debuff', stat: 'def', valor: reducaoDef, duracao: 2 },
            descricao: `**Supercondutor!** DEF do alvo reduzida em ${reducaoDef}% por 2 turnos`,
        };
    }

    _florescimento(proficiencia) {
        // Cria um núcleo Dendro que explode no próximo turno
        const danoNucleo = Math.round(100 + 5 * proficiencia / (proficiencia + 200));
        return {
            nome: 'Florescimento',
            danoAdicional: 0,
            efeito: { tipo: 'nucleo_dendro', valor: danoNucleo, duracao: 1 },
            descricao: `**Florescimento!** Núcleo Dendro criado — explode em 1 turno (${danoNucleo} dano)`,
        };
    }

    _intensificacao(danoBase, proficiencia) {
        const bonusDano = Math.round(5 * proficiencia / (proficiencia + 1200) * danoBase);
        return {
            nome: 'Intensificação',
            danoAdicional: bonusDano,
            descricao: `**Intensificação!** Dano amplificado em +${bonusDano}`,
        };
    }

    _reducao(alvo, elemento, proficiencia) {
        const reducaoRes = 40; // % redução de resistência ao elemento
        alvo.aplicarDebuff({ tipo: `res_${elemento}`, valor: reducaoRes, duracao: 2, fonte: 'reducao' });
        // Espalha o elemento para outros inimigos (lógica na engine)
        return {
            nome: `Redução (${elemento})`,
            danoAdicional: 0,
            espalhamento: elemento,
            descricao: `**Redução Anemo!** Resistência ${elemento} reduzida em ${reducaoRes}%`,
        };
    }

    _cristalizacao(elemento, proficiencia) {
        const valorEscudo = Math.round(100 + 4 * proficiencia / (proficiencia + 200));
        return {
            nome: `Cristalização (${elemento})`,
            danoAdicional: 0,
            escudo: { valor: valorEscudo, elemento, duracao: 3 },
            descricao: `**Cristalização!** Escudo elemental de ${valorEscudo} gerado`,
        };
    }

    // ─── Germinação e Fulguração (reações secundárias de Florescimento) ────────

    /**
     * Processa reação secundária sobre núcleo Dendro existente.
     * @param {string} elemento
     * @param {object} nucleo - { valor }
     * @param {number} proficiencia
     */
    processarNucleoSecundario(elemento, nucleo, proficiencia) {
        if (elemento === ELEMENTOS.ELECTRO) {
            const dano = Math.round(nucleo.valor * 1.25 + proficiencia * 0.1);
            return {
                reacao: 'germinacao',
                nome:   'Germinação',
                dano,
                descricao: `**Germinação!** Explosão aprimorada de ${dano} dano`,
            };
        }

        if (elemento === ELEMENTOS.PYRO) {
            const dano = Math.round(nucleo.valor * 1.5 + proficiencia * 0.1);
            return {
                reacao: 'fulguracao',
                nome:   'Fulguração',
                dano,
                descricao: `**Fulguração!** Explosão imediata de ${dano} dano`,
            };
        }

        return null;
    }
}

module.exports = ReactionManager;
