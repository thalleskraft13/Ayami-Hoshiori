'use strict';

/**
 * EffectManager
 *
 * Interpreta e aplica os efeitos declarados nos arquivos de personagem.
 * A engine chama applyEffects() passando a lista de efeitos de uma habilidade
 * e este manager resolve cada um contra o contexto de batalha correto.
 *
 * Para adicionar novo tipo de efeito: adicione um case em _aplicarEfeito().
 */
class EffectManager {
    /**
     * @param {ReactionManager} reactionManager
     */
    constructor(reactionManager) {
        this.reactionManager = reactionManager;
    }

    /**
     * Aplica uma lista de efeitos no contexto da batalha.
     *
     * @param {object[]} efeitos      - Array de efeitos do personagem
     * @param {BattleCharacter} fonte - Quem está aplicando os efeitos
     * @param {BattleTeam} timeAliado - Time do executante
     * @param {BattleTeam} timeInimigo- Time adversário
     * @returns {string[]} log de efeitos aplicados
     */
    aplicar(efeitos, fonte, timeAliado, timeInimigo) {
        const log = [];

        for (const efeito of (efeitos ?? [])) {
            const alvos = this._resolverAlvos(efeito.alvo, fonte, timeAliado, timeInimigo);

            for (const alvo of alvos) {
                const resultado = this._aplicarEfeito(efeito, fonte, alvo, timeAliado, timeInimigo);
                if (resultado) log.push(resultado);
            }
        }

        return log;
    }

    // ─── Resolução de alvos ───────────────────────────────────────────────────

    /**
     * Retorna o array de BattleCharacter para o alvo declarado no efeito.
     */
    _resolverAlvos(tipoAlvo, fonte, timeAliado, timeInimigo) {
        switch (tipoAlvo) {
            case 'self':
                return [fonte];

            case 'ativo':
                return timeAliado.ativo ? [timeAliado.ativo] : [];

            case 'proximo_ativo':
                return timeInimigo.ativo ? [timeInimigo.ativo] : [];

            case 'aliado':
                return timeAliado.vivos().filter(p => p !== fonte);

            case 'time':
                return timeAliado.vivos();

            case 'inimigo':
                return timeInimigo.ativo ? [timeInimigo.ativo] : [];

            case 'todos_inimigos':
                return timeInimigo.vivos();

            case 'aliado_morto':
                return timeAliado.derrotados().slice(0, 1); // Primeiro derrotado

            default:
                console.warn(`[EffectManager] Alvo desconhecido: ${tipoAlvo}`);
                return [];
        }
    }

    // ─── Aplicação dos efeitos ────────────────────────────────────────────────

    _aplicarEfeito(efeito, fonte, alvo, timeAliado, timeInimigo) {
        switch (efeito.tipo) {

            case 'dano':
                return this._aplicarDano(efeito, fonte, alvo);

            case 'cura':
                return this._aplicarCura(efeito, fonte, alvo);

            case 'buff':
                return this._aplicarBuff(efeito, fonte, alvo);

            case 'debuff':
                return this._aplicarDebuff(efeito, fonte, alvo);

            case 'escudo':
                return this._aplicarEscudo(efeito, fonte, alvo);

            case 'energia':
                return this._aplicarEnergia(efeito, alvo);

            case 'reviver':
                return this._aplicarReviver(efeito, alvo);

            case 'marca':
                return this._aplicarMarca(efeito, fonte, alvo);

            default:
                console.warn(`[EffectManager] Tipo de efeito desconhecido: ${efeito.tipo}`);
                return null;
        }
    }

    // ─── Dano ─────────────────────────────────────────────────────────────────

    _aplicarDano(efeito, fonte, alvo) {
        // Calcula valor base com scaling
        let valor = this._calcularValor(efeito, fonte);

        // Redução de defesa do alvo
        const defAlvo = alvo.getStat('def');
        const fatorDef = Math.max(0.1, 1 - defAlvo / (defAlvo + 1000));
        valor = Math.round(valor * fatorDef);

        // Resistência elemental
        if (efeito.elemento) {
            const res = alvo.debuffs.find(d => d.tipo === `res_${efeito.elemento}`)?.valor ?? 0;
            valor = Math.round(valor * (1 + res / 100));
        }

        // Crit
        const critRate  = fonte.getStat('critRate');
        const critDano  = fonte.getStat('critDano');
        const isCrit    = Math.random() * 100 < critRate;
        if (isCrit) valor = Math.round(valor * (1 + critDano / 100));

        // Verifica reação elemental
        let reacaoLog = '';
        if (efeito.elemento) {
            const reacao = this.reactionManager.processar(
                efeito.elemento, alvo, valor, fonte.getStat('proficiencia')
            );
            if (reacao) {
                valor        += reacao.danoAdicional ?? 0;
                reacaoLog     = ` | ${reacao.descricao}`;

                // Aplica escudo de cristalização no atacante
                if (reacao.escudo) {
                    fonte.aplicarEscudo({ ...reacao.escudo, fonte: 'cristalizacao' });
                }

                // Aplica efeito contínuo de reação
                if (reacao.efeito?.tipo === 'dano_continuo') {
                    alvo.aplicarMarca({
                        tipo:    'dano_continuo',
                        valor:   reacao.efeito.valor,
                        duracao: reacao.efeito.duracao,
                        dados:   { elemento: reacao.efeito.elemento },
                    });
                }

                // Aplica debuff de supercondutor (já aplicado no reactionManager)
            }
        }

        const danoReal = alvo.receberDano(valor, fonte.nome);
        fonte.estatisticas.danoTotal += danoReal;

        const critStr = isCrit ? ' ⚡**CRÍTICO!**' : '';
        return `${alvo.nome} recebeu **${danoReal}** dano${critStr}${reacaoLog}`;
    }

