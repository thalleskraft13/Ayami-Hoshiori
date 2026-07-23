'use strict';

const { workerData, parentPort } = require('worker_threads');
const { clusterId, shards, totalShards, clientOptions } = workerData;

process.env.CLUSTER_ID   = String(clusterId);
process.env.SHARD_LIST   = shards.join(',');
process.env.TOTAL_SHARDS = String(totalShards);

const DiscordGatewayClient = require('../function/DiscordGatewayClient.js');

async function main() {
    const client = new DiscordGatewayClient({
        ...clientOptions,
        shards,
        totalShards,
        isPrimary: clusterId === 0,
    });

    await client._connectMongo();

    parentPort.on('message', async (msg) => {
    if (msg?.type === 'GET_STATS') {
        const data = await client.getClusterInfo();
        parentPort.postMessage({
            type:      'STATS_RESPONSE',
            requestId: msg.requestId,
            data,
        });
    }

    if (msg?.type === 'ALL_STATS_RESPONSE') {
        client.emit('all_stats_response', msg);
    }

    if (msg?.type === 'SET_PRESENCE') {
        client.setPresence('all', msg.opts ?? {});
    }

    if (msg?.type === 'SET_MAINTENANCE') {
        require('../function/Utils/MaintenanceMode.js').applyLocalState(msg.state ?? {});
    }
});
    
    client.once('ready', () => {
    parentPort.postMessage({ type: 'CLUSTER_READY' });
    console.log(`[ClusterWorker ${clusterId}] Pronto!`);
});



    await client.connect();
}

main().catch((err) => {
    console.error(`[ClusterWorker ${clusterId}] Fatal:`, err);
    process.exit(1);
});