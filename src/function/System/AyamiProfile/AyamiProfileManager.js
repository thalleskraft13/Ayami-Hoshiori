'use strict';

const DiscordRequest       = require('../../DiscordRequest.js');
const AyamiProfileRequest  = require('../../../Mongodb/ayamiProfileRequest.js');
const { isStaff }          = require('../../Utils/StaffIds.js');

const APPROVE_COLOR = 0x57F287;
const DENY_COLOR    = 0xED4245;
const PENDING_COLOR = 0xF1C40F;

const CALLBACK_TYPE_UPDATE_MESSAGE = 7;

/**
 * Perfil Personalizado da Ayami por Servidor (Constellation).
 *
 * Este manager só cuida do que acontece DEPOIS que a solicitação já
 * existe no banco (criada pelo dashboard, ver services/ayamiProfileService.js
 * no repo do site) e a mensagem de análise já foi enviada ao canal de
 * revisão via bot token (site/services/discordSender.js#sendAsBot).
 *
 * Responsabilidades daqui pra frente:
 *   1. Rotear os cliques de Aprovar/Recusar (InteractionManager despacha
 *      pra cá quando reconhece custom_id {"t":"ayami_profile_approve"/"ayami_profile_reject"}).
 *   2. Validar permissão (apenas staff da Ayami).
 *   3. Ao aprovar: aplicar as mudanças permitidas pela API do Discord,
 *      atualizar o banco, editar a mensagem de análise, notificar o servidor.
 *   4. Ao recusar: abrir modal pedindo o motivo, registrar, editar a
 *      mensagem de análise, notificar o servidor.
 *
 * IMPORTANTE — limitações reais da API do Discord (jul/2026):
 *   - Avatar do bot POR SERVIDOR: suportado, via
 *     PATCH /guilds/{guild.id}/members/@me { avatar }.
 *   - Banner e "Sobre mim" (about me) POR SERVIDOR: NÃO existe suporte
 *     oficial ainda — só é possível globalmente via PATCH /users/@me,
 *     o que afetaria TODOS os servidores (proibido pelo objetivo deste
 *     sistema). Por isso o dashboard mantém essas opções ocultas e,
 *     mesmo que um documento antigo tenha `changes.banner.requested`
 *     ou `changes.bio.requested` = true, este manager NUNCA aplica —
 *     apenas ignora e deixa registrado como não aplicado.
 */
class AyamiProfileManager {
    constructor(client) {
        this.client = client;
    }

    /* ═══════════════════════════════════════════════
       ✅ APROVAR
       ═══════════════════════════════════════════════ */
    async handleApprove(interaction, requestId) {
        try {
            const responderId = interaction.member?.user?.id || interaction.user?.id;

            if (!isStaff(responderId)) {
                return this._ephemeral(interaction, '❌ Apenas a equipe oficial da Ayami pode aprovar solicitações de perfil.');
            }

            const request = await AyamiProfileRequest.findById(requestId);
            if (!request || request.status !== 'pending') {
                return this._ephemeral(interaction, '⚠️ Essa solicitação já foi analisada ou não existe mais.');
            }

            const applied = await this._applyChanges(request);

            request.status         = 'approved';
            request.resolvedBy     = responderId;
            request.resolvedAt     = new Date();
            request.appliedChanges = applied;
            await request.save();

            await this._updateReviewMessage(interaction, request, {
                title: '✅ Solicitação aprovada',
                color: APPROVE_COLOR,
                footer: `Aprovado por ${responderId}`,
            });

            await this._notifyGuild(request, true, applied);
        } catch (err) {
            console.error('[AyamiProfileManager] Erro ao aprovar:', err);
            await this._ephemeral(interaction, `❌ Erro ao aprovar: ${err.message || 'erro desconhecido'}`);
        }
    }

