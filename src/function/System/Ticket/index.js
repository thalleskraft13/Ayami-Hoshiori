'use strict';

const DiscordRequest      = require('../../DiscordRequest.js');
const { localeCtx }       = require('../../Utils/ctxLocale.js');
const { GuildDb: GuildModel } = require('../../../Mongodb/guild.js');
const AutoRoleManager     = require('./AutoRoleManager.js');
const SeqQuestionsManager = require('./SeqQuestionsManager.js');
const TranscriptManager   = require('./TranscriptManager.js');
const EmbedBuilderUI      = require('./EmbedBuilderUI.js');
const ComponentsV2Renderer = require('./ComponentsV2Renderer.js');
const { randomUUID }      = require('crypto');
const PremiumManager      = require('../../Utils/PremiumManager.js');
const { getPlan }         = require('../../Utils/PremiumPlans.js');

// Tipos de pergunta "avançados" — contam contra o limite separado do
// plano (plan.tickets.advancedTypeLimit). Texto curto/longo, número e
// sim/não são "básicos" e só contam contra o limite total de perguntas.
const ADVANCED_QUESTION_TYPES = new Set(['select', 'multiple', 'checkbox', 'attachment', 'member', 'role', 'channel']);

/**
 * Valores do campo TYPE do evento `ticketUpdate` do Logic Script —
 * números (não strings), conforme documentado em
 * /docs/reference/enums/ticket-update-type no site.
 */
const TICKET_UPDATE_TYPE = { CRIADO: 1, FECHADO: 2 };

/* ─────────────────────────────────────────────
   CORES DA AYAMI (mesma paleta do Logic Builder)
   ───────────────────────────────────────────── */
const COLOR = {
  main:    0x7C8FFF,
  gold:    0xFFD966,
  dark:    0x243B7A,
  pink:    0xFFB6C8,
  danger:  0xED4245,
  success: 0x57F287,
};

/* ═══════════════════════════════════════════════════════════
   HELPERS COMPONENTS V2
   (mesmo padrão usado em todo o resto do bot)
   ═══════════════════════════════════════════════════════════ */

function cv2Text(content) {
  return { type: 10, content };
}

function cv2Divider(spacing = 1) {
  return { type: 14, divider: true, spacing };
}

function cv2Section(content, accessory) {
  return { type: 9, accessory, components: [cv2Text(content)] };
}

function cv2Container(blocks, opts = {}) {
  return {
    type:         17,
    accent_color: opts.accentColor ?? COLOR.main,
    spoiler:      opts.spoiler ?? false,
    components:   blocks
  };
}

function cv2Flags(ephemeral = false) {
  return ephemeral ? 32768 | 64 : 32768;
}

function cv2Payload(blocks, opts = {}) {
  return {
    flags:      cv2Flags(opts.ephemeral ?? false),
    components: [cv2Container(blocks, opts)]
  };
}

function row(...components) {
  return { type: 1, components };
}

/**
 * Resolve uma mensagem customizável do painel, com fallback para o
 * texto padrão (Ayami) caso o usuário não tenha personalizado.
 * Substitui {user}, {id} e {count} quando fornecidos no contexto.
 */
function resolveMsg(panel, key, fallback, ctx = {}) {
  let text = panel.mensagensConfig?.[key] || fallback;
  if (ctx.userId)  text = text.replaceAll('{user}', `<@${ctx.userId}>`).replaceAll('{id}', ctx.userId);
  if (ctx.count != null) text = text.replaceAll('{count}', String(ctx.count));
  if (ctx.timeout != null) text = text.replaceAll('{timeout}', String(ctx.timeout));
  return text;
}

class TicketSystem {

  constructor(client) {
    this.client = client;
    this.autoRoleManager = new AutoRoleManager(client);
  }

  _e(name) {
    return this.client?.emoji?.[name] ?? '';
  }

  /** Atalho pra tradução de uma chave do sistema "ticket". */
  t(key, ctx) {
    return this.client.t(`ticket.${key}`, ctx);
  }

  /**
   * Contexto de tradução padrão: locale resolvido da interação +
   * atalhos pros emojis mais usados nas mensagens do sistema.
   */
  _tctx(interaction, extra = {}) {
    return localeCtx(interaction, {
      animada:   this._e('animada'),
      feliz:     this._e('feliz'),
      carinho:   this._e('carinho'),
      emburrada: this._e('emburrada'),
      pensando:  this._e('pensando'),
      curtida:   this._e('curtida'),
      emduvida:  this._e('emduvida'),
      assustada: this._e('assustada'),
      festa:     this._e('festa'),
      chorando:  this._e('chorando'),
      ...extra,
    });
  }

  /** Opções do tipo de pergunta (form sequencial), traduzidas. */
  _questionTypeChoices(ctx) {
    return [
      { label: this.t('qtype_short_label', ctx),      value: 'short',      description: this.t('qtype_short_desc', ctx) },
      { label: this.t('qtype_long_label', ctx),       value: 'long',       description: this.t('qtype_long_desc', ctx) },
      { label: this.t('qtype_number_label', ctx),     value: 'number',     description: this.t('qtype_number_desc', ctx) },
      { label: this.t('qtype_yesno_label', ctx),      value: 'yesno',      description: this.t('qtype_yesno_desc', ctx) },
      { label: this.t('qtype_select_label', ctx),     value: 'select',     description: this.t('qtype_select_desc', ctx) },
      { label: this.t('qtype_multiple_label', ctx),   value: 'multiple',   description: this.t('qtype_multiple_desc', ctx) },
      { label: this.t('qtype_checkbox_label', ctx),   value: 'checkbox',   description: this.t('qtype_checkbox_desc', ctx) },
      { label: this.t('qtype_member_label', ctx),     value: 'member',     description: this.t('qtype_member_desc', ctx) },
      { label: this.t('qtype_role_label', ctx),       value: 'role',       description: this.t('qtype_role_desc', ctx) },
      { label: this.t('qtype_channel_label', ctx),    value: 'channel',    description: this.t('qtype_channel_desc', ctx) },
      { label: this.t('qtype_attachment_label', ctx), value: 'attachment', description: this.t('qtype_attachment_desc', ctx) },
    ];
  }

  /* ═══════════════════════════════════════
     HELPERS — DISCORD
  ═══════════════════════════════════════ */

  /**
   * Responde diretamente à interação (type 4).
   * Delega para o InteractionManager do framework, que mantém o
   * Map `_states` sincronizado (replied/deferred) — bater direto no
   * Discord por fora disso causava dessincronia: em caso de erro
   * subsequente, `_replyError` tentava reconhecer a interação de
   * novo (achando que ainda não tinha sido respondida) e batia em
   * "Unknown interaction" / "Unknown Webhook" (404).
   */
  async reply(interaction, data) {
    return this.client.interactions._callback(interaction, { type: 4, data });
  }

  async deferUpdate(interaction) {
    return this.client.interactions.defer(interaction);
  }

