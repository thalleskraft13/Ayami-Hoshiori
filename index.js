'use strict';

require('dotenv').config();

const { isMainThread } = require('worker_threads');
const ClusterManager   = require('./src/Core/ClusterManager.js');

if (isMainThread) {
    const manager = new ClusterManager({
        totalShards:   6,
        shardsPerCluster: 3,
        clientOptions: { intents: 53608191 },
    });

    global.__clusterManager = manager;

    manager.launch().catch(console.error);
}