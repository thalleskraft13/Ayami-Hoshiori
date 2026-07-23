'use strict';

const DiscordRequest       = require('../../DiscordRequest.js');
const AyamiProfileRequest  = require('../../../Mongodb/ayamiProfileRequest.js');
const { isStaff }          = require('../../Utils/StaffIds.js');

const APPROVE_COLOR = 0x57F287;
const DENY_COLOR    = 0xED4245;
const PENDING_COLOR = 0xF1C40F;

const CALLBACK_TYPE_UPDATE_MESSAGE = 7;

class AyamiProfileManager {
    constructor(client) {
        this.client = client;
    }

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

    async _applyChanges(request) {
        const applied = { avatar: false, banner: false, bio: false };

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


        return applied;
    }

    async _urlToDataUri(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Não consegui baixar a imagem (${res.status})`);
        const contentType = res.headers.get('content-type') || 'image/png';
        const buffer = Buffer.from(await res.arrayBuffer());
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    }

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
