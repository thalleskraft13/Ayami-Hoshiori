'use strict';

const { randomUUID } = require('crypto');
const DiscordRequest  = require('../../DiscordRequest.js');
const FlowBuilder     = require('./FlowBuilder.js');
const CommandBuilder  = require('./CommandBuilder.js');

/* ─────────────────────────────────────────────
   CORES DA AYAMI
   ───────────────────────────────────────────── */
const COLOR = {
  main:    0x7C8FFF,
  gold:    0xFFD966,
  dark:    0x243B7A,
  hair:    0xA9D6FF,
  danger:  0xED4245,
  success: 0x57F287,
};

const GUIDE_URL = 'https://ayami-hoshiori.vercel.app/logic-builder';

/**
 * FlowUI
 *
 * Painel de configuração do Logic Builder no Discord.
 * Ponto de entrada: client.logicUI.open(interaction)
 */
class FlowUI {

  constructor(client) {
    this.client       = client;
    this.flowBuilder  = new FlowBuilder(client, this);
    this.cmdBuilder   = new CommandBuilder(client, this);
    this._listCache   = {};
  }

  /* ── helper de emoji da Ayami ── */
  _e(name) {
    return this.client?.emoji?.[name] ?? '';
  }

  /* ── botão de link para o guia ── */
  _guideButton() {
    return { type: 2, style: 5, label: '📖 Guia Logic Builder', url: GUIDE_URL };
  }

