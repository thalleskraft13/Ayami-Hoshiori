'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const CV2            = require('../../Messages/CV2.js');
const getPerm        = require('../../Utils/GetPerm.js');
const { localeCtx }  = require('../../Utils/ctxLocale.js');

class CreatorModuleBase {

  constructor(client, opts = {}) {
    this.client       = client;
    this.featureId     = opts.featureId;
    this.moduleLabel   = opts.moduleLabel ?? this.featureId;
    this.ACCENT        = opts.accent ?? 0x7C8FFF;
    this.ACCENT_SOFT   = opts.accentSoft ?? 0x2F3136;
    this.ACCENT_DENY   = opts.accentDeny ?? 0xED4245;
  }

  async deferUpdate(interaction) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 6 } },
    );
  }

  async editOriginal(interaction, containers, opts = {}) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body: CV2.payload(containers, { ephemeral: false, ...opts }) },
    );
  }

  async _hasAdminPerm(interaction) {
    const perms = await getPerm({
      id: interaction.member.user.id,
      guildId: interaction.guild_id,
      client: this.client,
    }).catch(() => []);

    return !!perms?.includes('MANAGE_GUILD');
  }

  async _botPerms(guildId, channelId) {
    return getPerm({
      channel: true,
      id: channelId,
      guildId,
      bot: true,
      client: this.client,
    }).catch(() => []);
  }

  async _botCanAnnounceIn(guildId, channelId) {
    if (!channelId) return true;
    const perms = await this._botPerms(guildId, channelId);
    return perms.includes('VIEW_CHANNEL') && perms.includes('SEND_MESSAGES');
  }

  _noPermissionContainer(interaction) {
    const ctx = localeCtx(interaction);
    return CV2.container([
      CV2.text(this.client.t('common.no_permission_title', {
        ...ctx,
        perm:   this.client.t('common.perm_manage_guild', ctx),
        action: this.client.t('common.action_use_command', ctx),
      })),
    ], { accentColor: this.ACCENT_DENY });
  }

  async _denyAdmin(interaction) {
    return this.editOriginal(interaction, [this._noPermissionContainer(interaction)]);
  }

  async _denyAdminModal(mi) {
    return this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload([this._noPermissionContainer(mi)], { ephemeral: false }),
    });
  }

  _guarded(destinoFn) {
    return async (i) => {
      await this.deferUpdate(i);
      if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
      return destinoFn(i);
    };
  }

  _guardedModal(destinoFn) {
    return async (mi, client, fields) => {
      if (!(await this._hasAdminPerm(mi))) return this._denyAdminModal(mi);
      return destinoFn(mi, fields);
    };
  }

  _betaNotice() {
    return CV2.text('-# 🧪 Módulo em Acesso Antecipado — recurso Beta exclusivo para assinantes ✨ Constellation.');
  }

  _errorContainer(titulo, descricao, user, destino) {
    return CV2.container([
      CV2.text(`⚠️ **${titulo}**`),
      CV2.separator(),
      CV2.text(descricao),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, destino),
    ], { accentColor: this.ACCENT_DENY });
  }

  navRow(user, destino) {
    return CV2.row(
      this.client.interactions.createButton({
        user,
        feature: this.featureId,
        data: { label: 'Voltar', style: 2, emoji: { name: '◀️' } },
        funcao: this._guarded(destino),
      }),
      this.client.interactions.createButton({
        user,
        feature: this.featureId,
        data: { label: 'Fechar', style: 4, emoji: { name: '✖️' } },
        funcao: async (i) => {
          await this.deferUpdate(i);
          return this.close(i);
        },
      }),
    );
  }

  async close(interaction) {
    return this.editOriginal(interaction, [CV2.container([
      CV2.text('👋 **Painel fechado.**'),
    ], { accentColor: this.ACCENT_SOFT })]);
  }

  async comingSoon(interaction, titulo, destino) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🚧 **${titulo}**`),
      CV2.separator(),
      CV2.text('Essa configuração ainda não está disponível — será implementada em uma atualização futura.\n\nNenhuma informação é salva nesta etapa.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, destino),
    ], { accentColor: this.ACCENT })]);
  }

  async open(interaction) {
    if (!(await this.client.featureManager.guardDeferred(interaction, this.featureId))) return;
    if (!(await this._hasAdminPerm(interaction))) return this._denyAdmin(interaction);

    return this.home(interaction);
  }

  async home() {
    throw new Error(`[CreatorModuleBase] home() não implementado em ${this.constructor.name}`);
  }
}

module.exports = CreatorModuleBase;
