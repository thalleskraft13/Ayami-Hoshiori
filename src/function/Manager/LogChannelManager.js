'use strict';

const DiscordRequest = require('../DiscordRequest.js');

const CHANNEL_ENV_MAP = {
    '1522177373792112860': 'WEBHOOK_GUILDS',
    '1522177449440448613': 'WEBHOOK_COMMANDS',
    '1522177412400676924': 'WEBHOOK_ECONOMIA',
    '1523640821629583441': 'WEBHOOK_TAREFAS',
};

class LogChannelManager {

    send(channelId, payload) {
       const envVar = CHANNEL_ENV_MAP[channelId];
       const url = process.env[envVar]; 
        if (!envVar) {
            console.warn(`[LogChannel:${channelId}] Canal não mapeado em CHANNEL_ENV_MAP — log ignorado.`);
            return;
        }

       
        if (!url) {
            console.warn(`[LogChannel:${channelId}] ${envVar} não configurada no .env — log ignorado.`);
            return;
        }

        this._sendInternal(url, payload).catch(err => {
            console.error(`[LogChannel:${channelId}] Falha ao enviar log:`, err?.message ?? err);
        });
    }

    async _sendInternal(webhookUrl, payload) {
        const match = webhookUrl.match(/\/webhooks\/(\d+)\/([^/?]+)/);
        if (!match) throw new Error(`URL de webhook inválida em ${webhookUrl}`);
        const [, id, token] = match;

        await DiscordRequest(`/webhooks/${id}/${token}?wait=true`, {
            method: 'POST',
            body: payload,
        });
    }
}

module.exports = new LogChannelManager();