  /**
   * Edita a "mensagem original" do painel. Normalmente relativo a
   * @original do token da interação atual — mas se a interação foi
   * marcada com `__rootOverride` (acontece depois do embed builder,
   * que roda num followUp com token próprio), edita a mensagem raiz
   * real via REST puro por channelId+messageId. Mesmo padrão do
   * Logic Builder.
   */
  async editOriginal(interaction, data) {
    if (interaction.__rootOverride) {
      const { channelId, messageId } = interaction.__rootOverride;
      return DiscordRequest(
        `/channels/${channelId}/messages/${messageId}`,
        { method: 'PATCH', body: data }
      );
    }
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body: data }
    );
  }

  async followUpEphemeral(interaction, data) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}`,
      { method: 'POST', body: { ...data, flags: (data.flags ?? 32768) | 64 } }
    );
  }

  btn(user, label, style, func, opts = {}) {
    return this.client.interactions.createButton({ user, data: { label, style, disabled: opts.disabled }, funcao: func });
  }

  select(user, options, placeholder, func, opts = {}) {
    return this.client.interactions.createSelect({ user, data: { placeholder, options, min_values: opts.minValues, max_values: opts.maxValues }, funcao: func });
  }

  async _ask(interaction, question, opts = {}) {
    // Correção: a interação precisa ser reconhecida ANTES de mandar um
    // follow-up (POST /webhooks/.../{token}) — senão o Discord ainda não
    // criou o "webhook" da interação e a chamada abaixo falha com
    // 404 "Unknown Webhook", derrubando a interação inteira pro usuário
    // ("a interação falhou"), mesmo o bot respondendo depois.
    // deferUpdate (type 6) reconhece SEM alterar a mensagem do painel,
    // então @original continua apontando pro painel — o editOriginal()
    // que roda depois de receber a resposta continua funcionando normal.
    await this.deferUpdate(interaction);

    await this.followUpEphemeral(interaction, cv2Payload([
      cv2Text(question),
      cv2Divider(),
      cv2Text('-# Digite "cancelar" para cancelar. Tempo: 2 minutos.'),
    ], { accentColor: COLOR.main, ephemeral: true }));

    try {
      const msg = await this.client.NextMessageCollector.wait({
        channelId: interaction.channel_id,
        userId:    interaction.member?.user?.id || interaction.user?.id,
        timeout:   120_000,
      });
      if (msg.content?.toLowerCase() === 'cancelar') return null;
      return msg.content;
    } catch {
      return null;
    }
  }

  async _getGuildDoc(guildId) {
    return GuildModel.findOne({ guildId });
  }

  _findPanel(guildDoc, panelId) {
    return guildDoc.ticket?.find(t => t.panelId === panelId);
  }

  _uid() {
    return randomUUID().replace(/-/g, '').slice(0, 16);
  }

  /** Resolve o plano premium da guild (FREE se não houver nenhum ativo). */
  async _getGuildPlan(guildId) {
    const premium = await PremiumManager.getGuildPremium(guildId).catch(() => ({ status: false }));
    return premium.status ? premium.plan : getPlan(null);
  }

  /**
   * O evento `ticketUpdate` e a função `abrirTicket()` do Logic Script
   * são recursos Premium — liberados a partir do plano 🌟 Nova Estrela
   * (ver `logicScript.premiumEvents` em Utils/PremiumPlans.js, espelhado
   * em site/config/premiumPlans.js).
   */
  async _isPremiumEventsEnabled(guildId) {
    const plan = await this._getGuildPlan(guildId);
    return !!plan?.logicScript?.premiumEvents;
  }

  /**
   * Dispara o evento `ticketUpdate` pro Logic Script E o trigger
   * "🎫 Ticket atualizado" pro Logic Builder da guild, se o plano
   * permitir. `payload.TYPE` é sempre um número (ver TICKET_UPDATE_TYPE) —
   * no Logic Builder isso vira o filtro por select (aberto/fechado), não
   * um campo pra digitar. Nunca lança — é best-effort, igual ao resto dos
   * side-effects deste sistema (auto-cargo, transcript, etc.).
   */
  _emitTicketUpdate(guildId, payload) {
    const runner = this.client?.logicScriptRunner;
    if (runner) {
      runner.emitCustomEvent(guildId, 'ticketUpdate', {
        channelId: payload.channelId,
        customData: payload,
      }).catch(err => console.error('[TicketSystem] Erro ao emitir ticketUpdate (Logic Script):', err.message));
    }

    const registry = this.client?.logicEngine?.triggerRegistry;
    if (registry) {
      registry.emitExternal('ticket', 'ticket_update', {
        guildId,
        channelId: payload.channelId,
        userId: payload.openedBy || payload.closedBy || null,
        customData: payload,
      });
    }
  }

  /**
   * Checa se a guild ainda pode adicionar uma pergunta do `tipo` informado
   * a essa lista de perguntas, respeitando os limites do plano:
   *   - total de perguntas (plan.tickets.maxQuestions)
   *   - perguntas de tipo avançado — seleção/múltipla escolha/checkbox/
   *     anexo/membro/cargo/canal (plan.tickets.advancedTypeLimit)
   * Retorna { ok: true, plan } ou { ok: false, motivo, plan }.
   */
  async _checkSeqQuestionLimit(guildId, existingQuestions, tipo, ctx) {
    const plan = await this._getGuildPlan(guildId);
    const questions = existingQuestions || [];

    const maxQuestions = plan.tickets?.maxQuestions ?? 10;
    if (questions.length >= maxQuestions) {
      return {
        ok: false,
        plan,
        motivo: this.t('question_limit_reached', { ...ctx, planEmoji: plan.emoji, planName: plan.name, max: maxQuestions === Infinity ? this.t('infinity_symbol', ctx) : maxQuestions }),
      };
    }

    if (ADVANCED_QUESTION_TYPES.has(tipo)) {
      const advancedLimit = plan.tickets?.advancedTypeLimit ?? 0;
      const advancedCount = questions.filter(q => ADVANCED_QUESTION_TYPES.has(q.tipo)).length;
      if (advancedCount >= advancedLimit) {
        return {
          ok: false,
          plan,
          motivo: this.t('advanced_question_limit_reached', { ...ctx, planEmoji: plan.emoji, planName: plan.name, max: advancedLimit === Infinity ? this.t('infinity_symbol', ctx) : advancedLimit }),
        };
      }
    }

    return { ok: true, plan };
  }

  /* ═══════════════════════════════════════
     ABERTURA / LISTA DE PAINÉIS
  ═══════════════════════════════════════ */

  async open(interaction) {
    const user    = interaction.member?.user?.id || interaction.user?.id;
    const guildId = interaction.guild_id;
    const doc     = await this._getGuildDoc(guildId);
    const panels  = doc?.ticket || [];

    return this.editOriginal(interaction, this._homePayload(interaction, user, panels));
  }

  _homePayload(interaction, user, panels) {
    const ctx = this._tctx(interaction);

    const btnList = this.btn(user, this.t('btn_panels', { ...ctx, count: panels.length }), 1, async (i) => {
      await this.deferUpdate(i);
      return this.painelList(i, user);
    });

    const btnNew = this.btn(user, this.t('btn_new_panel', ctx), 3, async (i) => this.criar(i, user));

    const blocks = [
      cv2Text(this.t('home_title', { ...ctx, corao: this._e('corao') })),
      cv2Divider(),
      row(btnList, btnNew),
    ];

    return cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main });
  }

  async painelList(interaction, user) {
    const guildId = interaction.guild_id;
    const doc     = await this._getGuildDoc(guildId);
    const panels  = doc?.ticket || [];
    const ctx     = this._tctx(interaction);

    const btnNew  = this.btn(user, this.t('btn_new_panel', ctx), 3, async (i) => this.criar(i, user));
    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.open(i);
    });

    if (!panels.length) {
      const blocks = [
        cv2Text(this.t('no_panels_title', ctx)),
        cv2Divider(),
        row(btnNew, btnBack),
      ];
      return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false }));
    }

    const options = panels.map(p => ({
      label:       (p.painelPrincipal?.title || p.panelId).slice(0, 100),
      value:       p.panelId,
      description: this.t('panel_option_desc', { ...ctx, staffCount: p.cargosStaff?.length || 0, hubLabel: p.selectMenuConfig?.enabled ? this.t('panel_hub_multi', ctx) : this.t('panel_hub_single', ctx) })
    }));

    const sel = this.select(user, options, this.t('select_which_panel', ctx), async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, i.data.values[0]);
    });

    const listText = panels
      .map(p => `🎫 **${p.painelPrincipal?.title || p.panelId}**`)
      .join('\n');

    const blocks = [
      cv2Text(this.t('panels_title', { ...ctx, count: panels.length, list: listText })),
      cv2Divider(),
      row(sel),
      cv2Divider(),
      row(btnNew, btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false }));
  }

  /* ═══════════════════════════════════════
     CRIAR PAINEL
  ═══════════════════════════════════════ */

  async criar(interaction, user) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('modal_create_panel_title', ctx),
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'panelId', label: this.t('modal_panel_id_label', ctx), style: 1, required: true, max_length: 50, placeholder: this.t('modal_panel_id_placeholder', ctx) }] }
      ],
      funcao: async (mi, client, fields) => {
        const miCtx = this._tctx(mi);
        const panelId = fields.panelId?.trim().toLowerCase().replace(/\s+/g, '_');
        if (!panelId) {
          return this.client.interactions._callback(mi, { type: 4, data: { content: this.t('invalid_id', miCtx), flags: 64 } });
        }

        const doc = await this._getGuildDoc(mi.guild_id) || new GuildModel({ guildId: mi.guild_id });
        if (this._findPanel(doc, panelId)) {
          return this.client.interactions._callback(mi, { type: 4, data: { content: this.t('panel_id_exists', { ...miCtx, panelId }), flags: 64 } });
        }

        doc.ticket = doc.ticket || [];
        doc.ticket.push({ panelId });
        await doc.save();

        await this.client.interactions._callback(mi, { type: 4, data: this._homePayload(mi, user, doc.ticket) });

        return this.painelMenu(mi, user, panelId);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ═══════════════════════════════════════
     MENU DO PAINEL
  ═══════════════════════════════════════ */

  async painelMenu(interaction, user, panelId, { successMsg } = {}) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const ctx   = this._tctx(interaction);

    if (!panel) {
      return this.followUpEphemeral(interaction, cv2Payload([
        cv2Text(this.t('panel_not_found', ctx))
      ]));
    }

    const hasEmbed   = !!panel.painelPrincipal;
    const hubEnabled = panel.selectMenuConfig?.enabled;
    const tipoLabels = [this.t('tipo_label_channel', ctx), this.t('tipo_label_thread_public', ctx), this.t('tipo_label_thread_private', ctx)];
    const statusLabel = (enabled) => enabled ? this.t('opt_active', ctx) : this.t('opt_inactive', ctx);

    const navSelect = this.select(user, [
      { label: hasEmbed ? this.t('opt_edit_embed', ctx) : this.t('opt_create_embed', ctx), value: 'embed', description: this.t('opt_embed_desc', ctx) },
      { label: this.t('opt_channel_category', ctx),     value: 'destino',  description: panel.canalId ? this.t('opt_configured', ctx) : this.t('opt_not_configured', ctx) },
      { label: this.t('opt_staff_name', ctx),          value: 'staff',    description: this.t('opt_staff_name_desc', ctx) },
      { label: this.t('opt_creation_type', ctx),       value: 'tipo',     description: tipoLabels[panel.tipoDeCriacao] || tipoLabels[0] },
      { label: this.t('opt_modal', ctx),                value: 'modal',    description: statusLabel(panel.modalConfig?.enabled) },
      { label: this.t('opt_seqform', ctx),       value: 'seqform',  description: statusLabel(panel.seqQuestionsConfig?.enabled) },
      { label: this.t('opt_autorole', ctx),           value: 'autorole', description: statusLabel(panel.autoRoleConfig?.enabled) },
      { label: this.t('opt_transcript', ctx),            value: 'transcript', description: statusLabel(panel.transcriptConfig?.enabled) },
      { label: this.t('opt_selecthub', ctx),           value: 'selecthub', description: hubEnabled ? this.t('opt_selecthub_desc', { ...ctx, count: panel.selectMenuConfig.options.length }) : this.t('opt_inactive', ctx) },
      { label: this.t('opt_messages', ctx),             value: 'mensagens', description: this.t('opt_messages_desc', ctx) },
    ], this.t('select_what_configure', ctx), async (i) => {
      await this.deferUpdate(i);
      const dest = {
        embed: async () => EmbedBuilderUI.open(i, this.client, {
          user,
          existingEmbed: panel.painelPrincipal,
          title: this.t('embed_title_prefix', { ...ctx, panelId }),
          onDone: async (rootInteraction, embedResult) => {
            const freshDoc   = await this._getGuildDoc(rootInteraction.guild_id);
            const freshPanel = this._findPanel(freshDoc, panelId);
            freshPanel.painelPrincipal = embedResult;
            await freshDoc.save();
            return this.painelMenu(rootInteraction, user, panelId, {
              successMsg: embedResult ? this.t('embed_updated', this._tctx(rootInteraction)) : this.t('embed_removed', this._tctx(rootInteraction))
            });
          }
        }),
        destino:    () => this.destinoMenu(i, user, panelId),
        staff:      () => this.staffNomeMenu(i, user, panelId),
        tipo:       () => this.tipoCriacaoMenu(i, user, panelId),
        modal:      () => this.modalMenu(i, user, panelId),
        seqform:    () => this.seqFormMenu(i, user, panelId),
        autorole:   () => this.autoRoleMenu(i, user, panelId),
        transcript: () => this.transcriptMenu(i, user, panelId),
        selecthub:  () => this.selectHubMenu(i, user, panelId),
        mensagens:  () => this.mensagensMenu(i, user, panelId),
      };
      return dest[i.data.values[0]]?.();
    });

    const btnPublish = this.btn(user, this.t('btn_publish', ctx), 3, async (i) => {
      await this.deferUpdate(i);
      return this._publicarPainel(i, user, panelId);
    });

    const btnDelete = this.btn(user, this.t('btn_delete', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      return this._confirmDeletePanel(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelList(i, user);
    });

    const blocks = [
      cv2Text(this.t('panel_header', {
        ...ctx,
        panelId,
        successMsg,
        embedStatus:   hasEmbed ? this.t('embed_ready', ctx) : this.t('embed_missing', ctx),
        channelStatus: panel.canalId ? `<#${panel.canalId}>` : this.t('no_channel_chosen', ctx),
        staffStatus:   panel.cargosStaff?.length ? panel.cargosStaff.map(r => `<@&${r}>`).join(', ') : this.t('no_staff_yet', ctx),
        cv2Active:     !!(panel.useComponentsV2 && panel.painelComponentsV2?.length),
      })),
      cv2Divider(),
      row(navSelect),
      row(btnPublish, btnDelete, btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _confirmDeletePanel(interaction, user, panelId) {
    const ctx = this._tctx(interaction);
    const btnConfirm = this.btn(user, this.t('btn_confirm_delete', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const doc = await this._getGuildDoc(i.guild_id);
      doc.ticket = doc.ticket.filter(t => t.panelId !== panelId);
      await doc.save();
      return this.painelList(i, user);
    });
    const btnCancel = this.btn(user, this.t('btn_cancel', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('confirm_delete_title', ctx)),
      cv2Divider(),
      row(btnConfirm, btnCancel),
    ];
    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.danger }));
  }

  /**
   * Monta as linhas de ação (botão único ou select hub) que abrem o
   * ticket. SEMPRE geradas pelo sistema — nunca vêm de dentro dos
   * blocos configurados na Dashboard (ver ComponentsV2Renderer.js).
   */
  _buildOpenTicketRows(panel, panelId, ctx) {
    return panel.selectMenuConfig?.enabled
      ? [row({
          type: 3,
          custom_id: JSON.stringify({ t: 'ticket_select_hub', p: panelId }),
          placeholder: panel.selectMenuConfig.placeholder || this.t('select_service_type_placeholder', ctx),
          options: panel.selectMenuConfig.options.map(o => ({
            label: o.label, value: o.optionId, description: o.description || undefined,
            emoji: o.emoji ? { name: o.emoji } : undefined
          }))
        })]
      : [row({ type: 2, style: 1, label: this.t('open_ticket_button', ctx), custom_id: JSON.stringify({ t: 'create_ticket_select', p: panelId }) })];
  }

  async _publicarPainel(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const ctx   = this._tctx(interaction);

    if (!panel.canalId) {
      return this.painelMenu(interaction, user, panelId, { successMsg: this.t('publish_no_channel', ctx) });
    }
    // Painel em Components V2 (configurado na Dashboard) não depende de
    // painelPrincipal — só o modo embed (bot) exige isso.
    if (!panel.useComponentsV2 && !panel.painelPrincipal) {
      return this.painelMenu(interaction, user, panelId, { successMsg: this.t('publish_no_embed', ctx) });
    }

    const rows = this._buildOpenTicketRows(panel, panelId, ctx);
    const { body } = ComponentsV2Renderer.buildPanelBody(panel, rows);

    // Se já existe uma mensagem publicada, EDITA em vez de duplicar.
    const msg = panel.messageId
      ? await DiscordRequest(`/channels/${panel.canalId}/messages/${panel.messageId}`, { method: 'PATCH', body }).catch(() => null)
      : null;

    const finalMsg = msg || await DiscordRequest(`/channels/${panel.canalId}/messages`, { method: 'POST', body });

    panel.messageId = finalMsg.id;
    await doc.save();

    return this.painelMenu(interaction, user, panelId, { successMsg: this.t('publish_success', { ...ctx, channelId: panel.canalId }) });
  }

  /* ═══════════════════════════════════════
     CANAL & CATEGORIA
  ═══════════════════════════════════════ */

  async destinoMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const ctx   = this._tctx(interaction);

    const chSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: this.t('destino_channel_placeholder', ctx), channel_types: [0, 5] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        this._findPanel(fd, panelId).canalId = i.data.values[0];
        await fd.save();
        return this.destinoMenu(i, user, panelId);
      }
    });

    const catSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: this.t('destino_category_placeholder', ctx), channel_types: [4] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        this._findPanel(fd, panelId).categoriaId = i.data.values[0];
        await fd.save();
        return this.destinoMenu(i, user, panelId);
      }
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('destino_title', {
        ...ctx,
        channelStatus:  panel.canalId ? `<#${panel.canalId}>` : this.t('destino_none_channel', ctx),
        categoryStatus: panel.categoriaId ? `<#${panel.categoriaId}>` : this.t('destino_none_category', ctx),
      })),
      cv2Divider(),
      row(chSel),
      row(catSel),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  /* ═══════════════════════════════════════
     STAFF & NOME DO TICKET
  ═══════════════════════════════════════ */

  async staffNomeMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const ctx   = this._tctx(interaction);

    const roleSel = this.client.interactions.createRoleSelect({
      user, data: { placeholder: this.t('staff_role_select_placeholder', ctx), max_values: 5 },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.cargosStaff = [...new Set([...(fp.cargosStaff || []), ...i.data.values])];
        await fd.save();
        return this.staffNomeMenu(i, user, panelId);
      }
    });

    const btnClearStaff = this.btn(user, this.t('btn_clear_staff', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).cargosStaff = [];
      await fd.save();
      return this.staffNomeMenu(i, user, panelId);
    });

    const btnNome = this.btn(user, this.t('btn_ticket_name', ctx), 2, async (i) => {
      const resp = await this._ask(i, this.t('ask_ticket_name', this._tctx(i)));
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).ticketChatName = resp.trim().slice(0, 90);
      await fd.save();
      return this.staffNomeMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('staff_title', {
        ...ctx,
        staffStatus: panel.cargosStaff?.length ? panel.cargosStaff.map(r => `<@&${r}>`).join(', ') : this.t('no_staff_yet', ctx),
        name: panel.ticketChatName || 'ticket-{count}',
      })),
      cv2Divider(),
      row(roleSel),
      row(btnClearStaff, btnNome),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  /* ═══════════════════════════════════════
     TIPO DE CRIAÇÃO
  ═══════════════════════════════════════ */

  async tipoCriacaoMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const ctx   = this._tctx(interaction);

    const labels = [this.t('tipo_label_channel', ctx), this.t('tipo_label_thread_public', ctx), this.t('tipo_label_thread_private', ctx)];

    const sel = this.select(user, labels.map((l, i) => ({ label: l, value: String(i), description: i === panel.tipoDeCriacao ? this.t('tipo_current_label', ctx) : undefined })), this.t('tipo_select_placeholder', ctx), async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).tipoDeCriacao = Number(i.data.values[0]);
      await fd.save();
      return this.tipoCriacaoMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('tipo_title', { ...ctx, current: labels[panel.tipoDeCriacao] || labels[0] })),
      cv2Divider(),
      row(sel),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  /* ═══════════════════════════════════════
     MODAL PERSONALIZADO
  ═══════════════════════════════════════ */

  async modalMenu(interaction, user, panelId, opts = {}) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const cfg   = panel.modalConfig || { enabled: false, fields: [] };
    const ctx   = this._tctx(interaction);

    const fieldsList = cfg.fields?.length
      ? cfg.fields.map((f, i) => `\`${i + 1}.\` **${f.label}** (${f.style === 2 ? this.t('modal_field_paragraph', ctx) : this.t('modal_field_short', ctx)})${f.required ? this.t('modal_field_required_tag', ctx) : ''}`).join('\n')
      : this.t('modal_no_fields', ctx);

    const btnToggle = this.btn(user, cfg.enabled ? this.t('btn_toggle_modal_off', ctx) : this.t('btn_toggle_modal_on', ctx), cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.modalConfig.enabled = !fp.modalConfig.enabled;
      await fd.save();
      return this.modalMenu(i, user, panelId);
    });

    const btnTitulo = this.btn(user, this.t('btn_modal_title', ctx), 2, async (i) => {
      const resp = await this._ask(i, this.t('ask_modal_title', this._tctx(i)));
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).modalConfig.title = resp.trim().slice(0, 45);
      await fd.save();
      return this.modalMenu(i, user, panelId);
    });

    const btnAddField = this.btn(user, this.t('btn_add_field', ctx), 1, async (i) => {
      return this._modalAddField(i, user, panelId);
    }, { disabled: (cfg.fields?.length || 0) >= 5 });

    const btnRemField = this.btn(user, this.t('btn_remove_field', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).modalConfig.fields.pop();
      await fd.save();
      return this.modalMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('modal_header', {
        ...ctx,
        successMsg: opts.successMsg,
        status: cfg.enabled ? this.t('status_on', ctx) : this.t('status_off', ctx),
        title: cfg.title || this.t('modal_title_default', ctx),
        count: cfg.fields?.length || 0,
        list: fieldsList,
      })),
      cv2Divider(),
      row(btnToggle, btnTitulo),
      row(btnAddField, btnRemField),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _modalAddField(interaction, user, panelId) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('add_field_modal_title', ctx),
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'label', label: this.t('field_label_label', ctx), style: 1, required: true, max_length: 45 }] },
        { type: 1, components: [{ type: 4, custom_id: 'placeholder', label: this.t('field_placeholder_label', ctx), style: 1, required: false, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'style', label: this.t('field_style_label', ctx), style: 1, required: true, max_length: 10, placeholder: this.t('field_style_placeholder', ctx) }] },
        { type: 1, components: [{ type: 4, custom_id: 'required', label: this.t('field_required_label', ctx), style: 1, required: false, max_length: 5, placeholder: this.t('field_required_placeholder', ctx) }] },
      ],
      funcao: async (mi, _, fields) => {
        const fd = await this._getGuildDoc(mi.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.modalConfig = fp.modalConfig || { enabled: true, fields: [] };
        fp.modalConfig.fields = fp.modalConfig.fields || [];
        fp.modalConfig.fields.push({
          customId:    this._uid(),
          label:       fields.label.trim(),
          placeholder: fields.placeholder?.trim() || '',
          style:       (fields.style || '').toLowerCase().startsWith('par') ? 2 : 1,
          required:    !['não', 'nao', 'no', 'n'].includes((fields.required || 'sim').toLowerCase()),
        });
        await fd.save();

        await this.client.interactions._callback(mi, { type: 6 });
        return this.modalMenu(mi, user, panelId, { successMsg: this.t('field_added', this._tctx(mi)) });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ═══════════════════════════════════════
     FORMULÁRIO SEQUENCIAL
  ═══════════════════════════════════════ */

  async seqFormMenu(interaction, user, panelId, opts = {}) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const cfg   = panel.seqQuestionsConfig || { enabled: false, questions: [], timeout: 60000 };
    const plan  = await this._getGuildPlan(interaction.guild_id);
    const maxQ  = plan.tickets?.maxQuestions ?? 10;
    const ctx   = this._tctx(interaction);

    const questionsList = cfg.questions?.length
      ? cfg.questions.map((q, i) => `\`${i + 1}.\` ${q.label} \`[${q.tipo || 'text'}]\`${q.required ? this.t('seq_question_required_tag', ctx) : ''}`).join('\n')
      : this.t('seq_no_questions', ctx);

    const timeoutSec = Math.round((cfg.timeout ?? 60000) / 1000);

    const btnToggle = this.btn(user, cfg.enabled ? this.t('btn_toggle_form_off', ctx) : this.t('btn_toggle_form_on', ctx), cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.seqQuestionsConfig.enabled = !fp.seqQuestionsConfig.enabled;
      await fd.save();
      return this.seqFormMenu(i, user, panelId);
    });

    const btnAddQ = this.btn(user, this.t('btn_add_question', ctx), 1, async (i) => {
      return this._seqAddQuestion(i, user, panelId);
    }, { disabled: (cfg.questions?.length || 0) >= maxQ });

    const btnRemQ = this.btn(user, this.t('btn_remove_question', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).seqQuestionsConfig.questions.pop();
      await fd.save();
      return this.seqFormMenu(i, user, panelId);
    });

    /**
     * Tempo do Form Sequencial — PERSONALIZÁVEL.
     * Select com presets comuns + opção de digitar valor customizado.
     */
    const timeoutSel = this.select(user, [
      { label: this.t('timeout_30s', ctx),  value: '30'  },
      { label: this.t('timeout_1m', ctx),     value: '60'  },
      { label: this.t('timeout_2m', ctx),    value: '120' },
      { label: this.t('timeout_5m', ctx),    value: '300' },
      { label: this.t('timeout_10m', ctx),   value: '600' },
      { label: this.t('timeout_custom', ctx), value: 'custom' },
    ], this.t('timeout_select_placeholder', { ...ctx, seconds: timeoutSec }), async (i) => {
      if (i.data.values[0] === 'custom') {
        const resp = await this._ask(i, this.t('ask_custom_seconds', this._tctx(i)));
        if (resp === null) return;
        const sec = parseInt(resp);
        if (!sec || sec < 5 || sec > 600) {
          await this.followUpEphemeral(i, cv2Payload([cv2Text(this.t('invalid_seconds', this._tctx(i)))], { ephemeral: true }));
          return this.seqFormMenu(i, user, panelId);
        }
        const fd = await this._getGuildDoc(i.guild_id);
        this._findPanel(fd, panelId).seqQuestionsConfig.timeout = sec * 1000;
        await fd.save();
        return this.seqFormMenu(i, user, panelId);
      }
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).seqQuestionsConfig.timeout = Number(i.data.values[0]) * 1000;
      await fd.save();
      return this.seqFormMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    /**
     * Onde mandar o resumo das respostas — só no ticket (padrão) ou
     * também/só num canal de log configurado.
     */
    const sendModeSel = this.select(user, [
      { label: this.t('send_mode_only_ticket', ctx), value: '0', description: cfg.sendMode === 0 ? this.t('selected_label', ctx) : undefined },
      { label: this.t('send_mode_log_channel', ctx), value: '1', description: cfg.sendMode === 1 ? this.t('selected_label', ctx) : undefined },
    ], this.t('send_mode_select_placeholder', ctx), async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).seqQuestionsConfig.sendMode = Number(i.data.values[0]);
      await fd.save();
      return this.seqFormMenu(i, user, panelId);
    });

    const logChSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: this.t('log_channel_select_placeholder', ctx), channel_types: [0, 5] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        this._findPanel(fd, panelId).seqQuestionsConfig.logChannelId = i.data.values[0];
        await fd.save();
        return this.seqFormMenu(i, user, panelId);
      }
    });

    const blocks = [
      cv2Text(this.t('seq_header', {
        ...ctx,
        successMsg: opts.successMsg,
        status: cfg.enabled ? this.t('status_on', ctx) : this.t('status_off', ctx),
        seconds: timeoutSec,
        destination: cfg.sendMode === 1 ? `📋 <#${cfg.logChannelId || '...'}>` : this.t('seq_dest_own_ticket', ctx),
        count: cfg.questions?.length || 0,
        max: maxQ === Infinity ? this.t('infinity_symbol', ctx) : maxQ,
        list: questionsList,
      })),
      cv2Divider(),
      row(btnToggle, btnAddQ, btnRemQ),
      row(timeoutSel),
      row(sendModeSel),
      ...(cfg.sendMode === 1 ? [row(logChSel)] : []),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _seqAddQuestion(interaction, user, panelId) {
    return this._seqAddQuestionGeneric({
      interaction, user,
      guildId:     interaction.guild_id,
      locateTarget: fd => this._findPanel(fd, panelId),
      onAdded:     mi => this.seqFormMenu(mi, user, panelId, { successMsg: this.t('question_added', this._tctx(mi)) }),
    });
  }

  /**
   * Fluxo genérico de "adicionar pergunta sequencial" — usado tanto no
   * form do painel quanto no form embutido numa opção do select menu.
   * Passos: 1) escolher o TIPO da pergunta → 2) checar limite do plano
   * pro tipo escolhido → 3) modal com os campos certos pro tipo → 4) salva.
   *
   * @param {Function} locateTarget (guildDoc) => objeto com .seqQuestionsConfig (painel ou opção)
   * @param {Function} onAdded      (modalInteraction) => tela pra voltar depois de salvar
   */
  async _seqAddQuestionGeneric({ interaction, user, guildId, locateTarget, onAdded }) {
    const ctx = this._tctx(interaction);
    const typeSelect = this.client.interactions.createSelect({
      user,
      tempo: 120_000,
      data: {
        placeholder: this.t('question_type_select_placeholder', ctx),
        options: this._questionTypeChoices(ctx),
      },
      funcao: async (si) => {
        const tipo = si.data.values[0];
        const siCtx = this._tctx(si);

        const fd = await this._getGuildDoc(guildId);
        const target = locateTarget(fd);
        target.seqQuestionsConfig = target.seqQuestionsConfig || { enabled: true, questions: [], timeout: 60000 };
        target.seqQuestionsConfig.questions = target.seqQuestionsConfig.questions || [];

        const check = await this._checkSeqQuestionLimit(guildId, target.seqQuestionsConfig.questions, tipo, siCtx);
        if (!check.ok) {
          return this.client.interactions._callback(si, {
            type: 4,
            data: { content: `🔒 ${check.motivo}`, flags: 64 },
          });
        }

        return this._seqAddQuestionModal(si, user, tipo, async (mi, fields) => {
          const fd2 = await this._getGuildDoc(guildId);
          const target2 = locateTarget(fd2);
          target2.seqQuestionsConfig = target2.seqQuestionsConfig || { enabled: true, questions: [], timeout: 60000 };
          target2.seqQuestionsConfig.questions = target2.seqQuestionsConfig.questions || [];

          const question = {
            id:       this._uid(),
            label:    fields.text.trim(),
            tipo,
            required: !['não', 'nao', 'no', 'n'].includes((fields.required || 'sim').toLowerCase()),
          };
          if (['select', 'multiple', 'checkbox'].includes(tipo)) {
            question.options = (fields.options || '')
              .split(',').map(s => s.trim()).filter(Boolean).slice(0, 25);
          }

          target2.seqQuestionsConfig.questions.push(question);
          await fd2.save();

          await this.client.interactions._callback(mi, { type: 6 });
          return onAdded(mi);
        });
      },
    });

    // Precisa nascer em formato Components V2 (não "content" legado): essa
    // mesma mensagem é convertida depois, via editOriginal()/cv2Payload(),
    // quando o usuário termina o modal (ver seqFormMenu() chamado no fim do
    // fluxo do select acima). Se ela começasse como `content` + action row
    // comum, o PATCH pra Components V2 falharia com "The 'content' field
    // cannot be used when using MessageFlags.IS_COMPONENTS_V2" — o content
    // antigo continua salvo na mensagem até esse ponto, e um PATCH que só
    // adiciona a flag 32768 sem tocar no content não é suficiente pro
    // Discord aceitar a transição. Nascendo já em CV2, nunca existe content
    // legado pra entrar em conflito.
    //
    // type: 7 (UPDATE_MESSAGE) — edita o painel original em vez de criar
    // uma mensagem nova (type: 4). Era esse o bug real: com type 4, o
    // select de tipo virava uma mensagem separada, e toda a cadeia
    // seguinte (modal → salvar → seqFormMenu) ficava presa editando ESSA
    // mensagem nova em vez de voltar pro painel visível — por isso parecia
    // que o resultado final aparecia "de novo" como um followUp solto ao
    // invés de atualizar o painel. O painel do formulário sequencial não é
    // ephemeral (ephemeral: false em seqFormMenu), então mantemos o mesmo
    // aqui — UPDATE_MESSAGE não pode mudar a visibilidade da mensagem.
    return this.client.interactions._callback(interaction, {
      type: 7,
      data: cv2Payload([cv2Text(this.t('flow_intermediate_title', ctx)), row(typeSelect)], { ephemeral: false }),
    });
  }

  /** Monta e exibe o modal certo pro tipo de pergunta escolhido. */
  async _seqAddQuestionModal(interaction, user, tipo, onSubmit) {
    const ctx = this._tctx(interaction);
    const needsOptions = ['select', 'multiple', 'checkbox'].includes(tipo);

    const components = [
      { type: 1, components: [{ type: 4, custom_id: 'text', label: this.t('question_text_label', ctx), style: 2, required: true, max_length: 300 }] },
    ];

    if (needsOptions) {
      components.push({
        type: 1,
        components: [{
          type: 4, custom_id: 'options', style: 2, required: true, max_length: 500,
          label: this.t('question_options_label', ctx),
          placeholder: this.t('question_options_placeholder', ctx),
        }],
      });
    }

    components.push({ type: 1, components: [{ type: 4, custom_id: 'required', label: this.t('question_required_label', ctx), style: 1, required: false, max_length: 5, placeholder: this.t('question_required_placeholder', ctx) }] });

    const modal = this.client.interactions.createModal({
      user,
      title: this.t('add_question_modal_title', ctx),
      components,
      funcao: async (mi, _, fields) => onSubmit(mi, fields),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ═══════════════════════════════════════
     AUTO-CARGO
  ═══════════════════════════════════════ */

  async _autoRoleAskTipo(interaction, user, panelId, roleId) {
    const ctx = this._tctx(interaction);
    const sel = this.select(user, [
      { label: this.t('role_permanent_label', ctx),        value: '0', description: this.t('role_permanent_desc', ctx) },
      { label: this.t('role_temp_select_label', ctx),        value: '1', description: this.t('role_temp_desc', ctx) },
      { label: this.t('role_linked_select_label', ctx), value: '2', description: this.t('role_linked_desc', ctx) },
    ], this.t('role_type_select_label', { ...ctx, roleId }), async (i) => {
      const tipo = Number(i.data.values[0]);
      const iCtx = this._tctx(i, { roleId });

      if (tipo === 1) {
        const resp = await this._ask(i, this.t('ask_role_duration', iCtx));
        if (resp === null) return this.autoRoleMenu(i, user, panelId);
        const min = parseInt(resp);
        if (!min || min < 1) {
          await this.followUpEphemeral(i, cv2Payload([cv2Text(this.t('invalid_value', iCtx))], { ephemeral: true }));
          return this.autoRoleMenu(i, user, panelId);
        }
        const fd = await this._getGuildDoc(i.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.autoRoleConfig = fp.autoRoleConfig || { enabled: true, roles: [] };
        fp.autoRoleConfig.roles = fp.autoRoleConfig.roles || [];
        fp.autoRoleConfig.roles.push({ roleId, tipo: 1, duration: min * 60_000 });
        await fd.save();
        return this.autoRoleMenu(i, user, panelId);
      }

      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.autoRoleConfig = fp.autoRoleConfig || { enabled: true, roles: [] };
      fp.autoRoleConfig.roles = fp.autoRoleConfig.roles || [];
      fp.autoRoleConfig.roles.push({ roleId, tipo, duration: null });
      await fd.save();
      return this.autoRoleMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('role_behavior_title', { ...ctx, roleId })),
      cv2Divider(),
      row(sel),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async autoRoleMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const cfg   = panel.autoRoleConfig || { enabled: false, roles: [] };
    const ctx   = this._tctx(interaction);

    const tipoLabel = (tipo, duration) => {
      if (tipo === 1) return this.t('role_temp_result_label', { ...ctx, minutes: Math.round((duration || 0) / 60000) });
      if (tipo === 2) return this.t('role_linked_result_label', ctx);
      return this.t('role_permanent_label', ctx);
    };

    const rolesList = cfg.roles?.length
      ? cfg.roles.map(r => `<@&${r.roleId}> — ${tipoLabel(r.tipo, r.duration)}`).join('\n')
      : this.t('no_roles', ctx);

    const btnToggle = this.btn(user, cfg.enabled ? this.t('btn_toggle_off', ctx) : this.t('btn_toggle_on', ctx), cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.autoRoleConfig.enabled = !fp.autoRoleConfig.enabled;
      await fd.save();
      return this.autoRoleMenu(i, user, panelId);
    });

    const roleSel = this.client.interactions.createRoleSelect({
      user, data: { placeholder: this.t('autorole_add_role_placeholder', ctx) },
      funcao: async (i) => {
        // Pede o tipo antes de salvar
        return this._autoRoleAskTipo(i, user, panelId, i.data.values[0]);
      }
    });

    const btnRemRole = this.btn(user, this.t('btn_remove_role', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).autoRoleConfig.roles.pop();
      await fd.save();
      return this.autoRoleMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('autorole_header', {
        ...ctx,
        status: cfg.enabled ? this.t('status_on', ctx) : this.t('status_off', ctx),
        list: rolesList,
      })),
      cv2Divider(),
      row(btnToggle),
      row(roleSel),
      row(btnRemRole),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  /* ═══════════════════════════════════════
     TRANSCRIPT
  ═══════════════════════════════════════ */

  async transcriptMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const cfg   = panel.transcriptConfig || { enabled: false, channelId: null, sendToUser: true };
    const ctx   = this._tctx(interaction);

    const btnToggle = this.btn(user, cfg.enabled ? this.t('btn_toggle_off', ctx) : this.t('btn_toggle_on', ctx), cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.transcriptConfig.enabled = !fp.transcriptConfig.enabled;
      await fd.save();
      return this.transcriptMenu(i, user, panelId);
    });

    const chSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: this.t('transcript_channel_placeholder', ctx), channel_types: [0, 5] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.transcriptConfig = fp.transcriptConfig || { enabled: true, sendToUser: true };
        fp.transcriptConfig.channelId = i.data.values[0];
        await fd.save();
        return this.transcriptMenu(i, user, panelId);
      }
    });

    const btnDmToggle = this.btn(user, cfg.sendToUser ? this.t('btn_dm_toggle_off', ctx) : this.t('btn_dm_toggle_on', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.transcriptConfig.sendToUser = !fp.transcriptConfig.sendToUser;
      await fd.save();
      return this.transcriptMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('transcript_header', {
        ...ctx,
        status: cfg.enabled ? this.t('status_on', ctx) : this.t('status_off', ctx),
        channel: cfg.channelId ? `<#${cfg.channelId}>` : this.t('destino_none_channel', ctx),
        dm: cfg.sendToUser ? this.t('dm_yes', ctx) : this.t('dm_no', ctx),
      })),
      cv2Divider(),
      row(btnToggle, btnDmToggle),
      row(chSel),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  /* ═══════════════════════════════════════
     MENSAGENS PERSONALIZADAS

     Todas as mensagens do sistema de ticket (criado, fechar,
     modal, form sequencial, transcript) podem ser customizadas
     aqui. Variáveis disponíveis por campo são indicadas no texto
     de ajuda de cada uma.
  ═══════════════════════════════════════ */

  async mensagensMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const m     = panel.mensagensConfig || {};
    const ctx   = this._tctx(interaction);

    const fieldDefs = [
      { key: 'ticketCriadoTitulo',    label: this.t('msg_field_ticket_title', ctx),          vars: '' },
      { key: 'ticketCriadoDescricao', label: this.t('msg_field_ticket_desc', ctx),       vars: '{user}' },
      { key: 'fecharBotaoLabel',      label: this.t('msg_field_close_btn', ctx),           vars: '' },
      { key: 'fechandoMensagem',      label: this.t('msg_field_closing', ctx),              vars: '' },
      { key: 'modalRespostasTitulo',  label: this.t('msg_field_modal_answers', ctx),   vars: '' },
      { key: 'seqInicioTitulo',       label: this.t('msg_field_seq_start_title', ctx), vars: '' },
      { key: 'seqInicioDescricao',    label: this.t('msg_field_seq_start_desc', ctx), vars: '{user} {timeout}' },
      { key: 'seqCanceladoMensagem',  label: this.t('msg_field_seq_cancel', ctx), vars: '' },
      { key: 'seqResumoTitulo',       label: this.t('msg_field_seq_summary', ctx), vars: '' },
      { key: 'transcriptTitulo',      label: this.t('msg_field_transcript_title', ctx),    vars: '' },
      { key: 'transcriptDmTitulo',    label: this.t('msg_field_transcript_dm_title', ctx),       vars: '' },
      { key: 'transcriptDmDescricao', label: this.t('msg_field_transcript_dm_desc', ctx), vars: '{user}' },
    ];

    const select = this.select(user, fieldDefs.map(f => ({
      label: f.label.slice(0, 100),
      value: f.key,
      description: m[f.key] ? this.t('msg_custom_label', ctx) : this.t('msg_default_label', ctx),
    })), this.t('select_message_placeholder', ctx), async (i) => {
      return this._editarMensagem(i, user, panelId, fieldDefs.find(f => f.key === i.data.values[0]));
    });

    const btnResetAll = this.btn(user, this.t('btn_reset_all', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).mensagensConfig = {};
      await fd.save();
      return this.mensagensMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const statusList = fieldDefs
      .map(f => `${m[f.key] ? this.t('msg_status_custom_icon', ctx) : this.t('msg_status_default_icon', ctx)} ${f.label}`)
      .join('\n');

    const blocks = [
      cv2Text(this.t('messages_header', { ...ctx, statusList })),
      cv2Divider(),
      row(select),
      row(btnResetAll, btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.pink }));
  }

  async _editarMensagem(interaction, user, panelId, fieldDef) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const atual = panel.mensagensConfig?.[fieldDef.key] || '';
    const ctx   = this._tctx(interaction);

    const modal = this.client.interactions.createModal({
      user,
      title: fieldDef.label.slice(0, 45),
      components: [{
        type: 1,
        components: [{
          type: 4, custom_id: 'texto',
          label: this.t('edit_message_field_label', { ...ctx, vars: fieldDef.vars }).slice(0, 45),
          style: 2, required: false, max_length: 1000,
          value: atual,
          placeholder: this.t('edit_message_placeholder', ctx),
        }]
      }],
      funcao: async (mi, _, fields) => {
        const fd = await this._getGuildDoc(mi.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.mensagensConfig = fp.mensagensConfig || {};
        const val = fields.texto?.trim();
        fp.mensagensConfig[fieldDef.key] = val || null;
        await fd.save();

        await this.client.interactions._callback(mi, { type: 6 });
        return this.mensagensMenu(mi, user, panelId);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ═══════════════════════════════════════
     SELECT MENU HUB

     Cada opção do select carrega sua PRÓPRIA configuração
     embutida (staff, nome do ticket, modal, form sequencial,
     embed de boas-vindas) — SEM precisar criar outro painel.
     Clicar numa opção abre um sub-painel só dela.
  ═══════════════════════════════════════ */

  async selectHubMenu(interaction, user, panelId, opts = {}) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const cfg   = panel.selectMenuConfig || { enabled: false, options: [] };
    const ctx   = this._tctx(interaction);

    const btnToggle = this.btn(user, cfg.enabled ? this.t('btn_toggle_hub_off', ctx) : this.t('btn_toggle_hub_on', ctx), cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.enabled = !fp.selectMenuConfig.enabled;
      await fd.save();
      return this.selectHubMenu(i, user, panelId);
    });

    const btnPlaceholder = this.btn(user, this.t('btn_select_text', ctx), 2, async (i) => {
      const resp = await this._ask(i, this.t('ask_select_placeholder', this._tctx(i)));
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).selectMenuConfig.placeholder = resp.trim().slice(0, 100);
      await fd.save();
      return this.selectHubMenu(i, user, panelId);
    });

    const btnAddOption = this.btn(user, this.t('btn_add_option', ctx), 1, async (i) => {
      return this._selectAddOption(i, user, panelId);
    }, { disabled: (cfg.options?.length || 0) >= 25 });

    const components = [];

    if (cfg.options?.length) {
      const editSel = this.select(user, cfg.options.map(o => ({
        label: `⚙️ ${o.label}`.slice(0, 100),
        value: o.optionId,
        description: this.t('edit_existing_option_desc', ctx),
      })), this.t('select_configure_existing_placeholder', ctx), async (i) => {
        await this.deferUpdate(i);
        return this.selectOptionMenu(i, user, panelId, i.data.values[0]);
      });
      components.push(row(editSel));
    }

    const btnRemOption = this.btn(user, this.t('btn_remove_option', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).selectMenuConfig.options.pop();
      await fd.save();
      return this.selectHubMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const optionsList = cfg.options?.length
      ? cfg.options.map((o, i) => {
          const completude = [
            o.cargosStaff?.length ? '👥' : null,
            o.embedBoasVindas ? '🎨' : null,
            o.modalConfig?.enabled ? '📋' : null,
            o.seqQuestionsConfig?.enabled ? '📝' : null,
          ].filter(Boolean).join(' ') || '—';
          return `\`${i + 1}.\` ${o.emoji || '▪️'} **${o.label}** ${completude}`;
        }).join('\n')
      : this.t('no_options', ctx);

    const blocks = [
      cv2Text(this.t('selecthub_header', {
        ...ctx,
        successMsg: opts.successMsg,
        status: cfg.enabled ? this.t('status_on', ctx) : this.t('status_off', ctx),
        count: cfg.options?.length || 0,
        list: optionsList,
      })),
      cv2Divider(),
      row(btnToggle, btnPlaceholder),
      row(btnAddOption, btnRemOption),
      ...components,
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _selectAddOption(interaction, user, panelId) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('new_option_modal_title', ctx),
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'label', label: this.t('option_name_label', ctx), style: 1, required: true, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: this.t('option_desc_label', ctx), style: 1, required: false, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'emoji', label: this.t('option_emoji_label', ctx), style: 1, required: false, max_length: 50 }] },
      ],
      funcao: async (mi, _, fields) => {
        const fd = await this._getGuildDoc(mi.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.selectMenuConfig = fp.selectMenuConfig || { enabled: true, options: [] };
        fp.selectMenuConfig.options = fp.selectMenuConfig.options || [];

        const optionId = this._uid();
        fp.selectMenuConfig.options.push({
          optionId,
          label:       fields.label.trim(),
          description: fields.description?.trim() || '',
          emoji:       fields.emoji?.trim() || null,
          cargosStaff: [],
          ticketChatName: null,
          embedBoasVindas: null,
          modalConfig:        { enabled: false, fields: [] },
          seqQuestionsConfig: { enabled: false, questions: [], timeout: 60000 },
        });
        await fd.save();

        await this.client.interactions._callback(mi, { type: 6 });

        // Abre direto o sub-painel da opção recém-criada — sem
        // precisar de outro painelId, exatamente como pedido.
        return this.selectOptionMenu(mi, user, panelId, optionId, {
          successMsg: this.t('option_created', { ...this._tctx(mi), label: fields.label.trim() })
        });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /**
   * Sub-painel de UMA opção do select. Tudo aqui vive dentro do
   * próprio objeto da opção (panel.selectMenuConfig.options[i]) —
   * não existe "outro painel" por trás disso.
   */
  async selectOptionMenu(interaction, user, panelId, optionId, opts = {}) {
    const doc    = await this._getGuildDoc(interaction.guild_id);
    const panel  = this._findPanel(doc, panelId);
    const option = panel.selectMenuConfig.options.find(o => o.optionId === optionId);
    const ctx    = this._tctx(interaction);

    if (!option) {
      return this.followUpEphemeral(interaction, cv2Payload([cv2Text(this.t('option_not_found', ctx))]));
    }

    const btnEmbed = this.btn(user, option.embedBoasVindas ? this.t('opt_edit_embed', ctx) : this.t('opt_create_embed', ctx), 1, async (i) => {
      return EmbedBuilderUI.open(i, this.client, {
        user,
        existingEmbed: option.embedBoasVindas,
        title: this.t('welcome_embed_title_prefix', { ...ctx, optionLabel: option.label }),
        onDone: async (rootInteraction, embedResult) => {
          const fd = await this._getGuildDoc(rootInteraction.guild_id);
          const fp = this._findPanel(fd, panelId);
          const fo = fp.selectMenuConfig.options.find(o => o.optionId === optionId);
          fo.embedBoasVindas = embedResult;
          await fd.save();
          return this.selectOptionMenu(rootInteraction, user, panelId, optionId, {
            successMsg: embedResult ? this.t('welcome_embed_updated', this._tctx(rootInteraction)) : this.t('welcome_embed_removed', this._tctx(rootInteraction))
          });
        }
      });
    });

    const roleSel = this.client.interactions.createRoleSelect({
      user, data: { placeholder: this.t('staff_role_option_placeholder', ctx), max_values: 5 },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        const fp = this._findPanel(fd, panelId);
        const fo = fp.selectMenuConfig.options.find(o => o.optionId === optionId);
        fo.cargosStaff = [...new Set([...(fo.cargosStaff || []), ...i.data.values])];
        await fd.save();
        return this.selectOptionMenu(i, user, panelId, optionId);
      }
    });

    const btnClearStaff = this.btn(user, this.t('btn_clear_staff', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).cargosStaff = [];
      await fd.save();
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const btnNome = this.btn(user, this.t('btn_ticket_name', ctx), 2, async (i) => {
      const resp = await this._ask(i, this.t('ask_option_ticket_name', this._tctx(i)));
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).ticketChatName = resp.trim().slice(0, 90);
      await fd.save();
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const btnModal = this.btn(user, this.t('btn_modal_status', { ...ctx, status: option.modalConfig?.enabled ? this.t('opt_active', ctx) : this.t('opt_inactive', ctx) }), 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnSeqForm = this.btn(user, this.t('btn_seqform_status', { ...ctx, status: option.seqQuestionsConfig?.enabled ? this.t('opt_active', ctx) : this.t('opt_inactive', ctx) }), 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const btnDelete = this.btn(user, this.t('btn_delete_option', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options = fp.selectMenuConfig.options.filter(o => o.optionId !== optionId);
      await fd.save();
      return this.selectHubMenu(i, user, panelId, { successMsg: this.t('option_deleted', { ...this._tctx(i), label: option.label }) });
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectHubMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(this.t('option_header', {
        ...ctx,
        successMsg: opts.successMsg,
        optionEmoji: option.emoji || '⚙️',
        optionLabel: option.label,
        embedStatus: option.embedBoasVindas ? this.t('embed_ready', ctx) : this.t('embed_missing', ctx),
        staffStatus: option.cargosStaff?.length ? option.cargosStaff.map(r => `<@&${r}>`).join(', ') : this.t('no_staff_yet', ctx),
        name: option.ticketChatName || panel.ticketChatName || 'ticket-{count}',
      })),
      cv2Divider(),
      row(btnEmbed, btnModal, btnSeqForm),
      row(roleSel),
      row(btnClearStaff, btnNome),
      cv2Divider(),
      row(btnDelete, btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  /* ── Modal embutido na opção ── */

  async selectOptionModalMenu(interaction, user, panelId, optionId, opts = {}) {
    const doc    = await this._getGuildDoc(interaction.guild_id);
    const panel  = this._findPanel(doc, panelId);
    const option = panel.selectMenuConfig.options.find(o => o.optionId === optionId);
    const cfg    = option.modalConfig || { enabled: false, fields: [] };
    const ctx    = this._tctx(interaction);

    const fieldsList = cfg.fields?.length
      ? cfg.fields.map((f, i) => `\`${i + 1}.\` **${f.label}** (${f.style === 2 ? this.t('modal_field_paragraph', ctx) : this.t('modal_field_short', ctx)})${f.required ? this.t('modal_field_required_tag', ctx) : ''}`).join('\n')
      : this.t('modal_no_fields', ctx);

    const btnToggle = this.btn(user, cfg.enabled ? this.t('btn_toggle_modal_off', ctx) : this.t('btn_toggle_modal_on', ctx), cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).modalConfig.enabled = !cfg.enabled;
      await fd.save();
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnTitulo = this.btn(user, this.t('btn_modal_title', ctx), 2, async (i) => {
      const resp = await this._ask(i, this.t('ask_modal_title', this._tctx(i)));
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).modalConfig.title = resp.trim().slice(0, 45);
      await fd.save();
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnAddField = this.btn(user, this.t('btn_add_field', ctx), 1, async (i) => {
      return this._selectOptionModalAddField(i, user, panelId, optionId);
    }, { disabled: (cfg.fields?.length || 0) >= 5 });

    const btnRemField = this.btn(user, this.t('btn_remove_field', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).modalConfig.fields.pop();
      await fd.save();
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const blocks = [
      cv2Text(this.t('modal_header_option', {
        ...ctx,
        optionLabel: option.label,
        successMsg: opts.successMsg,
        status: cfg.enabled ? this.t('status_on', ctx) : this.t('status_off', ctx),
        title: cfg.title || this.t('modal_title_default', ctx),
        count: cfg.fields?.length || 0,
        list: fieldsList,
      })),
      cv2Divider(),
      row(btnToggle, btnTitulo),
      row(btnAddField, btnRemField),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _selectOptionModalAddField(interaction, user, panelId, optionId) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('add_field_modal_title', ctx),
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'label', label: this.t('field_label_label', ctx), style: 1, required: true, max_length: 45 }] },
        { type: 1, components: [{ type: 4, custom_id: 'placeholder', label: this.t('field_placeholder_label', ctx), style: 1, required: false, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'style', label: this.t('field_style_label', ctx), style: 1, required: true, max_length: 10, placeholder: this.t('field_style_placeholder', ctx) }] },
        { type: 1, components: [{ type: 4, custom_id: 'required', label: this.t('field_required_label', ctx), style: 1, required: false, max_length: 5, placeholder: this.t('field_required_placeholder', ctx) }] },
      ],
      funcao: async (mi, _, fields) => {
        const fd = await this._getGuildDoc(mi.guild_id);
        const fp = this._findPanel(fd, panelId);
        const fo = fp.selectMenuConfig.options.find(o => o.optionId === optionId);
        fo.modalConfig = fo.modalConfig || { enabled: true, fields: [] };
        fo.modalConfig.fields = fo.modalConfig.fields || [];
        fo.modalConfig.fields.push({
          customId:    this._uid(),
          label:       fields.label.trim(),
          placeholder: fields.placeholder?.trim() || '',
          style:       (fields.style || '').toLowerCase().startsWith('par') ? 2 : 1,
          required:    !['não', 'nao', 'no', 'n'].includes((fields.required || 'sim').toLowerCase()),
        });
        await fd.save();

        await this.client.interactions._callback(mi, { type: 6 });
        return this.selectOptionModalMenu(mi, user, panelId, optionId, { successMsg: this.t('field_added', this._tctx(mi)) });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ── Form Sequencial embutido na opção (com tempo personalizável) ── */

  async selectOptionSeqFormMenu(interaction, user, panelId, optionId, opts = {}) {
    const doc    = await this._getGuildDoc(interaction.guild_id);
    const panel  = this._findPanel(doc, panelId);
    const option = panel.selectMenuConfig.options.find(o => o.optionId === optionId);
    const cfg    = option.seqQuestionsConfig || { enabled: false, questions: [], timeout: 60000 };
    const timeoutSec = Math.round((cfg.timeout ?? 60000) / 1000);
    const plan   = await this._getGuildPlan(interaction.guild_id);
    const maxQ   = plan.tickets?.maxQuestions ?? 10;
    const ctx    = this._tctx(interaction);

    const questionsList = cfg.questions?.length
      ? cfg.questions.map((q, i) => `\`${i + 1}.\` ${q.label} \`[${q.tipo || 'text'}]\`${q.required ? this.t('seq_question_required_tag', ctx) : ''}`).join('\n')
      : this.t('seq_no_questions', ctx);

    const btnToggle = this.btn(user, cfg.enabled ? this.t('btn_toggle_form_off', ctx) : this.t('btn_toggle_form_on', ctx), cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.enabled = !cfg.enabled;
      await fd.save();
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const btnAddQ = this.btn(user, this.t('btn_add_question', ctx), 1, async (i) => {
      return this._selectOptionSeqAddQuestion(i, user, panelId, optionId);
    }, { disabled: (cfg.questions?.length || 0) >= maxQ });

    const btnRemQ = this.btn(user, this.t('btn_remove_question', ctx), 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.questions.pop();
      await fd.save();
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const timeoutSel = this.select(user, [
      { label: this.t('timeout_30s', ctx),  value: '30'  },
      { label: this.t('timeout_1m', ctx),     value: '60'  },
      { label: this.t('timeout_2m', ctx),    value: '120' },
      { label: this.t('timeout_5m', ctx),    value: '300' },
      { label: this.t('timeout_10m', ctx),   value: '600' },
      { label: this.t('timeout_custom', ctx), value: 'custom' },
    ], this.t('timeout_select_placeholder', { ...ctx, seconds: timeoutSec }), async (i) => {
      if (i.data.values[0] === 'custom') {
        const resp = await this._ask(i, this.t('ask_custom_seconds', this._tctx(i)));
        if (resp === null) return;
        const sec = parseInt(resp);
        if (!sec || sec < 5 || sec > 600) {
          await this.followUpEphemeral(i, cv2Payload([cv2Text(this.t('invalid_seconds', this._tctx(i)))], { ephemeral: true }));
          return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
        }
        const fd = await this._getGuildDoc(i.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.timeout = sec * 1000;
        await fd.save();
        return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
      }
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.timeout = Number(i.data.values[0]) * 1000;
      await fd.save();
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const btnBack = this.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const sendModeSel = this.select(user, [
      { label: this.t('send_mode_only_ticket', ctx), value: '0', description: cfg.sendMode === 0 ? this.t('selected_label', ctx) : undefined },
      { label: this.t('send_mode_log_channel', ctx), value: '1', description: cfg.sendMode === 1 ? this.t('selected_label', ctx) : undefined },
    ], this.t('send_mode_select_placeholder', ctx), async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.sendMode = Number(i.data.values[0]);
      await fd.save();
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const logChSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: this.t('log_channel_select_placeholder', ctx), channel_types: [0, 5] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.logChannelId = i.data.values[0];
        await fd.save();
        return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
      }
    });

    const blocks = [
      cv2Text(this.t('seq_header_option', {
        ...ctx,
        optionLabel: option.label,
        successMsg: opts.successMsg,
        status: cfg.enabled ? this.t('status_on', ctx) : this.t('status_off', ctx),
        seconds: timeoutSec,
        destination: cfg.sendMode === 1 ? `📋 <#${cfg.logChannelId || '...'}>` : this.t('seq_dest_own_ticket', ctx),
        count: cfg.questions?.length || 0,
        max: maxQ === Infinity ? this.t('infinity_symbol', ctx) : maxQ,
        list: questionsList,
      })),
      cv2Divider(),
      row(btnToggle, btnAddQ, btnRemQ),
      row(timeoutSel),
      row(sendModeSel),
      ...(cfg.sendMode === 1 ? [row(logChSel)] : []),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _selectOptionSeqAddQuestion(interaction, user, panelId, optionId) {
    return this._seqAddQuestionGeneric({
      interaction, user,
      guildId: interaction.guild_id,
      locateTarget: fd => this._findPanel(fd, panelId).selectMenuConfig.options.find(o => o.optionId === optionId),
      onAdded: mi => this.selectOptionSeqFormMenu(mi, user, panelId, optionId, { successMsg: this.t('question_added', this._tctx(mi)) }),
    });
  }

  /* ═══════════════════════════════════════
     CRIAÇÃO DE TICKETS (runtime)
  ═══════════════════════════════════════ */

  /** Botão "Abrir Ticket" — painel sem select hub. */
  async createFromButton(interaction) {
    const data  = JSON.parse(interaction.data.custom_id);
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, data.p);
    if (!panel) return this.reply(interaction, { content: this.t('panel_not_found_short', this._tctx(interaction)), flags: 64 });

    return this._startTicketFlow(interaction, doc, panel, null);
  }

  /** Select Menu Hub — usuário escolheu uma opção. */
  async createFromSelect(interaction) {
    const data    = JSON.parse(interaction.data.custom_id);
    const doc     = await this._getGuildDoc(interaction.guild_id);
    const panel   = this._findPanel(doc, data.p);
    if (!panel) return this.reply(interaction, { content: this.t('panel_not_found_short', this._tctx(interaction)), flags: 64 });

    const optionId = interaction.data.values[0];
    const option    = panel.selectMenuConfig.options.find(o => o.optionId === optionId);
    if (!option) return this.reply(interaction, { content: this.t('option_not_found', this._tctx(interaction)), flags: 64 });

    return this._startTicketFlow(interaction, doc, panel, option);
  }

  /**
   * Fluxo de criação compartilhado entre botão único e select hub.
   * `option` é null quando vem do botão (usa config do painel raiz);
   * quando vem do select, mescla: staff/nome/modal/form/embed da
   * OPÇÃO, e canal/categoria/tipo do PAINEL raiz.
   */
  async _startTicketFlow(interaction, doc, panel, option) {
    const modalCfg = option?.modalConfig?.enabled ? option.modalConfig : (panel.modalConfig?.enabled ? panel.modalConfig : null);

    if (modalCfg) {
      return this._openTicketModal(interaction, panel, option, modalCfg);
    }

    await this.deferUpdate(interaction);
    return this._createTicketChannel(interaction, panel, option, {}, false);
  }

  async _openTicketModal(interaction, panel, option, modalCfg) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user:  interaction.member?.user?.id || interaction.user?.id,
      title: modalCfg.title || this.t('modal_title_default', ctx),
      components: (modalCfg.fields || []).slice(0, 5).map(f => ({
        type: 1,
        components: [{
          type: 4, custom_id: f.customId, label: f.label.slice(0, 45),
          style: f.style || 1, required: f.required ?? true,
          placeholder: f.placeholder || undefined, max_length: 1000,
        }]
      })),
      funcao: async (mi, _, fields) => {
        // type 5 (defer de canal NOVO) — modal_submit não tem uma
        // mensagem existente pra "atualizar" (type 6), é uma
        // interação independente, igual um slash command.
        await DiscordRequest(
          `/interactions/${mi.id}/${mi.token}/callback`,
          { method: 'POST', body: { type: 5, data: { flags: 64 } } }
        );
        return this._createTicketChannel(mi, panel, option, fields, true);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _createTicketChannel(interaction, panel, option, modalAnswers, isModalFlow = false) {
    const guildId = interaction.guild_id;
    const userId  = interaction.member?.user?.id || interaction.user?.id;

    // Recarrega do banco para evitar usar config desatualizada — o
    // `panel` recebido como parâmetro foi capturado no início da
    // interação e pode estar obsoleto se algo mudou nesse meio-tempo
    // (ex: admin editando o painel enquanto o usuário preenchia o
    // modal). A partir daqui, `fp` é a fonte de verdade.
    const fresh = await this._getGuildDoc(guildId);
    const fp    = this._findPanel(fresh, panel.panelId);
    fp.contadorTicket = (fp.contadorTicket || 0) + 1;
    const count = fp.contadorTicket;
    await fresh.save();

    // Se veio de uma opção do select, busca a mesma opção dentro do
    // documento fresh (para refletir eventuais edições recentes nela também)
    const fo = option ? fp.selectMenuConfig?.options?.find(o => o.optionId === option.optionId) : null;

    const nameTemplate = fo?.ticketChatName || fp.ticketChatName || 'ticket-{count}';
    const channelName  = nameTemplate.replaceAll('{count}', String(count)).slice(0, 90);

    const staffRoles = fo?.cargosStaff?.length ? fo.cargosStaff : (fp.cargosStaff || []);

    const permissionOverwrites = [
      { id: guildId, type: 0, deny: '1024' },              // @everyone (cargo): VIEW_CHANNEL deny
      { id: userId,  type: 1, allow: '3072' },              // criador (membro): VIEW_CHANNEL + SEND_MESSAGES
      ...staffRoles.map(roleId => ({ id: roleId, type: 0, allow: '3072' })), // staff (cargo)
    ];

    const channel = await DiscordRequest(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: {
        name: channelName,
        type: 0,
        parent_id: fp.categoriaId || undefined,
        permission_overwrites: permissionOverwrites,
        // Guarda o panelId no tópico do canal — assim o custom_id do
        // botão Fechar pode ficar só com o channelId (sempre curto e
        // dentro do limite de 100 chars do Discord, já que panelId é
        // uma string livre escolhida pelo usuário e pode ser longa).
        topic: `ticket:${panel.panelId}`,
      }
    });

    // Auto-cargo (abrir) — fp.panelId é usado internamente para
    // rastrear cargos "vinculados" (tipo 2) por ticket.
    if (fp.autoRoleConfig?.enabled) {
      await this.autoRoleManager.applyRoles({
        guildId, userId, ticketId: channel.id, panel: fp
      }).catch(err => console.error('[TicketSystem] Erro ao aplicar auto-cargo:', err));
    }

    // Mensagem "Ticket Criado" — personalizada
    const ctx = this._tctx(interaction);
    const tituloCriado = resolveMsg(fp, 'ticketCriadoTitulo', this.t('default_ticket_created_title', ctx));
    const descCriado    = resolveMsg(fp, 'ticketCriadoDescricao',
      this.t('default_ticket_created_desc', ctx),
      { userId }
    );

    const embedBoasVindas = fo?.embedBoasVindas || fp.painelPrincipal;

    const respostasText = Object.keys(modalAnswers).length
      ? Object.entries(modalAnswers).map(([k, v]) => `**${k}:** ${v}`).join('\n')
      : null;

    const fecharLabel = resolveMsg(fp, 'fecharBotaoLabel', this.t('default_close_button_label', ctx));

    await DiscordRequest(`/channels/${channel.id}/messages`, {
      method: 'POST',
      body: {
        content: `<@${userId}>` + (staffRoles.length ? ` ${staffRoles.map(r => `<@&${r}>`).join(' ')}` : ''),
        embeds: [
          { title: tituloCriado, description: descCriado, color: 0x7C8FFF },
          ...(embedBoasVindas ? [embedBoasVindas] : []),
          ...(respostasText ? [{ title: resolveMsg(fp, 'modalRespostasTitulo', this.t('default_modal_answers_title', ctx)), description: respostasText, color: 0xFFD966 }] : []),
        ],
        components: [{
          type: 1,
          components: [{ type: 2, style: 4, label: fecharLabel, custom_id: JSON.stringify({ t: 'close_ticket_v2', ch: channel.id, u: userId }) }]
        }]
      }
    });

    // Form sequencial — personalizado
    const seqCfg = fo?.seqQuestionsConfig?.enabled ? fo.seqQuestionsConfig : (fp.seqQuestionsConfig?.enabled ? fp.seqQuestionsConfig : null);
    if (seqCfg) {
      const seqManager = new SeqQuestionsManager(this.client);
      seqManager.run({
        panel:     { seqQuestionsConfig: seqCfg }, // run() espera panel.seqQuestionsConfig
        channelId: channel.id,
        userId,
        ctx,
        messages: {
          inicioTitulo:      resolveMsg(fp, 'seqInicioTitulo', this.t('default_seq_intro_title', ctx)),
          inicioDescricao:   resolveMsg(fp, 'seqInicioDescricao', this.t('default_seq_intro_desc', ctx), { userId, timeout: Math.round((seqCfg.timeout ?? 60000) / 1000) }),
          canceladoMensagem: resolveMsg(fp, 'seqCanceladoMensagem', this.t('default_seq_cancelled', ctx)),
          resumoTitulo:      resolveMsg(fp, 'seqResumoTitulo', this.t('default_seq_summary_title', ctx)),
        }
      }).catch(err => console.error('[TicketSystem] Erro no form sequencial:', err));
    }

    // Evento Premium (Nova Estrela+) do Logic Script — best-effort, não
    // bloqueia a criação do ticket se a checagem de plano falhar.
    if (await this._isPremiumEventsEnabled(guildId).catch(() => false)) {
      this._emitTicketUpdate(guildId, {
        TYPE: TICKET_UPDATE_TYPE.CRIADO,
        id: channel.id,
        channelId: channel.id,
        guildId,
        panelId: fp.panelId,
        openedBy: userId,
        closedBy: null,
        createdAt: new Date().toISOString(),
      });
    }

    const successMsg = this.t('ticket_created_success', { ...ctx, channelId: channel.id });

    if (isModalFlow) {
      // Veio de modal_submit (defer type 5) — completa com PATCH @original.
      return DiscordRequest(
        `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
        { method: 'PATCH', body: { content: successMsg } }
      );
    }

    // Veio de botão/select direto (defer type 6) — manda uma mensagem nova.
    return this.followUpEphemeral(interaction, { content: successMsg,flags:64});
  }

  /* ─────────────────────────────────────── */

  async closeTicket(interaction) {
    const data      = JSON.parse(interaction.data.custom_id);
    const closedBy  = interaction.member?.user?.id || interaction.user?.id; // quem clicou em fechar
    const ownerId   = data.u || closedBy; // dono original do ticket (quem o abriu)

    // O panelId não vai mais no custom_id (pode ser longo e estourar
    // o limite de 100 chars do Discord) — recupera do tópico do canal,
    // que foi gravado como "ticket:{panelId}" na criação.
    let panelId = null;
    try {
      const channelInfo = await DiscordRequest(`/channels/${data.ch}`);
      console.log('[DIAG-TRANSCRIPT] channelInfo.topic:', JSON.stringify(channelInfo?.topic));
      panelId = channelInfo?.topic?.startsWith('ticket:') ? channelInfo.topic.slice('ticket:'.length) : null;
      console.log('[DIAG-TRANSCRIPT] panelId resolvido:', panelId);
    } catch (err) {
      console.error('[TicketSystem] Erro ao buscar tópico do canal para resolver panelId:', err);
    }

    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = panelId ? this._findPanel(doc, panelId) : null;
    console.log('[DIAG-TRANSCRIPT] panel encontrado?', !!panel, '| transcriptConfig:', JSON.stringify(panel?.transcriptConfig));

    const ctx = this._tctx(interaction);
    const fechandoMsg = resolveMsg(panel, 'fechandoMensagem', this.t('default_closing_message', ctx));

    await this.reply(interaction, { content: fechandoMsg });

    // Transcript
    if (panel?.transcriptConfig?.enabled) {
      console.log('[DIAG-TRANSCRIPT] transcriptConfig.enabled=true, channelId:', panel.transcriptConfig.channelId, '— chamando generate()...');
      const transcriptManager = new TranscriptManager(this.client);
      await transcriptManager.generate({
        interaction, // interaction.channel_id == canal do ticket sendo fechado
        panel,
        closedBy,
        messages: {
          canalTitulo: resolveMsg(panel, 'transcriptTitulo', this.t('default_transcript_title', ctx)),
          dmTitulo:    resolveMsg(panel, 'transcriptDmTitulo', this.t('default_transcript_dm_title', ctx)),
          dmDescricao: resolveMsg(panel, 'transcriptDmDescricao', this.t('default_transcript_dm_desc', ctx), { userId: ownerId }),
        }
      }).then(() => console.log('[DIAG-TRANSCRIPT] generate() concluiu sem lançar erro'))
        .catch(err => console.error('[TicketSystem] Erro ao gerar transcript:', err));
    } else {
      console.log('[DIAG-TRANSCRIPT] Transcript NÃO disparado — panel existe?', !!panel, '| enabled?', panel?.transcriptConfig?.enabled);
    }

    // Auto-cargo (fechar) — remove cargos "vinculados" (tipo 2) do
    // DONO do ticket, se não houver outro ticket ativo sustentando.
    if (panel?.autoRoleConfig?.enabled) {
      await this.autoRoleManager.handleTicketClose({
        guildId: interaction.guild_id, userId: ownerId, ticketId: data.ch
      }).catch(err => console.error('[TicketSystem] Erro ao processar auto-cargo no fechamento:', err));
    }

    // Evento Premium (Nova Estrela+) do Logic Script — best-effort.
    if (await this._isPremiumEventsEnabled(interaction.guild_id).catch(() => false)) {
      this._emitTicketUpdate(interaction.guild_id, {
        TYPE: TICKET_UPDATE_TYPE.FECHADO,
        id: data.ch,
        channelId: data.ch,
        guildId: interaction.guild_id,
        panelId,
        openedBy: ownerId,
        closedBy,
        closedAt: new Date().toISOString(),
      });
    }

    setTimeout(() => {
      DiscordRequest(`/channels/${data.ch}`, { method: 'DELETE' }).catch(() => {});
    }, 10_000);
  }

  /* ─────────────────────────────────────── */

  /**
   * Abre um ticket de um painel JÁ CONFIGURADO sem depender de uma
   * interação de botão/select do Discord — é o que a função global
   * `abrirTicket(painelId, usuario?)` do Logic Script chama (ver
   * Interpreter.js). Reaproveita o mesmo formato de canal/permissões/
   * mensagem de `_createTicketChannel`, mas devolve dados simples em vez
   * de responder uma interação (que não existe nesse fluxo).
   *
   * Recursos que dependem de uma interação real (modal de abertura,
   * form sequencial pós-criação) não se aplicam aqui — script já decidiu
   * abrir o ticket, não faz sentido pedir mais informação por modal.
   *
   * @param {string} guildId
   * @param {string} panelId
   * @param {{ userId: string }} opts — quem vai ser o dono do ticket
   * @returns {Promise<{ id: string, channelId: string, panelId: string }>}
   */
  async createTicketFromScript(guildId, panelId, { userId } = {}) {
    if (!userId) throw new Error('abrirTicket(): usuário não informado.');

    const doc = await this._getGuildDoc(guildId);
    if (!doc) throw new Error('abrirTicket(): servidor sem nenhum painel de ticket configurado.');

    const panel = this._findPanel(doc, panelId);
    if (!panel) throw new Error(`abrirTicket(): painel '${panelId}' não encontrado.`);

    panel.contadorTicket = (panel.contadorTicket || 0) + 1;
    const count = panel.contadorTicket;
    await doc.save();

    const nameTemplate = panel.ticketChatName || 'ticket-{count}';
    const channelName  = nameTemplate.replaceAll('{count}', String(count)).slice(0, 90);
    const staffRoles   = panel.cargosStaff || [];

    const permissionOverwrites = [
      { id: guildId, type: 0, deny: '1024' },              // @everyone: VIEW_CHANNEL deny
      { id: userId,  type: 1, allow: '3072' },              // dono: VIEW_CHANNEL + SEND_MESSAGES
      ...staffRoles.map(roleId => ({ id: roleId, type: 0, allow: '3072' })),
    ];

    const channel = await DiscordRequest(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: {
        name: channelName,
        type: 0,
        parent_id: panel.categoriaId || undefined,
        permission_overwrites: permissionOverwrites,
        topic: `ticket:${panel.panelId}`,
      }
    });

    if (panel.autoRoleConfig?.enabled) {
      await this.autoRoleManager.applyRoles({
        guildId, userId, ticketId: channel.id, panel
      }).catch(err => console.error('[TicketSystem] Erro ao aplicar auto-cargo (abrirTicket):', err));
    }

    const fecharLabel  = resolveMsg(panel, 'fecharBotaoLabel', 'Fechar Ticket');
    const tituloCriado = resolveMsg(panel, 'ticketCriadoTitulo', '🎫 Ticket Criado');
    const descCriado   = resolveMsg(panel, 'ticketCriadoDescricao', 'Ticket aberto por {user}.', { userId });

    await DiscordRequest(`/channels/${channel.id}/messages`, {
      method: 'POST',
      body: {
        content: `<@${userId}>` + (staffRoles.length ? ` ${staffRoles.map(r => `<@&${r}>`).join(' ')}` : ''),
        embeds: [{ title: tituloCriado, description: descCriado, color: 0x7C8FFF }],
        components: [{
          type: 1,
          components: [{ type: 2, style: 4, label: fecharLabel, custom_id: JSON.stringify({ t: 'close_ticket_v2', ch: channel.id, u: userId }) }]
        }]
      }
    });

    if (await this._isPremiumEventsEnabled(guildId).catch(() => false)) {
      this._emitTicketUpdate(guildId, {
        TYPE: TICKET_UPDATE_TYPE.CRIADO,
        id: channel.id,
        channelId: channel.id,
        guildId,
        panelId: panel.panelId,
        openedBy: userId,
        closedBy: null,
        createdAt: new Date().toISOString(),
      });
    }

    return { id: channel.id, channelId: channel.id, panelId: panel.panelId };
  }
}

module.exports = TicketSystem;