  /* ═══════════════════════════════════════════
     HELPERS DE INTERACTION
     ═══════════════════════════════════════════ */

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
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
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
    return this.followUp(interaction, { ...data, flags: 64 });
  }

  /* ═══════════════════════════════════════════
     HELPERS DE COMPONENTES
     ═══════════════════════════════════════════ */

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

  extractId(text) {
    return text?.match(/\d{17,19}/)?.[0];
  }

  /* ═══════════════════════════════════════════
     HELPERS DE PAGINAÇÃO
     ═══════════════════════════════════════════ */

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

  /* ═══════════════════════════════════════════
     CACHE DE LISTAS
     ═══════════════════════════════════════════ */

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

  /* ═══════════════════════════════════════════
     TELA: HOME
     ═══════════════════════════════════════════ */

  async open(interaction) {
    const user    = interaction.member?.user?.id || interaction.user?.id;
    const guildId = interaction.guild_id;

    const engine = this.client.logicEngine;
    const flows  = await engine.getFlows(guildId);
    this._setCache(guildId, 'flows', flows);

    const { FlowModel, CustomCommandModel } = require('../../../Mongodb/flow.js');
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

    return {
      embeds: [{
        title:       `⚡ Logic Builder ${ayami}`,
        description:
          `Oii! Eu sou a **Ayami** ${this._e('corao')} e vou te ajudar a criar automações incríveis!\n\n` +
          `Com o **Logic Builder** você pode criar regras automáticas para o seu servidor — sem precisar saber programação!\n\n` +
          `**Como funciona?**\n` +
          `🎯 **Trigger** → o que começa tudo (ex: alguém entra no servidor)\n` +
          `🔍 **Condições** → verificações opcionais (ex: só se tiver o cargo X)\n` +
          `⚡ **Ações** → o que acontece (ex: enviar mensagem, dar cargo)\n\n` +
          `Ficou com dúvida? Clica no botão **📖 Guia** aqui embaixo! ${this._e('feliz')}`,
        color:  COLOR.main,
        fields: [
          {
            name:   '📊 Seus Fluxos',
            value:  `Total: **${flows.length}** • ✅ Ativos: **${enabled}** • ⏸️ Pausados: **${disabled}**`,
            inline: false
          },
          {
            name:   '🔧 Comandos',
            value:  `Total: **${cmdCount}** comando${cmdCount !== 1 ? 's' : ''} personalizado${cmdCount !== 1 ? 's' : ''}`,
            inline: false
          }
        ],
        footer:    { text: 'Logic Builder by Ayami Hoshiori ⭐' },
        thumbnail: { url: 'https://ayami-hoshiori.vercel.app/ayami-thumb.png' }
      }],
      components: [
        this.row(btnFlows, btnCmds, btnNew, this._guideButton())
      ]
    };
  }

  /* ═══════════════════════════════════════════
     TELA: LISTA DE FLUXOS (com paginação)
     ═══════════════════════════════════════════ */

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
      return this.editOriginal(interaction, {
        embeds: [{
          title:       `📋 Fluxos ${this._e('emburrada')}`,
          description:
            `Ainda não tem nenhum fluxo criado...\n\n` +
            `${this._e('feliz')} Clica em **✨ Novo Fluxo** para criar o primeiro! É fácil, eu prometo!`,
          color: COLOR.main
        }],
        components: [this.row(btnCreate, btnBack, this._guideButton())]
      });
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

    const components = [this.row(sel)];

    if (maxPage > 0) {
      components.push(
        this._paginationRow(
          user, safePage, maxPage,
          (i, p) => this.flowList(i, user, p),
          (i, p) => this.flowList(i, user, p)
        )
      );
    }

    components.push(this.row(btnCreate, btnBack, this._guideButton()));

    return this.editOriginal(interaction, {
      embeds: [{
        title:       `📋 Seus Fluxos (${flows.length}) ${this._e('pensando')}`,
        description: `Selecione um fluxo abaixo para configurar ou gerenciar!`,
        color:       COLOR.main,
        footer:      { text: `Página ${safePage + 1}/${maxPage + 1} • Logic Builder` }
      }],
      components
    });
  }

  /* ═══════════════════════════════════════════
     TELA: MENU DO FLUXO
     ═══════════════════════════════════════════ */

  async flowMenu(interaction, user, flowId) {
    const guildId = interaction.guild_id;
    const { FlowModel } = require('../../../Mongodb/flow.js');
    const flow = await FlowModel.findOne({ flowId, guildId }).lean();

    if (!flow) {
      return this.followUpEphemeral(interaction, {
        content: `❌ Fluxo não encontrado. ${this._e('assustada')}`
      });
    }

    const status = flow.enabled ? '🟢 Ativo' : '🔴 Pausado';

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

    return this.editOriginal(interaction, {
      embeds: [this._flowEmbed(flow, status)],
      components: [
        this.row(btnTrigger, btnConditions, btnActions),
        this.row(btnVars, btnSettings),
        this.row(btnToggle, btnDelete, btnBack, this._guideButton())
      ]
    });
  }

  _flowEmbed(flow, status) {
    const triggerLabel = this._triggerLabel(flow.trigger);
    const runs = flow.stats?.totalRuns  || 0;
    const ok   = flow.stats?.successRuns || 0;
    const fail = flow.stats?.failedRuns  || 0;
    const ayami = this._e(flow.enabled ? 'feliz' : 'sonolenta');

    return {
      title:       `⚡ ${flow.name} ${ayami}`,
      description: flow.description || '_Sem descrição_',
      color:       flow.enabled ? COLOR.success : COLOR.danger,
      fields: [
        { name: '📌 Status',      value: status,                                              inline: true  },
        { name: '🎯 Trigger',     value: triggerLabel,                                        inline: true  },
        { name: '🔍 Condições',   value: String(flow.conditions?.length || 0),                inline: true  },
        { name: '⚡ Ações',       value: String(flow.actions?.length || 0),                   inline: true  },
        { name: '📊 Execuções',   value: `✅ ${ok}  ❌ ${fail}  (Total: ${runs})`,           inline: true  },
        { name: '⏱️ Cooldown',    value: flow.cooldown > 0 ? `${flow.cooldown / 1000}s` : 'Sem cooldown', inline: true }
      ],
      footer:    { text: `ID do fluxo: ${flow.flowId} • Logic Builder` },
      timestamp: flow.updatedAt
    };
  }

  /* ═══════════════════════════════════════════
     CONFIRMAR EXCLUSÃO
     ═══════════════════════════════════════════ */

  async _confirmDelete(interaction, user, flowId, flowName) {
    const ayami = this._e('assustada');

    const btnConfirm = this.btn(user, '✅ Sim, excluir', 4, async (i) => {
      await this.deferUpdate(i);
      await this.client.logicEngine.deleteFlow(flowId, i.guild_id);
      this.invalidateCache(i.guild_id);
      await this.followUpEphemeral(i, {
        content: `${this._e('chorando')} Fluxo **${flowName}** excluído. Espero que não precise mais dele...`
      });
      return this.flowList(i, user, 0);
    });

    const btnCancel = this.btn(user, '❌ Cancelar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowMenu(i, user, flowId);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title:       `⚠️ Excluir fluxo? ${ayami}`,
        description:
          `Tem certeza que quer excluir o fluxo **${flowName}**?\n\n` +
          `**Esta ação não pode ser desfeita!** ${this._e('brava')}\n` +
          `Todas as configurações (trigger, condições, ações, variáveis) serão perdidas.`,
        color: COLOR.danger
      }],
      components: [this.row(btnConfirm, btnCancel)]
    });
  }

  /* ═══════════════════════════════════════════
     TELA: LISTA DE COMANDOS (com paginação)
     ═══════════════════════════════════════════ */

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
      return this.editOriginal(interaction, {
        embeds: [{
          title:       `🔧 Comandos Personalizados ${this._e('emburrada')}`,
          description:
            `Nenhum comando criado ainda!\n\n` +
            `${this._e('feliz')} Clica em **✨ Novo Comando** para criar o primeiro!`,
          color: COLOR.main
        }],
        components: [this.row(btnCreate, btnBack, this._guideButton())]
      });
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

    const components = [this.row(sel)];

    if (maxPage > 0) {
      components.push(
        this._paginationRow(
          user, safePage, maxPage,
          (i, p) => this.commandList(i, user, p),
          (i, p) => this.commandList(i, user, p)
        )
      );
    }

    components.push(this.row(btnCreate, btnBack, this._guideButton()));

    return this.editOriginal(interaction, {
      embeds: [{
        title:       `🔧 Comandos (${commands.length}) ${this._e('pensando')}`,
        description: `Selecione um comando abaixo para gerenciar!`,
        color:       COLOR.main,
        footer:      { text: `Página ${safePage + 1}/${maxPage + 1} • Logic Builder` }
      }],
      components
    });
  }

  /* ═══════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════ */

  _triggerLabel(trigger) {
    if (!trigger) return 'Não configurado';
    const labels = {
      'message:message_created':         '💬 Mensagem criada',
      'message:message_edited':          '✏️ Mensagem editada',
      'message:message_deleted':         '🗑️ Mensagem apagada',
      'message:message_contains_text':   '🔍 Mensagem com texto',
      'message:message_contains_link':   '🔗 Mensagem com link',
      'message:message_contains_image':  '🖼️ Mensagem com imagem',
      'message:message_contains_file':   '📎 Mensagem com arquivo',
      'message:message_contains_mention':'📣 Mensagem com menção',
      'message:message_contains_emoji':  '😀 Mensagem com emoji',
      'message:message_contains_sticker':'🎭 Mensagem com sticker',
      'member:member_joined':            '👋 Membro entrou',
      'member:member_left':              '🚪 Membro saiu',
      'member:member_banned':            '🔨 Membro banido',
      'member:member_unbanned':          '✅ Membro desbanido',
      'member:member_nick_changed':      '📝 Nick alterado',
      'reaction:reaction_added':         '➕ Reação adicionada',
      'reaction:reaction_removed':       '➖ Reação removida',
      'voice:voice_joined':              '🔊 Entrou em call',
      'voice:voice_left':                '🔇 Saiu da call',
      'voice:voice_moved':               '🔀 Mudou de call',
      'voice:camera_on':                 '📷 Câmera ligada',
      'voice:camera_off':                '📷 Câmera desligada',
      'voice:screen_share_start':        '🖥️ Compartilhando tela',
      'voice:screen_share_stop':         '🖥️ Parou de compartilhar',
      'component:button_clicked':        '🖱️ Botão clicado',
      'component:select_used':           '📋 Select usado',
      'component:modal_submitted':       '📝 Modal enviado',
      'channel:channel_created':         '📁 Canal criado',
      'channel:channel_deleted':         '❌ Canal apagado',
      'channel:channel_updated':         '🔧 Canal atualizado',
      'internal:custom_event':           '⚡ Evento customizado',
      'time:scheduled_trigger':          '🕐 Horário agendado',
      'command:command_executed':        '🔧 Comando executado'
    };
    return labels[`${trigger.category}:${trigger.type}`] || `${trigger.category}/${trigger.type}`;
  }
}

module.exports = FlowUI;