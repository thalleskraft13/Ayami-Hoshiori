'use strict';

const DiscordRequest      = require('../../DiscordRequest.js');
const TicketInstanceModel = require('../../../Mongodb/ticketInstance.js');

class TicketParticipants {

  constructor(ticketSystem) {
    this.ticketSystem = ticketSystem;
    this.client = ticketSystem.client;
  }

  t(key, ctx) {
    return this.client.t(`ticket.${key}`, ctx);
  }

  async _findPanelConfig(guildId, panelId) {
    const doc = await this.ticketSystem._getGuildDoc(guildId);
    return this.ticketSystem._findPanel(doc, panelId);
  }

  _canManage(interaction, panel, kind) {
    const roles = kind === 'add'
      ? panel?.participantsConfig?.addRoles
      : panel?.participantsConfig?.removeRoles;

    if (!roles?.length) return true;

    const memberRoles = interaction.member?.roles || [];
    return roles.some(roleId => memberRoles.includes(roleId));
  }

  async log(panel, titleKey, ctx, fields) {
    const logChannelId = panel?.claimConfig?.logChannelId;
    if (!logChannelId) return;

    await DiscordRequest(`/channels/${logChannelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title: this.t(titleKey, ctx),
          color: 0x7C8FFF,
          fields,
          timestamp: new Date().toISOString(),
        }]
      }
    }).catch(err => console.error('[TicketParticipants] Erro ao registrar log:', err));
  }

  async promptAdd(interaction) {
    return this._prompt(interaction, 'add');
  }

  async promptRemove(interaction) {
    return this._prompt(interaction, 'remove');
  }

  async _prompt(interaction, kind) {
    const data = JSON.parse(interaction.data.custom_id);
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    const instance = await TicketInstanceModel.findOne({ channelId: data.ch });
    if (!instance) return this._replyEphemeral(interaction, this.t('participant_ticket_not_found', ctx));

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);

    if (!this._canManage(interaction, panel, kind)) {
      return this._replyEphemeral(interaction, this.t(kind === 'add' ? 'participant_add_no_permission' : 'participant_remove_no_permission', ctx));
    }

    const select = this.client.interactions.createUserSelect({
      user: userId,
      data: { placeholder: this.t(kind === 'add' ? 'participant_add_placeholder' : 'participant_remove_placeholder', ctx) },
      funcao: async (mi) => kind === 'add' ? this.addSubmit(mi, instance.channelId) : this.removeSubmit(mi, instance.channelId)
    });

    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: 'POST',
      body: { type: 4, data: { flags: 64, components: [{ type: 1, components: [select] }] } }
    });
  }

  async addSubmit(interaction, channelId) {
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const targetUserId = interaction.data?.values?.[0];

    const instance = await TicketInstanceModel.findOne({ channelId });
    if (!instance) return this._replyEphemeral(interaction, this.t('participant_ticket_not_found', ctx));

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);
    if (!this._canManage(interaction, panel, 'add')) {
      return this._replyEphemeral(interaction, this.t('participant_add_no_permission', ctx));
    }

    if (targetUserId === this.client.clientId) {
      return this._replyEphemeral(interaction, this.t('participant_cannot_add_bot', ctx));
    }

    if (instance.participants.includes(targetUserId) || instance.ownerId === targetUserId) {
      return this._replyEphemeral(interaction, this.t('participant_already_in', { ...ctx, userId: targetUserId }));
    }

    await DiscordRequest(`/channels/${channelId}/permissions/${targetUserId}`, {
      method: 'PUT',
      body: { type: 1, allow: '3072' }
    });

    instance.participants.push(targetUserId);
    instance.participantHistory.push({ action: 'add', byUserId: userId, targetUserId });
    await instance.save();

    await this._reply(interaction, this.t('participant_add_success', { ...ctx, userId: targetUserId }));

    await this.log(panel, 'log_participant_add_title', ctx, [
      { name: this.t('log_field_channel', ctx), value: `<#${channelId}>`, inline: true },
      { name: this.t('log_field_by', ctx), value: `<@${userId}>`, inline: true },
      { name: this.t('log_field_participant', ctx), value: `<@${targetUserId}>`, inline: true },
    ]);
  }

  async removeSubmit(interaction, channelId) {
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const targetUserId = interaction.data?.values?.[0];

    const instance = await TicketInstanceModel.findOne({ channelId });
    if (!instance) return this._replyEphemeral(interaction, this.t('participant_ticket_not_found', ctx));

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);
    if (!this._canManage(interaction, panel, 'remove')) {
      return this._replyEphemeral(interaction, this.t('participant_remove_no_permission', ctx));
    }

    if (targetUserId === instance.ownerId) {
      return this._replyEphemeral(interaction, this.t('participant_cannot_remove_owner', ctx));
    }

    if (targetUserId === this.client.clientId) {
      return this._replyEphemeral(interaction, this.t('participant_cannot_remove_bot', ctx));
    }

    await DiscordRequest(`/channels/${channelId}/permissions/${targetUserId}`, { method: 'DELETE' }).catch(() => {});

    instance.participants = instance.participants.filter(id => id !== targetUserId);
    instance.participantHistory.push({ action: 'remove', byUserId: userId, targetUserId });
    await instance.save();

    await this._reply(interaction, this.t('participant_remove_success', { ...ctx, userId: targetUserId }));

    await this.log(panel, 'log_participant_remove_title', ctx, [
      { name: this.t('log_field_channel', ctx), value: `<#${channelId}>`, inline: true },
      { name: this.t('log_field_by', ctx), value: `<@${userId}>`, inline: true },
      { name: this.t('log_field_participant', ctx), value: `<@${targetUserId}>`, inline: true },
    ]);
  }

  async _reply(interaction, content) {
    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: 'POST',
      body: { type: 4, data: { content, flags: 64 } }
    }).catch(err => console.error('[TicketParticipants] Erro ao responder interação:', err));
  }

  async _replyEphemeral(interaction, content) {
    return this._reply(interaction, content);
  }
}

module.exports = TicketParticipants;
