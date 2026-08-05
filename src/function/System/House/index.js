'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const CV2             = require('../../Messages/CV2.js');
const EmbedBuilderUI   = require('../Ticket/EmbedBuilderUI.js');
const { localeCtx }    = require('../../Utils/ctxLocale.js');

const HouseConfigService = require('./HouseConfigService.js');
const PermissionService   = require('./PermissionService.js');
const RoleService         = require('./RoleService.js');
const CharacterService    = require('./CharacterService.js');
const DecorationService    = require('./DecorationService.js');
const HistoryService        = require('./HistoryService.js');
const CallService            = require('./CallService.js');
const CallScheduler           = require('./CallScheduler.js');
const ActivityService        = require('./ActivityService.js');
const ReceptionService       = require('./ReceptionService.js');
const PremiumService          = require('./PremiumService.js');

const ACCENT        = 0x7C8FFF;
const ACCENT_LOCKED  = 0x757575;
const ACCENT_ERROR   = 0xED4245;

const PERMISSION_LEVELS = [
  { value: 'admin',         labelKey: 'house.perm_level_admin' },
  { value: 'recepcionista', labelKey: 'house.perm_level_recepcionista' },
  { value: 'aprovador',     labelKey: 'house.perm_level_aprovador' },
  { value: 'visualizador',  labelKey: 'house.perm_level_visualizador' },
];

class HouseSystem {

  constructor(client) {
    this.client       = client;
    this.config        = new HouseConfigService();
    this.permissions    = new PermissionService(client);
    this.roles           = new RoleService(client);
    this.characters       = new CharacterService();
    this.decoration        = new DecorationService(client);
    this.history             = new HistoryService();
    this.call                  = new CallService();
    this.callScheduler          = new CallScheduler(client);
    this.activity                = new ActivityService();
    this.reception                = new ReceptionService(client);
    this.premium                    = new PremiumService();
  }

  async handleMemberJoin(data) {
    return this.reception.handleMemberJoin(data).catch(err => {
      console.error('[House] Erro ao processar entrada de membro:', err);
    });
  }

  async handleMemberRemove(data) {
    try {
      const guildId = data.guild_id;
      const user    = data.user;
      if (!guildId || !user?.id) return;

      const cfg = await this.config.get(guildId);
      if (!cfg?.enabled) return;

      const character = await this.characters.findByUser(guildId, user.id);
      if (character) {
        await this.characters.release(guildId, character._id, 'saida_do_servidor');
        await this.history.log(guildId, {
          action: 'personagem_liberado', userId: user.id,
          detail: this.client.t('house.detail_character_released_left', { characterName: character.name }),
        });
      }

      await this.history.log(guildId, { action: 'membro_saiu', userId: user.id, detail: this.client.t('house.detail_member_left', {}) });
    } catch (err) {
      console.error('[House] Erro ao processar saída de membro:', err);
    }
  }

