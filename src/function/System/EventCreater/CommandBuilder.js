'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
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

  _cv2(blocks, opts = {}) {
    return this.ui.cv2Payload(blocks, { ephemeral: false, ...opts });
  }


  async startCreate(interaction, user) {
    const flows = await FlowModel.find({
      guildId:        interaction.guild_id,
      'trigger.category': 'command',
      'trigger.type':     'command_executed'
    }).lean();

    if (!flows.length) {
      return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
        this.ui.cv2Text(`# ${this._e('emduvida')} Nenhum fluxo disponível\nCrie pelo menos um fluxo com trigger **🔧 Comando executado** antes de criar um comando personalizado.`)
      ]));
    }

    const options = flows.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${this.ui._triggerLabel(f.trigger)}`
    }));

    const sel = this.ui.select(user, options, '🔗 Selecione o fluxo do comando', async (i) => {
      return this._createStep2(i, user, i.data.values[0]);
    });

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.commandList(i, user);
    });

    const blocks = [
      this.ui.cv2Text(
        `# 🔧 Novo Comando — Passo 1 de 2 ${this._e('animada')}\n` +
        `${this._e('pensando')} Selecione o fluxo que será executado quando o comando for usado!\n\n` +
        `*Só aparecem fluxos com trigger* **🔧 Comando executado**.`
      ),
      this.ui.cv2Divider(),
      this.ui.row(sel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _createStep2(interaction, user, flowId) {
    const modal = this.client.interactions.createModal({
      user,
      title: 'Novo Comando — Detalhes',
      components: [
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'name',
            label:       'Nome do comando (sem prefixo)',
            style:       1,
            required:    true,
            max_length:  30,
            placeholder: 'daily, pescar, abrir, caçar...'
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'aliases',
            label:       'Aliases (separados por vírgula)',
            style:       1,
            required:    false,
            max_length:  200,
            placeholder: 'dy, dia, diario'
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'prefix',
            label:       'Prefixo (padrão: !)',
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
            label:       'Cooldown (ex: 24h, 22h 10m, 1d 5h, 0)',
            style:       1,
            required:    false,
            max_length:  30,
            placeholder: 'Ex: 24h • 22h 10m • 90m • 0 (sem cooldown)'
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'description',
            label:       'Descrição',
            style:       2,
            required:    false,
            max_length:  200,
            placeholder: 'Colete sua recompensa diária.'
          }]
        }
      ],
      funcao: async (modalInteraction, client, fields) => {
        const name = fields.name?.trim().toLowerCase().replace(/\s+/g, '_');
        if (!name) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: { content: `❌ Nome inválido! ${this._e('assustada')}`, flags: 64 } } }
          );
        }

        const existing = await CustomCommandModel.findOne({
          guildId: modalInteraction.guild_id,
          name
        });

        if (existing) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: { content: `${this._e('emburrada')} Comando **${name}** já existe.`, flags: 64 } } }
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
              content: `${this._e('emduvida')} Não entendi essa duração de cooldown! Use algo como \`24h\`, \`22h 10m\`, \`1d 5h\` ou \`0\`.`,
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

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this.commandMenu(modalInteraction, user, cmd.commandId, {
          successMsg: `${this._e('festa')} Comando **${cmd.prefix}${name}** criado!`
        });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }


  async commandMenu(interaction, user, commandId, { successMsg } = {}) {
    const guildId = interaction.guild_id;
    const cmd = await CustomCommandModel.findOne({ commandId, guildId }).lean();

    if (!cmd) {
      return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
        this.ui.cv2Text(`❌ Comando não encontrado. ${this._e('assustada')}`)
      ]));
    }

    const flow = await FlowModel.findOne({ flowId: cmd.flowId }).lean();
    const flowLabel = flow ? flow.name : `⚠️ Fluxo não encontrado`;

    const btnToggle = this.ui.btn(
      user,
      cmd.enabled ? '⏸️ Desativar' : '▶️ Ativar',
      cmd.enabled ? 4 : 3,
      async (i) => {
        await this.ui.deferUpdate(i);
        await CustomCommandModel.updateOne({ commandId }, { enabled: !cmd.enabled });
        this.client.logicEngine._flowCache?.delete(`cmd:${guildId}`);
        return this.commandMenu(i, user, commandId);
      }
    );

    const btnEdit = this.ui.btn(user, '✏️ Editar', 2, i => this._editCommand(i, user, commandId));

    const btnChangeFlow = this.ui.btn(user, '🔀 Trocar Fluxo', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this._changeFlow(i, user, commandId);
    });

    const btnRoles = this.ui.btn(user, '🛡️ Cargos Necessários', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this._manageRoles(i, user, commandId);
    });

    const btnDelete = this.ui.btn(user, '🗑️ Excluir', 4, async (i) => {
      await this.ui.deferUpdate(i);
      return this._confirmDeleteCommand(i, user, commandId, cmd.name);
    });

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.commandList(i, user);
    });

    const aliasStr = cmd.aliases?.length ? cmd.aliases.join(', ') : '_Nenhum_';
    const rolesStr = cmd.requiredRoles?.length ? cmd.requiredRoles.map(r => `<@&${r}>`).join(', ') : '_Qualquer um_';
    const coolStr  = cmd.cooldown > 0 ? formatDuration(cmd.cooldown) : 'Nenhum';
    const ayami    = this._e(cmd.enabled ? 'feliz' : 'sonolenta');

    const blocks = [
      this.ui.cv2Text(
        `# 🔧 ${cmd.prefix}${cmd.name} ${ayami}\n` +
        (successMsg ? `${successMsg}\n\n` : '') +
        `${cmd.description || '_Sem descrição_'}`
      ),
      this.ui.cv2Divider(),
      this.ui.cv2Text(
        `> 📌 **Status:** ${cmd.enabled ? '🟢 Ativo' : '🔴 Desativado'}\n` +
        `> 🔣 **Prefixo:** \`${cmd.prefix}\`\n` +
        `> ⏱️ **Cooldown:** ${coolStr}`
      ),
      this.ui.cv2Divider(),
      this.ui.cv2Text(
        `> 🏷️ **Aliases:** ${aliasStr}\n` +
        `> ⚡ **Fluxo:** ${flowLabel}\n` +
        `> 🛡️ **Cargos necessários:** ${rolesStr}`
      ),
      this.ui.cv2Divider(),
      this.ui.row(btnToggle, btnEdit, btnChangeFlow),
      this.ui.row(btnRoles, btnDelete, btnBack),
      this.ui.cv2Divider(),
      this.ui.cv2Text(`-# ID: ${cmd.commandId}`),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, {
      accentColor: cmd.enabled ? COLOR.success : COLOR.danger
    }));
  }

  async _editCommand(interaction, user, commandId) {
    const cmd = await CustomCommandModel.findOne({ commandId }).lean();

    const modal = this.client.interactions.createModal({
      user,
      title: 'Editar Comando',
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'name',        label: 'Nome',          style: 1, required: true,  max_length: 30,  value: cmd.name }] },
        { type: 1, components: [{ type: 4, custom_id: 'aliases',     label: 'Aliases',       style: 1, required: false, max_length: 200, value: cmd.aliases?.join(', ') || '' }] },
        { type: 1, components: [{ type: 4, custom_id: 'prefix',      label: 'Prefixo',       style: 1, required: false, max_length: 5,   value: cmd.prefix }] },
        { type: 1, components: [{ type: 4, custom_id: 'cooldown',    label: 'Cooldown (ex: 24h, 22h 10m, 0)', style: 1, required: false, max_length: 30,  value: cmd.cooldown > 0 ? formatDuration(cmd.cooldown) : '0' }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: 'Descrição',     style: 2, required: false, max_length: 200, value: cmd.description || '' }] }
      ],
      funcao: async (modalInteraction, client, fields) => {
        const rawCooldown = fields.cooldown?.trim() || '0';
        const cooldownMs  = rawCooldown === '0' ? 0 : parseDuration(rawCooldown);

        if (rawCooldown !== '0' && cooldownMs === 0) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: {
              content: `${this._e('emduvida')} Não entendi essa duração de cooldown! Use algo como \`24h\`, \`22h 10m\`, \`1d 5h\` ou \`0\`.`,
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

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this.commandMenu(modalInteraction, user, commandId, {
          successMsg: `${this._e('feliz')} Comando atualizado!`
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

    if (!flows.length) {
      return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
        this.ui.cv2Text(`${this._e('emduvida')} Nenhum fluxo com trigger **🔧 Comando executado** disponível.`)
      ]));
    }

    const options = flows.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${this.ui._triggerLabel(f.trigger)}`
    }));

    const sel = this.ui.select(user, options, '🔀 Selecione o novo fluxo', async (i) => {
      await this.ui.deferUpdate(i);
      await CustomCommandModel.updateOne({ commandId }, { flowId: i.data.values[0] });
      this.client.logicEngine._flowCache?.delete(`cmd:${i.guild_id}`);
      return this.commandMenu(i, user, commandId, {
        successMsg: `${this._e('curtida')} Fluxo do comando atualizado!`
      });
    });

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.commandMenu(i, user, commandId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# 🔀 Trocar Fluxo do Comando ${this._e('pensando')}\n` +
        `Selecione qual fluxo este comando vai executar agora:`
      ),
      this.ui.cv2Divider(),
      this.ui.row(sel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _manageRoles(interaction, user, commandId) {
    const cmd = await CustomCommandModel.findOne({ commandId }).lean();
    const rolesStr = cmd.requiredRoles?.length
      ? cmd.requiredRoles.map(r => `<@&${r}>`).join('\n')
      : `_Nenhum — qualquer usuário pode usar ${this._e('feliz')}_`;

    const btnAdd = this.ui.btn(user, '➕ Adicionar Cargo', 1, async (i) => {
      await this.ui.deferUpdate(i);
      await this.ui.followUpEphemeral(i, this.ui.cv2Payload([
        this.ui.cv2Text(`${this._e('pensando')} Envie o cargo (menção ou ID) no canal:`)
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
          this.ui.cv2Text(`${this._e('assustada')} Cargo inválido.`)
        ]));
      }

      const roles = cmd.requiredRoles || [];
      if (!roles.includes(id)) roles.push(id);

      await CustomCommandModel.updateOne({ commandId }, { requiredRoles: roles });
      this.client.logicEngine._flowCache?.delete(`cmd:${i.guild_id}`);
      return this._manageRoles(i, user, commandId);
    });

    const btnClear = this.ui.btn(user, '🧹 Limpar', 4, async (i) => {
      await this.ui.deferUpdate(i);
      await CustomCommandModel.updateOne({ commandId }, { requiredRoles: [] });
      this.client.logicEngine._flowCache?.delete(`cmd:${i.guild_id}`);
      return this._manageRoles(i, user, commandId);
    });

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.commandMenu(i, user, commandId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# 🛡️ Cargos Necessários ${this._e('emduvida')}\n` +
        `Apenas usuários com estes cargos podem usar o comando:\n\n${rolesStr}`
      ),
      this.ui.cv2Divider(),
      this.ui.row(btnAdd, btnClear, btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _confirmDeleteCommand(interaction, user, commandId, name) {
    const btnConfirm = this.ui.btn(user, '✅ Confirmar', 4, async (i) => {
      await this.ui.deferUpdate(i);
      await this.client.logicEngine.deleteCommand(commandId, i.guild_id);
      await this.ui.followUpEphemeral(i, this.ui.cv2Payload([
        this.ui.cv2Text(`${this._e('chorando')} Comando **${name}** excluído.`)
      ]));
      return this.ui.commandList(i, user, 0);
    });

    const btnCancel = this.ui.btn(user, '❌ Cancelar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.commandMenu(i, user, commandId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# ⚠️ Excluir Comando ${this._e('assustada')}\n` +
        `Tem certeza que quer excluir **${name}**?\n\n` +
        `**Esta ação não pode ser desfeita!** ${this._e('brava')}`
      ),
      this.ui.cv2Divider(),
      this.ui.row(btnConfirm, btnCancel),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.danger }));
  }
}

module.exports = CommandBuilder;
