'use strict';

const BattleSession = require('./BattleSession.js');

/**
 * BattleManager
 *
 * Singleton que armazena e gerencia todas as sessões de batalha ativas.
 * Impede duplicatas e garante cleanup quando batalhas terminam.
 */
class BattleManager {
    constructor() {
        /** @type {Map<string, BattleSession>} userId → sessão */
        this._sessoes = new Map();

        /** @type {Map<string, string>} userId → userId do oponente (para lookup reverso) */
        this._pares   = new Map();

        // Timeout de segurança: batalhas sem atividade por 10min são removidas
        this._timeouts = new Map();
    }

    // ─── Criação ──────────────────────────────────────────────────────────────

    /**
     * Cria uma nova sessão de batalha.
     * @param {object} opts - Mesmas opções de BattleSession
     * @returns {BattleSession}
     */
    criar(opts) {
        const sessao = new BattleSession(opts);

        this._sessoes.set(opts.userAId, sessao);
        this._sessoes.set(opts.userBId, sessao);

        this._pares.set(opts.userAId, opts.userBId);
        this._pares.set(opts.userBId, opts.userAId);

        // Timeout de segurança
        this._resetarTimeout(opts.userAId, opts.userBId);

        return sessao;
    }

    // ─── Acesso ───────────────────────────────────────────────────────────────

    /**
     * Retorna a sessão ativa de um usuário, se houver.
     * @param {string} userId
     * @returns {BattleSession|null}
     */
    getSessao(userId) {
        return this._sessoes.get(userId) ?? null;
    }

    /**
     * Verifica se um usuário está em batalha.
     * @param {string} userId
     */
    emBatalha(userId) {
        return this._sessoes.has(userId);
    }

    // ─── Remoção ──────────────────────────────────────────────────────────────

    /**
     * Remove uma sessão ao final da batalha.
     * @param {string} userAId
     * @param {string} userBId
     */
    encerrar(userAId, userBId) {
        this._sessoes.delete(userAId);
        this._sessoes.delete(userBId);
        this._pares.delete(userAId);
        this._pares.delete(userBId);
        this._limparTimeout(userAId);
        this._limparTimeout(userBId);
    }

    // ─── Timeout de segurança ─────────────────────────────────────────────────

    _resetarTimeout(userAId, userBId) {
        this._limparTimeout(userAId);
        this._limparTimeout(userBId);

        const timer = setTimeout(() => {
            console.log(`[BattleManager] Encerrando batalha por inatividade: ${userAId} vs ${userBId}`);
            this.encerrar(userAId, userBId);
        }, 10 * 60 * 1000); // 10 minutos

        this._timeouts.set(userAId, timer);
        this._timeouts.set(userBId, timer);
    }

    _limparTimeout(userId) {
        const timer = this._timeouts.get(userId);
        if (timer) {
            clearTimeout(timer);
            this._timeouts.delete(userId);
        }
    }

    /**
     * Reinicia o timeout de inatividade quando há uma ação.
     */
    resetarAtividade(userId) {
        const sessao = this.getSessao(userId);
        if (!sessao) return;
        this._resetarTimeout(sessao.userAId, sessao.userBId);
    }

    // ─── Estatísticas ─────────────────────────────────────────────────────────

    get totalSessoes() {
        // Cada batalha ocupa 2 entradas (uma por jogador)
        return this._sessoes.size / 2;
    }
}

// Singleton global
module.exports = new BattleManager();
