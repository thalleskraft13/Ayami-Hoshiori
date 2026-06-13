'use strict';

const BattleTeam     = require('./BattleTeam.js');
const EffectManager  = require('./EffectManager.js');
const ReactionManager = require('./ReactionManager.js');
const PassiveManager = require('./PassiveManager.js');

/**
 * BattleEngine
 *
 * Núcleo da batalha. Coordena turnos, ações, passivas e reações.
 * NÃO possui lógica específica de personagem — apenas orquestra os managers.
 *
 * Fluxo de um turno:
 *  1. processarInicioTurno()     → triggers de início de turno, dano contínuo
 *  2. executarAcao()             → ação escolhida pelo jogador (ataque, habilidade, supremo, troca)
 *  3. processarPassivas()        → passivas off-field ativadas pela ação
 *  4. processarFimTurno()        → reduz cooldowns/durações, triggers fim de turno
 *  5. verificarFimDeBatalha()    → verifica se algum time foi eliminado
 */
class BattleEngine {
    /**
     * @param {BattleTeam} timeA
     * @param {BattleTeam} timeB
     */
    constructor(timeA, timeB) {
        this.timeA = timeA;
        this.timeB = timeB;

        const reactionManager = new ReactionManager();
        const effectManager   = new EffectManager(reactionManager);
        this.effectManager    = effectManager;
        this.passiveManager   = new PassiveManager(effectManager);
        this.reactionManager  = reactionManager;

        // Controle de turno
        this.turnoAtual   = 1;
        this.vezAtual     = 'A'; // 'A' ou 'B'
        this.emAndamento  = true;
        this.vencedor     = null;

        // Log completo da batalha
        this.log = [];
        this._logTurno = [];
    }

    // ─── Acesso conveniente ───────────────────────────────────────────────────

    get timeAtacante() { return this.vezAtual === 'A' ? this.timeA : this.timeB; }
    get timeDefensor()  { return this.vezAtual === 'A' ? this.timeB : this.timeA; }

    // ─── Início de turno ──────────────────────────────────────────────────────

    processarInicioTurno() {
        this._logTurno = [];
        const time = this.timeAtacante;
        const ativo = time.ativo;
        if (!ativo) return [];

        // Dano contínuo de marcas (ex: eletricamenteCarregado)
        for (const marca of (ativo.marcas ?? [])) {
            if (marca.tipo === 'dano_continuo') {
                const dano = ativo.receberDano(marca.valor, 'dano_continuo');
                this._log(`☠️ ${ativo.nome} sofreu **${dano}** de dano contínuo (${marca.dados?.elemento ?? '?'})`);

                if (!ativo.vivo) {
                    this._log(`💀 ${ativo.nome} foi derrotado pelo dano contínuo!`);
                    time.avancarParaProximoVivo();
                }
            }

            if (marca.tipo === 'nucleo_dendro' && marca.duracao <= 1) {
                const dano = ativo.receberDano(marca.valor, 'nucleo_dendro');
                this._log(`🌿 Núcleo Dendro explodiu! ${ativo.nome} sofreu **${dano}** de dano`);
            }
        }

        // Triggers de início de turno
        const passLog = this.passiveManager.processar(
            'inicio_turno', time, this.timeDefensor, { turno: this.turnoAtual }
        );
        this._logTurno.push(...passLog);

        return [...this._logTurno];
    }

    // ─── Execução de ação ─────────────────────────────────────────────────────

