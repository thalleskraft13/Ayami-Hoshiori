'use strict';

const DiscordRequest = require('../DiscordRequest.js');

/**
 * Mapa de ID do canal (o mesmo hardcoded nos managers que chamam .send())
 * -> variável de ambiente com a URL do webhook oficial daquele log.
 *
 * Pra trocar o webhook de um log oficial (ex: token vazou, canal mudou),
 * só mexe no .env — não precisa tocar em CommandLogManager, ServerLogManager
 * etc, que continuam chamando .send(channelId, payload) com o ID de sempre.
 */
const CHANNEL_ENV_MAP = {
    '1522177373792112860': 'WEBHOOK_GUILDS',
    '1522177449440448613': 'WEBHOOK_COMMANDS',
    '1522177412400676924': 'WEBHOOK_ECONOMIA',
    '1523640821629583441': 'WEBHOOK_TAREFAS',
};

/**
 * LogChannelManager — envio fire-and-forget de embeds pros canais fixos
 * de log OFICIAL do bot (comandos, entrada/saída de servidor, etc).
 * Cada ID de canal usado pelos managers é resolvido pra uma URL de
 * webhook fixa vinda do .env (ver CHANNEL_ENV_MAP). Não cria/gerencia
 * webhook dinamicamente — é exclusivo pros logs internos oficiais.
 *
 * Nunca lança erro pra quem chamou — é sempre "dispara e esquece", pra
 * nunca atrasar a resposta real de um comando pro usuário.
 */
class LogChannelManager {

    /**
     * @param {string} channelId  ID do canal (o mesmo hardcoded nos managers).
     * @param {object} payload    Payload de mensagem do Discord (ex: { embeds: [...] })
     */
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