  async deferUpdate(interaction) {
    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: 'POST', body: { type: 6 },
    });
  }

  async editOriginal(interaction, containers, opts = {}) {
    const payload = CV2.payload(containers, { ephemeral: true, ...opts });

    if (interaction.__rootOverride) {
      const { channelId, messageId } = interaction.__rootOverride;
      payload.flags = (payload.flags ?? 0) & ~64;
      return DiscordRequest(`/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH', body: payload,
      });
    }

    return DiscordRequest(`/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`, {
      method: 'PATCH', body: payload,
    });
  }

  errorContainer(mensagem, opts = {}) {
    const ctx = opts.ctx ?? localeCtx({});
    const blocks = [
      CV2.text(this.client.t('house.error_title', ctx)),
      CV2.text(mensagem),
    ];
    if (opts.userId) {
      blocks.push(CV2.separator(), this.backRow(opts.userId, opts.destino ?? ((i) => this.mainPanel(i)), ctx));
    }
    return CV2.container(blocks, { accentColor: ACCENT_ERROR });
  }

  backRow(user, destino, ctx) {
    return CV2.row(this.client.interactions.createButton({
      user,
      data: { label: this.client.t('house.back_button', ctx ?? localeCtx({})), style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return destino(i);
      },
    }));
  }

  async _requireLevel(interaction, guildId, level, cfg) {
    const userId = interaction.member?.user?.id;
    const ctx = localeCtx(interaction);
    const ok = await this.permissions.hasAtLeast(guildId, userId, level, cfg);
    if (!ok) {
      await this.editOriginal(interaction, [this.errorContainer(
        this.client.t('house.no_permission_area', ctx),
        { userId, ctx },
      )]);
      return false;
    }
    return true;
  }

  async open(interaction) {
    const ctx = localeCtx(interaction);
    try {
      const guildId = interaction.guild_id;
      if (!guildId) {
        return this.editOriginal(interaction, [this.errorContainer(this.client.t('house.only_in_guild', ctx), { ctx })]);
      }

      const cfg = await this.config.getOrCreate(guildId);
      const userId = interaction.member?.user?.id;
      const level = await this.permissions.getLevel(guildId, userId, cfg);

      if (!level) {
        return this.editOriginal(interaction, [CV2.container([
          CV2.text(this.client.t('house.title_houses', ctx)),
          CV2.separator(),
          CV2.text(this.client.t('house.no_permission_configured', ctx)),
        ], { accentColor: ACCENT_LOCKED })]);
      }

      return this.mainPanel(interaction, cfg);
    } catch (err) {
      console.error('[House] Erro ao abrir painel:', err);
      return this.editOriginal(interaction, [this.errorContainer(this.client.t('house.unexpected_error', ctx), { ctx })]);
    }
  }

  async mainPanel(interaction, cfg) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });
    cfg = cfg ?? await this.config.getOrCreate(guildId);

    const nav = (label, style, destino) => this.client.interactions.createButton({
      user: userId,
      data: { label, style },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return destino(i);
      },
    });

    const status = cfg.enabled ? t('house.status_enabled') : t('house.status_disabled');

    const blocks = [
      CV2.text(t('house.main_title')),
      CV2.text(t('house.main_desc')),
      CV2.text(t('house.main_status_line', { status })),
      CV2.separator(),
      CV2.row(
        nav(t('house.nav_reception'),    2, (i) => this.receptionPanel(i)),
        nav(t('house.nav_characters'),   2, (i) => this.charactersPanel(i)),
        nav(t('house.nav_decoration'),   2, (i) => this.decorationPanel(i)),
        nav(t('house.nav_call'),         2, (i) => this.callPanel(i)),
        nav(t('house.nav_activity'),     2, (i) => this.activityPanel(i)),
      ),
      CV2.row(
        nav(t('house.nav_permissions'), 2, (i) => this.permissionsPanel(i)),
        nav(t('house.nav_history'),     2, (i) => this.historyPanel(i)),
        nav(t('house.nav_general'),     2, (i) => this.generalPanel(i)),
      ),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async generalPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    const ctx = localeCtx(interaction);
    const t   = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    const toggleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: cfg.enabled ? t('house.toggle_disable_houses') : t('house.toggle_enable_houses'), style: cfg.enabled ? 4 : 3 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const updated = await this.config.setEnabled(guildId, !cfg.enabled);
        await this.history.log(guildId, {
          action: updated.enabled ? 'modulo_ativado' : 'modulo_desativado', staffId: userId,
        });
        return this.generalPanel(i);
      },
    });

    const blocks = [
      CV2.text(t('house.general_title')),
      CV2.text(t('house.general_status_line', { status: cfg.enabled ? t('house.status_enabled') : t('house.status_disabled') })),
      CV2.separator(),
      CV2.row(toggleBtn),
      this.backRow(userId, (i) => this.mainPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  _roleErrorText(reason, ctx) {
    const MAP = {
      hierarquia_bot: 'house.role_err_hierarchy',
      cargo_inexistente: 'house.role_err_missing',
      cargo_nao_informado: 'house.role_err_not_selected',
    };
    const key = MAP[reason];
    return key ? this.client.t(key, ctx) : this.client.t('house.role_err_generic', { ...ctx, reason });
  }

  async receptionPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    const roleSelect = this.client.interactions.createRoleSelect({
      user: userId,
      data: { placeholder: t('house.ph_unregistered_role'), max_values: 1 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const iCtx = localeCtx(i);
        const roleId = i.data.values?.[0];
        const check = await this.roles.validateRole(guildId, roleId);
        if (!check.ok) {
          return this.editOriginal(i, [this.errorContainer(this._roleErrorText(check.reason, iCtx), {
            userId, ctx: iCtx, destino: (ii) => this.receptionPanel(ii),
          })]);
        }
        await this.config.updateReceptionRoles(guildId, { unregisteredRoleId: roleId });
        await this.history.log(guildId, { action: 'cargo_nao_registrado_definido', staffId: userId, detail: roleId });
        return this.receptionPanel(i);
      },
    });

    const roleSelect2 = this.client.interactions.createRoleSelect({
      user: userId,
      data: { placeholder: t('house.ph_registered_role'), max_values: 1 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const iCtx = localeCtx(i);
        const roleId = i.data.values?.[0];
        const check = await this.roles.validateRole(guildId, roleId);
        if (!check.ok) {
          return this.editOriginal(i, [this.errorContainer(this._roleErrorText(check.reason, iCtx), {
            userId, ctx: iCtx, destino: (ii) => this.receptionPanel(ii),
          })]);
        }
        await this.config.updateReceptionRoles(guildId, { registeredRoleId: roleId });
        await this.history.log(guildId, { action: 'cargo_registrado_definido', staffId: userId, detail: roleId });
        return this.receptionPanel(i);
      },
    });

    const channelSelect = this.client.interactions.createChannelSelect({
      user: userId,
      data: { placeholder: t('house.ph_reception_channel'), max_values: 1, channel_types: [0] },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const channelId = i.data.values?.[0];
        await this.config.updateReceptionChannel(guildId, channelId);
        await this.history.log(guildId, { action: 'canal_recepcao_definido', staffId: userId, detail: channelId });
        return this.receptionPanel(i);
      },
    });

    const messageBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_edit_welcome_message'), style: 2 },
      funcao: async (i, client) => {
        return EmbedBuilderUI.open(i, client, {
          user: userId,
          existingEmbed: cfg.reception.welcomeMessage?.embed ?? null,
          title: t('house.modal_welcome_message_title'),
          onDone: async (rootInteraction, embedResult) => {
            await this.config.updateWelcomeMessage(guildId, {
              type: embedResult ? 'embed' : 'normal',
              embed: embedResult,
            });
            await this.history.log(guildId, { action: 'mensagem_recepcao_atualizada', staffId: userId });
            return this.receptionPanel(rootInteraction);
          },
        });
      },
    });

    const finalMessageBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_edit_final_message'), style: 2 },
      funcao: async (i, client) => {
        return EmbedBuilderUI.open(i, client, {
          user: userId,
          existingEmbed: cfg.reception.finalMessage?.embed ?? null,
          title: t('house.modal_final_message_title'),
          onDone: async (rootInteraction, embedResult) => {
            await this.config.updateFinalMessage(guildId, {
              type: embedResult ? 'embed' : 'normal',
              embed: embedResult,
            });
            await this.history.log(guildId, { action: 'mensagem_final_recepcao_atualizada', staffId: userId });
            return this.receptionPanel(rootInteraction);
          },
        });
      },
    });

    const testBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_test'), style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const iCtx = localeCtx(i);

        let result;
        try {
          result = await this.reception.runTest(i, guildId, userId);
        } catch (err) {
          console.error('[House] Erro ao executar teste completo da recepção:', err);
          return this.editOriginal(i, [this.errorContainer(this.client.t('house.test_run_failed', iCtx), {
            userId, ctx: iCtx, destino: (ii) => this.receptionPanel(ii),
          })]);
        }

        if (!result.ok) {
          return this.editOriginal(i, [this.errorContainer(this.client.t(result.reasonKey, iCtx), {
            userId, ctx: iCtx, destino: (ii) => this.receptionPanel(ii),
          })]);
        }

        await DiscordRequest(`/webhooks/${this.client.clientId}/${i.token}`, {
          method: 'POST',
          body: {
            flags: 64,
            content: this.client.t('house.test_triggered_dm', { ...iCtx, channelId: result.channelId }),
          },
        }).catch(() => {});

        return this.receptionPanel(i);
      },
    });

    const characterStepBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_character_step', { state: cfg.reception.characterSelection.enabled ? t('house.state_enabled') : t('house.state_disabled') }), style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return this.characterStepPanel(i);
      },
    });

    const hasSubscription = await this.premium.hasSubscription(guildId);

    const logChannelBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: `${hasSubscription ? '' : '🔒 '}${t('house.btn_log_channel')}`, style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return this.logChannelPanel(i);
      },
    });

    const notDefined = t('house.not_defined');
    const blocks = [
      CV2.text(t('house.reception_title')),
      CV2.text(
        t('house.reception_summary', {
          unregisteredRole: cfg.reception.unregisteredRoleId ? `<@&${cfg.reception.unregisteredRoleId}>` : notDefined,
          registeredRole:   cfg.reception.registeredRoleId ? `<@&${cfg.reception.registeredRoleId}>` : notDefined,
          channel:          cfg.reception.channelId ? `<#${cfg.reception.channelId}>` : notDefined,
          logChannel:       cfg.reception.logChannelId ? `<#${cfg.reception.logChannelId}>` : notDefined,
        })
      ),
      CV2.text(t('house.reception_final_message_note')),
      CV2.separator(),
      CV2.row(roleSelect),
      CV2.row(roleSelect2),
      CV2.row(channelSelect),
      CV2.row(messageBtn, finalMessageBtn, characterStepBtn),
      CV2.row(testBtn, logChannelBtn),
      this.backRow(userId, (i) => this.mainPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async logChannelPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    if (!(await this.premium.hasSubscription(guildId))) {
      const plan = await this.premium.getPlano(guildId);
      return this.editOriginal(interaction, [CV2.container([
        CV2.text(t('house.reception_log_locked_title')),
        CV2.text(t('house.reception_log_locked_desc', { planEmoji: plan.emoji, planName: plan.name })),
        this.backRow(userId, (i) => this.receptionPanel(i), ctx),
      ], { accentColor: ACCENT_LOCKED })]);
    }

    const channelSelect = this.client.interactions.createChannelSelect({
      user: userId,
      data: { placeholder: t('house.ph_reception_log_channel'), max_values: 1, channel_types: [0] },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const channelId = i.data.values?.[0];
        await this.config.updateLogChannel(guildId, channelId);
        await this.history.log(guildId, { action: 'canal_logs_definido', staffId: userId, detail: channelId });
        return this.logChannelPanel(i);
      },
    });

    const clearBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_remove_log_channel'), style: 4 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        await this.config.updateLogChannel(guildId, null);
        await this.history.log(guildId, { action: 'canal_logs_removido', staffId: userId });
        return this.logChannelPanel(i);
      },
    });

    const blocks = [
      CV2.text(t('house.reception_log_title')),
      CV2.text(
        t('house.reception_log_summary', {
          channel: cfg.reception.logChannelId ? `<#${cfg.reception.logChannelId}>` : t('house.not_defined'),
        })
      ),
      CV2.separator(),
      CV2.row(channelSelect),
    ];
    if (cfg.reception.logChannelId) blocks.push(CV2.row(clearBtn));
    blocks.push(this.backRow(userId, (i) => this.receptionPanel(i), ctx));

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async characterStepPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    const charSel = cfg.reception.characterSelection;

    const toggleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: charSel.enabled ? t('house.btn_disable') : t('house.btn_enable_free'), style: charSel.enabled ? 4 : 3 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        await this.config.updateCharacterSelection(guildId, { enabled: !charSel.enabled });
        await this.history.log(guildId, {
          action: charSel.enabled ? 'escolha_personagem_desativada' : 'escolha_personagem_ativada', staffId: userId,
        });
        return this.characterStepPanel(i);
      },
    });

    const editBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_edit_step_text'), style: 2 },
      funcao: async (i, client) => {
        const modal = client.interactions.createModal({
          user: userId,
          title: t('house.modal_character_step_title'),
          components: [
            { type: 1, components: [{ type: 4, custom_id: 'nome', style: 1, label: t('house.field_step_name'), required: true, max_length: 80, value: charSel.stepName ?? '' }] },
            { type: 1, components: [{ type: 4, custom_id: 'descricao', style: 2, label: t('house.field_description'), required: false, max_length: 500, value: charSel.description ?? '' }] },
          ],
          funcao: async (modalInt, modalClient, fields) => {
            await modalClient.interactions.defer(modalInt);
            await this.config.updateCharacterSelection(guildId, { stepName: fields.nome, description: fields.descricao || null });
            await this.history.log(guildId, { action: 'escolha_personagem_editada', staffId: userId });
            return this.characterStepPanel(modalInt);
          },
        });
        return client.interactions.showModal(i, modal);
      },
    });

    const blocks = [
      CV2.text(t('house.character_step_title')),
      CV2.text(t('house.character_step_intro')),
      CV2.text(t('house.character_step_status', {
        status: charSel.enabled ? t('house.state_enabled_fem') : t('house.state_disabled_fem'),
        stepName: charSel.stepName,
      })),
    ];

    blocks.push(
      CV2.separator(),
      CV2.row(toggleBtn, editBtn),
      this.backRow(userId, (i) => this.receptionPanel(i), ctx),
    );

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async charactersPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'recepcionista', cfg))) return;

    const characters = await this.characters.list(guildId);
    const list = characters.length
      ? characters.map(c => `**${c.name}** — ${c.available ? t('house.character_available') : t('house.character_occupied')} _(${t('house.character_slots', { occupied: c.occupiedSlots, slots: c.slots })})_`).join('\n')
      : t('house.characters_empty');

    const canManage = await this.permissions.hasAtLeast(guildId, userId, 'admin', cfg);

    const blocks = [
      CV2.text(t('house.characters_title')),
      CV2.text(list),
    ];

    if (canManage) {
      const createBtn = this.client.interactions.createButton({
        user: userId,
        data: { label: t('house.btn_create_character'), style: 3 },
        funcao: async (i, client) => {
          const modal = client.interactions.createModal({
            user: userId,
            title: t('house.modal_new_character_title'),
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'nome', style: 1, label: t('house.field_name'), required: true, max_length: 80 }] },
              { type: 1, components: [{ type: 4, custom_id: 'descricao', style: 2, label: t('house.field_description'), required: false, max_length: 500 }] },
              { type: 1, components: [{ type: 4, custom_id: 'imagem', style: 1, label: t('house.field_image_url'), required: false, max_length: 300 }] },
              { type: 1, components: [{ type: 4, custom_id: 'vagas', style: 1, label: t('house.field_slots'), required: true, max_length: 3 }] },
              { type: 1, components: [{ type: 4, custom_id: 'cargo', style: 1, label: t('house.field_role_id'), required: false, max_length: 25 }] },
            ],
            funcao: async (modalInt, modalClient, fields) => {
              await modalClient.interactions.defer(modalInt);
              const modalCtx = localeCtx(modalInt);
              const slots = parseInt(fields.vagas, 10) || 1;

              if (fields.cargo) {
                const check = await this.roles.validateRole(guildId, fields.cargo);
                if (!check.ok) {
                  return this.editOriginal(modalInt, [this.errorContainer(this._roleErrorText(check.reason, modalCtx), {
                    userId, ctx: modalCtx, destino: (ii) => this.charactersPanel(ii),
                  })]);
                }
              }

              await this.characters.create(guildId, {
                name: fields.nome,
                description: fields.descricao || null,
                image: fields.imagem || null,
                roleId: fields.cargo || null,
                slots,
              });
              await this.history.log(guildId, { action: 'personagem_criado', staffId: userId, detail: fields.nome });
              return this.charactersPanel(modalInt);
            },
          });
          return client.interactions.showModal(i, modal);
        },
      });
      blocks.push(CV2.separator());
      blocks.push(CV2.row(createBtn));
    }

    blocks.push(this.backRow(userId, (i) => this.mainPanel(i), ctx));

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async decorationPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    if (!(await this.premium.hasSubscription(guildId))) {
      const plan = await this.premium.getPlano(guildId);
      return this.editOriginal(interaction, [CV2.container([
        CV2.text(t('house.decoration_locked_title')),
        CV2.text(t('house.decoration_locked_desc', { planEmoji: plan.emoji, planName: plan.name })),
        this.backRow(userId, (i) => this.mainPanel(i), ctx),
      ], { accentColor: ACCENT_LOCKED })]);
    }

    const formats = cfg.decoration.formats?.length
      ? cfg.decoration.formats
      : (cfg.decoration.format ? [cfg.decoration.format] : []);

    const toggleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: cfg.decoration.enabled ? t('house.btn_disable_decoration') : t('house.btn_enable_decoration'), style: cfg.decoration.enabled ? 4 : 3 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        await this.config.updateDecoration(guildId, { enabled: !cfg.decoration.enabled });
        return this.decorationPanel(i);
      },
    });

    const emojiToggleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: cfg.decoration.emojiEnabled ? t('house.btn_disable_emojis') : t('house.btn_enable_emojis'), style: cfg.decoration.emojiEnabled ? 4 : 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        await this.config.updateDecoration(guildId, { emojiEnabled: !cfg.decoration.emojiEnabled });
        await this.history.log(guildId, {
          action: cfg.decoration.emojiEnabled ? 'decoracao_emoji_desativado' : 'decoracao_emoji_ativado', staffId: userId,
        });
        return this.decorationPanel(i);
      },
    });

    const addBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_add_option', { count: formats.length }), style: 2 },
      funcao: async (i, client) => {
        const iCtx = localeCtx(i);
        if (formats.length >= 25) {
          return this.editOriginal(i, [this.errorContainer(
            this.client.t('house.decoration_limit_reached', iCtx),
            { userId, ctx: iCtx, destino: (ii) => this.decorationPanel(ii) },
          )]);
        }

        const modal = client.interactions.createModal({
          user: userId,
          title: this.client.t('house.modal_new_decoration_title', iCtx),
          components: [
            { type: 1, components: [{
              type: 4, custom_id: 'formato', style: 1,
              label: this.client.t('house.field_decoration_format', iCtx), required: true, max_length: 60,
            }] },
          ],
          funcao: async (modalInt, modalClient, fields) => {
            await modalClient.interactions.defer(modalInt);
            const modalCtx = localeCtx(modalInt);
            const result = await this.config.addDecorationFormat(guildId, fields.formato);
            if (!result.ok) {
              return this.editOriginal(modalInt, [this.errorContainer(
                this.client.t('house.decoration_add_failed', modalCtx),
                { userId, ctx: modalCtx, destino: (ii) => this.decorationPanel(ii) },
              )]);
            }
            await this.history.log(guildId, { action: 'decoracao_adicionada', staffId: userId, detail: fields.formato });
            return this.decorationPanel(modalInt);
          },
        });
        return client.interactions.showModal(i, modal);
      },
    });

    const removeSelect = formats.length ? this.client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: t('house.ph_remove_decoration'),
        options: formats.slice(0, 25).map((f, idx) => ({
          label: (f || t('house.decoration_option_fallback', { number: idx + 1 })).slice(0, 100),
          value: String(idx),
        })),
      },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const idx = parseInt(i.data.values?.[0], 10);
        await this.config.removeDecorationFormat(guildId, idx);
        await this.history.log(guildId, { action: 'decoracao_removida', staffId: userId, detail: String(idx) });
        return this.decorationPanel(i);
      },
    }) : null;

    const previewName = t('house.decoration_preview_name');
    const previewVars = { name: previewName, character: previewName, faction: t('house.decoration_preview_faction'), house: 'House', emoji: '🔥' };
    const preview = formats.length
      ? this.decoration.build(formats[Math.floor(Math.random() * formats.length)], previewVars)
      : this.decoration.build('{name}', previewVars);

    const list = formats.length
      ? formats.map((f, idx) => `**${idx + 1}.** \`${f}\``).join('\n')
      : t('house.decoration_none_configured');

    const blocks = [
      CV2.text(t('house.decoration_title')),
      CV2.text(t('house.decoration_status_line', { status: cfg.decoration.enabled ? t('house.status_enabled') : t('house.status_disabled') })),
      CV2.text(t('house.decoration_emoji_status_line', { status: cfg.decoration.emojiEnabled ? t('house.status_enabled') : t('house.status_disabled') })),
      CV2.text(t('house.decoration_options_configured', { count: formats.length, list })),
      CV2.text(t('house.decoration_preview_line', { preview })),
      CV2.text(t('house.decoration_note')),
      CV2.separator(),
      CV2.row(toggleBtn, emojiToggleBtn, addBtn),
    ];
    if (removeSelect) blocks.push(CV2.row(removeSelect));
    blocks.push(this.backRow(userId, (i) => this.mainPanel(i), ctx));

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async _expectedCallMembers(guildId) {
    const occupied = await this.characters.listOccupied(guildId);
    return occupied.map(c => c.currentUserId).filter(Boolean);
  }

  async callPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'recepcionista', cfg))) return;

    const openCall = await this.call.getOpen(guildId);

    const blocks = [CV2.text(t('house.call_title'))];

    if (openCall) {
      blocks.push(CV2.text(t('house.call_open_summary', {
        startedAt: Math.floor(openCall.startedAt.getTime() / 1000),
        present: openCall.presentUserIds.length,
        absent: openCall.absentUserIds.length,
      })));

      const presentBtn = this.client.interactions.createButton({
        user: userId,
        data: { label: t('house.btn_confirm_presence'), style: 3 },
        funcao: async (i, client) => {
          await client.interactions.defer(i);
          await this.call.confirmPresence(guildId, userId);
          await this.activity.registerPresence(guildId, userId);
          return this.callPanel(i);
        },
      });

      const closeBtn = this.client.interactions.createButton({
        user: userId,
        data: { label: t('house.btn_close_call'), style: 4 },
        funcao: async (i, client) => {
          await client.interactions.defer(i);
          const expected = await this._expectedCallMembers(guildId);
          const result   = await this.call.closeAndSummarize(guildId, expected);
          if (result.ok) {
            await this.callScheduler.cancelCallTimeout(guildId);
            await this.history.log(guildId, {
              action: 'chamada_encerrada', staffId: userId,
              detail: `Presença: ${result.stats.percent}% (${result.stats.present}/${result.stats.total})`,
            });
            await this.callScheduler.logCallClosed(guildId, cfg, result.stats, userId);
          }
          return this.callPanel(i);
        },
      });

      blocks.push(CV2.separator(), CV2.row(presentBtn, closeBtn));
    } else {
      const startBtn = this.client.interactions.createButton({
        user: userId,
        data: { label: t('house.btn_start_call'), style: 3 },
        funcao: async (i, client) => {
          await client.interactions.defer(i);
          const iCtx = localeCtx(i);

          if (!cfg.call.channelId) {
            return this.editOriginal(i, [this.errorContainer(
              this.client.t('house.call_channel_missing', iCtx),
              { userId, ctx: iCtx, destino: (ii) => this.callPanel(ii) },
            )]);
          }

          await this.callScheduler.startManualCall(guildId, userId, cfg);
          return this.callPanel(i);
        },
      });
      blocks.push(
        CV2.text(t('house.call_none_open')),
        CV2.text(t('house.call_manual_free_note')),
        CV2.separator(),
        CV2.row(startBtn),
      );
    }

    const configBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_call_settings'), style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return this.callConfigPanel(i);
      },
    });

    blocks.push(CV2.separator(), CV2.row(configBtn));
    blocks.push(this.backRow(userId, (i) => this.mainPanel(i), ctx));

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async handleCallConfirmButton(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const ctx     = localeCtx(interaction);

    if (!guildId || !userId) return;

    const openCall = await this.call.getOpen(guildId);
    if (!openCall) {
      return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
        method: 'POST',
        body: { type: 4, data: { content: this.client.t('house.call_none_open_toast', ctx), flags: 64 } },
      });
    }

    await this.call.confirmPresence(guildId, userId);
    await this.activity.registerPresence(guildId, userId);

    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: 'POST',
      body: { type: 4, data: { content: this.client.t('house.call_presence_confirmed_toast', ctx), flags: 64 } },
    });
  }

  async callConfigPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    const hasSubscription = await this.premium.hasSubscription(guildId);

    const channelSelect = this.client.interactions.createChannelSelect({
      user: userId,
      data: { placeholder: t('house.ph_call_channel'), max_values: 1, channel_types: [0] },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const channelId = i.data.values?.[0];
        await this.config.updateCallChannel(guildId, channelId);
        await this.history.log(guildId, { action: 'canal_chamada_definido', staffId: userId, detail: channelId });
        return this.callConfigPanel(i);
      },
    });

    const roleSelect = this.client.interactions.createRoleSelect({
      user: userId,
      data: { placeholder: t('house.ph_call_notify_role'), max_values: 1 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const roleId = i.data.values?.[0];
        await this.config.updateCallNotifyRole(guildId, roleId);
        await this.history.log(guildId, { action: 'cargo_notificacao_chamada_definido', staffId: userId, detail: roleId });
        return this.callConfigPanel(i);
      },
    });

    const scheduleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: `${hasSubscription ? '' : '🔒 '}${t('house.btn_auto_schedule')}`, style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return this.callSchedulePanel(i);
      },
    });

    const logChannelBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: `${hasSubscription ? '' : '🔒 '}${t('house.btn_log_channel')}`, style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return this.callLogChannelPanel(i);
      },
    });

    const inactivityBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_inactivity_punishment'), style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return this.callInactivityPanel(i);
      },
    });

    const callMessageBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_edit_call_message'), style: 2 },
      funcao: async (i, client) => {
        return EmbedBuilderUI.open(i, client, {
          user: userId,
          existingEmbed: cfg.call.message?.embed ?? null,
          title: t('house.modal_call_message_title'),
          onDone: async (rootInteraction, embedResult) => {
            await this.config.updateCallMessage(guildId, {
              type: embedResult ? 'embed' : 'normal',
              embed: embedResult,
            });
            await this.history.log(guildId, { action: 'mensagem_chamada_atualizada', staffId: userId });
            return this.callConfigPanel(rootInteraction);
          },
        });
      },
    });

    const durationBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_set_call_duration'), style: 2 },
      funcao: async (i, client) => {
        const modal = client.interactions.createModal({
          user: userId,
          title: this.client.t('house.modal_call_duration_title', localeCtx(i)),
          components: [
            { type: 1, components: [{ type: 4, custom_id: 'minutos', style: 1, label: this.client.t('house.field_duration_minutes', localeCtx(i)), required: false, max_length: 5, value: cfg.call.duration != null ? String(cfg.call.duration) : '' }] },
          ],
          funcao: async (modalInt, modalClient, fields) => {
            await modalClient.interactions.defer(modalInt);
            const modalCtx = localeCtx(modalInt);
            const raw = (fields.minutos ?? '').trim();

            let minutes = null;
            if (raw !== '') {
              minutes = parseInt(raw, 10);
              if (!Number.isInteger(minutes) || minutes < 1) {
                return this.editOriginal(modalInt, [this.errorContainer(
                  this.client.t('house.invalid_duration', modalCtx),
                  { userId, ctx: modalCtx, destino: (ii) => this.callConfigPanel(ii) },
                )]);
              }
            }

            await this.config.updateCallDuration(guildId, minutes);
            await this.callScheduler.syncCallTimeout(guildId);
            await this.history.log(guildId, {
              action: 'duracao_chamada_definida', staffId: userId,
              detail: minutes != null ? `${minutes} min` : this.client.t('house.status_disabled', modalCtx),
            });
            return this.callConfigPanel(modalInt);
          },
        });
        return client.interactions.showModal(i, modal);
      },
    });

    const schedule   = cfg.call.schedule;
    const inactivity = cfg.call.inactivity;
    const notDefined = t('house.not_defined');

    const blocks = [
      CV2.text(t('house.call_config_title')),
      CV2.text(
        t('house.call_config_summary', {
          channel: cfg.call.channelId ? `<#${cfg.call.channelId}>` : notDefined,
          notifyRole: cfg.call.notifyRoleId ? `<@&${cfg.call.notifyRoleId}>` : notDefined,
          logChannel: cfg.call.logChannelId ? `<#${cfg.call.logChannelId}>` : notDefined,
          scheduleLine: schedule.enabled && schedule.hour != null
            ? `🟢 ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
            : t('house.status_disabled'),
          inactivityLine: inactivity.enabled
            ? `🟢 ${t('house.inactivity_days_count', { days: inactivity.days })} · ${inactivity.punish ? t('house.punish_kick') : t('house.punish_log_only')}`
            : t('house.status_disabled'),
          durationLine: cfg.call.duration != null
            ? t('house.duration_minutes_count', { minutes: cfg.call.duration })
            : t('house.duration_manual_only'),
        })
      ),
      CV2.text(t('house.call_config_note')),
      CV2.separator(),
      CV2.row(channelSelect),
      CV2.row(roleSelect),
      CV2.row(scheduleBtn, logChannelBtn, inactivityBtn),
      CV2.row(callMessageBtn, durationBtn),
      this.backRow(userId, (i) => this.callPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async callSchedulePanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    if (!(await this.premium.hasSubscription(guildId))) {
      const plan = await this.premium.getPlano(guildId);
      return this.editOriginal(interaction, [CV2.container([
        CV2.text(t('house.schedule_locked_title')),
        CV2.text(t('house.schedule_locked_desc', { planEmoji: plan.emoji, planName: plan.name })),
        this.backRow(userId, (i) => this.callConfigPanel(i), ctx),
      ], { accentColor: ACCENT_LOCKED })]);
    }

    const schedule = cfg.call.schedule;

    const toggleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: schedule.enabled ? t('house.btn_disable_schedule') : t('house.btn_enable_schedule'), style: schedule.enabled ? 4 : 3 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const iCtx = localeCtx(i);

        if (!schedule.enabled && schedule.hour == null) {
          return this.editOriginal(i, [this.errorContainer(
            this.client.t('house.schedule_missing_time', iCtx),
            { userId, ctx: iCtx, destino: (ii) => this.callSchedulePanel(ii) },
          )]);
        }

        const updated = await this.config.updateCallSchedule(guildId, { enabled: !schedule.enabled });
        await this.callScheduler.syncSchedule(guildId, updated);
        await this.history.log(guildId, {
          action: updated.call.schedule.enabled ? 'chamada_automatica_ativada' : 'chamada_automatica_desativada', staffId: userId,
        });
        return this.callSchedulePanel(i);
      },
    });

    const setTimeBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_set_time'), style: 2 },
      funcao: async (i, client) => {
        const modal = client.interactions.createModal({
          user: userId,
          title: this.client.t('house.modal_schedule_time_title', localeCtx(i)),
          components: [
            { type: 1, components: [{ type: 4, custom_id: 'hora', style: 1, label: this.client.t('house.field_hour', localeCtx(i)), required: true, max_length: 2, value: schedule.hour != null ? String(schedule.hour) : '' }] },
            { type: 1, components: [{ type: 4, custom_id: 'minuto', style: 1, label: this.client.t('house.field_minute', localeCtx(i)), required: false, max_length: 2, value: schedule.minute != null ? String(schedule.minute) : '0' }] },
          ],
          funcao: async (modalInt, modalClient, fields) => {
            await modalClient.interactions.defer(modalInt);
            const modalCtx = localeCtx(modalInt);

            const hour   = parseInt(fields.hora, 10);
            const minute = fields.minuto ? parseInt(fields.minuto, 10) : 0;

            if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
              return this.editOriginal(modalInt, [this.errorContainer(
                this.client.t('house.schedule_invalid_time', modalCtx),
                { userId, ctx: modalCtx, destino: (ii) => this.callSchedulePanel(ii) },
              )]);
            }

            const updated = await this.config.updateCallSchedule(guildId, { hour, minute });
            if (updated.call.schedule.enabled) await this.callScheduler.syncSchedule(guildId, updated);

            await this.history.log(guildId, {
              action: 'horario_chamada_automatica_definido', staffId: userId,
              detail: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            });
            return this.callSchedulePanel(modalInt);
          },
        });
        return client.interactions.showModal(i, modal);
      },
    });

    const blocks = [
      CV2.text(t('house.schedule_title')),
      CV2.text(
        t('house.schedule_summary', {
          status: schedule.enabled ? t('house.status_enabled') : t('house.status_disabled'),
          time: schedule.hour != null ? `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}` : t('house.not_defined'),
        })
      ),
      CV2.text(t('house.schedule_note')),
      CV2.separator(),
      CV2.row(setTimeBtn, toggleBtn),
      this.backRow(userId, (i) => this.callConfigPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async callLogChannelPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    if (!(await this.premium.hasSubscription(guildId))) {
      const plan = await this.premium.getPlano(guildId);
      return this.editOriginal(interaction, [CV2.container([
        CV2.text(t('house.call_log_locked_title')),
        CV2.text(t('house.call_log_locked_desc', { planEmoji: plan.emoji, planName: plan.name })),
        this.backRow(userId, (i) => this.callConfigPanel(i), ctx),
      ], { accentColor: ACCENT_LOCKED })]);
    }

    const channelSelect = this.client.interactions.createChannelSelect({
      user: userId,
      data: { placeholder: t('house.ph_call_log_channel'), max_values: 1, channel_types: [0] },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const channelId = i.data.values?.[0];
        await this.config.updateCallLogChannel(guildId, channelId);
        await this.history.log(guildId, { action: 'canal_logs_chamada_definido', staffId: userId, detail: channelId });
        return this.callLogChannelPanel(i);
      },
    });

    const blocks = [
      CV2.text(t('house.call_log_title')),
      CV2.text(t('house.call_log_summary', { channel: cfg.call.logChannelId ? `<#${cfg.call.logChannelId}>` : t('house.not_defined') })),
      CV2.separator(),
      CV2.row(channelSelect),
      this.backRow(userId, (i) => this.callConfigPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async callInactivityPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    const inactivity = cfg.call.inactivity;

    const toggleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: inactivity.enabled ? t('house.btn_disable_check') : t('house.btn_enable_check'), style: inactivity.enabled ? 4 : 3 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const updated = await this.config.updateCallInactivity(guildId, { enabled: !inactivity.enabled });
        await this.callScheduler.syncInactivityTask(guildId, updated);
        await this.history.log(guildId, {
          action: updated.call.inactivity.enabled ? 'checagem_inatividade_ativada' : 'checagem_inatividade_desativada', staffId: userId,
        });
        return this.callInactivityPanel(i);
      },
    });

    const punishToggleBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: inactivity.punish ? t('house.punish_toggle_kick') : t('house.punish_toggle_log_only'), style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const updated = await this.config.updateCallInactivity(guildId, { punish: !inactivity.punish });
        await this.history.log(guildId, {
          action: 'punicao_inatividade_alterada', staffId: userId,
          detail: updated.call.inactivity.punish ? 'expulsar' : 'apenas_registrar',
        });
        return this.callInactivityPanel(i);
      },
    });

    const setDaysBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: t('house.btn_set_days'), style: 2 },
      funcao: async (i, client) => {
        const modal = client.interactions.createModal({
          user: userId,
          title: this.client.t('house.modal_inactivity_days_title', localeCtx(i)),
          components: [
            { type: 1, components: [{ type: 4, custom_id: 'dias', style: 1, label: this.client.t('house.field_days_without_call', localeCtx(i)), required: true, max_length: 3, value: String(inactivity.days ?? 7) }] },
          ],
          funcao: async (modalInt, modalClient, fields) => {
            await modalClient.interactions.defer(modalInt);
            const modalCtx = localeCtx(modalInt);
            const days = parseInt(fields.dias, 10);

            if (!Number.isInteger(days) || days < 1) {
              return this.editOriginal(modalInt, [this.errorContainer(
                this.client.t('house.invalid_days', modalCtx),
                { userId, ctx: modalCtx, destino: (ii) => this.callInactivityPanel(ii) },
              )]);
            }

            const updated = await this.config.updateCallInactivity(guildId, { days });
            if (updated.call.inactivity.enabled) await this.callScheduler.syncInactivityTask(guildId, updated);

            await this.history.log(guildId, { action: 'dias_inatividade_definido', staffId: userId, detail: String(days) });
            return this.callInactivityPanel(modalInt);
          },
        });
        return client.interactions.showModal(i, modal);
      },
    });

    const blocks = [
      CV2.text(t('house.inactivity_title')),
      CV2.text(
        t('house.inactivity_summary', {
          status: inactivity.enabled ? t('house.state_enabled_fem') : t('house.state_disabled_fem'),
          days: inactivity.days,
          punish: inactivity.punish ? t('house.punish_kick') : t('house.punish_log_only_full'),
        })
      ),
      CV2.text(
        t('house.inactivity_note', {
          days: inactivity.days,
          consequence: inactivity.punish ? t('house.inactivity_consequence_kick') : t('house.inactivity_consequence_log'),
        })
      ),
      CV2.separator(),
      CV2.row(toggleBtn, punishToggleBtn, setDaysBtn),
      this.backRow(userId, (i) => this.callConfigPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async activityPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'visualizador', cfg))) return;

    const top = await this.activity.top(guildId, { limit: 10 });
    const list = top.length
      ? top.map(a => t('house.activity_row', { userId: a.userId, presence: a.presenceCount, absence: a.absenceCount })).join('\n')
      : t('house.activity_empty');

    const blocks = [
      CV2.text(t('house.activity_title')),
      CV2.text(list),
      this.backRow(userId, (i) => this.mainPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async permissionsPanel(interaction) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'admin', cfg))) return;

    const levelSelect = this.client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: t('house.ph_permission_level'),
        options: PERMISSION_LEVELS.map(l => ({ value: l.value, label: t(l.labelKey) })),
      },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const level = i.data.values?.[0];
        return this.permissionLevelPanel(i, level);
      },
    });

    const summary = PERMISSION_LEVELS.map(l => {
      const roles = cfg.permissions[l.value] ?? [];
      return `**${t(l.labelKey)}**: ${roles.length ? roles.map(r => `<@&${r}>`).join(', ') : t('house.no_role')}`;
    }).join('\n');

    const blocks = [
      CV2.text(t('house.permissions_title')),
      CV2.text(summary),
      CV2.separator(),
      CV2.row(levelSelect),
      this.backRow(userId, (i) => this.mainPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  async permissionLevelPanel(interaction, level) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });
    const info    = PERMISSION_LEVELS.find(l => l.value === level);
    const levelLabel = info ? t(info.labelKey) : level;

    const roleSelect = this.client.interactions.createRoleSelect({
      user: userId,
      data: { placeholder: t('house.ph_permission_roles', { level: levelLabel }), min_values: 0, max_values: 10 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        const roleIds = i.data.values ?? [];
        await this.config.updatePermissionRoles(guildId, level, roleIds);
        await this.history.log(guildId, { action: 'permissao_atualizada', staffId: userId, detail: `${level}: ${roleIds.join(', ')}` });
        return this.permissionsPanel(i);
      },
    });

    const current = (cfg.permissions[level] ?? []).map(r => `<@&${r}>`).join(', ') || t('house.no_role');

    const blocks = [
      CV2.text(t('house.permission_level_title', { level: levelLabel })),
      CV2.text(t('house.permission_level_current', { current })),
      CV2.separator(),
      CV2.row(roleSelect),
      this.backRow(userId, (i) => this.permissionsPanel(i), ctx),
    ];

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  _historyActionLabel(action, ctx) {
    const KNOWN = [
      'canal_chamada_definido', 'canal_logs_chamada_definido', 'canal_logs_definido', 'canal_logs_removido',
      'canal_recepcao_definido', 'cargo_nao_registrado_definido', 'cargo_notificacao_chamada_definido',
      'cargo_registrado_definido', 'chamada_encerrada', 'chamada_iniciada', 'decoracao_adicionada',
      'decoracao_removida', 'dias_inatividade_definido', 'escolha_personagem_editada',
      'horario_chamada_automatica_definido', 'membro_entrou', 'membro_expulso_inatividade',
      'membro_inativo_detectado', 'membro_saiu', 'mensagem_final_recepcao_atualizada',
      'mensagem_recepcao_atualizada', 'permissao_atualizada', 'personagem_criado', 'personagem_liberado',
      'punicao_inatividade_alterada', 'recepcao_concluida', 'recepcao_teste_executado',
      'modulo_ativado', 'modulo_desativado', 'escolha_personagem_desativada', 'escolha_personagem_ativada',
      'decoracao_emoji_desativado', 'decoracao_emoji_ativado', 'chamada_automatica_ativada',
      'chamada_automatica_desativada', 'checagem_inatividade_ativada', 'checagem_inatividade_desativada',
      'mensagem_chamada_atualizada', 'duracao_chamada_definida',
    ];
    if (!KNOWN.includes(action)) return action;
    return this.client.t(`house.action_${action}`, ctx);
  }

  async historyPanel(interaction, page = 0) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);
    const t       = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    if (!(await this._requireLevel(interaction, guildId, 'visualizador', cfg))) return;

    const limit   = 8;
    const entries = await this.history.list(guildId, { limit, skip: page * limit });
    const total   = await this.history.count(guildId);

    const list = entries.length
      ? entries.map(e => `**${this._historyActionLabel(e.action, ctx)}** · <t:${Math.floor(e.at.getTime() / 1000)}:R>${e.userId ? ` · <@${e.userId}>` : ''}${e.detail ? `\n-# ${e.detail}` : ''}`).join('\n')
      : t('house.history_empty');

    const navButtons = [];
    if (page > 0) {
      navButtons.push(this.client.interactions.createButton({
        user: userId, data: { label: t('house.btn_previous'), style: 2 },
        funcao: async (i, client) => { await client.interactions.defer(i); return this.historyPanel(i, page - 1); },
      }));
    }
    if ((page + 1) * limit < total) {
      navButtons.push(this.client.interactions.createButton({
        user: userId, data: { label: t('house.btn_next'), style: 2 },
        funcao: async (i, client) => { await client.interactions.defer(i); return this.historyPanel(i, page + 1); },
      }));
    }

    const blocks = [
      CV2.text(t('house.history_title')),
      CV2.text(list),
    ];
    if (navButtons.length) blocks.push(CV2.separator(), CV2.row(...navButtons));
    blocks.push(this.backRow(userId, (i) => this.mainPanel(i), ctx));

    return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
  }

  
  
  

  async _personagensListaContainer(guildId, userId, page, ctx) {
    const t = (key, extra) => this.client.t(key, { ...ctx, ...extra });
    const perPage = 8;

    const all     = await this.characters.list(guildId);
    const total    = all.length;
    const maxPage   = Math.max(0, Math.ceil(total / perPage) - 1);
    const clamped    = Math.min(Math.max(0, page), maxPage);
    const slice        = all.slice(clamped * perPage, clamped * perPage + perPage);

    const list = slice.length
      ? slice.map(c => t('house.characters_list_row', {
          name: c.name,
          status: c.available ? t('house.character_available') : t('house.character_occupied'),
          occupied: c.occupiedSlots,
          slots: c.slots,
          holder: c.currentUserId ? `<@${c.currentUserId}>` : t('house.slot_vacant'),
        })).join('\n')
      : t('house.characters_list_empty');

    const navButtons = [];
    if (clamped > 0) {
      navButtons.push(this.client.interactions.createButton({
        user: userId, data: { label: t('house.btn_previous'), style: 2 },
        funcao: async (i, client) => { await client.interactions.defer(i); return this.personagensListaPanel(i, clamped - 1); },
      }));
    }
    if (clamped < maxPage) {
      navButtons.push(this.client.interactions.createButton({
        user: userId, data: { label: t('house.btn_next'), style: 2 },
        funcao: async (i, client) => { await client.interactions.defer(i); return this.personagensListaPanel(i, clamped + 1); },
      }));
    }

    const blocks = [
      CV2.text(t('house.characters_list_title')),
      CV2.text(t('house.characters_list_page', { page: clamped + 1, maxPage: maxPage + 1, total })),
      CV2.text(list),
    ];
    if (navButtons.length) blocks.push(CV2.separator(), CV2.row(...navButtons));

    return CV2.container(blocks, { accentColor: ACCENT });
  }

  async personagensListaPanel(interaction, page = 0) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id;
    const cfg     = await this.config.getOrCreate(guildId);
    const ctx     = localeCtx(interaction);

    if (!(await this._requireLevel(interaction, guildId, 'visualizador', cfg))) return;

    const container = await this._personagensListaContainer(guildId, userId, page, ctx);
    return this.editOriginal(interaction, [container]);
  }

  async _characterUserContainer(guildId, targetUserId, ctx) {
    const t = (key, extra) => this.client.t(key, { ...ctx, ...extra });
    const character = await this.characters.findByUser(guildId, targetUserId);

    if (!character) {
      return CV2.container([
        CV2.text(t('house.character_user_title')),
        CV2.text(t('house.character_user_none', { userId: targetUserId })),
      ], { accentColor: ACCENT });
    }

    const blocks = [
      CV2.text(t('house.character_user_title')),
      CV2.text(t('house.character_user_found', {
        userId: targetUserId,
        name: character.name,
        description: character.description || t('house.not_defined'),
        roleId: character.roleId ? `<@&${character.roleId}>` : t('house.not_defined'),
        chosenAt: character.chosenAt ? `<t:${Math.floor(character.chosenAt.getTime() / 1000)}:R>` : t('house.not_defined'),
        approvedBy: character.approvedBy ? `<@${character.approvedBy}>` : t('house.not_defined'),
      })),
    ];

    if (character.image) blocks.push(CV2.mediaGallery([{ url: character.image }]));

    return CV2.container(blocks, { accentColor: ACCENT });
  }
}

module.exports = HouseSystem;
