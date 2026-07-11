'use strict';

const DiscordRequest      = require('../../DiscordRequest.js');
const { GuildDb: GuildModel } = require('../../../Mongodb/guild.js');
const AutoRoleManager     = require('./AutoRoleManager.js');
const SeqQuestionsManager = require('./SeqQuestionsManager.js');
const TranscriptManager   = require('./TranscriptManager.js');
const EmbedBuilderUI      = require('./EmbedBuilderUI.js');
const { randomUUID }      = require('crypto');
const PremiumManager      = require('../../Utils/PremiumManager.js');
const { getPlan }         = require('../../Utils/PremiumPlans.js');

// Tipos de pergunta "avançados" — contam contra o limite separado do
// plano (plan.tickets.advancedTypeLimit). Texto curto/longo, número e
// sim/não são "básicos" e só contam contra o limite total de perguntas.
const ADVANCED_QUESTION_TYPES = new Set(['select', 'multiple', 'checkbox', 'attachment', 'member', 'role', 'channel']);

const QUESTION_TYPE_CHOICES = [
  { label: '📝 Texto curto',        value: 'short',      description: 'Resposta em até ~100 caracteres' },
  { label: '📄 Texto longo',        value: 'long',       description: 'Resposta em até 2000 caracteres' },
  { label: '🔢 Número',             value: 'number',     description: 'Aceita apenas números' },
  { label: '✅ Sim/Não',            value: 'yesno',      description: 'Resposta sim ou não' },
  { label: '📋 Seleção',            value: 'select',     description: 'Escolher 1 opção de uma lista (Premium)' },
  { label: '☑️ Múltipla escolha',   value: 'multiple',   description: 'Escolher várias opções de uma lista (Premium)' },
  { label: '🔲 Checkbox',           value: 'checkbox',   description: 'Marcar 0+ opções (Premium)' },
  { label: '👤 Seleção de membro',  value: 'member',     description: 'Escolher um membro do servidor (Premium)' },
  { label: '🏷️ Seleção de cargo',   value: 'role',       description: 'Escolher um cargo do servidor (Premium)' },
  { label: '📌 Seleção de canal',   value: 'channel',    description: 'Escolher um canal do servidor (Premium)' },
  { label: '📎 Anexo',              value: 'attachment', description: 'Enviar um arquivo/imagem (Premium)' },
];

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
   * Checa se a guild ainda pode adicionar uma pergunta do `tipo` informado
   * a essa lista de perguntas, respeitando os limites do plano:
   *   - total de perguntas (plan.tickets.maxQuestions)
   *   - perguntas de tipo avançado — seleção/múltipla escolha/checkbox/
   *     anexo/membro/cargo/canal (plan.tickets.advancedTypeLimit)
   * Retorna { ok: true, plan } ou { ok: false, motivo, plan }.
   */
  async _checkSeqQuestionLimit(guildId, existingQuestions, tipo) {
    const plan = await this._getGuildPlan(guildId);
    const questions = existingQuestions || [];

    const maxQuestions = plan.tickets?.maxQuestions ?? 10;
    if (questions.length >= maxQuestions) {
      return {
        ok: false,
        plan,
        motivo: `Limite de perguntas do plano ${plan.emoji} ${plan.name} atingido (${maxQuestions === Infinity ? '∞' : maxQuestions}). Assine um plano maior em /premium para adicionar mais.`,
      };
    }

    if (ADVANCED_QUESTION_TYPES.has(tipo)) {
      const advancedLimit = plan.tickets?.advancedTypeLimit ?? 0;
      const advancedCount = questions.filter(q => ADVANCED_QUESTION_TYPES.has(q.tipo)).length;
      if (advancedCount >= advancedLimit) {
        return {
          ok: false,
          plan,
          motivo: `Limite de perguntas avançadas (seleção/múltipla escolha/checkbox/anexo/membro/cargo/canal) do plano ${plan.emoji} ${plan.name} atingido (${advancedLimit === Infinity ? '∞' : advancedLimit}). Assine um plano maior em /premium para desbloquear mais.`,
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

    return this.editOriginal(interaction, this._homePayload(user, panels));
  }

  _homePayload(user, panels) {
    const btnList = this.btn(user, `📋 Painéis (${panels.length})`, 1, async (i) => {
      await this.deferUpdate(i);
      return this.painelList(i, user);
    });

    const btnNew = this.btn(user, '✨ Novo Painel', 3, async (i) => this.criar(i, user));

    const blocks = [
      cv2Text(
        `# 🎫 Sistema de Tickets ${this._e('animada')}\n` +
        `Oii! Eu sou a Ayami ${this._e('corao')} e vou te ajudar a montar o atendimento do servidor!`
      ),
      cv2Divider(),
      row(btnList, btnNew),
    ];

    return cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main });
  }

  async painelList(interaction, user) {
    const guildId = interaction.guild_id;
    const doc     = await this._getGuildDoc(guildId);
    const panels  = doc?.ticket || [];

    const btnNew  = this.btn(user, '✨ Novo Painel', 3, async (i) => this.criar(i, user));
    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.open(i);
    });

    if (!panels.length) {
      const blocks = [
        cv2Text(`# 📋 Seus Painéis ${this._e('emburrada')}\nNenhum painel ainda... vamos criar o primeiro?`),
        cv2Divider(),
        row(btnNew, btnBack),
      ];
      return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false }));
    }

    const options = panels.map(p => ({
      label:       (p.painelPrincipal?.title || p.panelId).slice(0, 100),
      value:       p.panelId,
      description: `${p.cargosStaff?.length || 0} staff • ${p.selectMenuConfig?.enabled ? 'Select Menu' : 'Botão único'}`
    }));

    const sel = this.select(user, options, '✨ Qual painel você quer ver?', async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, i.data.values[0]);
    });

    const listText = panels
      .map(p => `🎫 **${p.painelPrincipal?.title || p.panelId}**`)
      .join('\n');

    const blocks = [
      cv2Text(`# 📋 Seus Painéis (${panels.length}) ${this._e('feliz')}\n${listText}`),
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
    const modal = this.client.interactions.createModal({
      user,
      title: 'Criar Painel de Ticket ✨',
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'panelId', label: 'ID do painel (sem espaços)', style: 1, required: true, max_length: 50, placeholder: 'suporte, denuncias, parcerias...' }] }
      ],
      funcao: async (mi, client, fields) => {
        const panelId = fields.panelId?.trim().toLowerCase().replace(/\s+/g, '_');
        if (!panelId) {
          return this.client.interactions._callback(mi, { type: 4, data: { content: `❌ ID inválido!`, flags: 64 } });
        }

        const doc = await this._getGuildDoc(mi.guild_id) || new GuildModel({ guildId: mi.guild_id });
        if (this._findPanel(doc, panelId)) {
          return this.client.interactions._callback(mi, { type: 4, data: { content: `${this._e('emburrada')} Já existe um painel com ID **${panelId}**.`, flags: 64 } });
        }

        doc.ticket = doc.ticket || [];
        doc.ticket.push({ panelId });
        await doc.save();

        await this.client.interactions._callback(mi, { type: 4, data: this._homePayload(user, doc.ticket) });

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

    if (!panel) {
      return this.followUpEphemeral(interaction, cv2Payload([
        cv2Text(`# ${this._e('emduvida')} Não achei esse painel...\nPode ter sido apagado!`)
      ]));
    }

    const hasEmbed   = !!panel.painelPrincipal;
    const hubEnabled = panel.selectMenuConfig?.enabled;

    const navSelect = this.select(user, [
      { label: hasEmbed ? '🎨 Editar Embed' : '✨ Criar Embed', value: 'embed', description: 'A carinha do seu painel' },
      { label: '📌 Canal & Categoria',     value: 'destino',  description: panel.canalId ? 'Já configurado' : 'Ainda não configurado' },
      { label: '👥 Staff & Nome',          value: 'staff',    description: 'Quem atende e como o ticket se chama' },
      { label: '⚙️ Tipo de Criação',       value: 'tipo',     description: ['Canal', 'Thread Pública', 'Thread Privada'][panel.tipoDeCriacao] || 'Canal' },
      { label: '📋 Modal',                 value: 'modal',    description: panel.modalConfig?.enabled ? 'Ativo' : 'Inativo' },
      { label: '📝 Form Sequencial',       value: 'seqform',  description: panel.seqQuestionsConfig?.enabled ? 'Ativo' : 'Inativo' },
      { label: '🏷️ Auto-Cargo',           value: 'autorole', description: panel.autoRoleConfig?.enabled ? 'Ativo' : 'Inativo' },
      { label: '📄 Transcript',            value: 'transcript', description: panel.transcriptConfig?.enabled ? 'Ativo' : 'Inativo' },
      { label: '🧩 Select Menu',           value: 'selecthub', description: hubEnabled ? `${panel.selectMenuConfig.options.length} opção(ões)` : 'Inativo' },
      { label: '💬 Mensagens',             value: 'mensagens', description: 'Deixe tudo com a sua cara!' },
    ], '✨ O que você quer configurar?', async (i) => {
      await this.deferUpdate(i);
      const dest = {
        embed: async () => EmbedBuilderUI.open(i, this.client, {
          user,
          existingEmbed: panel.painelPrincipal,
          title: `Embed — ${panelId}`,
          onDone: async (rootInteraction, embedResult) => {
            const freshDoc   = await this._getGuildDoc(rootInteraction.guild_id);
            const freshPanel = this._findPanel(freshDoc, panelId);
            freshPanel.painelPrincipal = embedResult;
            await freshDoc.save();
            return this.painelMenu(rootInteraction, user, panelId, {
              successMsg: embedResult ? `${this._e('curtida')} Ficou linda!` : `${this._e('emduvida')} Tirei a embed.`
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

    const btnPublish = this.btn(user, '🚀 Publicar', 3, async (i) => {
      await this.deferUpdate(i);
      return this._publicarPainel(i, user, panelId);
    });

    const btnDelete = this.btn(user, '🗑️ Excluir', 4, async (i) => {
      await this.deferUpdate(i);
      return this._confirmDeletePanel(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelList(i, user);
    });

    const blocks = [
      cv2Text(
        `# 🎫 ${panelId} ${this._e('animada')}\n` +
        (successMsg ? `${successMsg}\n\n` : '') +
        `> 🎨 Embed: ${hasEmbed ? 'pronta!' : 'falta criar'}\n` +
        `> 📌 Canal: ${panel.canalId ? `<#${panel.canalId}>` : 'não escolhido'}\n` +
        `> 👥 Staff: ${panel.cargosStaff?.length ? panel.cargosStaff.map(r => `<@&${r}>`).join(', ') : 'ninguém ainda'}`
      ),
      cv2Divider(),
      row(navSelect),
      row(btnPublish, btnDelete, btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _confirmDeletePanel(interaction, user, panelId) {
    const btnConfirm = this.btn(user, '✅ Sim, excluir', 4, async (i) => {
      await this.deferUpdate(i);
      const doc = await this._getGuildDoc(i.guild_id);
      doc.ticket = doc.ticket.filter(t => t.panelId !== panelId);
      await doc.save();
      return this.painelList(i, user);
    });
    const btnCancel = this.btn(user, '❌ Cancelar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(`# ${this._e('assustada')} Excluir o painel?\nTem certeza? Não vai dar pra desfazer depois...`),
      cv2Divider(),
      row(btnConfirm, btnCancel),
    ];
    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.danger }));
  }

  async _publicarPainel(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);

    if (!panel.canalId) {
      return this.painelMenu(interaction, user, panelId, { successMsg: `${this._e('emduvida')} Escolhe um canal antes, tá bom?` });
    }
    if (!panel.painelPrincipal) {
      return this.painelMenu(interaction, user, panelId, { successMsg: `${this._e('emduvida')} Falta criar a embed primeiro!` });
    }

    const components = panel.selectMenuConfig?.enabled
      ? [row({
          type: 3,
          custom_id: JSON.stringify({ t: 'ticket_select_hub', p: panelId }),
          placeholder: panel.selectMenuConfig.placeholder || 'Selecione o tipo de atendimento',
          options: panel.selectMenuConfig.options.map(o => ({
            label: o.label, value: o.optionId, description: o.description || undefined,
            emoji: o.emoji ? { name: o.emoji } : undefined
          }))
        })]
      : [row({ type: 2, style: 1, label: '🎫 Abrir Ticket', custom_id: JSON.stringify({ t: 'create_ticket_select', p: panelId }) })];

    const msg = await DiscordRequest(`/channels/${panel.canalId}/messages`, {
      method: 'POST',
      body: { embeds: [panel.painelPrincipal], components }
    });

    panel.messageId = msg.id;
    await doc.save();

    return this.painelMenu(interaction, user, panelId, { successMsg: `${this._e('festa')} Prontinho! Publiquei em <#${panel.canalId}>~` });
  }

  /* ═══════════════════════════════════════
     CANAL & CATEGORIA
  ═══════════════════════════════════════ */

  async destinoMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);

    const chSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: '📌 Canal onde o painel será enviado', channel_types: [0, 5] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        this._findPanel(fd, panelId).canalId = i.data.values[0];
        await fd.save();
        return this.destinoMenu(i, user, panelId);
      }
    });

    const catSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: '📂 Categoria onde os tickets serão criados', channel_types: [4] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        this._findPanel(fd, panelId).categoriaId = i.data.values[0];
        await fd.save();
        return this.destinoMenu(i, user, panelId);
      }
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(
        `# 📌 Canal & Categoria ${this._e('feliz')}\n` +
        `> 📢 Canal: ${panel.canalId ? `<#${panel.canalId}>` : 'nenhum ainda'}\n` +
        `> 📂 Categoria: ${panel.categoriaId ? `<#${panel.categoriaId}>` : 'nenhuma ainda'}`
      ),
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

    const roleSel = this.client.interactions.createRoleSelect({
      user, data: { placeholder: '👥 Adicionar cargo staff', max_values: 5 },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        const fp = this._findPanel(fd, panelId);
        fp.cargosStaff = [...new Set([...(fp.cargosStaff || []), ...i.data.values])];
        await fd.save();
        return this.staffNomeMenu(i, user, panelId);
      }
    });

    const btnClearStaff = this.btn(user, '🧹 Limpar Staff', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).cargosStaff = [];
      await fd.save();
      return this.staffNomeMenu(i, user, panelId);
    });

    const btnNome = this.btn(user, '✏️ Nome do Ticket', 2, async (i) => {
      const resp = await this._ask(i, `${this._e('pensando')} Como o ticket vai se chamar?\nUse \`{count}\` pro número. Ex: \`ticket-{count}\``);
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).ticketChatName = resp.trim().slice(0, 90);
      await fd.save();
      return this.staffNomeMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(
        `# 👥 Staff & Nome ${this._e('feliz')}\n` +
        `> 🛡️ Staff: ${panel.cargosStaff?.length ? panel.cargosStaff.map(r => `<@&${r}>`).join(', ') : 'ninguém ainda'}\n` +
        `> 🏷️ Nome: \`${panel.ticketChatName || 'ticket-{count}'}\``
      ),
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

    const labels = ['📁 Canal de Texto', '🧵 Thread Pública', '🔒 Thread Privada'];

    const sel = this.select(user, labels.map((l, i) => ({ label: l, value: String(i), description: i === panel.tipoDeCriacao ? '✅ Atual' : undefined })), 'Selecionar tipo de criação', async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).tipoDeCriacao = Number(i.data.values[0]);
      await fd.save();
      return this.tipoCriacaoMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(`# ⚙️ Tipo de Criação ${this._e('feliz')}\nComo o ticket é criado? Atual: ${labels[panel.tipoDeCriacao] || labels[0]}`),
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

    const fieldsList = cfg.fields?.length
      ? cfg.fields.map((f, i) => `\`${i + 1}.\` **${f.label}** (${f.style === 2 ? 'parágrafo' : 'curto'})${f.required ? ' *obrigatório*' : ''}`).join('\n')
      : '_Nenhum campo adicionado_';

    const btnToggle = this.btn(user, cfg.enabled ? '⏸️ Desativar Modal' : '▶️ Ativar Modal', cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.modalConfig.enabled = !fp.modalConfig.enabled;
      await fd.save();
      return this.modalMenu(i, user, panelId);
    });

    const btnTitulo = this.btn(user, '✏️ Título do Modal', 2, async (i) => {
      const resp = await this._ask(i, `${this._e('pensando')} Qual o título do modal?`);
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).modalConfig.title = resp.trim().slice(0, 45);
      await fd.save();
      return this.modalMenu(i, user, panelId);
    });

    const btnAddField = this.btn(user, '➕ Adicionar Campo', 1, async (i) => {
      return this._modalAddField(i, user, panelId);
    }, { disabled: (cfg.fields?.length || 0) >= 5 });

    const btnRemField = this.btn(user, '🗑️ Remover Último Campo', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).modalConfig.fields.pop();
      await fd.save();
      return this.modalMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(
        `# 📋 Modal ${this._e('feliz')}\n` +
        (opts.successMsg ? `${opts.successMsg}\n\n` : '') +
        `Aparece quando alguém clica em Abrir Ticket!\n` +
        `> Status: ${cfg.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
        `> Título: \`${cfg.title || 'Formulário de Atendimento'}\`\n\n` +
        `**Campos (${cfg.fields?.length || 0}/5):**\n${fieldsList}`
      ),
      cv2Divider(),
      row(btnToggle, btnTitulo),
      row(btnAddField, btnRemField),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _modalAddField(interaction, user, panelId) {
    const modal = this.client.interactions.createModal({
      user,
      title: 'Adicionar Campo do Modal',
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'label', label: 'Pergunta/Label do campo', style: 1, required: true, max_length: 45 }] },
        { type: 1, components: [{ type: 4, custom_id: 'placeholder', label: 'Placeholder (opcional)', style: 1, required: false, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'style', label: 'Estilo: curto ou paragrafo', style: 1, required: true, max_length: 10, placeholder: 'curto' }] },
        { type: 1, components: [{ type: 4, custom_id: 'required', label: 'Obrigatório? (sim/não)', style: 1, required: false, max_length: 5, placeholder: 'sim' }] },
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
        return this.modalMenu(mi, user, panelId, { successMsg: `${this._e('curtida')} Campo adicionado!` });
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

    const questionsList = cfg.questions?.length
      ? cfg.questions.map((q, i) => `\`${i + 1}.\` ${q.label} \`[${q.tipo || 'text'}]\`${q.required ? ' *obrigatória*' : ''}`).join('\n')
      : '_Nenhuma pergunta adicionada_';

    const timeoutSec = Math.round((cfg.timeout ?? 60000) / 1000);

    const btnToggle = this.btn(user, cfg.enabled ? '⏸️ Desativar Form' : '▶️ Ativar Form', cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.seqQuestionsConfig.enabled = !fp.seqQuestionsConfig.enabled;
      await fd.save();
      return this.seqFormMenu(i, user, panelId);
    });

    const btnAddQ = this.btn(user, '➕ Adicionar Pergunta', 1, async (i) => {
      return this._seqAddQuestion(i, user, panelId);
    }, { disabled: (cfg.questions?.length || 0) >= maxQ });

    const btnRemQ = this.btn(user, '🗑️ Remover Última', 4, async (i) => {
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
      { label: '30 segundos',  value: '30'  },
      { label: '1 minuto',     value: '60'  },
      { label: '2 minutos',    value: '120' },
      { label: '5 minutos',    value: '300' },
      { label: '10 minutos',   value: '600' },
      { label: '✏️ Personalizado (digitar)', value: 'custom' },
    ], `⏱️ Tempo por pergunta — Atual: ${timeoutSec}s`, async (i) => {
      if (i.data.values[0] === 'custom') {
        const resp = await this._ask(i, `${this._e('pensando')} Quantos **segundos** o usuário terá para responder cada pergunta? *(5 a 600)*`);
        if (resp === null) return;
        const sec = parseInt(resp);
        if (!sec || sec < 5 || sec > 600) {
          await this.followUpEphemeral(i, cv2Payload([cv2Text(`${this._e('emduvida')} Valor inválido! Use entre 5 e 600 segundos.`)], { ephemeral: true }));
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

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    /**
     * Onde mandar o resumo das respostas — só no ticket (padrão) ou
     * também/só num canal de log configurado.
     */
    const sendModeSel = this.select(user, [
      { label: '🎫 Só no ticket', value: '0', description: cfg.sendMode === 0 ? 'Selecionado' : undefined },
      { label: '📋 Canal de log', value: '1', description: cfg.sendMode === 1 ? 'Selecionado' : undefined },
    ], '📤 Onde mandar as respostas?', async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).seqQuestionsConfig.sendMode = Number(i.data.values[0]);
      await fd.save();
      return this.seqFormMenu(i, user, panelId);
    });

    const logChSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: '📋 Canal de log das respostas', channel_types: [0, 5] },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const fd = await this._getGuildDoc(i.guild_id);
        this._findPanel(fd, panelId).seqQuestionsConfig.logChannelId = i.data.values[0];
        await fd.save();
        return this.seqFormMenu(i, user, panelId);
      }
    });

    const blocks = [
      cv2Text(
        `# 📝 Form Sequencial ${this._e('animada')}\n` +
        (opts.successMsg ? `${opts.successMsg}\n\n` : '') +
        `Eu faço as perguntas no chat, uma de cada vez!\n` +
        `> Status: ${cfg.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
        `> Tempo por pergunta: ${timeoutSec}s\n` +
        `> Resumo vai pra: ${cfg.sendMode === 1 ? `📋 <#${cfg.logChannelId || '...'}>` : '🎫 o próprio ticket'}\n\n` +
        `**Perguntas (${cfg.questions?.length || 0}/${maxQ === Infinity ? '∞' : maxQ}):**\n${questionsList}`
      ),
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
      onAdded:     mi => this.seqFormMenu(mi, user, panelId, { successMsg: `${this._e('curtida')} Pergunta adicionada!` }),
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
    const typeSelect = this.client.interactions.createSelect({
      user,
      tempo: 120_000,
      data: {
        placeholder: 'Qual o tipo dessa pergunta?',
        options: QUESTION_TYPE_CHOICES,
      },
      funcao: async (si) => {
        const tipo = si.data.values[0];

        const fd = await this._getGuildDoc(guildId);
        const target = locateTarget(fd);
        target.seqQuestionsConfig = target.seqQuestionsConfig || { enabled: true, questions: [], timeout: 60000 };
        target.seqQuestionsConfig.questions = target.seqQuestionsConfig.questions || [];

        const check = await this._checkSeqQuestionLimit(guildId, target.seqQuestionsConfig.questions, tipo);
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
      data: cv2Payload([cv2Text('📋 Qual o tipo dessa pergunta?'), row(typeSelect)], { ephemeral: false }),
    });
  }

  /** Monta e exibe o modal certo pro tipo de pergunta escolhido. */
  async _seqAddQuestionModal(interaction, user, tipo, onSubmit) {
    const needsOptions = ['select', 'multiple', 'checkbox'].includes(tipo);

    const components = [
      { type: 1, components: [{ type: 4, custom_id: 'text', label: 'Texto da pergunta', style: 2, required: true, max_length: 300 }] },
    ];

    if (needsOptions) {
      components.push({
        type: 1,
        components: [{
          type: 4, custom_id: 'options', style: 2, required: true, max_length: 500,
          label: 'Opções (separadas por vírgula)',
          placeholder: 'Ex: Dúvida, Bug, Sugestão, Denúncia',
        }],
      });
    }

    components.push({ type: 1, components: [{ type: 4, custom_id: 'required', label: 'Obrigatória? (sim/não)', style: 1, required: false, max_length: 5, placeholder: 'sim' }] });

    const modal = this.client.interactions.createModal({
      user,
      title: 'Adicionar Pergunta',
      components,
      funcao: async (mi, _, fields) => onSubmit(mi, fields),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ═══════════════════════════════════════
     AUTO-CARGO
  ═══════════════════════════════════════ */

  async _autoRoleAskTipo(interaction, user, panelId, roleId) {
    const sel = this.select(user, [
      { label: '♾️ Permanente',        value: '0', description: 'O cargo fica para sempre' },
      { label: '⏱️ Temporário',        value: '1', description: 'Removido após X minutos' },
      { label: '🔗 Vinculado ao Ticket', value: '2', description: 'Removido quando o ticket fechar' },
    ], `Tipo do cargo <@&${roleId}>`, async (i) => {
      const tipo = Number(i.data.values[0]);

      if (tipo === 1) {
        const resp = await this._ask(i, `${this._e('pensando')} Em quantos **minutos** o cargo <@&${roleId}> deve ser removido?`);
        if (resp === null) return this.autoRoleMenu(i, user, panelId);
        const min = parseInt(resp);
        if (!min || min < 1) {
          await this.followUpEphemeral(i, cv2Payload([cv2Text(`${this._e('emduvida')} Valor inválido!`)], { ephemeral: true }));
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
      cv2Text(`# 🏷️ Esse cargo é... ${this._e('pensando')}\nComo o cargo <@&${roleId}> deve se comportar?`),
      cv2Divider(),
      row(sel),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async autoRoleMenu(interaction, user, panelId) {
    const doc   = await this._getGuildDoc(interaction.guild_id);
    const panel = this._findPanel(doc, panelId);
    const cfg   = panel.autoRoleConfig || { enabled: false, roles: [] };

    const tipoLabel = (tipo, duration) => {
      if (tipo === 1) return `⏱️ Temporário (${Math.round((duration || 0) / 60000)}min)`;
      if (tipo === 2) return `🔗 Vinculado (some quando o ticket fecha)`;
      return '♾️ Permanente';
    };

    const rolesList = cfg.roles?.length
      ? cfg.roles.map(r => `<@&${r.roleId}> — ${tipoLabel(r.tipo, r.duration)}`).join('\n')
      : '_Nenhum cargo configurado_';

    const btnToggle = this.btn(user, cfg.enabled ? '⏸️ Desativar' : '▶️ Ativar', cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.autoRoleConfig.enabled = !fp.autoRoleConfig.enabled;
      await fd.save();
      return this.autoRoleMenu(i, user, panelId);
    });

    const roleSel = this.client.interactions.createRoleSelect({
      user, data: { placeholder: '➕ Adicionar cargo automático (dado ao abrir o ticket)' },
      funcao: async (i) => {
        // Pede o tipo antes de salvar
        return this._autoRoleAskTipo(i, user, panelId, i.data.values[0]);
      }
    });

    const btnRemRole = this.btn(user, '🗑️ Remover Último', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).autoRoleConfig.roles.pop();
      await fd.save();
      return this.autoRoleMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(
        `# 🏷️ Auto-Cargo ${this._e('feliz')}\n` +
        `Dou um cargo automático pra quem abre o ticket!\n` +
        `> Status: ${cfg.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n\n` +
        `> ♾️ Permanente — fica pra sempre\n` +
        `> ⏱️ Temporário — some depois de X minutos\n` +
        `> 🔗 Vinculado — some quando o ticket fecha\n\n` +
        `**Cargos:**\n${rolesList}`
      ),
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

    const btnToggle = this.btn(user, cfg.enabled ? '⏸️ Desativar' : '▶️ Ativar', cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.transcriptConfig.enabled = !fp.transcriptConfig.enabled;
      await fd.save();
      return this.transcriptMenu(i, user, panelId);
    });

    const chSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: '📌 Canal para salvar transcripts', channel_types: [0, 5] },
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

    const btnDmToggle = this.btn(user, cfg.sendToUser ? '🔕 Não enviar DM' : '🔔 Enviar DM ao usuário', 2, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.transcriptConfig.sendToUser = !fp.transcriptConfig.sendToUser;
      await fd.save();
      return this.transcriptMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(
        `# 📄 Transcript ${this._e('feliz')}\n` +
        `Guardo um histórico da conversa quando o ticket fecha!\n` +
        `> Status: ${cfg.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
        `> Canal: ${cfg.channelId ? `<#${cfg.channelId}>` : 'nenhum ainda'}\n` +
        `> Mandar por DM: ${cfg.sendToUser ? '✅ Sim' : '❌ Não'}`
      ),
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

    const fieldDefs = [
      { key: 'ticketCriadoTitulo',    label: '🎫 Ticket Criado — Título',          vars: '' },
      { key: 'ticketCriadoDescricao', label: '🎫 Ticket Criado — Descrição',       vars: '{user}' },
      { key: 'fecharBotaoLabel',      label: '🔒 Texto do Botão Fechar',           vars: '' },
      { key: 'fechandoMensagem',      label: '🔒 Mensagem ao Fechar',              vars: '' },
      { key: 'modalRespostasTitulo',  label: '📋 Título das Respostas do Modal',   vars: '' },
      { key: 'seqInicioTitulo',       label: '📝 Form Sequencial — Título Início', vars: '' },
      { key: 'seqInicioDescricao',    label: '📝 Form Sequencial — Descrição Início', vars: '{user} {timeout}' },
      { key: 'seqCanceladoMensagem',  label: '📝 Form Sequencial — Mensagem Cancelado', vars: '' },
      { key: 'seqResumoTitulo',       label: '📝 Form Sequencial — Título do Resumo', vars: '' },
      { key: 'transcriptTitulo',      label: '📄 Transcript — Título no canal',    vars: '' },
      { key: 'transcriptDmTitulo',    label: '📄 Transcript — Título na DM',       vars: '' },
      { key: 'transcriptDmDescricao', label: '📄 Transcript — Descrição na DM',    vars: '{user}' },
    ];

    const select = this.select(user, fieldDefs.map(f => ({
      label: f.label.slice(0, 100),
      value: f.key,
      description: m[f.key] ? '✏️ Personalizada' : '— Padrão da Ayami',
    })), 'Escolher mensagem para editar', async (i) => {
      return this._editarMensagem(i, user, panelId, fieldDefs.find(f => f.key === i.data.values[0]));
    });

    const btnResetAll = this.btn(user, '🧹 Restaurar Todas ao Padrão', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).mensagensConfig = {};
      await fd.save();
      return this.mensagensMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.painelMenu(i, user, panelId);
    });

    const statusList = fieldDefs
      .map(f => `${m[f.key] ? '✏️' : '⚪'} ${f.label}`)
      .join('\n');

    const blocks = [
      cv2Text(
        `# 💬 Mensagens ${this._e('carinho')}\n` +
        `Deixa tudo com a sua cara! O que não mexer, eu cuido~\n\n${statusList}`
      ),
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

    const modal = this.client.interactions.createModal({
      user,
      title: fieldDef.label.slice(0, 45),
      components: [{
        type: 1,
        components: [{
          type: 4, custom_id: 'texto',
          label: `Texto${fieldDef.vars ? ` (vars: ${fieldDef.vars})` : ''}`.slice(0, 45),
          style: 2, required: false, max_length: 1000,
          value: atual,
          placeholder: 'Deixe vazio para usar o texto padrão da Ayami',
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

    const btnToggle = this.btn(user, cfg.enabled ? '⏸️ Desativar Select Hub' : '▶️ Ativar Select Hub', cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.enabled = !fp.selectMenuConfig.enabled;
      await fd.save();
      return this.selectHubMenu(i, user, panelId);
    });

    const btnPlaceholder = this.btn(user, '✏️ Texto do Select', 2, async (i) => {
      const resp = await this._ask(i, `${this._e('pensando')} Qual o texto exibido no select menu (placeholder)?`);
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).selectMenuConfig.placeholder = resp.trim().slice(0, 100);
      await fd.save();
      return this.selectHubMenu(i, user, panelId);
    });

    const btnAddOption = this.btn(user, '➕ Criar Opção', 1, async (i) => {
      return this._selectAddOption(i, user, panelId);
    }, { disabled: (cfg.options?.length || 0) >= 25 });

    const components = [];

    if (cfg.options?.length) {
      const editSel = this.select(user, cfg.options.map(o => ({
        label: `⚙️ ${o.label}`.slice(0, 100),
        value: o.optionId,
        description: 'Configurar staff, modal, form e embed desta opção',
      })), '⚙️ Configurar uma opção existente', async (i) => {
        await this.deferUpdate(i);
        return this.selectOptionMenu(i, user, panelId, i.data.values[0]);
      });
      components.push(row(editSel));
    }

    const btnRemOption = this.btn(user, '🗑️ Remover Última Opção', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      this._findPanel(fd, panelId).selectMenuConfig.options.pop();
      await fd.save();
      return this.selectHubMenu(i, user, panelId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
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
      : '_Nenhuma opção criada_';

    const blocks = [
      cv2Text(
        `# 🧩 Select Menu ${this._e('animada')}\n` +
        (opts.successMsg ? `${opts.successMsg}\n\n` : '') +
        `Em vez de um botão só, mostro várias opções de atendimento!\n` +
        `Cada uma com seu próprio staff, modal e formulário ${this._e('feliz')}\n\n` +
        `> Status: ${cfg.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n\n` +
        `**Opções (${cfg.options?.length || 0}/25):**\n${optionsList}`
      ),
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
    const modal = this.client.interactions.createModal({
      user,
      title: 'Nova Opção do Select',
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'label', label: 'Nome da opção', style: 1, required: true, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: 'Descrição (opcional)', style: 1, required: false, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'emoji', label: 'Emoji (opcional)', style: 1, required: false, max_length: 50 }] },
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
          successMsg: `${this._e('festa')} Opção **${fields.label.trim()}** criada! Configure-a abaixo.`
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

    if (!option) {
      return this.followUpEphemeral(interaction, cv2Payload([cv2Text(`❌ Opção não encontrada.`)]));
    }

    const btnEmbed = this.btn(user, option.embedBoasVindas ? '🎨 Editar Embed' : '✨ Criar Embed', 1, async (i) => {
      return EmbedBuilderUI.open(i, this.client, {
        user,
        existingEmbed: option.embedBoasVindas,
        title: `Embed de Boas-Vindas — ${option.label}`,
        onDone: async (rootInteraction, embedResult) => {
          const fd = await this._getGuildDoc(rootInteraction.guild_id);
          const fp = this._findPanel(fd, panelId);
          const fo = fp.selectMenuConfig.options.find(o => o.optionId === optionId);
          fo.embedBoasVindas = embedResult;
          await fd.save();
          return this.selectOptionMenu(rootInteraction, user, panelId, optionId, {
            successMsg: embedResult ? `${this._e('curtida')} Embed de boas-vindas atualizada!` : `${this._e('emduvida')} Embed removida.`
          });
        }
      });
    });

    const roleSel = this.client.interactions.createRoleSelect({
      user, data: { placeholder: '👥 Adicionar cargo staff desta opção', max_values: 5 },
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

    const btnClearStaff = this.btn(user, '🧹 Limpar Staff', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).cargosStaff = [];
      await fd.save();
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const btnNome = this.btn(user, '✏️ Nome do Ticket', 2, async (i) => {
      const resp = await this._ask(i, `${this._e('pensando')} Nome dos tickets criados por esta opção? Use \`{count}\` para o número.`);
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).ticketChatName = resp.trim().slice(0, 90);
      await fd.save();
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const btnModal = this.btn(user, `📋 Modal (${option.modalConfig?.enabled ? 'Ativo' : 'Inativo'})`, 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnSeqForm = this.btn(user, `📝 Form Sequencial (${option.seqQuestionsConfig?.enabled ? 'Ativo' : 'Inativo'})`, 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const btnDelete = this.btn(user, '🗑️ Excluir Opção', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options = fp.selectMenuConfig.options.filter(o => o.optionId !== optionId);
      await fd.save();
      return this.selectHubMenu(i, user, panelId, { successMsg: `${this._e('chorando')} Opção **${option.label}** excluída.` });
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectHubMenu(i, user, panelId);
    });

    const blocks = [
      cv2Text(
        `# ${option.emoji || '⚙️'} ${option.label} ${this._e('feliz')}\n` +
        (opts.successMsg ? `${opts.successMsg}\n\n` : '') +
        `> 🎨 Embed: ${option.embedBoasVindas ? 'pronta!' : 'falta criar'}\n` +
        `> 🛡️ Staff: ${option.cargosStaff?.length ? option.cargosStaff.map(r => `<@&${r}>`).join(', ') : 'ninguém ainda'}\n` +
        `> 🏷️ Nome: \`${option.ticketChatName || panel.ticketChatName || 'ticket-{count}'}\``
      ),
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

    const fieldsList = cfg.fields?.length
      ? cfg.fields.map((f, i) => `\`${i + 1}.\` **${f.label}** (${f.style === 2 ? 'parágrafo' : 'curto'})${f.required ? ' *obrigatório*' : ''}`).join('\n')
      : '_Nenhum campo adicionado_';

    const btnToggle = this.btn(user, cfg.enabled ? '⏸️ Desativar Modal' : '▶️ Ativar Modal', cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).modalConfig.enabled = !cfg.enabled;
      await fd.save();
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnTitulo = this.btn(user, '✏️ Título do Modal', 2, async (i) => {
      const resp = await this._ask(i, `${this._e('pensando')} Título do modal desta opção?`);
      if (resp === null) return;
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).modalConfig.title = resp.trim().slice(0, 45);
      await fd.save();
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnAddField = this.btn(user, '➕ Adicionar Campo', 1, async (i) => {
      return this._selectOptionModalAddField(i, user, panelId, optionId);
    }, { disabled: (cfg.fields?.length || 0) >= 5 });

    const btnRemField = this.btn(user, '🗑️ Remover Último Campo', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).modalConfig.fields.pop();
      await fd.save();
      return this.selectOptionModalMenu(i, user, panelId, optionId);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const blocks = [
      cv2Text(
        `# 📋 Modal — ${option.label} ${this._e('feliz')}\n` +
        (opts.successMsg ? `${opts.successMsg}\n\n` : '') +
        `> Status: ${cfg.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
        `> Título: \`${cfg.title || 'Formulário de Atendimento'}\`\n\n` +
        `**Campos (${cfg.fields?.length || 0}/5):**\n${fieldsList}`
      ),
      cv2Divider(),
      row(btnToggle, btnTitulo),
      row(btnAddField, btnRemField),
      cv2Divider(),
      row(btnBack),
    ];

    return this.editOriginal(interaction, cv2Payload(blocks, { ephemeral: false, accentColor: COLOR.main }));
  }

  async _selectOptionModalAddField(interaction, user, panelId, optionId) {
    const modal = this.client.interactions.createModal({
      user,
      title: 'Adicionar Campo do Modal',
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'label', label: 'Pergunta/Label do campo', style: 1, required: true, max_length: 45 }] },
        { type: 1, components: [{ type: 4, custom_id: 'placeholder', label: 'Placeholder (opcional)', style: 1, required: false, max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'style', label: 'Estilo: curto ou paragrafo', style: 1, required: true, max_length: 10, placeholder: 'curto' }] },
        { type: 1, components: [{ type: 4, custom_id: 'required', label: 'Obrigatório? (sim/não)', style: 1, required: false, max_length: 5, placeholder: 'sim' }] },
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
        return this.selectOptionModalMenu(mi, user, panelId, optionId, { successMsg: `${this._e('curtida')} Campo adicionado!` });
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

    const questionsList = cfg.questions?.length
      ? cfg.questions.map((q, i) => `\`${i + 1}.\` ${q.label} \`[${q.tipo || 'text'}]\`${q.required ? ' *obrigatória*' : ''}`).join('\n')
      : '_Nenhuma pergunta adicionada_';

    const btnToggle = this.btn(user, cfg.enabled ? '⏸️ Desativar Form' : '▶️ Ativar Form', cfg.enabled ? 4 : 3, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.enabled = !cfg.enabled;
      await fd.save();
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const btnAddQ = this.btn(user, '➕ Adicionar Pergunta', 1, async (i) => {
      return this._selectOptionSeqAddQuestion(i, user, panelId, optionId);
    }, { disabled: (cfg.questions?.length || 0) >= maxQ });

    const btnRemQ = this.btn(user, '🗑️ Remover Última', 4, async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.questions.pop();
      await fd.save();
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const timeoutSel = this.select(user, [
      { label: '30 segundos',  value: '30'  },
      { label: '1 minuto',     value: '60'  },
      { label: '2 minutos',    value: '120' },
      { label: '5 minutos',    value: '300' },
      { label: '10 minutos',   value: '600' },
      { label: '✏️ Personalizado (digitar)', value: 'custom' },
    ], `⏱️ Tempo por pergunta — Atual: ${timeoutSec}s`, async (i) => {
      if (i.data.values[0] === 'custom') {
        const resp = await this._ask(i, `${this._e('pensando')} Quantos **segundos** para responder cada pergunta? *(5 a 600)*`);
        if (resp === null) return;
        const sec = parseInt(resp);
        if (!sec || sec < 5 || sec > 600) {
          await this.followUpEphemeral(i, cv2Payload([cv2Text(`${this._e('emduvida')} Valor inválido! Use entre 5 e 600 segundos.`)], { ephemeral: true }));
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

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.selectOptionMenu(i, user, panelId, optionId);
    });

    const sendModeSel = this.select(user, [
      { label: '🎫 Só no ticket', value: '0', description: cfg.sendMode === 0 ? 'Selecionado' : undefined },
      { label: '📋 Canal de log', value: '1', description: cfg.sendMode === 1 ? 'Selecionado' : undefined },
    ], '📤 Onde mandar as respostas?', async (i) => {
      await this.deferUpdate(i);
      const fd = await this._getGuildDoc(i.guild_id);
      const fp = this._findPanel(fd, panelId);
      fp.selectMenuConfig.options.find(o => o.optionId === optionId).seqQuestionsConfig.sendMode = Number(i.data.values[0]);
      await fd.save();
      return this.selectOptionSeqFormMenu(i, user, panelId, optionId);
    });

    const logChSel = this.client.interactions.createChannelSelect({
      user, data: { placeholder: '📋 Canal de log das respostas', channel_types: [0, 5] },
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
      cv2Text(
        `# 📝 Form Sequencial — ${option.label} ${this._e('animada')}\n` +
        (opts.successMsg ? `${opts.successMsg}\n\n` : '') +
        `> Status: ${cfg.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
        `> Tempo por pergunta: ${timeoutSec}s\n` +
        `> Resumo vai pra: ${cfg.sendMode === 1 ? `📋 <#${cfg.logChannelId || '...'}>` : '🎫 o próprio ticket'}\n\n` +
        `**Perguntas (${cfg.questions?.length || 0}/${maxQ === Infinity ? '∞' : maxQ}):**\n${questionsList}`
      ),
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
      onAdded: mi => this.selectOptionSeqFormMenu(mi, user, panelId, optionId, { successMsg: `${this._e('curtida')} Pergunta adicionada!` }),
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
    if (!panel) return this.reply(interaction, { content: '❌ Painel não encontrado.', flags: 64 });

    return this._startTicketFlow(interaction, doc, panel, null);
  }

  /** Select Menu Hub — usuário escolheu uma opção. */
  async createFromSelect(interaction) {
    const data    = JSON.parse(interaction.data.custom_id);
    const doc     = await this._getGuildDoc(interaction.guild_id);
    const panel   = this._findPanel(doc, data.p);
    if (!panel) return this.reply(interaction, { content: '❌ Painel não encontrado.', flags: 64 });

    const optionId = interaction.data.values[0];
    const option    = panel.selectMenuConfig.options.find(o => o.optionId === optionId);
    if (!option) return this.reply(interaction, { content: '❌ Opção não encontrada.', flags: 64 });

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
    const modal = this.client.interactions.createModal({
      user:  interaction.member?.user?.id || interaction.user?.id,
      title: modalCfg.title || 'Formulário de Atendimento',
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
    const tituloCriado = resolveMsg(fp, 'ticketCriadoTitulo', '🎫 Ticket Criado');
    const descCriado    = resolveMsg(fp, 'ticketCriadoDescricao',
      'Olá {user}! Sua solicitação foi recebida.\nUm membro da equipe responderá em breve.',
      { userId }
    );

    const embedBoasVindas = fo?.embedBoasVindas || fp.painelPrincipal;

    const respostasText = Object.keys(modalAnswers).length
      ? Object.entries(modalAnswers).map(([k, v]) => `**${k}:** ${v}`).join('\n')
      : null;

    const fecharLabel = resolveMsg(fp, 'fecharBotaoLabel', 'Fechar Ticket');

    await DiscordRequest(`/channels/${channel.id}/messages`, {
      method: 'POST',
      body: {
        content: `<@${userId}>` + (staffRoles.length ? ` ${staffRoles.map(r => `<@&${r}>`).join(' ')}` : ''),
        embeds: [
          { title: tituloCriado, description: descCriado, color: 0x7C8FFF },
          ...(embedBoasVindas ? [embedBoasVindas] : []),
          ...(respostasText ? [{ title: resolveMsg(fp, 'modalRespostasTitulo', '📋 Respostas do Formulário'), description: respostasText, color: 0xFFD966 }] : []),
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
        messages: {
          inicioTitulo:      resolveMsg(fp, 'seqInicioTitulo', '📋 Formulário de Atendimento'),
          inicioDescricao:   resolveMsg(fp, 'seqInicioDescricao', 'Olá {user}! Vou te fazer algumas perguntas.\nVocê tem {timeout}s para responder cada uma.', { userId, timeout: Math.round((seqCfg.timeout ?? 60000) / 1000) }),
          canceladoMensagem: resolveMsg(fp, 'seqCanceladoMensagem', '⚠️ Formulário encerrado.'),
          resumoTitulo:      resolveMsg(fp, 'seqResumoTitulo', '✅ Respostas Recebidas'),
        }
      }).catch(err => console.error('[TicketSystem] Erro no form sequencial:', err));
    }

    const successMsg = `${this._e('feliz') || '✅'} Ticket criado em <#${channel.id}>!`;

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

    const fechandoMsg = resolveMsg(panel, 'fechandoMensagem', '⛔ Este ticket será fechado em 10 segundos...');

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
          canalTitulo: resolveMsg(panel, 'transcriptTitulo', '📄 Transcript'),
          dmTitulo:    resolveMsg(panel, 'transcriptDmTitulo', '📄 Seu Transcript'),
          dmDescricao: resolveMsg(panel, 'transcriptDmDescricao', 'Aqui está o histórico do seu atendimento, {user}!', { userId: ownerId }),
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

    setTimeout(() => {
      DiscordRequest(`/channels/${data.ch}`, { method: 'DELETE' }).catch(() => {});
    }, 10_000);
  }
}

module.exports = TicketSystem;
