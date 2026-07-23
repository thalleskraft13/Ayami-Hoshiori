'use strict';



class Cache {
    constructor(options = {}) {
        this._ttl             = options.ttl             ?? 300_000;
        this._maxSize         = options.maxSize         ?? 500;
        this._cleanupInterval = options.cleanupInterval ?? 60_000;
        this._name            = options.name            ?? 'Cache';

        this._store = new Map();

        this._stats = { hits: 0, misses: 0, evicted: 0 };

        this._timer = setInterval(() => this._sweep(), this._cleanupInterval);
        this._timer.unref?.(); 
    }


    set(key, value, ttl) {
        const resolvedTtl = ttl ?? this._ttl;
        const expiresAt   = resolvedTtl > 0 ? Date.now() + resolvedTtl : 0;

        this._store.set(key, { value, expiresAt, hits: 0, createdAt: Date.now() });
        this._enforceMaxSize();
    }

    get(key) {
        const entry = this._store.get(key);
        if (!entry) { this._stats.misses++; return undefined; }

        if (this._isExpired(entry)) {
            this._store.delete(key);
            this._stats.misses++;
            this._stats.evicted++;
            return undefined;
        }

        entry.hits++;
        this._stats.hits++;
        return entry.value;
    }

    has(key) {
        const entry = this._store.get(key);
        if (!entry) return false;
        if (this._isExpired(entry)) { this._store.delete(key); this._stats.evicted++; return false; }
        return true;
    }

    delete(key) {
        const existed = this._store.has(key);
        if (existed) this._stats.evicted++;
        return this._store.delete(key);
    }

    invalidatePrefix(prefix) {
        let count = 0;
        for (const key of this._store.keys()) {
            if (key.startsWith(prefix)) { this._store.delete(key); count++; }
        }
        this._stats.evicted += count;
        return count;
    }

    clear() {
        this._stats.evicted += this._store.size;
        this._store.clear();
    }

    stats() {
        return {
            size:    this._store.size,
            hits:    this._stats.hits,
            misses:  this._stats.misses,
            evicted: this._stats.evicted,
        };
    }

    destroy() {
        clearInterval(this._timer);
        this._store.clear();
    }


    _isExpired(entry) {
        return entry.expiresAt > 0 && Date.now() > entry.expiresAt;
    }

    _sweep() {
        let evicted = 0;
        for (const [key, entry] of this._store) {
            if (this._isExpired(entry)) { this._store.delete(key); evicted++; }
        }
        if (evicted > 0) {
            this._stats.evicted += evicted;
        }
    }

    _enforceMaxSize() {
        if (this._store.size <= this._maxSize) return;

        const overflow = this._store.size - this._maxSize;
        let   removed  = 0;

        for (const key of this._store.keys()) {
            if (removed >= overflow) break;
            this._store.delete(key);
            removed++;
        }

        this._stats.evicted += removed;
    }
}

module.exports = Cache;
