'use strict';

class ClusterSyncManager {

    constructor() {
        this._watchers = new Map();
    }

    watch(name, model, onChange, opts = {}) {
        if (this._watchers.has(name)) return; 

        try {
            const stream = model.watch([], { fullDocument: 'updateLookup' });

            stream.on('change', (change) => {
                try { onChange(change); }
                catch (err) { console.error(`[ClusterSync:${name}] Erro no handler de mudança:`, err); }
            });

            stream.on('error', (err) => {
                console.warn(`[ClusterSync:${name}] Change stream caiu, tentando fallback por polling:`, err?.message ?? err);
                this._watchers.delete(name);
                this._startPolling(name, model, onChange, opts.pollIntervalMs ?? 15_000);
            });

            this._watchers.set(name, { model, stream, pollTimer: null });
            console.log(`[ClusterSync] Watcher "${name}" ativo via Change Streams.`);
        } catch (err) {
            console.warn(
                `[ClusterSync:${name}] Change Streams indisponível (Mongo sem replica set?). ` +
                `Usando polling a cada ${(opts.pollIntervalMs ?? 15_000) / 1000}s como fallback.`
            );
            this._startPolling(name, model, onChange, opts.pollIntervalMs ?? 15_000);
        }
    }

    _startPolling(name, model, onChange, intervalMs) {
        let lastCheck = new Date();

        const timer = setInterval(async () => {
            try {
                const changed = await model.find({ updatedAt: { $gt: lastCheck } }).lean().catch(() => []);
                lastCheck = new Date();
                for (const doc of changed) {
                    onChange({ operationType: 'update', fullDocument: doc, documentKey: { _id: doc._id } });
                }
            } catch (err) {
                console.error(`[ClusterSync:${name}] Erro no polling de fallback:`, err);
            }
        }, intervalMs);

        timer.unref?.();
        this._watchers.set(name, { model, stream: null, pollTimer: timer });
    }

    unwatch(name) {
        const w = this._watchers.get(name);
        if (!w) return;
        if (w.stream) w.stream.close().catch(() => {});
        if (w.pollTimer) clearInterval(w.pollTimer);
        this._watchers.delete(name);
    }

    destroy() {
        for (const name of this._watchers.keys()) this.unwatch(name);
    }
}

module.exports = ClusterSyncManager;
