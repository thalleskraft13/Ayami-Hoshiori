'use strict';

/**
 * Concurrency-limited async task queue.
 *
 * Ensures at most `concurrency` tasks run simultaneously,
 * queuing the rest until a slot becomes available.
 *
 * @example
 * const queue = new Queue({ concurrency: 4 });
 * const buffer = await queue.add(() => renderHeavyImage(data));
 */
class Queue {
    /**
     * @param {object} [options]
     * @param {number} [options.concurrency=4]  - Max simultaneous tasks.
     * @param {number} [options.timeout=30_000] - Per-task timeout in ms. 0 = unlimited.
     */
    constructor(options = {}) {
        this._concurrency = Math.max(1, options.concurrency ?? 4);
        this._timeout     = options.timeout ?? 30_000;

        /** @type {Array<{ fn: Function, resolve: Function, reject: Function }>} */
        this._pending  = [];
        this._running  = 0;
        this._stats    = { completed: 0, failed: 0, queued: 0 };
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Enqueue an async function. Returns a Promise that resolves/rejects
     * with the function's result once it gets a slot.
     *
     * @template T
     * @param {() => Promise<T>} fn
     * @returns {Promise<T>}
     */
    add(fn) {
        return new Promise((resolve, reject) => {
            this._pending.push({ fn, resolve, reject });
            this._stats.queued++;
            this._tick();
        });
    }

    /**
     * Current snapshot of queue state.
     *
     * @returns {{ running: number, pending: number, completed: number, failed: number }}
     */
    stats() {
        return {
            running:   this._running,
            pending:   this._pending.length,
            completed: this._stats.completed,
            failed:    this._stats.failed,
        };
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    _tick() {
        while (this._running < this._concurrency && this._pending.length > 0) {
            const task = this._pending.shift();
            this._running++;
            this._run(task);
        }
    }

    async _run({ fn, resolve, reject }) {
        try {
            const result = await this._withTimeout(fn);
            resolve(result);
            this._stats.completed++;
        } catch (err) {
            reject(err);
            this._stats.failed++;
        } finally {
            this._running--;
            this._tick();
        }
    }

    /**
     * Execute `fn` with a timeout guard.
     *
     * @param {Function} fn
     * @returns {Promise<*>}
     */
    _withTimeout(fn) {
        if (this._timeout <= 0) return fn();

        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error(`[Queue] Task timed out after ${this._timeout}ms`)),
                this._timeout
            );

            Promise.resolve()
                .then(fn)
                .then((v) => { clearTimeout(timer); resolve(v); })
                .catch((e) => { clearTimeout(timer); reject(e); });
        });
    }
}

module.exports = Queue;
