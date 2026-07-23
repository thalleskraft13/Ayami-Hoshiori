'use strict';

const BattleSession = require('./BattleSession.js');

class BattleManager {
    constructor() {
        this._sessoes = new Map();

        this._pares   = new Map();

        this._timeouts = new Map();
    }


    criar(opts) {
        const sessao = new BattleSession(opts);

        this._sessoes.set(opts.userAId, sessao);
        this._sessoes.set(opts.userBId, sessao);

        this._pares.set(opts.userAId, opts.userBId);
        this._pares.set(opts.userBId, opts.userAId);

        this._resetarTimeout(opts.userAId, opts.userBId);

        return sessao;
    }


    getSessao(userId) {
        return this._sessoes.get(userId) ?? null;
    }

    emBatalha(userId) {
        return this._sessoes.has(userId);
    }


    encerrar(userAId, userBId) {
        this._sessoes.delete(userAId);
        this._sessoes.delete(userBId);
        this._pares.delete(userAId);
        this._pares.delete(userBId);
        this._limparTimeout(userAId);
        this._limparTimeout(userBId);
    }


    _resetarTimeout(userAId, userBId) {
        this._limparTimeout(userAId);
        this._limparTimeout(userBId);

        const timer = setTimeout(() => {
            console.log(`[BattleManager] Encerrando batalha por inatividade: ${userAId} vs ${userBId}`);
            this.encerrar(userAId, userBId);
        }, 10 * 60 * 1000); 

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

    resetarAtividade(userId) {
        const sessao = this.getSessao(userId);
        if (!sessao) return;
        this._resetarTimeout(sessao.userAId, sessao.userBId);
    }


    get totalSessoes() {
        return this._sessoes.size / 2;
    }
}

module.exports = new BattleManager();
