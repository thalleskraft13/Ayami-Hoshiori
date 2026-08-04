'use strict';

const DiscordRequest      = require('../../DiscordRequest.js');
const TicketInstanceModel = require('../../../Mongodb/ticketInstance.js');
const { PLAN_KEYS, isPlanAtLeast } = require('../../Utils/PremiumPlans.js');

class TicketActionMenu {

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

  async handleMessage(data) {
    if (!data.guild_id || data.author?.bot || !data.content) return;

    const instance = await TicketInstanceModel.findOne({ channelId: data.channel_id, status: 'open' });
    if (!instance) return;

    const panel = await this._findPanelConfig(instance.guildId, instance.panelId).catch(() => null);
    const menuCfg = panel?.actionMenuConfig;
    if (!menuCfg?.enabled || !menuCfg.keywords?.length) return;

    const content = data.content.trim().toLowerCase();
    const plan = await this.ticketSystem._getGuildPlan(instance.guildId).catch(() => null);
    const isPremium = isPlanAtLeast(plan?.key, PLAN_KEYS.LUA_CRESCENTE);
    const availableKeywords = isPremium ? menuCfg.keywords : menuCfg.keywords.slice(0, 1);

    const matched = availableKeywords.find(k => k.keyword.trim().toLowerCase() === content);
    if (!matched) return;

    let memberRoles = [];
    try {
      const m = await DiscordRequest(`/guilds/${instance.guildId}/members/${data.author.id}`);
      memberRoles = m?.roles || [];
    } catch (err) {
      console.error('[TicketActionMenu] Erro ao buscar cargos do membro:', err);
    }

    const allowedRoles = matched.cargosPermitidos?.length ? matched.cargosPermitidos : (panel.cargosStaff || []);
    if (allowedRoles.length && !allowedRoles.some(r => memberRoles.includes(r))) return;

    if (matched.autoDelete) {
      DiscordRequest(`/channels/${data.channel_id}/messages/${data.id}`, { method: 'DELETE' }).catch(() => {});
    }

    return this._sendMenu({ instance, actions: matched.actions, ctx: this.ticketSystem._tctx(null) });
  }

  _buildButton(action, instance, ctx) {
    switch (action) {
      case 'claim':
        return { type: 2, style: 3, label: this.t('btn_claim', ctx), custom_id: JSON.stringify({ t: 'ticket_claim', ch: instance.channelId }) };
      case 'transfer':
        return { type: 2, style: 1, label: this.t('btn_transfer', ctx), custom_id: JSON.stringify({ t: 'ticket_transfer', ch: instance.channelId }) };
      case 'add_participant':
        return { type: 2, style: 2, label: this.t('btn_add_participant', ctx), custom_id: JSON.stringify({ t: 'ticket_add_participant', ch: instance.channelId }) };
      case 'remove_participant':
        return { type: 2, style: 2, label: this.t('btn_remove_participant', ctx), custom_id: JSON.stringify({ t: 'ticket_remove_participant', ch: instance.channelId }) };
      case 'close':
        return { type: 2, style: 4, label: this.t('btn_close', ctx), custom_id: JSON.stringify({ t: 'close_ticket_v2', ch: instance.channelId, u: instance.ownerId }) };
      default:
        return null;
    }
  }

  async _sendMenu({ instance, actions, ctx }) {
    const buttons = actions.map(a => this._buildButton(a, instance, ctx)).filter(Boolean);
    if (!buttons.length) return;

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push({ type: 1, components: buttons.slice(i, i + 5) });
    }

    return DiscordRequest(`/channels/${instance.channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{ title: this.t('action_menu_title', ctx), color: 0x7C8FFF }],
        components: rows
      }
    }).catch(err => console.error('[TicketActionMenu] Erro ao enviar menu de ações:', err));
  }
}

module.exports = TicketActionMenu;
