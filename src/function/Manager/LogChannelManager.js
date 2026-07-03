'use strict';

const { ensureWebhook, isWebhookDead } = require('./WebhookManager.js');
const DiscordRequest = require('../DiscordRequest.js');

/**
 * LogChannelManager — envio fire-and-forget de embeds pra canais fixos de
 * log interno do bot (comandos, entrada/saída de servidores, economia —
 * Mantém um webhook em cache por canal (criado uma vez, reaproveitado),
 * recriando automaticamente se ele for deletado/quebrar. Nunca lança erro
 * pra quem chamou — é sempre "dispara e esquece", pra nunca atrasar a
 * resposta real de um comando pro usuário.
 */
class LogChannelManager {

    constructor() {
        /** @type {Map<string, {id: string, token: string}>} */
        this._webhooks = new Map();
    }

    /**
     * Envia um embed (ou payload completo) pro canal, sem bloquear quem chamou.
     * @param {string} channelId
     * @param {object} payload  Payload de mensagem do Discord (ex: { embeds: [...] })
     */
    send(channelId, payload) {
        // Fire-and-forget de verdade: não retorna a Promise pro chamador.
        this._sendInternal(channelId, payload).catch(err => {
            console.error(`[LogChannel:${channelId}] Falha ao enviar log:`, err?.message ?? err);
        });
    }

    async _sendInternal(channelId, payload) {
        let webhook = this._webhooks.get(channelId);

        try {
            webhook = await ensureWebhook(channelId, webhook);
            this._webhooks.set(channelId, webhook);
            await DiscordRequest(`/webhooks/${webhook.id}/${webhook.token}?wait=true`, {
                method: 'POST',
                body: payload,
            });
        } catch (err) {
            if (isWebhookDead(err)) {
                // Recria uma vez e tenta de novo.
                try {
                    webhook = await ensureWebhook(channelId, null);
                    this._webhooks.set(channelId, webhook);
                    await DiscordRequest(`/webhooks/${webhook.id}/${webhook.token}?wait=true`, {
                        method: 'POST',
                        body: payload,
                    });
                    return;
                } catch (err2) {
                    throw err2;
                }
            }
            throw err;
        }
    }
}

module.exports = new LogChannelManager(); // singleton — um cache de webhooks pro processo inteiro
