'use strict';

const BlacklistModel = require('../../Mongodb/blacklist.js');
const ClusterSyncManager = require('./ClusterSyncManager.js');

class BlacklistManager {

    constructor(client) {
        this.client = client;

        this._cache = new Map();
        this._sync  = new ClusterSyncManager();
        this._ready = false;
    }

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

    isBanned(userId) {
        return this._cache.has(userId);
    }

    getEntry(userId) {
        return this._cache.get(userId) ?? null;
    }

    async ban(userId, staffId, motivo = "Não especificado") {
        const doc = await BlacklistModel.findOneAndUpdate(
            { userId },
            { userId, staffId, motivo, appliedAt: Date.now() },
            { upsert: true, new: true }
        );
        this._cache.set(userId, { staffId: doc.staffId, motivo: doc.motivo, appliedAt: doc.appliedAt });
        return doc;
    }

    async unban(userId) {
        await BlacklistModel.deleteOne({ userId });
        this._cache.delete(userId);
    }

    destroy() {
        this._sync.destroy();
    }
}

module.exports = BlacklistManager;
