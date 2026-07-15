'use strict';

const { randomUUID } = require('crypto');
const DiscordRequest  = require('../../DiscordRequest.js');
const { localeCtx }   = require('../../Utils/ctxLocale.js');
const FlowBuilder     = require('./FlowBuilder.js');
const CommandBuilder  = require('./CommandBuilder.js');

/* ─────────────────────────────────────────────
   CORES DA AYAMI
   ───────────────────────────────────────────── */
const COLOR = {
  main:    0x7C8FFF,   // azul principal
  gold:    0xFFD966,   // dourado
  dark:    0x243B7A,   // azul escuro
  hair:    0xA9D6FF,   // azul cabelo
  danger:  0xED4245,
  success: 0x57F287,
};

const GUIDE_URL = 'https://ayami-hoshiori.discloud.app/logic-builder';

/**
 * FlowUI — Components V2
 *
 * Todos os painéis principais usam Container (type 17) com blocos cv2*.
 * IS_COMPONENTS_V2 flag = 1 << 15 = 32768
 * EPHEMERAL flag        = 1 << 6  = 64
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

  /** Atalho pra tradução de uma chave do sistema "logicbuilder". */
  t(key, ctx, extra = {}) {
    return this.client.t(`logicbuilder.${key}`, { ...ctx, ...extra });
  }

  /** Contexto de locale + atalhos de emoji, a partir da interação. */
  _tctx(interaction, extra = {}) {
    return localeCtx(interaction, {
      ayami:     this._e('ayami'),
      corao:     this._e('corao'),
      feliz:     this._e('feliz'),
      emburrada: this._e('emburrada'),
      pensando:  this._e('pensando'),
      assustada: this._e('assustada'),
      brava:     this._e('brava'),
      chorando:  this._e('chorando'),
      curtida:   this._e('curtida'),
      festa:     this._e('festa'),
      ...extra,
    });
  }

  /* ── botão de link para o guia (estilo 5 = link) ── */
  _guideButton(ctx = {}) {
    return { type: 2, style: 5, label: this.t('guide_button', ctx), url: GUIDE_URL };
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

  /**
   * Apaga uma mensagem de followUp (pelo messageId retornado no POST).
   * Usado pelo embed builder para fechar o painel temporário.
   */
  async deleteFollowUp(interaction, messageId) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/${messageId}`,
      { method: 'DELETE' }
    );
  }

  /* ═══════════════════════════════════════════
     HELPERS DE COMPONENTES (ActionRows legados)
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

  /* ═══════════════════════════════════════════
     HELPERS COMPONENTS V2
     ═══════════════════════════════════════════ */

  /** Text Display (type 10) */
  cv2Text(content) {
    return { type: 10, content };
  }

  /** Separator (type 14) */
  cv2Divider(spacing = 1) {
    return { type: 14, divider: true, spacing };
  }

  /**
   * Section (type 9) — texto + botão acessório ao lado.
   * @param {string} content   Markdown do texto
   * @param {object} button    Botão já criado com this.btn(...)
   */
  cv2Section(content, button) {
    return {
      type:      9,
      accessory: button,
      components: [this.cv2Text(content)]
    };
  }

  /**
   * Media Gallery (type 12) — imagem decorativa da Ayami.
   * @param {string|string[]} urls
   */
  cv2Gallery(urls) {
    const list = Array.isArray(urls) ? urls : [urls];
    return {
      type:  12,
      items: list.map(url => ({ media: { url }, description: null, spoiler: false }))
    };
  }

  /**
   * Container raiz (type 17).
   * @param {object[]} blocks   Blocos internos (cv2Text, cv2Divider, cv2Section, row...)
   * @param {{ accentColor?: number, spoiler?: boolean }} opts
   */
  cv2Container(blocks, opts = {}) {
    return {
      type:         17,
      accent_color: opts.accentColor ?? COLOR.main,
      spoiler:      opts.spoiler ?? false,
      components:   blocks
    };
  }

  /**
   * Flags para respostas CV2.
   * IS_COMPONENTS_V2 = 1 << 15 = 32768   EPHEMERAL = 1 << 6 = 64
   */
  cv2Flags(ephemeral = true) {
    return ephemeral ? 32768 | 64 : 32768;
  }

  /**
   * Payload completo { flags, components: [container] } pronto para
   * editOriginal / followUp / reply.
   *
   * @param {object[]} blocks
   * @param {{ accentColor?: number, ephemeral?: boolean }} opts
   */
  cv2Payload(blocks, opts = {}) {
    return {
      flags:      this.cv2Flags(opts.ephemeral ?? true),
      components: [this.cv2Container(blocks, opts)]
    };
  }

  /* ── Modal helpers (type 18) ──
     Sem acesso à interação aqui (usados por FlowBuilder/CommandBuilder
     em dezenas de call sites); os defaults abaixo usam o idioma padrão
     do sistema quando o chamador não define um label customizado. */

  modalSelect(customId, label, options, opts = {}) {
    return {
      type:        18,
      label,
      description: opts.description,
      component: {
        type:        3,
        custom_id:   customId,
        placeholder: opts.placeholder || this.t('modal_choose_option', {}),
        min_values:  opts.required === false ? 0 : 1,
        max_values:  1,
        options
      }
    };
  }

  modalYesNo(customId, label, opts = {}) {
    return this.modalSelect(customId, label, [
      { label: opts.yesLabel || this.t('modal_yes', {}), value: 'true',  default: opts.defaultValue === 'true' },
      { label: opts.noLabel  || this.t('modal_no', {}), value: 'false', default: opts.defaultValue === 'false' },
    ], { placeholder: opts.placeholder || this.t('modal_yesno_placeholder', {}) });
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

  _paginationRow(user, page, maxPage, onPrev, onNext, ctx = {}) {
    const btnPrev = this.btn(user, this.t('btn_prev', ctx), page === 0 ? 2 : 1, async (i) => {
      await this.deferUpdate(i);
      return onPrev(i, page - 1);
    });
    const btnNext = this.btn(user, this.t('btn_next', ctx), page >= maxPage ? 2 : 1, async (i) => {
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
     TELA: HOME  ─ Components V2
     ═══════════════════════════════════════════ */

  async open(interaction) {
    const user    = interaction.member?.user?.id || interaction.user?.id;
    const guildId = interaction.guild_id;

    const engine = this.client.logicEngine;
    const flows  = await engine.getFlows(guildId);
    this._setCache(guildId, 'flows', flows);

    const { CustomCommandModel } = require('../../../Mongodb/flow.js');
    const cmdCount = await CustomCommandModel.countDocuments({ guildId });

    return this.editOriginal(interaction, this._homePayload(interaction, user, flows, cmdCount));
  }

  _homePayload(interaction, user, flows, cmdCount) {
    const enabled  = flows.filter(f => f.enabled).length;
    const disabled = flows.length - enabled;
    const ctx      = this._tctx(interaction);

    const btnFlows = this.btn(user, this.t('btn_flows', { ...ctx, count: flows.length }), 1, async (i) => {
      await this.deferUpdate(i);
      return this.flowList(i, user, 0);
    });

    const btnCmds = this.btn(user, this.t('btn_commands', { ...ctx, count: cmdCount }), 2, async (i) => {
      await this.deferUpdate(i);
      return this.commandList(i, user, 0);
    });

    const btnNew = this.btn(user, this.t('btn_new_flow', ctx), 3, async (i) => {
      return this.flowBuilder.startCreate(i, user);
    });

    /* ── Blocos Components V2 ── */
    const blocks = [
      this.cv2Text(this.t('home_title', ctx)),
      this.cv2Divider(),
      this.cv2Section(
        this.t('flows_section', { ...ctx, total: flows.length, enabled, disabled }),
        btnFlows
      ),
      this.cv2Divider(),
      this.cv2Section(
        this.t('commands_section', { ...ctx, count: cmdCount }),
        btnCmds
      ),
      this.cv2Divider(),
      this.row(btnNew, this._guideButton(ctx)),
      this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),

    ];

    return this.cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main });
  }

  /* ═══════════════════════════════════════════
     TELA: LISTA DE FLUXOS  ─ Components V2
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

    const ctx = this._tctx(interaction);

    const btnCreate = this.btn(user, this.t('btn_new_flow', ctx), 3, async (i) => {
      return this.flowBuilder.startCreate(i, user);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.open(i);
    });

    if (!flows.length) {
      const blocks = [
        this.cv2Text(this.t('no_flows_title', ctx)),
        this.cv2Divider(),
        this.row(btnCreate, btnBack, this._guideButton(ctx)),
        this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
      ];
      return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
    }

    const { page: safePage, maxPage } = this._clampPage(page, flows.length);
    const pageItems = this._pageSlice(flows, safePage);

    const statusLabel = (enabled) => enabled ? this.t('flow_status_active', ctx) : this.t('flow_status_disabled', ctx);

    const options = pageItems.map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${this._triggerLabel(f.trigger, ctx)} • ${statusLabel(f.enabled)}`,
      emoji:       { name: f.enabled ? '🟢' : '🔴' }
    }));

    const sel = this.select(user, options, this.t('select_flow_placeholder', ctx), async (i) => {
      await this.deferUpdate(i);
      return this.flowMenu(i, user, i.data.values[0]);
    });

    const listText = pageItems
      .map(f => `${f.enabled ? '🟢' : '🔴'} **${f.name}** \`(${this._triggerLabel(f.trigger, ctx)})\``)
      .join('\n');

    const blocks = [
      this.cv2Text(this.t('flows_list_title', { ...ctx, count: flows.length, page: safePage + 1, maxPage: maxPage + 1, list: listText })),
      this.cv2Divider(),
      this.row(sel),
      this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
    ];

    if (maxPage > 0) {
      blocks.push(
        this._paginationRow(
          user, safePage, maxPage,
          (i, p) => this.flowList(i, user, p),
          (i, p) => this.flowList(i, user, p),
          ctx
        )
      );
    }

    blocks.push(this.cv2Divider());
    blocks.push(this.row(btnCreate, btnBack, this._guideButton(ctx)));

    return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
  }

  /* ═══════════════════════════════════════════
     TELA: MENU DO FLUXO  ─ Components V2
     ═══════════════════════════════════════════ */

  async flowMenu(interaction, user, flowId) {
    const guildId = interaction.guild_id;
    const { FlowModel } = require('../../../Mongodb/flow.js');
    const flow = await FlowModel.findOne({ flowId, guildId }).lean();
    const ctx  = this._tctx(interaction);

    if (!flow) {
      return this.followUpEphemeral(interaction, this.cv2Payload([
        this.cv2Text(`❌ Fluxo não encontrado. ${this._e('assustada')}`)
      ]));
    }

    const status       = flow.enabled ? this.t('flow_status_active', ctx) : this.t('flow_status_paused', ctx);
    const triggerLabel = this._triggerLabel(flow.trigger, ctx);
    const runs         = flow.stats?.totalRuns   || 0;
    const ok           = flow.stats?.successRuns || 0;
    const fail         = flow.stats?.failedRuns  || 0;
    const ayami        = this._e(flow.enabled ? 'feliz' : 'sonolenta');

    const btnTrigger = this.btn(user, this.t('btn_trigger', ctx), 1, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.triggerMenu(i, user, flowId);
    });

    const btnConditions = this.btn(user, this.t('btn_conditions', { ...ctx, count: flow.conditions?.length || 0 }), 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.conditionsMenu(i, user, flowId);
    });

    const btnActions = this.btn(user, this.t('btn_actions', { ...ctx, count: flow.actions?.length || 0 }), 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.actionsMenu(i, user, flowId);
    });

    const btnVars = this.btn(user, this.t('btn_vars', { ...ctx, count: flow.variables?.length || 0 }), 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.variablesMenu(i, user, flowId);
    });

    const btnSettings = this.btn(user, this.t('btn_settings', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowBuilder.settingsMenu(i, user, flowId);
    });

    const btnToggle = this.btn(
      user,
      flow.enabled ? this.t('btn_toggle_pause', ctx) : this.t('btn_toggle_activate', ctx),
      flow.enabled ? 4 : 3,
      async (i) => {
        await this.deferUpdate(i);
        await this.client.logicEngine.toggleFlow(flowId, guildId);
        this.invalidateCache(guildId);
        return this.flowMenu(i, user, flowId);
      }
    );

    const btnDelete = this.btn(user, this.t('btn_delete_flow', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      return this._confirmDelete(i, user, flowId, flow.name);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowList(i, user, 0);
    });

    const cooldownText = flow.cooldown > 0 ? `${flow.cooldown / 1000}s` : this.t('no_cooldown', ctx);

    const blocks = [
      this.cv2Text(this.t('flow_menu_header', { ...ctx, ayami, name: flow.name, description: flow.description || this.t('no_description_italic', ctx) })),
      this.cv2Divider(),
      this.cv2Section(
        this.t('flow_status_line', { ...ctx, status, trigger: triggerLabel, cooldown: cooldownText }),
        btnTrigger
      ),
      this.cv2Divider(),
      this.cv2Section(
        this.t('flow_conditions_actions_line', { ...ctx, conditions: flow.conditions?.length || 0, actions: flow.actions?.length || 0 }),
        btnConditions
      ),
      this.cv2Divider(),
      this.cv2Section(
        this.t('flow_executions_line', { ...ctx, ok, fail, total: runs }),
        btnActions
      ),
      this.cv2Divider(),
      this.row(btnVars, btnSettings),
      this.row(btnToggle, btnDelete, btnBack, this._guideButton(ctx)),
    ];

    return this.editOriginal(interaction, this.cv2Payload(blocks, {
      ephemeral:   false,
      accentColor: flow.enabled ? COLOR.success : COLOR.danger
    }));
  }

  /* ═══════════════════════════════════════════
     CONFIRMAR EXCLUSÃO  ─ Components V2
     ═══════════════════════════════════════════ */

  async _confirmDelete(interaction, user, flowId, flowName) {
    const ctx = this._tctx(interaction);

    const btnConfirm = this.btn(user, this.t('btn_confirm_delete', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      await this.client.logicEngine.deleteFlow(flowId, i.guild_id);
      this.invalidateCache(i.guild_id);
      await this.followUpEphemeral(i, this.cv2Payload([
        this.cv2Text(this.t('flow_deleted_success', { ...this._tctx(i), name: flowName }))
      ]));
      return this.flowList(i, user, 0);
    });

    const btnCancel = this.btn(user, this.t('btn_cancel', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.cv2Text(this.t('flow_delete_confirm_title', { ...ctx, name: flowName })),
      this.cv2Divider(),
      this.row(btnConfirm, btnCancel),
    ];

    return this.editOriginal(interaction, this.cv2Payload(blocks, {
      ephemeral:   false,
      accentColor: COLOR.danger
    }));
  }

  /* ═══════════════════════════════════════════
     TELA: LISTA DE COMANDOS  ─ Components V2
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

    const ctx = this._tctx(interaction);

    const btnCreate = this.btn(user, this.t('btn_new_command', ctx), 3, async (i) => {
      await this.deferUpdate(i);
      return this.cmdBuilder.startCreate(i, user);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.open(i);
    });

    if (!commands.length) {
      const blocks = [
        this.cv2Text(this.t('no_commands_title', ctx)),
        this.cv2Divider(),
        this.row(btnCreate, btnBack, this._guideButton(ctx)),
        this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
      ];
      return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
    }

    const { page: safePage, maxPage } = this._clampPage(page, commands.length);
    const pageItems = this._pageSlice(commands, safePage);

    const options = pageItems.map(c => ({
      label:       `${c.prefix}${c.name}`.slice(0, 100),
      value:       c.commandId,
      description: c.description?.slice(0, 100) || this.t('no_description', ctx),
      emoji:       { name: c.enabled ? '🟢' : '🔴' }
    }));

    const sel = this.select(user, options, this.t('select_command_placeholder', ctx), async (i) => {
      await this.deferUpdate(i);
      return this.cmdBuilder.commandMenu(i, user, i.data.values[0]);
    });

    const listText = pageItems
      .map(c => `${c.enabled ? '🟢' : '🔴'} **${c.prefix}${c.name}** \`${c.description?.slice(0, 50) || this.t('no_description_lower_italic', ctx)}\``)
      .join('\n');

    const blocks = [
      this.cv2Text(this.t('commands_list_title', { ...ctx, count: commands.length, page: safePage + 1, maxPage: maxPage + 1, list: listText })),
      this.cv2Divider(),
      this.row(sel),
      this.cv2Gallery('https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281'),
    ];

    if (maxPage > 0) {
      blocks.push(
        this._paginationRow(
          user, safePage, maxPage,
          (i, p) => this.commandList(i, user, p),
          (i, p) => this.commandList(i, user, p),
          ctx
        )
      );
    }

    blocks.push(this.cv2Divider());
    blocks.push(this.row(btnCreate, btnBack, this._guideButton(ctx)));

    return this.editOriginal(interaction, this.cv2Payload(blocks, { ephemeral: false }));
  }

  /* ═══════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════ */

  _triggerLabel(trigger, ctx = {}) {
    if (!trigger) return this.t('trigger_not_configured', ctx);
    const labels = {
      'message:message_created':          this.t('trigger_message_created', ctx),
      'message:message_edited':           this.t('trigger_message_edited', ctx),
      'message:message_deleted':          this.t('trigger_message_deleted', ctx),
      'message:message_contains_text':    this.t('trigger_message_contains_text', ctx),
      'message:message_contains_link':    this.t('trigger_message_contains_link', ctx),
      'message:message_contains_image':   this.t('trigger_message_contains_image', ctx),
      'message:message_contains_file':    this.t('trigger_message_contains_file', ctx),
      'message:message_contains_mention': this.t('trigger_message_contains_mention', ctx),
      'message:message_contains_emoji':   this.t('trigger_message_contains_emoji', ctx),
      'message:message_contains_sticker': this.t('trigger_message_contains_sticker', ctx),
      'member:member_joined':             this.t('trigger_member_joined', ctx),
      'member:member_left':               this.t('trigger_member_left', ctx),
      'member:member_banned':             this.t('trigger_member_banned', ctx),
      'member:member_unbanned':           this.t('trigger_member_unbanned', ctx),
      'member:member_nick_changed':       this.t('trigger_member_nick_changed', ctx),
      'reaction:reaction_added':          this.t('trigger_reaction_added', ctx),
      'reaction:reaction_removed':        this.t('trigger_reaction_removed', ctx),
      'voice:voice_joined':               this.t('trigger_voice_joined', ctx),
      'voice:voice_left':                 this.t('trigger_voice_left', ctx),
      'voice:voice_moved':                this.t('trigger_voice_moved', ctx),
      'voice:camera_on':                  this.t('trigger_camera_on', ctx),
      'voice:camera_off':                 this.t('trigger_camera_off', ctx),
      'voice:screen_share_start':         this.t('trigger_screen_share_start', ctx),
      'voice:screen_share_stop':          this.t('trigger_screen_share_stop', ctx),
      'component:button_clicked':         this.t('trigger_button_clicked', ctx),
      'component:select_used':            this.t('trigger_select_used', ctx),
      'component:modal_submitted':        this.t('trigger_modal_submitted', ctx),
      'channel:channel_created':          this.t('trigger_channel_created', ctx),
      'channel:channel_deleted':          this.t('trigger_channel_deleted', ctx),
      'channel:channel_updated':          this.t('trigger_channel_updated', ctx),
      'internal:custom_event':            this.t('trigger_custom_event', ctx),
      'time:scheduled_trigger':           this.t('trigger_scheduled_trigger', ctx),
      'command:command_executed':         this.t('trigger_command_executed', ctx)
    };
    return labels[`${trigger.category}:${trigger.type}`] || `${trigger.category}/${trigger.type}`;
  }
}

module.exports = FlowUI;