    /**
     * Executa a ação escolhida pelo jogador.
     *
     * @param {'ataqueNormal'|'habilidadeElemental'|'supremo'|'trocar'} tipoAcao
     * @param {object} [opcoes] - { indicePersonagem } para troca
     * @returns {{ log: string[], ativouPassivas: string[] }}
     */
    executarAcao(tipoAcao, opcoes = {}) {
        this._logTurno = [];
        const atacante = this.timeAtacante;
        const defensor = this.timeDefensor;
        const ativo    = atacante.ativo;

        if (!ativo || !this.emAndamento) return { log: [], ativouPassivas: [] };

        let triggerPassiva = null;

        switch (tipoAcao) {
            case 'ataqueNormal':
                triggerPassiva = this._executarHabilidade('ataqueNormal', ativo, atacante, defensor);
                break;

            case 'habilidadeElemental':
                triggerPassiva = this._executarHabilidade('habilidadeElemental', ativo, atacante, defensor);
                break;

            case 'supremo':
                triggerPassiva = this._executarSupremo(ativo, atacante, defensor);
                break;

            case 'trocar':
                triggerPassiva = this._executarTroca(atacante, opcoes.indice, defensor);
                break;

            default:
                this._log(`❌ Ação desconhecida: ${tipoAcao}`);
        }

        // Verifica derrota do defensor ativo após a ação
        if (defensor.ativo && !defensor.ativo.vivo) {
            const derrotado = defensor.ativo.nome;
            defensor.ativo.estatisticas.abatesFeitos = 0;
            ativo.estatisticas.abatesFeitos++;

            this._log(`💀 **${derrotado}** foi derrotado!`);

            // Passiva: personagem_derrotado
            const passLog = this.passiveManager.processar(
                'personagem_derrotado', atacante, defensor, { derrotado }
            );
            this._logTurno.push(...passLog);

            defensor.avancarParaProximoVivo();

            if (defensor.estaVivo()) {
                this._log(`🔄 ${defensor.username} enviou **${defensor.ativo?.nome}** para o campo!`);
            }
        }

        // Passivas off-field ativadas pela ação
        let ativouPassivas = [];
        if (triggerPassiva) {
            ativouPassivas = this.passiveManager.processar(
                triggerPassiva, atacante, defensor, { ativo }
            );
        }

        return {
            log:            [...this._logTurno],
            ativouPassivas,
        };
    }

    // ─── Fim de turno ─────────────────────────────────────────────────────────

    processarFimTurno() {
        const time  = this.timeAtacante;
        const ativo = time.ativo;

        // Triggers de fim de turno
        const passLog = this.passiveManager.processar(
            'fim_turno', time, this.timeDefensor, { turno: this.turnoAtual }
        );

        // Reduz duração de efeitos
        time.processarFimDeTurno();

        // Alterna vez
        if (this.vezAtual === 'A') {
            this.vezAtual = 'B';
        } else {
            this.vezAtual = 'A';
            this.turnoAtual++;
        }

        return passLog;
    }

    // ─── Verificação de fim ───────────────────────────────────────────────────

    verificarFimDeBatalha() {
        if (!this.timeA.estaVivo()) {
            this.emAndamento = false;
            this.vencedor    = 'B';
            return { fim: true, vencedor: this.timeB, perdedor: this.timeA };
        }

        if (!this.timeB.estaVivo()) {
            this.emAndamento = false;
            this.vencedor    = 'A';
            return { fim: true, vencedor: this.timeA, perdedor: this.timeB };
        }

        if (this.turnoAtual > 50) {
            this.emAndamento = false;
            // Empate: vence quem tem mais HP total
            const hpA = this.timeA.vivos().reduce((s, p) => s + p.hpAtual, 0);
            const hpB = this.timeB.vivos().reduce((s, p) => s + p.hpAtual, 0);
            const vencedor = hpA >= hpB ? this.timeA : this.timeB;
            const perdedor = hpA >= hpB ? this.timeB : this.timeA;
            this.vencedor  = hpA >= hpB ? 'A' : 'B';
            return { fim: true, vencedor, perdedor, empate: true };
        }

        return { fim: false };
    }

    // ─── Habilidades ─────────────────────────────────────────────────────────

