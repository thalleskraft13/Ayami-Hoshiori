'use strict';

/**
 * @typedef {Object} CacheEntry
 * @property {*}      value     - The cached value.
 * @property {number} expiresAt - Unix timestamp (ms) when the entry expires. 0 = never.
 * @property {number} hits      - How many times this entry has been read.
 * @property {number} createdAt - Unix timestamp (ms) when the entry was created.
 */

/**
 * @typedef {Object} CacheStats
 * @property {number} size    - Number of entries currently in cache.
 * @property {number} hits    - Total cache hits.
 * @property {number} misses  - Total cache misses.
 * @property {number} evicted - Total entries evicted (expired or invalidated).
 */

/**
 * Generic in-memory key-value cache with TTL, auto-cleanup and statistics.
 *
 * @example
 * const cache = new Cache({ ttl: 60_000, maxSize: 200 });
 * cache.set('avatar:123', buffer);
 * const buf = cache.get('avatar:123'); // Buffer or undefined
 */
class Cache {
    /**
     * @param {object} [options]
     * @param {number} [options.ttl=300_000]        - Default TTL in ms (5 min). 0 = immortal.
     * @param {number} [options.maxSize=500]         - Max number of entries before LRU eviction.
     * @param {number} [options.cleanupInterval=60_000] - How often the sweep runs (ms).
     * @param {string} [options.name='Cache']        - Label used in log messages.
     */
    constructor(options = {}) {
        this._ttl             = options.ttl             ?? 300_000;
        this._maxSize         = options.maxSize         ?? 500;
        this._cleanupInterval = options.cleanupInterval ?? 60_000;
        this._name            = options.name            ?? 'Cache';

        /** @type {Map<string, CacheEntry>} */
        this._store = new Map();

        this._stats = { hits: 0, misses: 0, evicted: 0 };

        this._timer = setInterval(() => this._sweep(), this._cleanupInterval);
        this._timer.unref?.(); // Don't block Node.js exit
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Store a value.
     *
     * @param {string} key
     * @param {*}      value
     * @param {number} [ttl] - Override default TTL for this entry (ms). 0 = immortal.
     */
    set(key, value, ttl) {
        const resolvedTtl = ttl ?? this._ttl;
        const expiresAt   = resolvedTtl > 0 ? Date.now() + resolvedTtl : 0;

        this._store.set(key, { value, expiresAt, hits: 0, createdAt: Date.now() });
        this._enforceMaxSize();
    }

    /**
     * Retrieve a value. Returns `undefined` on miss or expired entry.
     *
     * @param {string} key
     * @returns {*}
     */
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

    /**
     * Check whether a key exists and is not expired.
     *
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        const entry = this._store.get(key);
        if (!entry) return false;
        if (this._isExpired(entry)) { this._store.delete(key); this._stats.evicted++; return false; }
        return true;
    }

    /**
     * Remove a specific key.
     *
     * @param {string} key
     * @returns {boolean} Whether the key existed.
     */
    delete(key) {
        const existed = this._store.has(key);
        if (existed) this._stats.evicted++;
        return this._store.delete(key);
    }

    /**
     * Remove all keys matching a prefix.
     *
     * @param {string} prefix
     * @returns {number} Number of keys removed.
     */
    invalidatePrefix(prefix) {
        let count = 0;
        for (const key of this._store.keys()) {
            if (key.startsWith(prefix)) { this._store.delete(key); count++; }
        }
        this._stats.evicted += count;
        return count;
    }

    /** Clear the entire cache. */
    clear() {
        this._stats.evicted += this._store.size;
        this._store.clear();
    }

    /**
     * Return current statistics.
     *
     * @returns {CacheStats}
     */
    stats() {
        return {
            size:    this._store.size,
            hits:    this._stats.hits,
            misses:  this._stats.misses,
            evicted: this._stats.evicted,
        };
    }

    /** Stop the cleanup timer. Call when shutting down the process. */
    destroy() {
        clearInterval(this._timer);
        this._store.clear();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /** @param {CacheEntry} entry */
    _isExpired(entry) {
        return entry.expiresAt > 0 && Date.now() > entry.expiresAt;
    }

    /** Remove expired entries. */
    _sweep() {
        let evicted = 0;
        for (const [key, entry] of this._store) {
            if (this._isExpired(entry)) { this._store.delete(key); evicted++; }
        }
        if (evicted > 0) {
            this._stats.evicted += evicted;
        }
    }

    /** Evict least-recently-created entries when maxSize is exceeded. */
    _enforceMaxSize() {
        if (this._store.size <= this._maxSize) return;

        // Map preserves insertion order — evict from the front.
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
