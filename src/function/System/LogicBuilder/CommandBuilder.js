'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const { localeCtx }  = require('../../Utils/ctxLocale.js');
const { CustomCommandModel, FlowModel } = require('../../../Mongodb/flow.js');
const { parseDuration, formatDuration } = require('./LogicEngine.js');

const COLOR = {
  main:    0x7C8FFF,
  dark:    0x243B7A,
  danger:  0xED4245,
  success: 0x57F287,
};

class CommandBuilder {

  constructor(client, ui) {
    this.client = client;
    this.ui     = ui;
  }

  _e(name) {
    return this.client?.emoji?.[name] ?? '';
  }

  t(key, ctx, extra = {}) {
    return this.client.t(`logicbuilder.${key}`, { ...ctx, ...extra });
  }

  _tctx(interaction, extra = {}) {
    return localeCtx(interaction, {
      animada:   this._e('animada'),
      pensando:  this._e('pensando'),
      assustada: this._e('assustada'),
      emburrada: this._e('emburrada'),
      emduvida:  this._e('emduvida'),
      festa:     this._e('festa'),
      feliz:     this._e('feliz'),
      curtida:   this._e('curtida'),
      chorando:  this._e('chorando'),
      brava:     this._e('brava'),
      ...extra,
    });
  }

  _cv2(blocks, opts = {}) {
    return this.ui.cv2Payload(blocks, { ephemeral: false, ...opts });
  }


