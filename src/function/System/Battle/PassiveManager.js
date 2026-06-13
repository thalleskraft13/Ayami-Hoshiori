'use strict';

/**
 * PassiveManager
 *
 * Processa triggers de passivas e ataques coordenados de personagens off-field.
 * Recebe o contexto do trigger e dispara os efeitos declarados nos dados do personagem.
 *
 * Para adicionar novo trigger: adicione o case em processar().
 */
class PassiveManager {
    /**
     * @param {EffectManager} effectManager
     */
    constructor(effectManager) {
        this.effectManager = effectManager;
    }

    /**
     * Processa todas as passivas do time aliado para um trigger específico.
     *
     * @param {string} trigger        - Nome do trigger (ex: 'ataque_aliado')
     * @param {BattleTeam} timeAliado
     * @param {BattleTeam} timeInimigo
     * @param {object} [contexto]     - Dados extras do trigger
     * @returns {string[]} log de efeitos ativados
     */
    processar(trigger, timeAliado, timeInimigo, contexto = {}) {
        const log = [];

        for (const personagem of timeAliado.vivos()) {
            const passivas = personagem.dados.passivas ?? [];

            for (const passiva of passivas) {
                if (passiva.trigger !== trigger) continue;

                // Verifica se é passiva off-field (personagem não está ativo)
                if (!personagem.ativo && !personagem.podeAtorOffField()) continue;

                // Verifica condição da passiva (se houver)
                if (passiva.condicao && !this._verificarCondicao(passiva.condicao, personagem, contexto)) {
                    continue;
                }

                // Aplica efeitos da passiva
                const efeitos = this._resolverEfeitos(passiva, personagem, contexto);
                const efeitosLog = this.effectManager.aplicar(efeitos, personagem, timeAliado, timeInimigo);

                if (efeitosLog.length > 0) {
                    log.push(`✦ **[Passiva]** ${personagem.nome} — *${passiva.nome}*:`);
                    log.push(...efeitosLog.map(e => `  ${e}`));
                }

                // Adiciona energia por ataque coordenado (se aplicável)
                if (passiva.geraEnergia && trigger === 'ataque_aliado') {
                    personagem.adicionarEnergia(passiva.geraEnergia);
                    log.push(`  ⚡ ${personagem.nome} ganhou ${passiva.geraEnergia} de energia`);
                }
            }

            // Processa constelações com triggers
            this._processarConstelacoes(trigger, personagem, timeAliado, timeInimigo, contexto, log);
        }

        return log;
    }

    /**
     * Processa triggers de constelações ativas.
     */
    _processarConstelacoes(trigger, personagem, timeAliado, timeInimigo, contexto, log) {
        for (let i = 1; i <= personagem.constelacao; i++) {
            const cons = personagem.getConstelacao(i);
            if (!cons?.trigger || cons.trigger !== trigger) continue;

            const efeitosLog = this.effectManager.aplicar(
                cons.efeitos ?? [], personagem, timeAliado, timeInimigo
            );

            if (efeitosLog.length > 0) {
                log.push(`✦ **[C${i}]** ${personagem.nome} — *${cons.nome ?? `Constelação ${i}`}*:`);
                log.push(...efeitosLog.map(e => `  ${e}`));
            }
        }
    }

    /**
     * Resolve os efeitos de uma passiva, aplicando modificadores de contexto.
     */
    _resolverEfeitos(passiva, personagem, contexto) {
        let efeitos = passiva.efeitos ?? [];

        // Permite que passivas com efeitos dinâmicos (função) calculem em tempo real
        if (typeof efeitos === 'function') {
            efeitos = efeitos(personagem, contexto) ?? [];
        }

        return efeitos;
    }

    /**
     * Verifica condição de ativação de passiva.
     * @param {object} condicao
     * @param {BattleCharacter} personagem
     * @param {object} contexto
     */
    _verificarCondicao(condicao, personagem, contexto) {
        switch (condicao.tipo) {
            case 'hp_abaixo':
                return (personagem.hpAtual / personagem.stats.hp * 100) < condicao.valor;

            case 'hp_acima':
                return (personagem.hpAtual / personagem.stats.hp * 100) > condicao.valor;

            case 'energia_cheia':
                return personagem.temEnergiaSuficiente();

            case 'tem_buff':
                return personagem.buffs.some(b => b.stat === condicao.stat);

            case 'tem_marca':
                return personagem.marcas.some(m => m.tipo === condicao.id);

            case 'constelacao':
                return personagem.temConstelacao(condicao.nivel);

            default:
                return true;
        }
    }
}

module.exports = PassiveManager;
