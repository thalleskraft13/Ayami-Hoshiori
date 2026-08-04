'use strict';

const DiscordRequest       = require('../../DiscordRequest.js');
const TicketInstanceModel  = require('../../../Mongodb/ticketInstance.js');

class TicketClaim {

  constructor(ticketSystem) {
    this.ticketSystem = ticketSystem;
    this.client = ticketSystem.client;
  }

  t(key, ctx) {
    return this.client.t(`ticket.${key}`, ctx);
  }

  async createInstance({ guildId, channelId, panelId, ownerId }) {
    return TicketInstanceModel.create({ guildId, channelId, panelId, ownerId });
  }

  async getInstance(channelId) {
    return TicketInstanceModel.findOne({ channelId });
  }

  buildStatusRow(ctx, instance) {
    const components = [];

    if (instance.claimedBy) {
      components.push({ type: 2, style: 2, label: this.t('btn_unclaim', ctx), custom_id: JSON.stringify({ t: 'ticket_unclaim', ch: instance.channelId }) });
      components.push({ type: 2, style: 1, label: this.t('btn_transfer', ctx), custom_id: JSON.stringify({ t: 'ticket_transfer', ch: instance.channelId }) });
    } else {
      components.push({ type: 2, style: 3, label: this.t('btn_claim', ctx), custom_id: JSON.stringify({ t: 'ticket_claim', ch: instance.channelId }) });
    }

    return { type: 1, components };
  }

  statusFieldText(ctx, instance) {
    return instance.claimedBy
      ? this.t('claim_status_set', { ...ctx, userId: instance.claimedBy })
      : this.t('claim_status_none', ctx);
  }

  async _findPanelConfig(guildId, panelId) {
    const doc = await this.ticketSystem._getGuildDoc(guildId);
    return this.ticketSystem._findPanel(doc, panelId);
  }

  _staffRoleIds(panel) {
    return panel?.claimConfig?.cargosPermitidos?.length
      ? panel.claimConfig.cargosPermitidos
      : (panel?.cargosStaff || []);
  }

  hasClaimPermission(interaction, panel) {
    const allowedRoles = this._staffRoleIds(panel);
    if (!allowedRoles.length) return true;

    const memberRoles = interaction.member?.roles || [];
    return allowedRoles.some(roleId => memberRoles.includes(roleId));
  }

