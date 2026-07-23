'use strict';

class TTLCache {
    constructor(opts = {}) {
        this.ttlMs           = opts.ttlMs ?? 60_000;
        this.sweepIntervalMs = opts.sweepIntervalMs ?? 5 * 60_000;
        this.maxSize         = opts.maxSize ?? null;

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
        this._sweepTimer.unref?.();
    }

    destroy() {
        if (this._sweepTimer) {
            clearInterval(this._sweepTimer);
            this._sweepTimer = null;
        }
        this._store.clear();
    }
}

module.exports = TTLCache;
