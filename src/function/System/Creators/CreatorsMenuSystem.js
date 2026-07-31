'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const CV2            = require('../../Messages/CV2.js');
const getPerm        = require('../../Utils/GetPerm.js');
const { localeCtx }  = require('../../Utils/ctxLocale.js');
const { FEATURES, FEATURE_MODES } = require('../FeatureFlags/features.js');

const ACCENT      = 0x7C8FFF;
const ACCENT_SOFT = 0x2F3136;
const ACCENT_DENY = 0xED4245;

const MODULES = [
  { value: 'twitch',  label: 'Twitch',  desc: 'Anúncios automáticos de lives da Twitch',              emoji: '🟣', system: 'twitchConfig' },
  { value: 'youtube', label: 'YouTube', desc: 'Anúncios automáticos de vídeos, Shorts e lives',        emoji: '🔴', system: 'youtubeConfig' },
];

class CreatorsMenuSystem {

  constructor(client) {
    this.client = client;
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

  _noPermissionContainer(interaction) {
    const ctx = localeCtx(interaction);
    return CV2.container([
      CV2.text(this.client.t('common.no_permission_title', {
        ...ctx,
        perm:   this.client.t('common.perm_manage_guild', ctx),
        action: this.client.t('common.action_use_command', ctx),
      })),
    ], { accentColor: ACCENT_DENY });
  }

  async _denyAdmin(interaction) {
    return this.editOriginal(interaction, [this._noPermissionContainer(interaction)]);
  }

  async close(interaction) {
    return this.editOriginal(interaction, [CV2.container([
      CV2.text('👋 **Painel fechado.**'),
    ], { accentColor: ACCENT_SOFT })]);
  }

  _modeLabel(value) {
    const mode = FEATURES[value]?.mode;
    if (mode === FEATURE_MODES.PUBLIC) return 'Público';
    if (mode === FEATURE_MODES.DISABLED) return 'Indisponível';
    return 'Beta';
  }

  async open(interaction) {
    if (!(await this._hasAdminPerm(interaction))) return this._denyAdmin(interaction);

    const user = interaction.member.user.id;

    const select = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: 'Selecione um módulo de criadores',
        options: MODULES.map(m => ({
          label: `${m.label} (${this._modeLabel(m.value)})`,
          description: m.desc,
          value: m.value,
          emoji: { name: m.emoji },
        })),
      },
      funcao: async (i) => {
        await this.deferUpdate(i);
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);

        const valor  = i.data.values?.[0];
        const modulo = MODULES.find(m => m.value === valor);
        if (!modulo) return;

        const system = this.client[modulo.system];
        if (!system) return;

        if (!(await this.client.featureManager.guardDeferred(i, modulo.value))) return;

        return system.home(i);
      },
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🧑‍🎨 **Criadores**'),
      CV2.separator(),
      CV2.text('Módulos voltados para criadores de conteúdo dentro do servidor.'),
      CV2.separator(),
      CV2.row(select),
      CV2.row(this.client.interactions.createButton({
        user,
        data: { label: 'Fechar', style: 4, emoji: { name: '✖️' } },
        funcao: async (i) => {
          await this.deferUpdate(i);
          return this.close(i);
        },
      })),
    ])]);
  }
}

module.exports = CreatorsMenuSystem;
