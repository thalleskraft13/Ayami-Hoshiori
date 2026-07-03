'use strict';

require('dotenv').config();

const { isMainThread } = require('worker_threads');
const ClusterManager   = require('./src/Core/ClusterManager.js');

if (isMainThread) {
    const manager = new ClusterManager({
        totalShards:   1,
        shardsPerCluster: 1,
        clientOptions: { intents: 53608191 },
    });

    // Expõe globalmente para o IPC funcionar via require
    global.__clusterManager = manager;

    manager.launch().catch(console.error);
}