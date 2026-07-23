'use strict';

class PassiveManager {
    constructor(effectManager) {
        this.effectManager = effectManager;
    }

    processar(trigger, timeAliado, timeInimigo, contexto = {}) {
        const log = [];

        for (const personagem of timeAliado.vivos()) {
            const passivas = personagem.dados.passivas ?? [];

            for (const passiva of passivas) {
                if (passiva.trigger !== trigger) continue;

                if (!personagem.ativo && !personagem.podeAtorOffField()) continue;

                if (passiva.condicao && !this._verificarCondicao(passiva.condicao, personagem, contexto)) {
                    continue;
                }

                const efeitos = this._resolverEfeitos(passiva, personagem, contexto);
                const efeitosLog = this.effectManager.aplicar(efeitos, personagem, timeAliado, timeInimigo);

                if (efeitosLog.length > 0) {
                    log.push(`✦ **[Passiva]** ${personagem.nome} — *${passiva.nome}*:`);
                    log.push(...efeitosLog.map(e => `  ${e}`));
                }

                if (passiva.geraEnergia && trigger === 'ataque_aliado') {
                    personagem.adicionarEnergia(passiva.geraEnergia);
                    log.push(`  ⚡ ${personagem.nome} ganhou ${passiva.geraEnergia} de energia`);
                }
            }

            this._processarConstelacoes(trigger, personagem, timeAliado, timeInimigo, contexto, log);
        }

        return log;
    }

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

    _resolverEfeitos(passiva, personagem, contexto) {
        let efeitos = passiva.efeitos ?? [];

        if (typeof efeitos === 'function') {
            efeitos = efeitos(personagem, contexto) ?? [];
        }

        return efeitos;
    }

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
