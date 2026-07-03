'use strict';

/**
 * TTLCache — cache genérico em memória com expiração automática.
 *
 * DiscordGatewayClient tinha reinventado seu próprio cache (Map com
 * setInterval, objeto puro sem limpeza, etc). Esta classe padroniza isso:
 *
 *   - get/set/delete/has, com expiração automática por entrada (TTL em ms).
 *   - sweep periódico configurável (setInterval) que remove entradas
 *     expiradas sozinho, mesmo que nunca mais sejam lidas — resolve o
 *     vazamento de memória visto no `SecuritySystem._botPermCache`
 *     (objeto `{}` puro, só era limpo quando relido).
 *   - `destroy()` pra parar o sweep quando o processo for encerrado
 *     (evita manter o event loop vivo à toa em testes/scripts).
 */
class TTLCache {
    /**
     * @param {object} [opts]
     * @param {number} [opts.ttlMs=60000]              TTL padrão de cada entrada, em ms.
     * @param {number} [opts.sweepIntervalMs=300000]   Intervalo do sweep automático (5min). `0`/`null` desativa o sweep.
     * @param {number} [opts.maxSize]                  Limite opcional de entradas (LRU simples: remove a mais antiga ao estourar).
     */
    constructor(opts = {}) {
        this.ttlMs           = opts.ttlMs ?? 60_000;
        this.sweepIntervalMs = opts.sweepIntervalMs ?? 5 * 60_000;
        this.maxSize         = opts.maxSize ?? null;

        /** @type {Map<any, { value: any, expires: number }>} */
        this._store = new Map();

        this._sweepTimer = null;
        if (this.sweepIntervalMs) this._startSweep();
    }

    set(key, value, ttlMs = this.ttlMs) {
        if (this.maxSize && this._store.size >= this.maxSize && !this._store.has(key)) {
            const oldestKey = this._store.keys().next().value;
            if (oldestKey !== undefined) this._store.delete(oldestKey);
        }
        this._store.set(key, { value, expires: Date.now() + ttlMs });
        return value;
    }

    get(key) {
        const entry = this._store.get(key);
        if (!entry) return undefined;
        if (entry.expires <= Date.now()) {
            this._store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    has(key) {
        const entry = this._store.get(key);
        if (!entry) return false;
        if (entry.expires <= Date.now()) {
            this._store.delete(key);
            return false;
        }
        return true;
    }

    delete(key) {
        return this._store.delete(key);
    }

    /** Remove todas as entradas cuja chave satisfaz `predicate(key)`. Útil pra invalidar tudo de uma guild, por ex. */
    deleteWhere(predicate) {
        let removed = 0;
        for (const key of this._store.keys()) {
            if (predicate(key)) {
                this._store.delete(key);
                removed++;
            }
        }
        return removed;
    }

    clear() {
        this._store.clear();
    }

    get size() {
        return this._store.size;
    }

    /** Remove entradas expiradas. Chamado automaticamente pelo sweep, mas pode ser chamado manualmente também. */
    sweep() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this._store) {
            if (entry.expires <= now) {
                this._store.delete(key);
                removed++;
            }
        }
        return removed;
    }

    _startSweep() {
        this._sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs);
        // Não impede o processo de encerrar (worker threads/testes) por causa do timer.
        this._sweepTimer.unref?.();
    }

    /** Para o sweep automático. Chamar ao desligar o subsistema, se necessário. */
    destroy() {
        if (this._sweepTimer) {
            clearInterval(this._sweepTimer);
            this._sweepTimer = null;
        }
        this._store.clear();
    }
}

module.exports = TTLCache;