  async startCreate(interaction, user) {
    const ctx = this._tctx(interaction);
    const flows = await FlowModel.find({
      guildId:        interaction.guild_id,
      'trigger.category': 'command',
      'trigger.type':     'command_executed'
    }).lean();

    if (!flows.length) {
      return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
        this.ui.cv2Text(this.t('cb_no_flow_available_title', ctx))
      ]));
    }

    const options = flows.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${this.ui._triggerLabel(f.trigger, ctx)}`
    }));

    const sel = this.ui.select(user, options, this.t('cb_flow_select_placeholder', ctx), async (i) => {
      return this._createStep2(i, user, i.data.values[0]);
    });

    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.commandList(i, user);
    });

    const blocks = [
      this.ui.cv2Text(this.t('cb_create_step1_title', ctx)),
      this.ui.cv2Divider(),
      this.ui.row(sel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _createStep2(interaction, user, flowId) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('cb_modal_new_command_title', ctx),
      components: [
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'name',
            label:       this.t('cb_field_name_label', ctx),
            style:       1,
            required:    true,
            max_length:  30,
            placeholder: this.t('cb_field_name_placeholder', ctx)
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'aliases',
            label:       this.t('cb_field_aliases_label', ctx),
            style:       1,
            required:    false,
            max_length:  200,
            placeholder: this.t('cb_field_aliases_placeholder', ctx)
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'prefix',
            label:       this.t('cb_field_prefix_label', ctx),
            style:       1,
            required:    false,
            max_length:  5,
            placeholder: '!'
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'cooldown',
            label:       this.t('cb_field_cooldown_label', ctx),
            style:       1,
            required:    false,
            max_length:  30,
            placeholder: this.t('cb_field_cooldown_placeholder', ctx)
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'description',
            label:       this.t('cb_field_description_label', ctx),
            style:       2,
            required:    false,
            max_length:  200,
            placeholder: this.t('cb_field_description_placeholder', ctx)
          }]
        }
      ],
      funcao: async (modalInteraction, client, fields) => {
        const miCtx = this._tctx(modalInteraction);
        const name = fields.name?.trim().toLowerCase().replace(/\s+/g, '_');
        if (!name) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: { content: this.t('cb_invalid_name', miCtx), flags: 64 } } }
          );
        }

        const existing = await CustomCommandModel.findOne({
          guildId: modalInteraction.guild_id,
          name
        });

        if (existing) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: { content: this.t('cb_command_exists', { ...miCtx, name }), flags: 64 } } }
          );
        }

        const aliases = fields.aliases
          ? fields.aliases.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
          : [];

        const rawCooldown = fields.cooldown?.trim() || '0';
        const cooldownMs  = rawCooldown === '0' ? 0 : parseDuration(rawCooldown);

        if (rawCooldown !== '0' && cooldownMs === 0) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: {
              content: this.t('cb_invalid_cooldown', miCtx),
              flags: 64
            } } }
          );
        }

        const cmd = await this.client.logicEngine.createCommand({
          guildId:     modalInteraction.guild_id,
          name,
          aliases,
          description: fields.description?.trim() || '',
          prefix:      fields.prefix?.trim() || '!',
          flowId,
          cooldown:    cooldownMs
        });

        this.ui.invalidateCache(modalInteraction.guild_id);

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this.commandMenu(modalInteraction, user, cmd.commandId, {
          successMsg: this.t('cb_command_created', { ...miCtx, prefix: cmd.prefix, name })
        });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }


  async commandMenu(interaction, user, commandId, { successMsg } = {}) {
    const guildId = interaction.guild_id;
    const cmd = await CustomCommandModel.findOne({ commandId, guildId }).lean();
    const ctx = this._tctx(interaction);

    if (!cmd) {
      return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
        this.ui.cv2Text(this.t('cb_not_found', ctx))
      ]));
    }

    const flow = await FlowModel.findOne({ flowId: cmd.flowId }).lean();
    const flowLabel = flow ? flow.name : this.t('cb_flow_not_found', ctx);

    const btnToggle = this.ui.btn(
      user,
      cmd.enabled ? this.t('cb_btn_disable', ctx) : this.t('cb_btn_activate', ctx),
      cmd.enabled ? 4 : 3,
      async (i) => {
        await this.ui.deferUpdate(i);
        await CustomCommandModel.updateOne({ commandId }, { enabled: !cmd.enabled });
        this.client.logicEngine._flowCache?.delete(`cmd:${guildId}`);
        this.ui.invalidateCache(guildId);
        return this.commandMenu(i, user, commandId);
      }
    );

    const btnEdit = this.ui.btn(user, this.t('cb_btn_edit', ctx), 2, i => this._editCommand(i, user, commandId));

    const btnChangeFlow = this.ui.btn(user, this.t('cb_btn_change_flow', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this._changeFlow(i, user, commandId);
    });

    const btnRoles = this.ui.btn(user, this.t('cb_btn_required_roles', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this._manageRoles(i, user, commandId);
    });

    const btnDelete = this.ui.btn(user, this.t('cb_btn_delete', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      return this._confirmDeleteCommand(i, user, commandId, cmd.name);
    });

    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.commandList(i, user);
    });

    const aliasStr = cmd.aliases?.length ? cmd.aliases.join(', ') : this.t('cb_none_aliases', ctx);
    const rolesStr = cmd.requiredRoles?.length ? cmd.requiredRoles.map(r => `<@&${r}>`).join(', ') : this.t('cb_anyone', ctx);
    const coolStr  = cmd.cooldown > 0 ? formatDuration(cmd.cooldown, ctx.system?.locale) : this.t('cb_no_cooldown2', ctx);
    const ayami    = this._e(cmd.enabled ? 'feliz' : 'sonolenta');
    const status   = cmd.enabled ? this.t('cb_status_active', ctx) : this.t('cb_status_disabled', ctx);

    const blocks = [
      this.ui.cv2Text(this.t('cb_menu_header', { ...ctx, ayami, prefix: cmd.prefix, name: cmd.name, successMsg, description: cmd.description || this.t('no_description_italic', ctx) })),
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('cb_status_line', { ...ctx, status, prefix: cmd.prefix, cooldown: coolStr })),
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('cb_details_line', { ...ctx, aliases: aliasStr, flow: flowLabel, roles: rolesStr })),
      this.ui.cv2Divider(),
      this.ui.row(btnToggle, btnEdit, btnChangeFlow),
      this.ui.row(btnRoles, btnDelete, btnBack),
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('cb_id_footer', { ...ctx, id: cmd.commandId })),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, {
      accentColor: cmd.enabled ? COLOR.success : COLOR.danger
    }));
  }

  async _editCommand(interaction, user, commandId) {
    const cmd = await CustomCommandModel.findOne({ commandId }).lean();
    const ctx = this._tctx(interaction);

    const modal = this.client.interactions.createModal({
      user,
      title: this.t('cb_modal_edit_title', ctx),
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'name',        label: this.t('cb_field_name_label2', ctx),          style: 1, required: true,  max_length: 30,  value: cmd.name }] },
        { type: 1, components: [{ type: 4, custom_id: 'aliases',     label: this.t('cb_field_aliases_label2', ctx),       style: 1, required: false, max_length: 200, value: cmd.aliases?.join(', ') || '' }] },
        { type: 1, components: [{ type: 4, custom_id: 'prefix',      label: this.t('cb_field_prefix_label2', ctx),       style: 1, required: false, max_length: 5,   value: cmd.prefix }] },
        { type: 1, components: [{ type: 4, custom_id: 'cooldown',    label: this.t('cb_field_cooldown_label2', ctx), style: 1, required: false, max_length: 30,  value: cmd.cooldown > 0 ? formatDuration(cmd.cooldown, ctx.system?.locale) : '0' }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: this.t('cb_field_description_label2', ctx),     style: 2, required: false, max_length: 200, value: cmd.description || '' }] }
      ],
      funcao: async (modalInteraction, client, fields) => {
        const miCtx = this._tctx(modalInteraction);
        const rawCooldown = fields.cooldown?.trim() || '0';
        const cooldownMs  = rawCooldown === '0' ? 0 : parseDuration(rawCooldown);

        if (rawCooldown !== '0' && cooldownMs === 0) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: {
              content: this.t('cb_invalid_cooldown', miCtx),
              flags: 64
            } } }
          );
        }

        const updates = {
          name:        fields.name?.trim().toLowerCase() || cmd.name,
          aliases:     fields.aliases ? fields.aliases.split(',').map(a => a.trim().toLowerCase()).filter(Boolean) : [],
          prefix:      fields.prefix?.trim() || '!',
          cooldown:    cooldownMs,
          description: fields.description?.trim() || ''
        };

        await CustomCommandModel.updateOne({ commandId }, updates);
        this.client.logicEngine._flowCache?.delete(`cmd:${modalInteraction.guild_id}`);
        this.ui.invalidateCache(modalInteraction.guild_id);

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this.commandMenu(modalInteraction, user, commandId, {
          successMsg: this.t('cb_command_updated', miCtx)
        });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _changeFlow(interaction, user, commandId) {
    const flows = await FlowModel.find({
      guildId:        interaction.guild_id,
      'trigger.category': 'command',
      'trigger.type':     'command_executed'
    }).lean();
    const ctx = this._tctx(interaction);

    if (!flows.length) {
      return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
        this.ui.cv2Text(this.t('cb_no_flows_for_change', ctx))
      ]));
    }

    const options = flows.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${this.ui._triggerLabel(f.trigger, ctx)}`
    }));

    const sel = this.ui.select(user, options, this.t('cb_change_flow_placeholder', ctx), async (i) => {
      await this.ui.deferUpdate(i);
      await CustomCommandModel.updateOne({ commandId }, { flowId: i.data.values[0] });
      this.client.logicEngine._flowCache?.delete(`cmd:${i.guild_id}`);
      this.ui.invalidateCache(i.guild_id);
      return this.commandMenu(i, user, commandId, {
        successMsg: this.t('cb_flow_updated', this._tctx(i))
      });
    });

    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.commandMenu(i, user, commandId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('cb_change_flow_title', ctx)),
      this.ui.cv2Divider(),
      this.ui.row(sel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _manageRoles(interaction, user, commandId) {
    const cmd = await CustomCommandModel.findOne({ commandId }).lean();
    const ctx = this._tctx(interaction);
    const rolesStr = cmd.requiredRoles?.length
      ? cmd.requiredRoles.map(r => `<@&${r}>`).join('\n')
      : this.t('cb_no_roles', ctx);

    const btnAdd = this.ui.btn(user, this.t('cb_btn_add_role', ctx), 1, async (i) => {
      await this.ui.deferUpdate(i);
      await this.ui.followUpEphemeral(i, this.ui.cv2Payload([
        this.ui.cv2Text(this.t('cb_ask_role', this._tctx(i)))
      ]));

      let msg;
      try {
        msg = await this.client.NextMessageCollector.wait({
          channelId: i.channel_id,
          userId:    user
        });
      } catch { return; }

      const id = msg.content?.match(/\d{17,19}/)?.[0];
      if (!id) {
        return this.ui.followUpEphemeral(i, this.ui.cv2Payload([
          this.ui.cv2Text(this.t('cb_invalid_role', this._tctx(i)))
        ]));
      }

      const roles = cmd.requiredRoles || [];
      if (!roles.includes(id)) roles.push(id);

      await CustomCommandModel.updateOne({ commandId }, { requiredRoles: roles });
      this.client.logicEngine._flowCache?.delete(`cmd:${i.guild_id}`);
      this.ui.invalidateCache(i.guild_id);
      return this._manageRoles(i, user, commandId);
    });

    const btnClear = this.ui.btn(user, this.t('cb_btn_clear', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      await CustomCommandModel.updateOne({ commandId }, { requiredRoles: [] });
      this.client.logicEngine._flowCache?.delete(`cmd:${i.guild_id}`);
      this.ui.invalidateCache(i.guild_id);
      return this._manageRoles(i, user, commandId);
    });

    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.commandMenu(i, user, commandId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('cb_roles_title', { ...ctx, rolesList: rolesStr })),
      this.ui.cv2Divider(),
      this.ui.row(btnAdd, btnClear, btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _confirmDeleteCommand(interaction, user, commandId, name) {
    const ctx = this._tctx(interaction);

    const btnConfirm = this.ui.btn(user, this.t('cb_btn_confirm', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      await this.client.logicEngine.deleteCommand(commandId, i.guild_id);
      await this.ui.followUpEphemeral(i, this.ui.cv2Payload([
        this.ui.cv2Text(this.t('cb_command_deleted', { ...this._tctx(i), name }))
      ]));
      return this.ui.commandList(i, user, 0);
    });

    const btnCancel = this.ui.btn(user, this.t('btn_cancel', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.commandMenu(i, user, commandId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('cb_delete_title', { ...ctx, name })),
      this.ui.cv2Divider(),
      this.ui.row(btnConfirm, btnCancel),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.danger }));
  }
}

module.exports = CommandBuilder;
