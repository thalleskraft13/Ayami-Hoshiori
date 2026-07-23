'use strict';

const { randomUUID } = require('crypto');
const DiscordRequest  = require('../../DiscordRequest.js');
const FlowBuilder     = require('./FlowBuilder.js');
const CommandBuilder  = require('./CommandBuilder.js');

const COLOR = {
  main:    0x7C8FFF,   // azul principal
  gold:    0xFFD966,   // dourado
  dark:    0x243B7A,   // azul escuro
  hair:    0xA9D6FF,   // azul cabelo
  danger:  0xED4245,
  success: 0x57F287,
};

const GUIDE_URL = 'https://ayami-hoshiori.vercel.app/logic-builder';

class FlowUI {

  constructor(client) {
    this.client       = client;
    this.flowBuilder  = new FlowBuilder(client, this);
    this.cmdBuilder   = new CommandBuilder(client, this);
    this._listCache   = {};
  }

  _e(name) {
    return this.client?.emoji?.[name] ?? '';
  }

  _guideButton() {
    return { type: 2, style: 5, label: '📖 Guia', url: GUIDE_URL };
  }


  async reply(interaction, data) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 4, data } }
    );
  }

  async deferUpdate(interaction) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 6 } }
    );
  }

  async editOriginal(interaction, data) {
  if (interaction.__rootOverride) {
    const { channelId, messageId } = interaction.__rootOverride;
    return this.editMessageById(channelId, messageId, data);
  }
  return DiscordRequest(
    `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
    { method: 'PATCH', body: data }
  );
}

async editMessageById(channelId, messageId, data) {
  return DiscordRequest(
    `/channels/${channelId}/messages/${messageId}`,
    { method: 'PATCH', body: data }
  );
}

  async followUp(interaction, data) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}`,
      { method: 'POST', body: data }
    );
  }

  async followUpEphemeral(interaction, data) {
    return this.followUp(interaction, { ...data, flags: (data.flags ?? 0) | 64 });
  }

  async deleteFollowUp(interaction, messageId) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/${messageId}`,
      { method: 'DELETE' }
    );
  }


  btn(user, label, style, func, opts = {}) {
    return this.client.interactions.createButton({
      user,
      data: { label, style, emoji: opts.emoji },
      funcao: func
    });
  }

  select(user, options, placeholder, func) {
    return this.client.interactions.createSelect({
      user,
      data: { placeholder, options },
      funcao: func
    });
  }

  row(...components) {
    return { type: 1, components };
  }


  cv2Text(content) {
    return { type: 10, content };
  }

  cv2Divider(spacing = 1) {
    return { type: 14, divider: true, spacing };
  }

  cv2Section(content, button) {
    return {
      type:      9,
      accessory: button,
      components: [this.cv2Text(content)]
    };
  }

  cv2Gallery(urls) {
    const list = Array.isArray(urls) ? urls : [urls];
    return {
      type:  12,
      items: list.map(url => ({ media: { url }, description: null, spoiler: false }))
    };
  }

  cv2Container(blocks, opts = {}) {
    return {
      type:         17,
      accent_color: opts.accentColor ?? COLOR.main,
      spoiler:      opts.spoiler ?? false,
      components:   blocks
    };
  }

  cv2Flags(ephemeral = true) {
    return ephemeral ? 32768 | 64 : 32768;
  }

  cv2Payload(blocks, opts = {}) {
    return {
      flags:      this.cv2Flags(opts.ephemeral ?? true),
      components: [this.cv2Container(blocks, opts)]
    };
  }


  modalSelect(customId, label, options, opts = {}) {
    return {
      type:        18,
      label,
      description: opts.description,
      component: {
        type:        3,
        custom_id:   customId,
        placeholder: opts.placeholder || 'Escolha uma opção…',
        min_values:  opts.required === false ? 0 : 1,
        max_values:  1,
        options
      }
    };
  }

  modalYesNo(customId, label, opts = {}) {
    return this.modalSelect(customId, label, [
      { label: opts.yesLabel || '✅ Sim', value: 'true',  default: opts.defaultValue === 'true' },
      { label: opts.noLabel  || '❌ Não', value: 'false', default: opts.defaultValue === 'false' },
    ], { placeholder: opts.placeholder || 'Sim ou não?' });
  }

  modalText(customId, label, opts = {}) {
    return {
      type:        18,
      label,
      description: opts.description,
      component: {
        type:        4,
        custom_id:   customId,
        style:       opts.style ?? 1,
        required:    opts.required ?? true,
        min_length:  opts.minLength,
        max_length:  opts.maxLength ?? 200,
        placeholder: opts.placeholder,
        value:       opts.value
      }
    };
  }

  extractId(text) {
    return text?.match(/\d{17,19}/)?.[0];
  }


  _clampPage(page, total) {
    const maxPage  = Math.max(0, Math.ceil(total / 25) - 1);
    const safePage = Math.min(Math.max(0, page), maxPage);
    return { page: safePage, maxPage };
  }

  _pageSlice(list, page) {
    return list.slice(page * 25, page * 25 + 25);
  }

  _paginationRow(user, page, maxPage, onPrev, onNext) {
    const btnPrev = this.btn(user, '⬅️ Anterior', page === 0 ? 2 : 1, async (i) => {
      await this.deferUpdate(i);
      return onPrev(i, page - 1);
    });
    const btnNext = this.btn(user, '➡️ Próximo', page >= maxPage ? 2 : 1, async (i) => {
      await this.deferUpdate(i);
      return onNext(i, page + 1);
    });
    return this.row(btnPrev, btnNext);
  }


  static CACHE_TTL = 60_000;

  _isCacheValid(guildId, key) {
    const entry = this._listCache[guildId];
    if (!entry || !entry[key]) return false;
    return (Date.now() - entry.fetchedAt) < FlowUI.CACHE_TTL;
  }

  _setCache(guildId, key, data) {
    if (!this._listCache[guildId]) this._listCache[guildId] = {};
    this._listCache[guildId][key]      = data;
    this._listCache[guildId].fetchedAt = Date.now();
  }

  _getCache(guildId, key) {
    return this._listCache[guildId]?.[key] ?? null;
  }

  invalidateCache(guildId) {
    delete this._listCache[guildId];
  }


  async open(interaction) {
    const user    = interaction.member?.user?.id || interaction.user?.id;
    const guildId = interaction.guild_id;

    const engine = this.client.logicEngine;
    const flows  = await engine.getFlows(guildId);
    this._setCache(guildId, 'flows', flows);

    const { CustomCommandModel } = require('../../../Mongodb/flow.js');
    const cmdCount = await CustomCommandModel.countDocuments({ guildId });

    return this.editOriginal(interaction, this._homePayload(user, flows, cmdCount));
  }

  _homePayload(user, flows, cmdCount) {
    const enabled  = flows.filter(f => f.enabled).length;
    const disabled = flows.length - enabled;
    const ayami    = this._e('animada');

    const btnFlows = this.btn(user, `📋 Fluxos (${flows.length})`, 1, async (i) => {
      await this.deferUpdate(i);
      return this.flowList(i, user, 0);
    });

    const btnCmds = this.btn(user, `🔧 Comandos (${cmdCount})`, 2, async (i) => {
      await this.deferUpdate(i);
      return this.commandList(i, user, 0);
    });

    const btnNew = this.btn(user, '✨ Novo Fluxo', 3, async (i) => {
      return this.flowBuilder.startCreate(i, user);
    });

    const blocks = [
      this.cv2Text(
        `# ⚡ Logic Builder ${ayami}\n` +
        `Oii! Eu sou a **Ayami** ${this._e('corao')} e vou te ajudar a criar automações incríveis!\n\n` +
        `Com o **Logic Builder** você cria regras automáticas pro seu servidor — sem precisar saber programar!\n\n` +
        `> 🎯 **Trigger** → o que começa tudo *(ex: alguém entra no servidor)*\n` +
        `> 🔍 **Condições** → verificações opcionais *(ex: só se tiver o cargo X)*\n` +
        `> ⚡ **Ações** → o que acontece *(ex: enviar mensagem, dar cargo)*`
      ),
      this.cv2Divider(),
      this.cv2Section(
        `## 📊 | Seus Fluxos
        
        Total: **${flows.length}** • ✅ Ativos: **${enabled}** • ⏸️ Pausados: **${disabled}**`,
        btnFlows
      ),
      this.cv2Divider(),
      this.cv2Section(
        `## 🔧 Comandos Personalizados
        
        Total: **${cmdCount}** comando${cmdCount !== 1 ? 's' : ''} personalizado${cmdCount !== 1 ? 's' : ''}`,
        btnCmds
      ),
      this.cv2Divider(),
      this.row(btnNew, this._guideButton()),
      this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),

    ];

    return this.cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main });
  }


  async flowList(interaction, user, page = 0) {
    const guildId = interaction.guild_id;

    let flows;
    if (this._isCacheValid(guildId, 'flows')) {
      flows = this._getCache(guildId, 'flows');
    } else {
      flows = await this.client.logicEngine.getFlows(guildId);
      this._setCache(guildId, 'flows', flows);
    }

    const btnCreate = this.btn(user, '✨ Novo Fluxo', 3, async (i) => {
      return this.flowBuilder.startCreate(i, user);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.open(i);
    });

    if (!flows.length) {
      const blocks = [
        this.cv2Text(
          `# 📋 Fluxos ${this._e('emburrada')}\n` +
          `Ainda não tem nenhum fluxo criado...\n\n` +
          `${this._e('feliz')} Clica em **✨ Novo Fluxo** para criar o primeiro! É fácil, eu prometo!`
        ),
        this.cv2Divider(),
        this.row(btnCreate, btnBack, this._guideButton()),
        this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
      ];
      return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
    }

    const { page: safePage, maxPage } = this._clampPage(page, flows.length);
    const pageItems = this._pageSlice(flows, safePage);

    const options = pageItems.map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${this._triggerLabel(f.trigger)} • ${f.enabled ? '🟢 Ativo' : '🔴 Desativado'}`,
      emoji:       { name: f.enabled ? '🟢' : '🔴' }
    }));

    const sel = this.select(user, options, '🔍 Selecionar fluxo...', async (i) => {
      await this.deferUpdate(i);
      return this.flowMenu(i, user, i.data.values[0]);
    });

    const listText = pageItems
      .map(f => `${f.enabled ? '🟢' : '🔴'} **${f.name}** \`(${this._triggerLabel(f.trigger)})\``)
      .join('\n');

    const blocks = [
      this.cv2Text(
        `# 📋 Seus Fluxos (${flows.length}) ${this._e('pensando')}\n` +
        `Selecione um fluxo abaixo para configurar ou gerenciar!\n` +
        `*(Página ${safePage + 1}/${maxPage + 1})*\n\n${listText}`
      ),
      this.cv2Divider(),
      this.row(sel),
      this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
    ];

    if (maxPage > 0) {
      blocks.push(
        this._paginationRow(
          user, safePage, maxPage,
          (i, p) => this.flowList(i, user, p),
          (i, p) => this.flowList(i, user, p)
        )
      );
    }

    blocks.push(this.cv2Divider());
    blocks.push(this.row(btnCreate, btnBack, this._guideButton()));

    return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
  }


  async flowMenu(interaction, user, flowId) {
    const guildId = interaction.guild_id;
    const { FlowModel } = require('../../../Mongodb/flow.js');
    const flow = await FlowModel.findOne({ flowId, guildId }).lean();

    if (!flow) {
      return this.followUpEphemeral(interaction, this.cv2Payload([
        this.cv2Text(`❌ Fluxo não encontrado. ${this._e('assustada')}`)
      ]));
    }

    const status       = flow.enabled ? '🟢 Ativo' : '🔴 Pausado';
    const triggerLabel = this._triggerLabel(flow.trigger);
    const runs         = flow.stats?.totalRuns   || 0;
    const ok           = flow.stats?.successRuns || 0;
    const fail         = flow.stats?.failedRuns  || 0;
    const ayami        = this._e(flow.enabled ? 'feliz' : 'sonolenta');

    const btnTrigger = this.btn(user, '🎯 Trigger', 1, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.triggerMenu(i, user, flowId);
    });

    const btnConditions = this.btn(user, `🔍 Condições (${flow.conditions?.length || 0})`, 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.conditionsMenu(i, user, flowId);
    });

    const btnActions = this.btn(user, `⚡ Ações (${flow.actions?.length || 0})`, 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.actionsMenu(i, user, flowId);
    });

    const btnVars = this.btn(user, `📦 Variáveis (${flow.variables?.length || 0})`, 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.variablesMenu(i, user, flowId);
    });

    const btnSettings = this.btn(user, '⚙️ Configurações', 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.settingsMenu(i, user, flowId);
    });

    const btnToggle = this.btn(
      user,
      flow.enabled ? '⏸️ Pausar' : '▶️ Ativar',
      flow.enabled ? 4 : 3,
      async (i) => {
        await this.deferUpdate(i);
        await this.client.logicEngine.toggleFlow(flowId, guildId);
        this.invalidateCache(guildId);
        return this.flowMenu(i, user, flowId);
      }
    );

    const btnDelete = this.btn(user, '🗑️ Excluir', 4, async (i) => {
      await this.deferUpdate(i);
      return this._confirmDelete(i, user, flowId, flow.name);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowList(i, user, 0);
    });

    const cooldownText = flow.cooldown > 0 ? `${flow.cooldown / 1000}s` : 'Sem cooldown';

    const blocks = [
      this.cv2Text(
        `# ⚡ ${flow.name} ${ayami}\n` +
        `${flow.description || '_Sem descrição_'}`
      ),
      this.cv2Divider(),
      this.cv2Section(
        `**📌 Status:** ${status}  •  **🎯 Trigger:** ${triggerLabel}\n` +
        `**⏱️ Cooldown:** ${cooldownText}`,
        btnTrigger
      ),
      this.cv2Divider(),
      this.cv2Section(
        `**🔍 Condições:** ${flow.conditions?.length || 0}  •  **⚡ Ações:** ${flow.actions?.length || 0}`,
        btnConditions
      ),
      this.cv2Divider(),
      this.cv2Section(
        `**📊 Execuções:** ✅ ${ok}  ❌ ${fail}  (Total: ${runs})`,
        btnActions
      ),
      this.cv2Divider(),
      this.row(btnVars, btnSettings),
      this.row(btnToggle, btnDelete, btnBack, this._guideButton()),
    ];

    return this.editOriginal(interaction, this.cv2Payload(blocks, {
      ephemeral:   false,
      accentColor: flow.enabled ? COLOR.success : COLOR.danger
    }));
  }


  async _confirmDelete(interaction, user, flowId, flowName) {
    const ayami = this._e('assustada');

    const btnConfirm = this.btn(user, '✅ Sim, excluir', 4, async (i) => {
      await this.deferUpdate(i);
      await this.client.logicEngine.deleteFlow(flowId, i.guild_id);
      this.invalidateCache(i.guild_id);
      await this.followUpEphemeral(i, this.cv2Payload([
        this.cv2Text(`${this._e('chorando')} Fluxo **${flowName}** excluído. Espero que não precise mais dele...`)
      ]));
      return this.flowList(i, user, 0);
    });

    const btnCancel = this.btn(user, '❌ Cancelar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.cv2Text(
        `# ⚠️ Excluir fluxo? ${ayami}\n` +
        `Tem certeza que quer excluir o fluxo **${flowName}**?\n\n` +
        `**Esta ação não pode ser desfeita!** ${this._e('brava')}\n` +
        `Todas as configurações (trigger, condições, ações, variáveis) serão perdidas.`
      ),
      this.cv2Divider(),
      this.row(btnConfirm, btnCancel),
    ];

    return this.editOriginal(interaction, this.cv2Payload(blocks, {
      ephemeral:   false,
      accentColor: COLOR.danger
    }));
  }


  async commandList(interaction, user, page = 0) {
    const guildId = interaction.guild_id;
    const { CustomCommandModel } = require('../../../Mongodb/flow.js');

    let commands;
    if (this._isCacheValid(guildId, 'commands')) {
      commands = this._getCache(guildId, 'commands');
    } else {
      commands = await CustomCommandModel.find({ guildId }).lean();
      this._setCache(guildId, 'commands', commands);
    }

    const btnCreate = this.btn(user, '✨ Novo Comando', 3, async (i) => {
      await this.deferUpdate(i);
      return this.cmdBuilder.startCreate(i, user);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.open(i);
    });

    if (!commands.length) {
      const blocks = [
        this.cv2Text(
          `# 🔧 Comandos Personalizados ${this._e('emburrada')}\n` +
          `Nenhum comando criado ainda!\n\n` +
          `${this._e('feliz')} Clica em **✨ Novo Comando** para criar o primeiro!`
        ),
        this.cv2Divider(),
        this.row(btnCreate, btnBack, this._guideButton()),
        this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
      ];
      return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
    }

    const { page: safePage, maxPage } = this._clampPage(page, commands.length);
    const pageItems = this._pageSlice(commands, safePage);

    const options = pageItems.map(c => ({
      label:       `${c.prefix}${c.name}`.slice(0, 100),
      value:       c.commandId,
      description: c.description?.slice(0, 100) || 'Sem descrição',
      emoji:       { name: c.enabled ? '🟢' : '🔴' }
    }));

    const sel = this.select(user, options, '🔍 Selecionar comando...', async (i) => {
      await this.deferUpdate(i);
      return this.cmdBuilder.commandMenu(i, user, i.data.values[0]);
    });

    const listText = pageItems
      .map(c => `${c.enabled ? '🟢' : '🔴'} **${c.prefix}${c.name}** \`${c.description?.slice(0, 50) || '_sem descrição_'}\``)
      .join('\n');

    const blocks = [
      this.cv2Text(
        `# 🔧 Comandos (${commands.length}) ${this._e('pensando')}\n` +
        `Selecione um comando abaixo para gerenciar!\n` +
        `*(Página ${safePage + 1}/${maxPage + 1})*\n\n${listText}`
      ),
      this.cv2Divider(),
      this.row(sel),
      this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
    ];

    if (maxPage > 0) {
      blocks.push(
        this._paginationRow(
          user, safePage, maxPage,
          (i, p) => this.commandList(i, user, p),
          (i, p) => this.commandList(i, user, p)
        )
      );
    }

    blocks.push(this.cv2Divider());
    blocks.push(this.row(btnCreate, btnBack, this._guideButton()));

    return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
  }


  _triggerLabel(trigger) {
    if (!trigger) return 'Não configurado';
    const labels = {
      'message:message_created':          '💬 Mensagem criada',
      'message:message_edited':           '✏️ Mensagem editada',
      'message:message_deleted':          '🗑️ Mensagem apagada',
      'message:message_contains_text':    '🔍 Mensagem com texto',
      'message:message_contains_link':    '🔗 Mensagem com link',
      'message:message_contains_image':   '🖼️ Mensagem com imagem',
      'message:message_contains_file':    '📎 Mensagem com arquivo',
      'message:message_contains_mention': '📣 Mensagem com menção',
      'message:message_contains_emoji':   '😀 Mensagem com emoji',
      'message:message_contains_sticker': '🎭 Mensagem com sticker',
      'member:member_joined':             '👋 Membro entrou',
      'member:member_left':               '🚪 Membro saiu',
      'member:member_banned':             '🔨 Membro banido',
      'member:member_unbanned':           '✅ Membro desbanido',
      'member:member_nick_changed':       '📝 Nick alterado',
      'reaction:reaction_added':          '➕ Reação adicionada',
      'reaction:reaction_removed':        '➖ Reação removida',
      'voice:voice_joined':               '🔊 Entrou em call',
      'voice:voice_left':                 '🔇 Saiu da call',
      'voice:voice_moved':                '🔀 Mudou de call',
      'voice:camera_on':                  '📷 Câmera ligada',
      'voice:camera_off':                 '📷 Câmera desligada',
      'voice:screen_share_start':         '🖥️ Compartilhando tela',
      'voice:screen_share_stop':          '🖥️ Parou de compartilhar',
      'component:button_clicked':         '🖱️ Botão clicado',
      'component:select_used':            '📋 Select usado',
      'component:modal_submitted':        '📝 Modal enviado',
      'channel:channel_created':          '📁 Canal criado',
      'channel:channel_deleted':          '❌ Canal apagado',
      'channel:channel_updated':          '🔧 Canal atualizado',
      'internal:custom_event':            '⚡ Evento customizado',
      'time:scheduled_trigger':           '🕐 Horário agendado',
      'command:command_executed':         '🔧 Comando executado'
    };
    return labels[`${trigger.category}:${trigger.type}`] || `${trigger.category}/${trigger.type}`;
  }
}

module.exports = FlowUI;