    _executarHabilidade(tipo, personagem, timeAliado, timeInimigo) {
        const habilidade = personagem.dados[tipo];
        if (!habilidade) return null;

        if (!personagem.podeUsar(tipo)) {
            this._log(`⏳ ${personagem.nome} ainda está em cooldown para **${habilidade.nome}**`);
            return null;
        }

        // Frase de uso
        if (habilidade.frases?.length) {
            const frase = habilidade.frases[Math.floor(Math.random() * habilidade.frases.length)];
            this._log(`💬 *"${frase}"*`);
        }

        this._log(`⚔️ **${personagem.nome}** usou **${habilidade.nome}**!`);

        // Aplica efeitos
        const efeitosLog = this.effectManager.aplicar(
            habilidade.efeitos, personagem, timeAliado, timeInimigo
        );
        this._logTurno.push(...efeitosLog);

        // Gera energia
        if (habilidade.geraEnergia) {
            personagem.adicionarEnergia(habilidade.geraEnergia);
            this._log(`⚡ ${personagem.nome} gerou **${habilidade.geraEnergia}** de energia (${personagem.energiaAtual}/${personagem.stats.energiaMax})`);
        }

        // Aplica cooldown
        if (habilidade.cooldown) {
            personagem.setCooldown(tipo, habilidade.cooldown);
        }

        const triggers = {
            ataqueNormal:        'ataque_aliado',
            habilidadeElemental: 'habilidade_aliada',
        };

        return triggers[tipo] ?? null;
    }

    _executarSupremo(personagem, timeAliado, timeInimigo) {
        const supremo = personagem.dados.supremo;
        if (!supremo) return null;

        if (!personagem.podeUsar('supremo')) {
            this._log(`⏳ ${personagem.nome} ainda está em cooldown para **${supremo.nome}**`);
            return null;
        }

        if (!personagem.temEnergiaSuficiente()) {
            const falta = (supremo.energiaNecessaria ?? 100) - personagem.energiaAtual;
            this._log(`⚡ ${personagem.nome} precisa de mais **${falta}** de energia para o Supremo`);
            return null;
        }

        // Consome energia
        personagem.consumirEnergia(supremo.energiaNecessaria ?? 100);

        // Frase de uso
        if (supremo.frases?.length) {
            const frase = supremo.frases[Math.floor(Math.random() * supremo.frases.length)];
            this._log(`💬 *"${frase}"*`);
        }

        this._log(`🌟 **${personagem.nome}** usou o Supremo **${supremo.nome}**!`);

        // Aplica efeitos
        const efeitosLog = this.effectManager.aplicar(
            supremo.efeitos, personagem, timeAliado, timeInimigo
        );
        this._logTurno.push(...efeitosLog);

        // Cooldown do supremo
        if (supremo.cooldown) {
            personagem.setCooldown('supremo', supremo.cooldown);
        }

        return 'supremo_aliado';
    }

    _executarTroca(time, indice, timeInimigo) {
        const anterior = time.ativo?.nome;
        const resultado = time.trocar(indice);

        if (!resultado.sucesso) {
            this._log(`❌ Troca falhou: ${resultado.mensagem}`);
            return null;
        }

        this._log(`🔄 ${time.username} trocou: **${anterior}** → **${time.ativo.nome}**`);

        // Passiva: troca_personagem
        const passLog = this.passiveManager.processar(
            'troca_personagem', time, timeInimigo, { anterior, novo: time.ativo.nome }
        );
        this._logTurno.push(...passLog);

        return 'troca_personagem';
    }

    // ─── Log ──────────────────────────────────────────────────────────────────

    _log(mensagem) {
        this._logTurno.push(mensagem);
        this.log.push(mensagem);
    }

    // ─── Snapshot para embed ──────────────────────────────────────────────────

    gerarSnapshot() {
        return {
            turno:    this.turnoAtual,
            vez:      this.vezAtual,
            timeA:    this.timeA.toSnapshot(),
            timeB:    this.timeB.toSnapshot(),
            emAndamento: this.emAndamento,
            vencedor: this.vencedor,
        };
    }
}

module.exports = BattleEngine;
