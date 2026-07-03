'use strict';

/**
 * ClusterSyncManager — sincronização de estado entre clusters.
 *
 * Problema: o bot roda em múltiplos clusters (worker threads via
 * ClusterManager/ClusterWorker), cada um com memória isolada. Um cache em
 * memória (blacklist, premium, permissões) alterado num cluster não se
 * propaga sozinho pros outros.
 *
 * Mongo Change Streams. Cada cluster escuta
 * mudanças direto nas collections relevantes do Mongo, sem depender do
 * ClusterManager como intermediário. Mais desacoplado que IPC manual (opção
 * A) e escala melhor conforme novos tipos de dado forem adicionados — basta
 * chamar `watch()` de novo com outro model, sem tocar no ClusterManager/
 * ClusterWorker.
 *
 * Requer MongoDB rodando como replica set (padrão em Atlas e a maioria dos
 * provedores gerenciados). Se change streams não estiverem disponíveis
 * (ex: Mongo standalone em dev local), cai para um polling de fallback —
 * o subsistema continua funcionando, só perde a propagação instantânea.
 *
 */
class ClusterSyncManager {

    constructor() {
        /** @type {Map<string, { model: import('mongoose').Model, stream: any, pollTimer: any }>} */
        this._watchers = new Map();
    }

    /**
     * Começa a escutar mudanças numa collection via Mongo Change Stream.
     * @param {string} name         Nome único desse watcher (pra poder parar depois).
     * @param {import('mongoose').Model} model  Model do mongoose a observar.
     * @param {(change: object) => void} onChange  Callback chamado a cada insert/update/delete/replace.
     * @param {object} [opts]
     * @param {number} [opts.pollIntervalMs=15000]  Intervalo do fallback por polling, se change streams falharem.
     */
    watch(name, model, onChange, opts = {}) {
        if (this._watchers.has(name)) return; // já observando

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

    /** Para um watcher específico. */
    unwatch(name) {
        const w = this._watchers.get(name);
        if (!w) return;
        if (w.stream) w.stream.close().catch(() => {});
        if (w.pollTimer) clearInterval(w.pollTimer);
        this._watchers.delete(name);
    }

    /** Para todos os watchers (usar no shutdown do processo). */
    destroy() {
        for (const name of this._watchers.keys()) this.unwatch(name);
    }
}

module.exports = ClusterSyncManager;
