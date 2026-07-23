'use strict';


const ELEMENTOS = Object.freeze({
    PYRO:    'pyro',
    HYDRO:   'hydro',
    ELECTRO: 'electro',
    CRYO:    'cryo',
    DENDRO:  'dendro',
    ANEMO:   'anemo',
    GEO:     'geo',
});

const TABELA_REACOES = {
    [`${ELEMENTOS.PYRO}+${ELEMENTOS.HYDRO}`]:    'vaporizacao_pyro',
    [`${ELEMENTOS.HYDRO}+${ELEMENTOS.PYRO}`]:    'vaporizacao_hydro',

    [`${ELEMENTOS.PYRO}+${ELEMENTOS.CRYO}`]:     'derretimento_pyro',
    [`${ELEMENTOS.CRYO}+${ELEMENTOS.PYRO}`]:     'derretimento_cryo',

    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.HYDRO}`]: 'eletricamenteCarregado',
    [`${ELEMENTOS.HYDRO}+${ELEMENTOS.ELECTRO}`]: 'eletricamenteCarregado',

    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.PYRO}`]:  'sobrecarga',
    [`${ELEMENTOS.PYRO}+${ELEMENTOS.ELECTRO}`]:  'sobrecarga',

    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.CRYO}`]:  'supercondutor',
    [`${ELEMENTOS.CRYO}+${ELEMENTOS.ELECTRO}`]:  'supercondutor',

    [`${ELEMENTOS.HYDRO}+${ELEMENTOS.DENDRO}`]:  'florescimento',
    [`${ELEMENTOS.DENDRO}+${ELEMENTOS.HYDRO}`]:  'florescimento',

    [`${ELEMENTOS.ELECTRO}+${ELEMENTOS.DENDRO}`]:'intensificacao',
    [`${ELEMENTOS.DENDRO}+${ELEMENTOS.ELECTRO}`]:'intensificacao',

    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.PYRO}`]:    'reducao_pyro',
    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.HYDRO}`]:   'reducao_hydro',
    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.ELECTRO}`]: 'reducao_electro',
    [`${ELEMENTOS.ANEMO}+${ELEMENTOS.CRYO}`]:    'reducao_cryo',

    [`${ELEMENTOS.GEO}+${ELEMENTOS.PYRO}`]:      'cristalizacao',
    [`${ELEMENTOS.GEO}+${ELEMENTOS.HYDRO}`]:     'cristalizacao',
    [`${ELEMENTOS.GEO}+${ELEMENTOS.ELECTRO}`]:   'cristalizacao',
    [`${ELEMENTOS.GEO}+${ELEMENTOS.CRYO}`]:      'cristalizacao',
};

class ReactionManager {
    processar(elementoAplicado, alvo, danoBase, proficiencia = 0) {
        for (const aura of alvo.auras) {
            const chave   = `${elementoAplicado}+${aura}`;
            const reacao  = TABELA_REACOES[chave];
            if (!reacao) continue;

            const resultado = this._executarReacao(reacao, alvo, danoBase, proficiencia, aura, elementoAplicado);
            if (resultado) {
                if (reacao !== 'intensificacao') alvo.removerAura(aura);
                return { reacao, ...resultado };
            }
        }

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
        const reducaoDef = 40; 
        alvo.aplicarDebuff({ tipo: 'def', valor: reducaoDef, duracao: 2, fonte: 'supercondutor' });
        return {
            nome: 'Supercondutor',
            danoAdicional: 0,
            efeito: { tipo: 'debuff', stat: 'def', valor: reducaoDef, duracao: 2 },
            descricao: `**Supercondutor!** DEF do alvo reduzida em ${reducaoDef}% por 2 turnos`,
        };
    }

    _florescimento(proficiencia) {
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
        const reducaoRes = 40; 
        alvo.aplicarDebuff({ tipo: `res_${elemento}`, valor: reducaoRes, duracao: 2, fonte: 'reducao' });
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
