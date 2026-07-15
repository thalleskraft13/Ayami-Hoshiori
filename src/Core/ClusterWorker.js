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

    // Conecta o Mongo JÁ, antes de sequer abrir o gateway com o Discord —
    // assim a conexão fica pronta antes do primeiro comando/interação
    // chegar, em vez de esperar o READY do shard (que antes só disparava
    // pra shards específicos, listados em LISTASHARDS).
    //
    // Observação sobre "uma única conexão global pra todos os clusters":
    // como cada cluster roda numa worker_thread separada (isolate próprio
    // do V8, com seu próprio módulo/memória), não é possível compartilhar
    // literalmente UM objeto de conexão do Mongoose entre threads — sockets
    // TCP não são transferíveis entre isolates. O que dá pra fazer (e é o
    // que isso faz) é garantir 1 conexão por cluster, aberta o quanto antes,
    // em vez de N conexões abertas tarde e de forma redundante por shard.
    await client._connectMongo();

    // Escuta requests do ClusterManager
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
        // Repassa para o client resolver a Promise pendente
        client.emit('all_stats_response', msg);
    }

    if (msg?.type === 'SET_PRESENCE') {
        // Broadcast vindo do ClusterManager (seção 6) — aplica em todos os
        // shards DESTE cluster.
        client.setPresence('all', msg.opts ?? {});
    }

    if (msg?.type === 'SET_MAINTENANCE') {
        // Broadcast da Atualização Programada — atualiza o cache em
        // memória deste cluster imediatamente (sem round-trip ao Mongo).
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