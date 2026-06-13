'use strict';

const BattleCharacter = require('./BattleCharacter.js');

/**
 * BattleTeam
 *
 * Gerencia um time de até 4 personagens em batalha.
 * Controla qual personagem está ativo, troca de personagens e estado geral do time.
 */
class BattleTeam {
    /**
     * @param {string} userId       - ID do dono do time
     * @param {string} username     - Nome de exibição
     * @param {object[]} personagens - Array de { dados, registroDB }
     */
    constructor(userId, username, personagens = []) {
        this.userId   = userId;
        this.username = username;

        // Instancia BattleCharacter para cada personagem
        this.personagens = personagens.map(
            ({ dados, registroDB }) => new BattleCharacter(dados, registroDB)
        );

        // Índice do personagem ativo (começa com o primeiro vivo)
        this._indiceAtivo = 0;
        this._ativarPersonagem(0);
    }

    // ─── Acesso ao personagem ativo ───────────────────────────────────────────

    get ativo() {
        return this.personagens[this._indiceAtivo] ?? null;
    }

    get indiceAtivo() {
        return this._indiceAtivo;
    }

    // ─── Personagens off-field ────────────────────────────────────────────────

    get offField() {
        return this.personagens.filter((p, i) => i !== this._indiceAtivo && p.vivo);
    }

    // ─── Troca de personagem ──────────────────────────────────────────────────

    /**
     * Troca o personagem ativo para o índice especificado.
     * @param {number} indice
     * @returns {{ sucesso: boolean, mensagem: string }}
     */
    trocar(indice) {
        if (indice === this._indiceAtivo) {
            return { sucesso: false, mensagem: `${this.personagens[indice]?.nome} já está em campo.` };
        }

        const alvo = this.personagens[indice];
        if (!alvo) {
            return { sucesso: false, mensagem: 'Personagem não encontrado.' };
        }

        if (!alvo.vivo) {
            return { sucesso: false, mensagem: `${alvo.nome} está derrotado e não pode entrar em campo.` };
        }

        const anterior = this.ativo;
        if (anterior) anterior.ativo = false;

        this._indiceAtivo = indice;
        this._ativarPersonagem(indice);

        return { sucesso: true, mensagem: `${anterior?.nome ?? '?'} → ${alvo.nome}` };
    }

    /**
     * Troca por nome de personagem.
     * @param {string} nome
     */
    trocarPorNome(nome) {
        const indice = this.personagens.findIndex(
            p => p.nome.toLowerCase() === nome.toLowerCase()
        );
        if (indice === -1) return { sucesso: false, mensagem: `${nome} não está neste time.` };
        return this.trocar(indice);
    }

    _ativarPersonagem(indice) {
        if (this.personagens[indice]) {
            this.personagens[indice].ativo = true;
        }
    }

    // ─── Estado do time ───────────────────────────────────────────────────────

    /**
     * Verifica se o time ainda está vivo (pelo menos 1 personagem vivo).
     */
    estaVivo() {
        return this.personagens.some(p => p.vivo);
    }

    /**
     * Retorna todos os personagens vivos (incluindo o ativo).
     */
    vivos() {
        return this.personagens.filter(p => p.vivo);
    }

    /**
     * Retorna todos os personagens derrotados.
     */
    derrotados() {
        return this.personagens.filter(p => !p.vivo);
    }

    /**
     * Tenta avançar automaticamente para o próximo personagem vivo
     * quando o ativo é derrotado.
     * @returns {boolean} true se encontrou substituto
     */
    avancarParaProximoVivo() {
        const proximo = this.personagens.findIndex((p, i) => i !== this._indiceAtivo && p.vivo);
        if (proximo === -1) return false;

        if (this.ativo) this.ativo.ativo = false;
        this._indiceAtivo = proximo;
        this._ativarPersonagem(proximo);
        return true;
    }

    // ─── Redução de efeitos ao fim do turno ───────────────────────────────────

    /**
     * Reduz cooldowns e durações de efeitos para todos os personagens vivos.
     */
    processarFimDeTurno() {
        for (const p of this.vivos()) {
            p.reduzirCooldowns();
            p.reduzirDuracoes();
        }
    }

    // ─── Snapshot para embed ──────────────────────────────────────────────────

    toSnapshot() {
        return {
            userId:   this.userId,
            username: this.username,
            personagens: this.personagens.map(p => p.toSnapshot()),
            ativoIndex: this._indiceAtivo,
            vivo: this.estaVivo(),
        };
    }

    /**
     * Gera a barra de HP visual para exibição em embed.
     * @param {BattleCharacter} personagem
     */
    static barraHP(personagem, tamanho = 10) {
        const pct      = personagem.hpAtual / personagem.stats.hp;
        const cheios   = Math.round(pct * tamanho);
        const vazios   = tamanho - cheios;
        const emoji    = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
        return emoji.repeat(cheios) + '⬛'.repeat(vazios);
    }
}

module.exports = BattleTeam;
