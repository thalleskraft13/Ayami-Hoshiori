'use strict';

const BlacklistModel = require('../../Mongodb/blacklist.js');
const ClusterSyncManager = require('./ClusterSyncManager.js');

/**
 * BlacklistManager 
 *
 * Blacklist GLOBAL: bane do bot inteiro, aplicada só pela staff oficial da
 * Ayami (não pelos donos de servidor). Checada em toda interação
 * (DiscordGatewayClient#_onInteraction), então não pode bater no Mongo a
 * cada clique — mantém um cache em memória (Map, carregado no boot) e
 * sincronizado entre clusters via ClusterSyncManager (Mongo Change Streams) sempre que alguém for banido/desbanido em qualquer cluster.
 */
class BlacklistManager {

    constructor(client) {
        this.client = client;

        /** @type {Map<string, { staffId: string, motivo: string, appliedAt: number }>} */
        this._cache = new Map();
        this._sync  = new ClusterSyncManager();
        this._ready = false;
    }

    /** Carrega a blacklist inteira do Mongo pra memória e começa a escutar mudanças de outros clusters. */
    async start() {
        await this._loadAll();

        this._sync.watch('blacklist-sync', BlacklistModel, (change) => {
            this._applyChange(change);
        });

        this._ready = true;
        console.log(`[Blacklist] ${this._cache.size} usuário(s) na blacklist. Cache carregado.`);
    }

    async _loadAll() {
        const docs = await BlacklistModel.find({}).lean();
        this._cache.clear();
        for (const doc of docs) {
            this._cache.set(doc.userId, {
                staffId:   doc.staffId,
                motivo:    doc.motivo,
                appliedAt: doc.appliedAt,
            });
        }
    }

    _applyChange(change) {
        if (change.operationType === 'delete') {
            // documentKey não tem o userId direto (é o _id do Mongo) — como não
            // temos o userId no delete, mais simples e seguro é recarregar tudo.
            // Baixo custo: blacklist tende a ser pequena e bans/unbans são raros.
            this._loadAll().catch(err => console.error('[Blacklist] Erro ao recarregar após delete:', err));
            return;
        }

        const doc = change.fullDocument;
        if (!doc?.userId) return;

        this._cache.set(doc.userId, {
            staffId:   doc.staffId,
            motivo:    doc.motivo,
            appliedAt: doc.appliedAt,
        });
    }

    /** Checagem síncrona e barata — é isso que roda em toda interação. */
    isBanned(userId) {
        return this._cache.has(userId);
    }

    getEntry(userId) {
        return this._cache.get(userId) ?? null;
    }

    /**
     * Aplica um ban global. Persiste no Mongo (o que dispara o Change Stream
     * e propaga pros outros clusters automaticamente) e já atualiza o cache
     * local na hora, sem esperar o round-trip do próprio stream.
     */
    async ban(userId, staffId, motivo = "Não especificado") {
        const doc = await BlacklistModel.findOneAndUpdate(
            { userId },
            { userId, staffId, motivo, appliedAt: Date.now() },
            { upsert: true, new: true }
        );
        this._cache.set(userId, { staffId: doc.staffId, motivo: doc.motivo, appliedAt: doc.appliedAt });
        return doc;
    }

    /** Remove um ban global. */
    async unban(userId) {
        await BlacklistModel.deleteOne({ userId });
        this._cache.delete(userId);
    }

    destroy() {
        this._sync.destroy();
    }
}

module.exports = BlacklistManager;