  async refreshStatusMessage(instance, ctx) {
    if (!instance.statusMessageId) return;

    const message = await DiscordRequest(`/channels/${instance.channelId}/messages/${instance.statusMessageId}`).catch(() => null);
    if (!message) return;

    const embeds = (message.embeds || []).map((embed, idx) => {
      if (idx !== 0) return embed;
      const fields = (embed.fields || []).length
        ? embed.fields.map((f, i) => i === 0 ? { ...f, value: this.statusFieldText(ctx, instance) } : f)
        : [{ name: '\u200b', value: this.statusFieldText(ctx, instance) }];
      return { ...embed, fields };
    });

    const closeRow = (message.components || []).find(row => row.components?.some(c => {
      try { return JSON.parse(c.custom_id || '{}').t === 'close_ticket_v2'; } catch { return false; }
    }));

    await DiscordRequest(`/channels/${instance.channelId}/messages/${instance.statusMessageId}`, {
      method: 'PATCH',
      body: { embeds, components: [...(closeRow ? [closeRow] : []), this.buildStatusRow(ctx, instance)] }
    }).catch(err => console.error('[TicketClaim] Erro ao atualizar mensagem de status:', err));
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
    }).catch(err => console.error('[TicketClaim] Erro ao registrar log:', err));
  }

  async claim(interaction) {
    const data = JSON.parse(interaction.data.custom_id);
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    const instance = await this.getInstance(data.ch);
    if (!instance) return this._replyEphemeral(interaction, this.t('unclaim_not_claimed', ctx));

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);
    if (panel?.claimConfig?.enabled === false) return this._replyEphemeral(interaction, this.t('claim_no_permission', ctx));

    if (!this.hasClaimPermission(interaction, panel)) {
      return this._replyEphemeral(interaction, this.t('claim_no_permission', ctx));
    }

    if (instance.claimedBy) {
      return this._replyEphemeral(interaction, this.t('claim_already_claimed', { ...ctx, userId: instance.claimedBy }));
    }

    instance.claimedBy = userId;
    instance.claimHistory.push({ action: 'claim', byUserId: userId, previousUserId: null, newUserId: userId });
    await instance.save();

    await this.refreshStatusMessage(instance, ctx);
    await this._reply(interaction, this.t('claim_success', { ...ctx, userId }));

    await this.log(panel, 'log_claim_title', ctx, [
      { name: this.t('log_field_channel', ctx), value: `<#${instance.channelId}>`, inline: true },
      { name: this.t('log_field_by', ctx), value: `<@${userId}>`, inline: true },
    ]);
  }

  async unclaim(interaction) {
    const data = JSON.parse(interaction.data.custom_id);
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    const instance = await this.getInstance(data.ch);
    if (!instance) return this._replyEphemeral(interaction, this.t('unclaim_not_claimed', ctx));

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);

    if (!this.hasClaimPermission(interaction, panel) && instance.claimedBy !== userId) {
      return this._replyEphemeral(interaction, this.t('unclaim_no_permission', ctx));
    }

    if (!instance.claimedBy) {
      return this._replyEphemeral(interaction, this.t('unclaim_not_claimed', ctx));
    }

    const previousUserId = instance.claimedBy;
    instance.claimedBy = null;
    instance.claimHistory.push({ action: 'unclaim', byUserId: userId, previousUserId, newUserId: null });
    await instance.save();

    await this.refreshStatusMessage(instance, ctx);
    await this._reply(interaction, this.t('unclaim_success', { ...ctx, userId }));

    await this.log(panel, 'log_unclaim_title', ctx, [
      { name: this.t('log_field_channel', ctx), value: `<#${instance.channelId}>`, inline: true },
      { name: this.t('log_field_by', ctx), value: `<@${userId}>`, inline: true },
      { name: this.t('log_field_previous', ctx), value: `<@${previousUserId}>`, inline: true },
    ]);
  }

  async transferPrompt(interaction) {
    const data = JSON.parse(interaction.data.custom_id);
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    const instance = await this.getInstance(data.ch);
    if (!instance) return this._replyEphemeral(interaction, this.t('unclaim_not_claimed', ctx));

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);

    if (!this.hasClaimPermission(interaction, panel)) {
      return this._replyEphemeral(interaction, this.t('transfer_no_permission', ctx));
    }

    const select = this.client.interactions.createUserSelect({
      user: userId,
      data: { placeholder: this.t('transfer_select_placeholder', ctx) },
      funcao: async (mi) => this.transferSubmit(mi, instance.channelId)
    });

    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: 'POST',
      body: { type: 4, data: { flags: 64, components: [{ type: 1, components: [select] }] } }
    });
  }

  async transferSubmit(interaction, channelId) {
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const targetUserId = interaction.data?.values?.[0];

    const instance = await this.getInstance(channelId);
    if (!instance) return this._replyEphemeral(interaction, this.t('unclaim_not_claimed', ctx));

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);

    if (!this.hasClaimPermission(interaction, panel)) {
      return this._replyEphemeral(interaction, this.t('transfer_no_permission', ctx));
    }

    if (instance.claimedBy === targetUserId) {
      return this._replyEphemeral(interaction, this.t('transfer_same_user', ctx));
    }

    const previousUserId = instance.claimedBy;
    instance.claimedBy = targetUserId;
    instance.claimHistory.push({ action: 'transfer', byUserId: userId, previousUserId, newUserId: targetUserId });
    await instance.save();

    await this.refreshStatusMessage(instance, ctx);
    await this._reply(interaction, this.t('transfer_success', { ...ctx, fromUserId: userId, toUserId: targetUserId }));

    await this.log(panel, 'log_transfer_title', ctx, [
      { name: this.t('log_field_channel', ctx), value: `<#${instance.channelId}>`, inline: true },
      { name: this.t('log_field_by', ctx), value: `<@${userId}>`, inline: true },
      { name: this.t('log_field_previous', ctx), value: previousUserId ? `<@${previousUserId}>` : this.t('log_none', ctx), inline: true },
      { name: this.t('log_field_new', ctx), value: `<@${targetUserId}>`, inline: true },
    ]);
  }

  async _reply(interaction, content) {
    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: 'POST',
      body: { type: 4, data: { content, flags: 64 } }
    }).catch(err => console.error('[TicketClaim] Erro ao responder interação:', err));
  }

  async _replyEphemeral(interaction, content) {
    return this._reply(interaction, content);
  }
}

module.exports = TicketClaim;