    /* ═══════════════════════════════════════════════
       ❌ RECUSAR — abre modal pedindo o motivo
       ═══════════════════════════════════════════════ */
    async handleReject(interaction, requestId) {
        const responderId = interaction.member?.user?.id || interaction.user?.id;

        if (!isStaff(responderId)) {
            return this._ephemeral(interaction, '❌ Apenas a equipe oficial da Ayami pode recusar solicitações de perfil.');
        }

        const request = await AyamiProfileRequest.findById(requestId);
        if (!request || request.status !== 'pending') {
            return this._ephemeral(interaction, '⚠️ Essa solicitação já foi analisada ou não existe mais.');
        }

        const modal = this.client.interactions.createModal({
            user: responderId,
            title: 'Motivo da recusa',
            funcao: (modalInteraction, client, fields) =>
                this._handleRejectSubmit(modalInteraction, requestId, fields.motivo),
            components: [
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'motivo',
                        style: 2,
                        label: 'Por que essa solicitação está sendo recusada?',
                        placeholder: 'Ex: a imagem enviada não segue as diretrizes da comunidade.',
                        required: true,
                        min_length: 3,
                        max_length: 500,
                    }],
                },
            ],
        });

        await this.client.interactions.showModal(interaction, modal);
    }

    async _handleRejectSubmit(interaction, requestId, reason) {
        try {
            const responderId = interaction.member?.user?.id || interaction.user?.id;

            const request = await AyamiProfileRequest.findById(requestId);
            if (!request || request.status !== 'pending') {
                return this._ephemeral(interaction, '⚠️ Essa solicitação já foi analisada ou não existe mais.');
            }

            request.status       = 'denied';
            request.resolvedBy   = responderId;
            request.resolvedAt   = new Date();
            request.denialReason = reason || null;
            await request.save();

            await this._updateReviewMessage(interaction, request, {
                title: '❌ Solicitação recusada',
                color: DENY_COLOR,
                footer: `Recusado por ${responderId}`,
                extraField: { name: 'Motivo', value: reason || 'Não informado' },
            });

            await this._notifyGuild(request, false, null, reason);
        } catch (err) {
            console.error('[AyamiProfileManager] Erro ao recusar:', err);
            await this._ephemeral(interaction, `❌ Erro ao recusar: ${err.message || 'erro desconhecido'}`);
        }
    }

    /* ═══════════════════════════════════════════════
       Aplica as mudanças permitidas pela API do Discord
       ═══════════════════════════════════════════════ */
    async _applyChanges(request) {
        const applied = { avatar: false, banner: false, bio: false };

        // Avatar — suportado por servidor via member avatar do bot.
        if (request.changes?.avatar?.requested && request.changes.avatar.url) {
            try {
                const base64 = await this._urlToDataUri(request.changes.avatar.url);
                await DiscordRequest(`/guilds/${request.guildId}/members/@me`, {
                    method: 'PATCH',
                    body: { avatar: base64 },
                });
                applied.avatar = true;
            } catch (err) {
                console.error('[AyamiProfileManager] Falha ao aplicar avatar:', err);
            }
        }

        // Banner e Bio (about me) — SEM suporte por servidor na API do
        // Discord ainda. Não aplicamos nada, mesmo que solicitado —
        // arquitetura já preparada pro dia em que existir suporte oficial.
        // (request.changes.banner / request.changes.bio permanecem só
        // registrados no histórico, nunca aplicados por aqui.)

        return applied;
    }

    async _urlToDataUri(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Não consegui baixar a imagem (${res.status})`);
        const contentType = res.headers.get('content-type') || 'image/png';
        const buffer = Buffer.from(await res.arrayBuffer());
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    /* ═══════════════════════════════════════════════
       Edita a mensagem de análise no canal de revisão
       ═══════════════════════════════════════════════ */
    async _updateReviewMessage(interaction, request, { title, color, footer, extraField }) {
        const fields = [
            { name: 'Servidor', value: `${request.guildName || request.guildId} (\`${request.guildId}\`)`, inline: true },
            { name: 'Solicitado por', value: `<@${request.requesterId}>`, inline: true },
        ];

        const changeLines = [];
        changeLines.push(`${request.changes?.avatar?.requested ? '✅' : '❌'} Avatar`);
        changeLines.push(`${request.changes?.banner?.requested ? '✅' : '❌'} Banner`);
        changeLines.push(`${request.changes?.bio?.requested ? '✅' : '❌'} Sobre Mim`);
        fields.push({ name: 'Alterações solicitadas', value: changeLines.join('\n') });

        if (extraField) fields.push(extraField);

        const embed = {
            title,
            color,
            fields,
            footer: { text: footer },
            timestamp: new Date().toISOString(),
        };

        await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
            method: 'POST',
            body: {
                type: CALLBACK_TYPE_UPDATE_MESSAGE,
                data: { embeds: [embed], components: [] },
            },
        });
    }

    /* ═══════════════════════════════════════════════
       Notifica o servidor solicitante do resultado
       ═══════════════════════════════════════════════ */
    async _notifyGuild(request, approved, applied, reason) {
        const embed = approved
            ? {
                title: '✨ Seu Perfil Personalizado da Ayami foi aprovado!',
                description: this._appliedSummary(applied),
                color: APPROVE_COLOR,
            }
            : {
                title: '💭 Sua solicitação de Perfil Personalizado foi recusada',
                description: reason ? `**Motivo:** ${reason}` : 'Nenhum motivo foi informado.',
                color: DENY_COLOR,
            };

        try {
            if (request.notifyChannelId) {
                await DiscordRequest(`/channels/${request.notifyChannelId}/messages`, {
                    method: 'POST',
                    body: { content: `<@${request.requesterId}>`, embeds: [embed] },
                });
                return;
            }
        } catch (err) {
            console.error('[AyamiProfileManager] Falha ao notificar no canal, tentando DM:', err.message);
        }

        // Fallback: DM pra quem solicitou.
        try {
            const dm = await DiscordRequest('/users/@me/channels', {
                method: 'POST',
                body: { recipient_id: request.requesterId },
            });
            await DiscordRequest(`/channels/${dm.id}/messages`, {
                method: 'POST',
                body: { embeds: [embed] },
            });
        } catch (err) {
            console.error('[AyamiProfileManager] Falha ao notificar por DM:', err.message);
        }
    }

    _appliedSummary(applied) {
        if (!applied) return 'As alterações foram registradas.';
        const parts = [];
        if (applied.avatar) parts.push('✅ Avatar atualizado');
        if (applied.banner) parts.push('⏳ Banner (ainda sem suporte por servidor na API do Discord)');
        if (applied.bio)    parts.push('⏳ Sobre Mim (ainda sem suporte por servidor na API do Discord)');
        return parts.length ? parts.join('\n') : 'Nenhuma alteração aplicável foi encontrada.';
    }

    async _ephemeral(interaction, content) {
        return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
            method: 'POST',
            body: { type: 4, data: { content, flags: 64 } },
        });
    }
}

module.exports = AyamiProfileManager;