    // ─── Cura ─────────────────────────────────────────────────────────────────

    _aplicarCura(efeito, fonte, alvo) {
        let valor = this._calcularValor(efeito, fonte);

        // Bônus de Recarga de Energia aumenta cura em healing-based characters
        const recarga = fonte.getStat('recarga');
        if (recarga > 100) valor = Math.round(valor * (1 + (recarga - 100) / 400));

        const curaReal = alvo.receberCura(valor);
        fonte.estatisticas.curaTotal += curaReal;

        return `${alvo.nome} recuperou **${curaReal}** HP 💚`;
    }

    // ─── Buff ─────────────────────────────────────────────────────────────────

    _aplicarBuff(efeito, fonte, alvo) {
        alvo.aplicarBuff({
            stat:    efeito.stat,
            valor:   efeito.valor,
            duracao: efeito.duracao ?? 2,
            fonte:   fonte.nome,
        });

        return `${alvo.nome} recebeu buff: **${efeito.stat}** +${efeito.valor} por ${efeito.duracao ?? 2} turnos ✨`;
    }

    // ─── Debuff ───────────────────────────────────────────────────────────────

    _aplicarDebuff(efeito, fonte, alvo) {
        alvo.aplicarDebuff({
            tipo:    efeito.stat ?? efeito.tipo,
            valor:   efeito.valor,
            duracao: efeito.duracao ?? 2,
            fonte:   fonte.nome,
        });

        return `${alvo.nome} sofreu debuff: **${efeito.stat ?? efeito.tipo}** -${efeito.valor} por ${efeito.duracao ?? 2} turnos 🔻`;
    }

    // ─── Escudo ───────────────────────────────────────────────────────────────

    _aplicarEscudo(efeito, fonte, alvo) {
        const valor = this._calcularValor(efeito, fonte);
        alvo.aplicarEscudo({
            valor,
            elemento: efeito.elemento ?? null,
            duracao:  efeito.duracao ?? 3,
            fonte:    fonte.nome,
        });

        return `${alvo.nome} recebeu escudo de **${valor}** por ${efeito.duracao ?? 3} turnos 🛡️`;
    }

    // ─── Energia ──────────────────────────────────────────────────────────────

    _aplicarEnergia(efeito, alvo) {
        alvo.adicionarEnergia(efeito.valor);
        return `${alvo.nome} recebeu **${efeito.valor}** de energia ⚡`;
    }

    // ─── Reviver ──────────────────────────────────────────────────────────────

    _aplicarReviver(efeito, alvo) {
        if (alvo.vivo) return null;

        const hp = efeito.hp ?? Math.round(alvo.stats.hp * 0.2);
        alvo.reviver(hp);
        return `${alvo.nome} foi **revivido** com **${hp}** HP 🌟`;
    }

    // ─── Marca ────────────────────────────────────────────────────────────────

    _aplicarMarca(efeito, fonte, alvo) {
        alvo.aplicarMarca({
            tipo:    efeito.id ?? 'marca',
            valor:   efeito.valor ?? 0,
            duracao: efeito.duracao ?? 3,
            dados:   efeito.dados ?? {},
        });

        return `${alvo.nome} recebeu a marca **${efeito.id ?? 'marca'}** 🔖`;
    }

    // ─── Cálculo de valor ─────────────────────────────────────────────────────

    /**
     * Calcula o valor final de um efeito com base no scaling do personagem.
     * Suporta: valor fixo, % de atk/hp/def/proficiencia.
     */
    _calcularValor(efeito, fonte) {
        if (typeof efeito.valor === 'number') {
            // Valor fixo multiplicado pelo scaling do personagem
            const scaling     = fonte.dados.scaling;
            const statBase    = fonte.getStat(scaling?.stat ?? 'atk');
            const multiplicador = scaling?.multiplicador ?? 1;

            // Se o efeito tem escala explícita
            if (efeito.escala) {
                return Math.round(fonte.getStat(efeito.escala) * (efeito.valor / 100));
            }

            // Usa o valor como multiplicador % do stat principal
            if (efeito.valor <= 10) {
                // Provavelmente é um multiplicador direto (ex: 2.5 = 250% atk)
                return Math.round(statBase * efeito.valor * multiplicador);
            }

            // Valor > 10 é tratado como valor fixo com bônus de stat
            return Math.round(efeito.valor + statBase * 0.1 * multiplicador);
        }

        return 0;
    }
}

module.exports = EffectManager;
