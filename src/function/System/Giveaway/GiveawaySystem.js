'use strict';

const DiscordRequest  = require('../../DiscordRequest.js');
const GiveawayDb      = require('../../../Mongodb/giveaway.js');
const AuthorizationDb = require('../../../Mongodb/giveawayAuthorization.js');
const GiveawayDraw    = require('./Utils/GiveawayDraw.js');
const GiveawayEmbed   = require('./Utils/GiveawayEmbed.js');
const GiveawayExport  = require('./Utils/GiveawayExport.js');
const PremiumManager  = require('../../Utils/PremiumManager.js');

const E = Object.freeze({
  feliz:    '<:ayamifeliz:1513904597649981561>',
  animada:  '<:ayamianimada:1513895694824378408>',
  festa:    '<:ayamifesta:1513895771676737746>',
  pensando: '<:ayamipensando:1513891183036989533>',
});

const DEFAULT_COLOR = 0xFFB7C5;
const TIMEOUT_MS    = 120_000;

class GiveawaySystem {

  constructor(client) {
    this.client  = client;
    this._drafts = new Map();
  }

  /* ═══════════════════════════════════════
     HELPERS — DISCORD
  ═══════════════════════════════════════ */

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

  // Edita SEMPRE a mensagem original — única msg de configuração visível
  async editOriginal(interaction, data) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body: data }
    );
  }

  // followUp ephemeral — para perguntas "envie isso" e feedbacks rápidos
  // Sempre deleta depois de receber a resposta para manter o chat limpo
  async followUpEphemeral(interaction, data) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}`,
      { method: 'POST', body: { ...data, flags: 64 } }
    );
  }

  async deleteFollowUp(interaction, messageId) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/${messageId}`,
      { method: 'DELETE' }
    ).catch(() => {});
  }

  async deleteMsg(channelId, messageId) {
    return DiscordRequest(
      `/channels/${channelId}/messages/${messageId}`,
      { method: 'DELETE' }
    ).catch(() => {});
  }

  btn(user, label, style, func) {
    return this.client.interactions.createButton({ user, data: { label, style }, funcao: func });
  }

  select(user, options, placeholder, func) {
    return this.client.interactions.createSelect({ user, data: { placeholder, options }, funcao: func });
  }

  row(...components) {
    return { type: 1, components };
  }

  /* ═══════════════════════════════════════
     HELPER CENTRAL — _ask

     Fluxo:
       1. editOriginal → mantém a tela de config com indicador "aguardando"
       2. followUpEphemeral → pergunta efêmera "envie isso"
       3. NextMessageCollector → aguarda resposta do user
       4. Deleta: followUp efêmero + msg do user
       5. Retorna o conteúdo (ou null se timeout/cancelar)
  ═══════════════════════════════════════ */

  async _ask(interaction, draft, questionEmbed) {

    // 1. Atualiza a msg original mostrando que está aguardando input
    await this.editOriginal(interaction, {
      embeds: [{
        ...this._embedDraft(draft),
        footer: { text: '⌨️ Aguardando sua resposta no chat...' },
      }],
      components: [],
    });

    // 2. followUp efêmero com a pergunta
    const prompt = await this.followUpEphemeral(interaction, {
      embeds: [{
        description: questionEmbed,
        color: DEFAULT_COLOR,
        footer: { text: 'Digite "cancelar" para cancelar. Tempo: 2 minutos.' }
      }]
    });

    // 3. Aguarda msg do user
    try {
      const msg = await this.client.NextMessageCollector.wait({
        channelId: interaction.channel_id,
        userId:    interaction.member?.user?.id || interaction.user?.id,
        timeout:   TIMEOUT_MS,
      });

      // 4. Limpa: followUp efêmero + msg do user
      if (prompt?.id) this.deleteFollowUp(interaction, prompt.id);
      this.deleteMsg(interaction.channel_id, msg.id);

      if (msg.content?.toLowerCase() === 'cancelar') return null;
      return msg.content;

    } catch {
      if (prompt?.id) this.deleteFollowUp(interaction, prompt.id);
      return null;
    }
  }

  /* ═══════════════════════════════════════
     HELPERS — DRAFT
  ═══════════════════════════════════════ */

  _getDraft(userId) {
    if (!this._drafts.has(userId)) {
      this._drafts.set(userId, {
        prize: null, description: '',
        channelId: null, winners: 1,
        duration: null, endsAt: null,
        color: DEFAULT_COLOR,
        thumbnail: null, banner: null, customMessage: null,
        bonusEntries: [], requirements: [],
        isMultiServer: false, multiMode: 'global', multiServers: [],
      });
    }
    return this._drafts.get(userId);
  }

  _clearDraft(userId) { this._drafts.delete(userId); }

  async isPremium(guildId) {
    const p = await PremiumManager.getGuildPremium(guildId);
    return p.status;
  }

  async save(doc) { await doc.save(); }
  _genId() { return 'giveaway_' + Date.now(); }

  _embedDraft(draft) {
    const endsTs = draft.endsAt ? Math.floor(new Date(draft.endsAt).getTime() / 1000) : null;
    return {
      title: `${E.animada} Configurando o Sorteio`,
      description: [
        `**Prêmio:** ${draft.prize || '—'}`,
        `**Descrição:** ${draft.description || '—'}`,
        `**Canal:** ${draft.channelId ? `<#${draft.channelId}>` : '—'}`,
        `**Vencedores:** ${draft.winners}`,
        `**Encerra:** ${endsTs ? `<t:${endsTs}:R>` : '—'}`,
        `**Entradas bônus:** ${draft.bonusEntries.length}`,
        `**Requisitos:** ${draft.requirements.length}`,
        `**Multi-Servidor:** ${draft.isMultiServer ? '✅' : '❌'}`,
      ].join('\n'),
      color: draft.color,
      thumbnail: draft.thumbnail ? { url: draft.thumbnail } : undefined,
      image:     draft.banner    ? { url: draft.banner }    : undefined,
    };
  }

  /* ═══════════════════════════════════════
     MENU PRINCIPAL
  ═══════════════════════════════════════ */

  async startMenu(interaction) {

    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const actives = await GiveawayDb.find({
      guildId, status: { $in: ['active', 'paused'] }
    }).lean();

    const selectOptions = actives.length
      ? actives.map(g => ({
          label:       g.prize.slice(0, 80),
          value:       g.giveawayId,
          description: `${g.participants.length} participante(s)`,
        }))
      : [{ label: 'Nenhum sorteio ativo', value: 'none' }];

    const selectSorteio = this.select(
      user, selectOptions, 'Selecionar sorteio para gerenciar',
      async (i) => {
        await this.deferUpdate(i);
        if (!actives.length) return;
        const doc = await GiveawayDb.findOne({ giveawayId: i.data.values[0] });
        return this.giveawayMenu(i, doc, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} Sistema de Sorteios`,
        description:
          `Olá! Bem-vindo ao painel de sorteios~\n\n` +
          `**Sorteios ativos:** ${actives.length}\n\n` +
          `Use \`/sorteio criar\` para criar um novo sorteio!`,
        color: DEFAULT_COLOR,
      }],
      components: actives.length ? [this.row(selectSorteio)] : [],
    });
  }

  /* ═══════════════════════════════════════
     CRIAÇÃO — /sorteio criar

     Regras:
       - Modal → único, só no comando (interação virgem)
       - Perguntas → followUpEphemeral (some após resposta)
       - Tela de config → sempre editOriginal
  ═══════════════════════════════════════ */

  async criar(interaction) {

    const user = interaction.member.user.id;
    this._clearDraft(user);

    const modal = this.client.interactions.createModal({
      user,
      title: '🎉 Criar Sorteio',
      components: [
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'prize',
            label: 'Qual é o prêmio?',
            style: 1, required: true, max_length: 200,
            placeholder: 'Ex: Nitro Classic por 1 mês',
          }]
        },
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'description',
            label: 'Descrição (opcional)',
            style: 2, required: false, max_length: 1000,
            placeholder: 'Descreva o prêmio ou informações extras...',
          }]
        },
      ],
      funcao: async (mi, _client, fields) => {

        const draft       = this._getDraft(user);
        draft.prize       = fields.prize.trim();
        draft.description = fields.description?.trim() || '';

        // ACK do modal — exibe a msg original pela primeira vez
        await DiscordRequest(
          `/interactions/${mi.id}/${mi.token}/callback`,
          {
            method: 'POST',
            body: {
              type: 4,
              data: {
                embeds: [this._embedDraft(draft)],
                components: [],
              //  flags: 64,
              }
            }
          }
        );

        return this._criarStep_Canal(mi, user);
      },
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ── Passo 1: Canal ───────────────────────────────────────── */

  async _criarStep_Canal(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} **Passo 1/4 — Canal**\n\n` +
      `Envie a **menção ou ID** do canal onde o sorteio será publicado:`
    );

    if (resp === null) {
      this._clearDraft(user);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} Criação cancelada.`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    const id = resp.match(/\d{17,19}/)?.[0];
    if (!id) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Canal inválido! Tente novamente.`, color: DEFAULT_COLOR }]
      });
      return this._criarStep_Canal(interaction, user);
    }

    draft.channelId = id;
    return this._criarStep_Vencedores(interaction, user);
  }

  /* ── Passo 2: Vencedores ──────────────────────────────────── */

  async _criarStep_Vencedores(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} **Passo 2/4 — Vencedores**\n\n` +
      `Quantos vencedores o sorteio terá? *(1 a 100)*`
    );

    if (resp === null) {
      this._clearDraft(user);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} Criação cancelada.`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    const n = parseInt(resp);
    if (!n || n < 1 || n > 100) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Número inválido! Use entre 1 e 100.`, color: DEFAULT_COLOR }]
      });
      return this._criarStep_Vencedores(interaction, user);
    }

    draft.winners = n;
    return this._criarStep_Duracao(interaction, user);
  }

  /* ── Passo 3: Duração ─────────────────────────────────────── */

  async _criarStep_Duracao(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} **Passo 3/4 — Duração**\n\n` +
      `Por quanto tempo o sorteio ficará aberto?\n\n` +
      `\`7d\` → 7 dias · \`12h\` → 12 horas · \`30m\` → 30 minutos`
    );

    if (resp === null) {
      this._clearDraft(user);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} Criação cancelada.`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    const ms = this._parseDuration(resp);
    if (!ms) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Duração inválida! Use \`1d\`, \`12h\` ou \`30m\`.`, color: DEFAULT_COLOR }]
      });
      return this._criarStep_Duracao(interaction, user);
    }

    draft.duration = ms;
    draft.endsAt   = new Date(Date.now() + ms);

    return this._telaExtras(interaction, user);
  }

  /* ── Tela de extras ───────────────────────────────────────── */

  async _telaExtras(interaction, user) {

    const draft   = this._getDraft(user);
    const premium = await this.isPremium(interaction.guild_id);

    const select = this.select(
      user,
      [
        { label: '🎁 Entradas Bônus',        value: 'bonus'   },
        { label: '✅ Requisitos',             value: 'reqs'    },
        { label: '🎨 Aparência',             value: 'visual'  },
        { label: premium ? '🌐 Multi-Servidor' : '🔒 Multi-Servidor (Premium)', value: 'multi' },
        { label: '📨 Mensagem Personalizada', value: 'msg'     },
        { label: '🚀 Publicar Sorteio',       value: 'publish' },
      ],
      'O que deseja configurar?',
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === 'bonus')   return this._telaBonus(i, user);
        if (v === 'reqs')    return this._telaReqs(i, user, premium);
        if (v === 'visual')  return this._telaVisual(i, user);
        if (v === 'multi')   return this._telaMulti(i, user, premium);
        if (v === 'msg')     return this._telaMsg(i, user);
        if (v === 'publish') return this._publicar(i, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        ...this._embedDraft(draft),
        footer: { text: 'Selecione uma opção ou clique em Publicar Sorteio.' }
      }],
      components: [this.row(select)],
    });
  }

  /* ═══════════════════════════════════════
     CONFIGURAÇÕES
     Regra: editOriginal para telas, followUpEphemeral para perguntas
  ═══════════════════════════════════════ */

  /* ── Bônus ────────────────────────────────────────────────── */

  async _telaBonus(interaction, user) {

    const draft = this._getDraft(user);
    const atual = draft.bonusEntries.length
      ? draft.bonusEntries.map(b => `<@&${b.roleId}> → +${b.entries} entradas`).join('\n')
      : 'Nenhuma configurada.';

    const btnAdd = this.btn(user, '➕ Adicionar', 3, async (i) => {
      await this.deferUpdate(i);
      return this._bonusAdd(i, user);
    });
    const btnDel = this.btn(user, '🗑 Remover Última', 4, async (i) => {
      await this.deferUpdate(i);
      draft.bonusEntries.pop();
      return this._telaBonus(i, user);
    });
    const btnVoltar = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this._telaExtras(i, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} Entradas Bônus`,
        description: `Cargos que concedem entradas extras.\n\n**Configuradas:**\n${atual}`,
        color: DEFAULT_COLOR,
      }],
      components: [this.row(btnAdd, btnDel, btnVoltar)],
    });
  }

  async _bonusAdd(interaction, user) {

    const draft = this._getDraft(user);

    // Pergunta o cargo — followUp efêmero, msg original continua visível
    const respRole = await this._ask(interaction, draft,
      `${E.animada} Envie a **menção ou ID** do cargo que receberá entradas bônus:`
    );
    if (!respRole) return this._telaBonus(interaction, user);

    const roleId = respRole.match(/\d{17,19}/)?.[0];
    if (!roleId) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Cargo inválido!`, color: DEFAULT_COLOR }]
      });
      return this._telaBonus(interaction, user);
    }

    const respQtd = await this._ask(interaction, draft,
      `${E.animada} Quantas entradas extras o cargo <@&${roleId}> receberá?`
    );
    if (!respQtd) return this._telaBonus(interaction, user);

    const entries = parseInt(respQtd);
    if (!entries || entries < 1) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Número inválido!`, color: DEFAULT_COLOR }]
      });
      return this._telaBonus(interaction, user);
    }

    draft.bonusEntries.push({ roleId, entries, label: '' });
    return this._telaBonus(interaction, user);
  }

  /* ── Requisitos ───────────────────────────────────────────── */

  async _telaReqs(interaction, user, premium) {

    const draft = this._getDraft(user);
    const atual = draft.requirements.length
      ? draft.requirements.map((r, i) => `\`${i + 1}.\` ${this._reqLabel(r)}`).join('\n')
      : 'Nenhum configurado.';

    const options = [
      { label: '🔒 Cargo obrigatório',      value: 'REQUIRED_ROLE' },
      { label: '🚫 Cargo proibido',          value: 'FORBIDDEN_ROLE' },
      { label: '💬 Mínimo de mensagens',     value: 'MIN_MESSAGES' },
      { label: '📅 Dias no servidor',        value: 'MIN_DAYS_IN_SERVER' },
      { label: '🎂 Idade mínima da conta',   value: 'MIN_ACCOUNT_AGE' },
      { label: '🌐 Estar em outro servidor', value: 'IN_SERVER' },
      ...(premium ? [
        { label: '🔑 Cargo em outro servidor',      value: 'REQUIRED_ROLE_IN_SERVER' },
        { label: '🚫 Sem cargo em outro servidor',  value: 'FORBIDDEN_ROLE_IN_SERVER' },
        { label: '📅 Dias em outro servidor',       value: 'MIN_DAYS_IN_EXT_SERVER' },
        { label: '💬 Msgs em outro servidor',       value: 'MIN_MESSAGES_IN_EXT_SERVER' },
        { label: '📞 Horas em call',                value: 'MIN_HOURS_IN_CALL' },
        { label: '⭐ Nível mínimo',                 value: 'MIN_LEVEL' },
        { label: '✨ XP mínima',                    value: 'MIN_XP' },
        { label: '🚀 Cargo Booster',                value: 'HAS_BOOSTER_ROLE' },
        { label: '💙 Cargo Apoiador',               value: 'HAS_SUPPORTER_ROLE' },
      ] : []),
    ];

    const selectReq = this.select(user, options, 'Adicionar requisito', async (i) => {
      await this.deferUpdate(i);
      return this._reqAdd(i, user, i.data.values[0], premium);
    });

    const btnDel = this.btn(user, '🗑 Remover Último', 4, async (i) => {
      await this.deferUpdate(i);
      draft.requirements.pop();
      return this._telaReqs(i, user, premium);
    });
    const btnVoltar = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this._telaExtras(i, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} Requisitos`,
        description:
          `Verificados **apenas no momento do sorteio**, não na entrada.\n\n` +
          `**Configurados:**\n${atual}`,
        color: DEFAULT_COLOR,
      }],
      components: [this.row(selectReq), this.row(btnDel, btnVoltar)],
    });
  }

  async _reqAdd(interaction, user, type, premium) {

    const draft = this._getDraft(user);

    const premiumTypes = [
      'REQUIRED_ROLE_IN_SERVER', 'FORBIDDEN_ROLE_IN_SERVER',
      'MIN_DAYS_IN_EXT_SERVER', 'MIN_MESSAGES_IN_EXT_SERVER',
      'MIN_HOURS_IN_CALL', 'MIN_LEVEL', 'MIN_XP',
      'HAS_BOOSTER_ROLE', 'HAS_SUPPORTER_ROLE',
    ];

    if (premiumTypes.includes(type) && !premium) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `🔒 Este requisito é exclusivo premium!`, color: DEFAULT_COLOR }]
      });
      return this._telaReqs(interaction, user, premium);
    }

    const externalTypes = [
      'IN_SERVER', 'REQUIRED_ROLE_IN_SERVER', 'FORBIDDEN_ROLE_IN_SERVER',
      'MIN_DAYS_IN_EXT_SERVER', 'MIN_MESSAGES_IN_EXT_SERVER',
      'HAS_BOOSTER_ROLE', 'HAS_SUPPORTER_ROLE',
    ];

    let guildId = null;

    if (externalTypes.includes(type)) {

      const resp = await this._ask(interaction, draft,
        `${E.animada} Envie o **ID do servidor** alvo:`
      );
      if (!resp) return this._telaReqs(interaction, user, premium);

      guildId = resp.match(/\d{17,19}/)?.[0];
      if (!guildId) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} ID inválido!`, color: DEFAULT_COLOR }]
        });
        return this._telaReqs(interaction, user, premium);
      }

      const inServer = await this._checkBotInGuild(guildId);
      if (!inServer) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} Não estou no servidor \`${guildId}\`!`, color: DEFAULT_COLOR }]
        });
        return this._telaReqs(interaction, user, premium);
      }

      const level      = type === 'IN_SERVER' ? 'basic' : 'advanced';
      const authorized = await this._checkAuthorization(guildId, interaction.guild_id, level);

      if (!authorized) {
        await this._requestAuthorization(interaction, guildId, interaction.guild_id, level);
        return this._telaReqs(interaction, user, premium);
      }
    }

    const needsValue = {
      REQUIRED_ROLE:             `Envie a **menção ou ID** do cargo obrigatório:`,
      FORBIDDEN_ROLE:            `Envie a **menção ou ID** do cargo proibido:`,
      MIN_MESSAGES:              `Quantas **mensagens mínimas**? *(número)*`,
      MIN_DAYS_IN_SERVER:        `Quantos **dias mínimos** no servidor? *(número)*`,
      MIN_ACCOUNT_AGE:           `Quantos **dias mínimos** de conta? *(número)*`,
      REQUIRED_ROLE_IN_SERVER:   `Envie a **menção ou ID** do cargo no servidor externo:`,
      FORBIDDEN_ROLE_IN_SERVER:  `Envie a **menção ou ID** do cargo proibido no externo:`,
      MIN_DAYS_IN_EXT_SERVER:    `Quantos **dias mínimos** no servidor externo? *(número)*`,
      MIN_MESSAGES_IN_EXT_SERVER:`Quantas **mensagens mínimas** no servidor externo? *(número)*`,
      MIN_HOURS_IN_CALL:         `Quantas **horas mínimas** em call? *(número)*`,
      MIN_LEVEL:                 `Qual o **nível mínimo**? *(número)*`,
      MIN_XP:                    `Qual a **XP mínima**? *(número)*`,
    };

    let value = null;

    if (needsValue[type]) {
      const resp = await this._ask(interaction, draft,
        `${E.animada} ${needsValue[type]}`
      );
      if (!resp) return this._telaReqs(interaction, user, premium);

      const isRole = type.includes('ROLE');
      value = isRole ? (resp.match(/\d{17,19}/)?.[0] || null) : resp.trim();

      if (!value) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} Valor inválido!`, color: DEFAULT_COLOR }]
        });
        return this._telaReqs(interaction, user, premium);
      }
    }

    draft.requirements.push({ type, value, guildId });
    return this._telaReqs(interaction, user, premium);
  }

  /* ── Visual ───────────────────────────────────────────────── */

  async _telaVisual(interaction, user) {

    const draft = this._getDraft(user);

    const respCor = await this._ask(interaction, draft,
      `${E.animada} **Aparência — Cor**\n\nEnvie a cor em **hex** *(ex: \`#FFB7C5\`)* ou \`pular\`:`
    );
    if (respCor && respCor.toLowerCase() !== 'pular') {
      const parsed = parseInt(respCor.trim().replace('#', ''), 16);
      if (!isNaN(parsed)) draft.color = parsed;
    }

    const respThumb = await this._ask(interaction, draft,
      `${E.animada} **Aparência — Thumbnail**\n\nEnvie a URL da thumbnail ou \`pular\`:`
    );
    if (respThumb && respThumb.toLowerCase() !== 'pular' && respThumb.startsWith('http')) {
      draft.thumbnail = respThumb.trim();
    }

    const respBanner = await this._ask(interaction, draft,
      `${E.animada} **Aparência — Banner**\n\nEnvie a URL do banner *(imagem grande)* ou \`pular\`:`
    );
    if (respBanner && respBanner.toLowerCase() !== 'pular' && respBanner.startsWith('http')) {
      draft.banner = respBanner.trim();
    }

    return this._telaExtras(interaction, user);
  }

  /* ── Mensagem personalizada ───────────────────────────────── */

  async _telaMsg(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} Envie a **mensagem personalizada** que aparecerá na embed do sorteio, ou \`pular\`:`
    );
    if (resp && resp.toLowerCase() !== 'pular') {
      draft.customMessage = resp.slice(0, 500);
    }

    return this._telaExtras(interaction, user);
  }

  /* ── Multi-servidor ───────────────────────────────────────── */

  async _telaMulti(interaction, user, premium) {

    if (!premium) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `🔒 Sorteios Multi-Servidor são exclusivos premium!`, color: DEFAULT_COLOR }]
      });
      return this._telaExtras(interaction, user);
    }

    const draft = this._getDraft(user);
    const atual = draft.multiServers.length
      ? draft.multiServers.map(s =>
          `\`${s.guildId}\` — <#${s.channelId}> — ${s.winners || 'global'} vencedor(es)`
        ).join('\n')
      : 'Nenhum servidor adicional.';

    const selectModo = this.select(user, [
      { label: '🌐 Global — todos competem juntos',     value: 'global'   },
      { label: '🏆 Separado — vencedores por servidor', value: 'separate' },
    ], 'Modo do sorteio', async (i) => {
      await this.deferUpdate(i);
      draft.isMultiServer = true;
      draft.multiMode     = i.data.values[0];
      return this._telaMulti(i, user, premium);
    });

    const btnAdd = this.btn(user, '➕ Adicionar Servidor', 3, async (i) => {
      await this.deferUpdate(i);
      return this._multiAddServer(i, user, premium);
    });
    const btnDel = this.btn(user, '🗑 Remover Último', 4, async (i) => {
      await this.deferUpdate(i);
      draft.multiServers.pop();
      if (!draft.multiServers.length) draft.isMultiServer = false;
      return this._telaMulti(i, user, premium);
    });
    const btnVoltar = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this._telaExtras(i, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} Multi-Servidor`,
        description:
          `**Modo:** ${draft.multiMode === 'global' ? '🌐 Global' : '🏆 Separado'}\n\n` +
          `**Servidores:**\n${atual}`,
        color: DEFAULT_COLOR,
      }],
      components: [this.row(selectModo), this.row(btnAdd, btnDel, btnVoltar)],
    });
  }

  async _multiAddServer(interaction, user, premium) {

    const draft = this._getDraft(user);

    const respGuild = await this._ask(interaction, draft,
      `${E.animada} Envie o **ID do servidor** a adicionar:`
    );
    if (!respGuild) return this._telaMulti(interaction, user, premium);

    const guildId = respGuild.match(/\d{17,19}/)?.[0];
    if (!guildId) return this._telaMulti(interaction, user, premium);

    const inServer = await this._checkBotInGuild(guildId);
    if (!inServer) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Não estou no servidor \`${guildId}\`!`, color: DEFAULT_COLOR }]
      });
      return this._telaMulti(interaction, user, premium);
    }

    const authorized = await this._checkAuthorization(guildId, interaction.guild_id, 'multi_giveaway');
    if (!authorized) {
      await this._requestAuthorization(interaction, guildId, interaction.guild_id, 'multi_giveaway');
      return this._telaMulti(interaction, user, premium);
    }

    const respCh = await this._ask(interaction, draft,
      `${E.animada} Envie o **ID do canal** nesse servidor:`
    );
    if (!respCh) return this._telaMulti(interaction, user, premium);
    const channelExtId = respCh.match(/\d{17,19}/)?.[0];

    let winners = 0;
    if (draft.multiMode === 'separate') {
      const respW = await this._ask(interaction, draft,
        `${E.animada} Quantos vencedores nesse servidor?`
      );
      if (respW) winners = parseInt(respW) || 1;
    }

    draft.multiServers.push({ guildId, channelId: channelExtId, winners, label: '', messageId: null });
    return this._telaMulti(interaction, user, premium);
  }

  /* ═══════════════════════════════════════
     PUBLICAR
  ═══════════════════════════════════════ */

  async _publicar(interaction, user) {

    const draft = this._getDraft(user);

    if (!draft.prize || !draft.channelId || !draft.endsAt) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Preencha prêmio, canal e duração antes de publicar!`, color: DEFAULT_COLOR }]
      });
      return this._telaExtras(interaction, user);
    }

    await this.editOriginal(interaction, {
      embeds: [{ description: `⏳ Publicando sorteio...`, color: DEFAULT_COLOR }],
      components: [],
    });

    const doc = await GiveawayDb.create({
      giveawayId: this._genId(),
      guildId:    interaction.guild_id,
      channelId:  draft.channelId,
      createdBy:  user,
      ...draft,
    });

    const embed      = GiveawayEmbed.buildActive(doc);
    const components = this._buildJoinComponents(doc);

    const msg = await DiscordRequest(`/channels/${draft.channelId}/messages`, {
      method: 'POST', body: { embeds: [embed], components }
    });

    doc.messageId = msg.id;
    await this.save(doc);

    if (doc.isMultiServer) {
      for (const server of doc.multiServers) {
        if (!server.channelId) continue;
        const m = await DiscordRequest(`/channels/${server.channelId}/messages`, {
          method: 'POST', body: { embeds: [embed], components }
        }).catch(() => null);
        if (m) server.messageId = m.id;
      }
      await this.save(doc);
    }

    this.client.gScheduler?.schedule(doc);
    this._clearDraft(user);

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.festa} Sorteio Publicado!`,
        description:
          `O sorteio foi publicado em <#${draft.channelId}>!\n\n` +
          `**ID:** \`${doc.giveawayId}\``,
        color: DEFAULT_COLOR,
      }],
      components: [],
    });
  }

  _buildJoinComponents(doc) {
    return [{
      type: 1,
      components: [{
        type: 2, label: '🎉 Participar', style: 3,
        custom_id: JSON.stringify({ t: 'giveaway_join', id: doc.giveawayId }),
      }]
    }];
  }

  /* ═══════════════════════════════════════
     PARTICIPAÇÃO
  ═══════════════════════════════════════ */

  async join(interaction) {
    try {
      const data = JSON.parse(interaction.data.custom_id);
      const doc  = await GiveawayDb.findOne({ giveawayId: data.id });

      if (!doc || doc.status !== 'active') {
        return this.reply(interaction, {
          content: `${E.pensando} Este sorteio não está mais ativo!`, flags: 64,
        });
      }

      const user = interaction.member?.user || interaction.user;
      const existing = doc.participants.find(
        p => p.userId === user.id && p.guildId === interaction.guild_id
      );

      if (existing) {
        return this.reply(interaction, {
          content:
            `${E.feliz} Você já está participando!\n\n` +
            `🎟️ Suas entradas: **${existing.totalEntries}**`,
          flags: 64,
        });
      }

      const memberRoles  = interaction.member?.roles || [];
      const bonusEntries = doc.bonusEntries.reduce((acc, b) =>
        memberRoles.includes(b.roleId) ? acc + b.entries : acc, 0);
      const totalEntries = 1 + bonusEntries;

      doc.participants.push({
        userId: user.id, guildId: interaction.guild_id,
        baseEntries: 1, bonusEntries, totalEntries,
        joinedAt: new Date(), status: 'participating',
      });

      await this.save(doc);
      await this._refreshEmbed(doc).catch(() => {});

      return this.reply(interaction, {
        content:
          `${E.feliz} **Você entrou no sorteio com sucesso!**\n\n` +
          `🎟️ Suas entradas: **${totalEntries}**` +
          (bonusEntries ? ` (base: 1 + bônus: ${bonusEntries})` : '') +
          `\n\nBoa sorte! Estou torcendo por você~`,
        flags: 64,
      });

    } catch (err) {
      console.error('[GiveawaySystem] join error:', err);
      return this.reply(interaction, {
        content: `${E.pensando} Ocorreu um erro. Tente novamente!`, flags: 64,
      });
    }
  }

  async _refreshEmbed(doc) {
    if (!doc.messageId) return;
    await DiscordRequest(`/channels/${doc.channelId}/messages/${doc.messageId}`, {
      method: 'PATCH',
      body: { embeds: [GiveawayEmbed.buildActive(doc)], components: this._buildJoinComponents(doc) }
    });
  }

  /* ═══════════════════════════════════════
     MENU DE GERENCIAMENTO
  ═══════════════════════════════════════ */

  async giveawayMenu(interaction, doc, user) {

    const statusMap = {
      active: '🟢 Ativo', paused: '🟡 Pausado',
      ended: '🔴 Encerrado', cancelled: '⚫ Cancelado',
    };

    const select = this.select(user, [
      { label: '⏹ Encerrar Agora',       value: 'end'    },
      { label: doc.status === 'paused' ? '▶️ Reabrir' : '⏸ Pausar', value: 'toggle' },
      { label: '✏️ Editar',               value: 'edit'   },
      { label: '⏱ Adicionar Tempo',       value: 'add_t'  },
      { label: '⏱ Remover Tempo',         value: 'rem_t'  },
      { label: '🔁 Reroll',               value: 'reroll' },
      { label: '📤 Exportar',             value: 'export' },
      { label: '📊 Estatísticas',         value: 'stats'  },
    ], 'Gerenciar sorteio', async (i) => {
      await this.deferUpdate(i);
      const v = i.data.values[0];
      if (v === 'end')    return this.endGiveaway(i, doc);
      if (v === 'toggle') return this.togglePause(i, doc, user);
      if (v === 'edit')   return this.editGiveaway(i, doc, user);
      if (v === 'add_t')  return this.modifyTime(i, doc, user, 'add');
      if (v === 'rem_t')  return this.modifyTime(i, doc, user, 'remove');
      if (v === 'reroll') return this.reroll(i, doc, user);
      if (v === 'export') return this.exportMenu(i, doc, user);
      if (v === 'stats')  return this.showStats(i, doc, user);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.startMenu(i);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} Gerenciar — ${doc.prize.slice(0, 50)}`,
        description: [
          `**Status:** ${statusMap[doc.status]}`,
          `**Canal:** <#${doc.channelId}>`,
          `**Vencedores:** ${doc.winners}`,
          `**Participantes:** ${doc.participants.length}`,
          `**Encerra:** <t:${Math.floor(doc.endsAt.getTime() / 1000)}:R>`,
        ].join('\n'),
        color: DEFAULT_COLOR,
      }],
      components: [this.row(select), this.row(btnBack)],
    });
  }

  /* ═══════════════════════════════════════
     AÇÕES DE GERENCIAMENTO
  ═══════════════════════════════════════ */

  async endGiveaway(interaction, doc) {
    if (doc.status === 'ended') {
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} Este sorteio já foi encerrado!`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    await this.editOriginal(interaction, {
      embeds: [{ description: `⏳ Sorteando vencedores...`, color: DEFAULT_COLOR }],
      components: [],
    });

    doc.status = 'ended'; doc.endedAt = new Date();
    await this.save(doc);
    this.client.gScheduler?.cancel(doc.giveawayId);

    const result = await GiveawayDraw.draw(doc, this.client);
    await this.save(doc);
    await this._sendEndReport(doc, result);

    return this.editOriginal(interaction, {
      embeds: [{ description: `${E.festa} Sorteio encerrado! Resultado enviado no canal.`, color: DEFAULT_COLOR }],
      components: [],
    });
  }

  async togglePause(interaction, doc, user) {
    if (doc.status === 'paused') {
      const pausedMs = doc.pausedAt ? Date.now() - doc.pausedAt.getTime() : 0;
      doc.pausedDuration += pausedMs;
      doc.endsAt   = new Date(doc.endsAt.getTime() + pausedMs);
      doc.status   = 'active'; doc.pausedAt = null;
      this.client.gScheduler?.schedule(doc);
    } else {
      doc.pausedAt = new Date(); doc.status = 'paused';
      this.client.gScheduler?.cancel(doc.giveawayId);
    }
    await this.save(doc);
    await this._refreshEmbed(doc).catch(() => {});
    return this.giveawayMenu(interaction, doc, user);
  }

  async modifyTime(interaction, doc, user, mode) {

    const resp = await this._ask(interaction, { ...doc.toObject(), prize: doc.prize },
      `${E.animada} Envie o tempo para ${mode === 'add' ? 'adicionar' : 'remover'} *(ex: \`2h\`, \`30m\`)*:`
    );
    if (!resp) return this.giveawayMenu(interaction, doc, user);

    const ms = this._parseDuration(resp);
    if (!ms) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Tempo inválido!`, color: DEFAULT_COLOR }]
      });
      return this.giveawayMenu(interaction, doc, user);
    }

    if (mode === 'add') {
      doc.endsAt = new Date(doc.endsAt.getTime() + ms);
    } else {
      const newEnd = new Date(doc.endsAt.getTime() - ms);
      if (newEnd <= new Date()) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} Tempo removido ultrapassaria o horário atual!`, color: DEFAULT_COLOR }]
        });
        return this.giveawayMenu(interaction, doc, user);
      }
      doc.endsAt = newEnd;
    }

    await this.save(doc);
    this.client.gScheduler?.reschedule(doc.giveawayId);
    await this._refreshEmbed(doc).catch(() => {});
    return this.giveawayMenu(interaction, doc, user);
  }

  async reroll(interaction, doc, user) {
    if (doc.status !== 'ended') {
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} Só é possível reroll em sorteios encerrados!`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    await this.editOriginal(interaction, {
      embeds: [{ description: `⏳ Realizando reroll...`, color: DEFAULT_COLOR }],
      components: [],
    });

    const result = await GiveawayDraw.draw(doc, this.client, { reroll: true });
    await this.save(doc);
    await this._sendEndReport(doc, result);

    return this.editOriginal(interaction, {
      embeds: [{ description: `${E.festa} Reroll realizado! Resultado enviado no canal.`, color: DEFAULT_COLOR }],
      components: [],
    });
  }

  async editGiveaway(interaction, doc, user) {

    const fakeDraft = { prize: doc.prize, description: doc.description, channelId: doc.channelId, winners: doc.winners, endsAt: doc.endsAt, color: doc.color, thumbnail: doc.thumbnail, banner: doc.banner, bonusEntries: doc.bonusEntries, requirements: doc.requirements, isMultiServer: doc.isMultiServer, customMessage: doc.customMessage, multiServers: doc.multiServers };

    const respPrize = await this._ask(interaction, fakeDraft,
      `${E.animada} Novo prêmio ou \`pular\`:\n*Atual: **${doc.prize}***`
    );
    if (respPrize === null) return this.giveawayMenu(interaction, doc, user);
    if (respPrize.toLowerCase() !== 'pular') doc.prize = respPrize.trim().slice(0, 200);

    fakeDraft.prize = doc.prize;

    const respDesc = await this._ask(interaction, fakeDraft,
      `${E.animada} Nova descrição ou \`pular\`:`
    );
    if (respDesc === null) return this.giveawayMenu(interaction, doc, user);
    if (respDesc.toLowerCase() !== 'pular') doc.description = respDesc.trim().slice(0, 1000);

    const respW = await this._ask(interaction, fakeDraft,
      `${E.animada} Novo número de vencedores ou \`pular\`:\n*Atual: **${doc.winners}***`
    );
    if (respW === null) return this.giveawayMenu(interaction, doc, user);
    if (respW.toLowerCase() !== 'pular') {
      const n = parseInt(respW);
      if (n && n >= 1) doc.winners = n;
    }

    await this.save(doc);
    await this._refreshEmbed(doc).catch(() => {});
    return this.giveawayMenu(interaction, doc, user);
  }

  /* ═══════════════════════════════════════
     EXPORTAR
  ═══════════════════════════════════════ */

  async exportMenu(interaction, doc, user) {

    const select = this.select(user, [
      { label: '🌐 HTML',  value: 'html' },
      { label: '📄 CSV',   value: 'csv'  },
      { label: '📊 XLSX',  value: 'xlsx' },
      { label: '🔧 JSON',  value: 'json' },
    ], 'Formato de exportação', async (i) => {
      await this.deferUpdate(i);
      return this.exportGiveaway(i, doc, i.data.values[0]);
    });

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.giveawayMenu(i, doc, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} Exportar Participantes`,
        description: 'Escolha o formato de exportação:',
        color: DEFAULT_COLOR,
      }],
      components: [this.row(select), this.row(btnBack)],
    });
  }

  async exportGiveaway(interaction, doc, format) {
    try {
      await this.editOriginal(interaction, {
        embeds: [{ description: `⏳ Gerando arquivo **${format.toUpperCase()}**...`, color: DEFAULT_COLOR }],
        components: [],
      });

      const file = await GiveawayExport.export(doc, format);

      await DiscordRequest(`/channels/${interaction.channel_id}/messages`, {
        method: 'POST',
        body:   { content: `${E.feliz} Exportação dos participantes!` },
        files:  [file],
      });

      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.feliz} Arquivo enviado no canal!`, color: DEFAULT_COLOR }],
        components: [],
      });
    } catch (err) {
      console.error('[GiveawaySystem] export error:', err);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} Erro ao exportar!`, color: DEFAULT_COLOR }],
        components: [],
      });
    }
  }

  /* ═══════════════════════════════════════
     ESTATÍSTICAS
  ═══════════════════════════════════════ */

  async showStats(interaction, doc, user) {

    const total      = doc.participants.length;
    const winners    = doc.participants.filter(p => p.status === 'winner').length;
    const disq       = doc.participants.filter(p => p.status === 'disqualified').length;
    const totalBonus = doc.participants.reduce((a, p) => a + p.bonusEntries, 0);
    const totalEnt   = doc.participants.reduce((a, p) => a + p.totalEntries, 0);

    const byGuild = doc.participants.reduce((acc, p) => {
      acc[p.guildId] = (acc[p.guildId] || 0) + 1; return acc;
    }, {});

    const byGuildLines = Object.entries(byGuild)
      .map(([gId, c]) => `\`${gId}\`: ${c} participante(s)`)
      .join('\n') || '—';

    const btnBack = this.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.deferUpdate(i);
      return this.giveawayMenu(i, doc, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} Estatísticas`,
        fields: [
          { name: '👥 Participantes',    value: String(total),      inline: true },
          { name: '🏆 Vencedores',       value: String(winners),    inline: true },
          { name: '❌ Desclassificados', value: String(disq),       inline: true },
          { name: '🎟️ Entradas totais', value: String(totalEnt),   inline: true },
          { name: '✨ Entradas bônus',   value: String(totalBonus), inline: true },
          { name: '📊 Por Servidor',     value: byGuildLines },
        ],
        color: DEFAULT_COLOR,
      }],
      components: [this.row(btnBack)],
    });
  }

  /* ═══════════════════════════════════════
     RELATÓRIO DE ENCERRAMENTO
  ═══════════════════════════════════════ */

  async _sendEndReport(doc, result) {
    const embed = GiveawayEmbed.buildEndReport(doc, result);

    await DiscordRequest(`/channels/${doc.channelId}/messages`, {
      method: 'POST',
      body: {
        content: result.winners.map(w => `<@${w.userId}>`).join(' '),
        embeds:  [embed],
      },
    }).catch(() => {});

    if (doc.messageId) {
      await DiscordRequest(`/channels/${doc.channelId}/messages/${doc.messageId}`, {
        method: 'PATCH',
        body: { embeds: [GiveawayEmbed.buildEnded(doc, result)], components: [] },
      }).catch(() => {});
    }
  }

  /* ═══════════════════════════════════════
     AUTORIZAÇÃO INTER-SERVIDOR
     
     Fluxo:
       1. Tenta enviar DM ao dono do servidor
       2. Se DM fechada → busca canal do servidor e manda mencionando o dono
       3. Apenas o dono pode aceitar (validado no handleAuthResponse)
  ═══════════════════════════════════════ */

  async _checkBotInGuild(guildId) {
    try { await DiscordRequest(`/guilds/${guildId}`, { method: 'GET' }); return true; }
    catch { return false; }
  }

  async _checkAuthorization(ownerGuildId, requesterGuildId, level) {
    const auth = await AuthorizationDb.findOne({
      ownerGuildId, requesterGuildId, status: 'approved'
    });
    if (!auth) return false;
    if (auth.expiresAt && auth.expiresAt < new Date()) return false;
    const levels = ['basic', 'advanced', 'multi_giveaway'];
    return levels.indexOf(auth.permissionLevel) >= levels.indexOf(level);
  }

  async _requestAuthorization(interaction, ownerGuildId, requesterGuildId, level) {

    const levelLabels = {
      basic:          'Básica — verificar se o usuário está no servidor',
      advanced:       'Avançada — cargos, atividade, níveis e estatísticas',
      multi_giveaway: 'Multi-Sorteio — participação em sorteios compartilhados',
    };

    // Buscar dados do servidor dono
    let ownerGuild;
    try {
      ownerGuild = await DiscordRequest(`/guilds/${ownerGuildId}?with_counts=false`, { method: 'GET' });
    } catch {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} Não consegui acessar os dados do servidor \`${ownerGuildId}\`.`, color: DEFAULT_COLOR }]
      });
      return;
    }

    const ownerId = ownerGuild.owner_id;

    // Buscar dados do servidor solicitante
    let requesterGuild = { name: requesterGuildId, icon: null };
    try {
      requesterGuild = await DiscordRequest(`/guilds/${requesterGuildId}?with_counts=false`, { method: 'GET' });
    } catch {}

    // Buscar username de quem está configurando
    const configurerId = interaction.member?.user?.id || interaction.user?.id;
    let configurerTag  = `<@${configurerId}>`;
    try {
      const u    = await DiscordRequest(`/users/${configurerId}`, { method: 'GET' });
      configurerTag = u.global_name
        ? `${u.global_name} (@${u.username})`
        : `@${u.username}`;
    } catch {}

    // Criar registro pending no banco
    const auth = await AuthorizationDb.findOneAndUpdate(
      { ownerGuildId, requesterGuildId },
      {
        ownerGuildId, requesterGuildId,
        permissionLevel: level,
        status: 'pending',
        ownerId,
        requestedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Ícone do servidor solicitante (para thumbnail)
    const requesterIcon = requesterGuild.icon
      ? `https://cdn.discordapp.com/icons/${requesterGuildId}/${requesterGuild.icon}.png?size=64`
      : null;

    const authEmbed = {
      title: `${E.animada} Solicitação de Autorização`,
      description:
        `Olá! O servidor abaixo deseja utilizar dados de **${ownerGuild.name}** em um sorteio.\n\n` +
        `**Servidor solicitante:** ${requesterGuild.name} \`(${requesterGuildId})\`\n` +
        `**Configurado por:** ${configurerTag}\n` +
        `**Permissão solicitada:** ${levelLabels[level]}\n\n` +
        `Apenas você, como dono do servidor, pode aceitar esta solicitação.`,
      color: DEFAULT_COLOR,
      thumbnail: requesterIcon ? { url: requesterIcon } : undefined,
    };

    const authComponents = [{
      type: 1,
      components: [
        {
          type: 2, label: 'Autorizar', style: 3,
          custom_id: JSON.stringify({ t: 'auth_approve', authId: auth._id.toString() })
        },
        {
          type: 2, label: 'Recusar', style: 4,
          custom_id: JSON.stringify({ t: 'auth_deny', authId: auth._id.toString() })
        },
      ]
    }];

    // 1. Tentar DM ao dono
    let sentViaDM = false;

    try {
      const dmChannel = await DiscordRequest('/users/@me/channels', {
        method: 'POST',
        body: { recipient_id: ownerId }
      });

      const msg = await DiscordRequest(`/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        body: { embeds: [authEmbed], components: authComponents }
      });

      auth.authMessageId  = msg.id;
      auth.authChannelId  = dmChannel.id;
      auth.sentVia        = 'dm';
      await auth.save();
      sentViaDM = true;

    } catch {
      sentViaDM = false;
    }

    // 2. DM fechada → enviar no canal do servidor mencionando o dono
    if (!sentViaDM) {

      const fallbackChannelId = ownerGuild.system_channel_id || await this._findTextChannel(ownerGuildId);

      if (fallbackChannelId) {
        try {
          const msg = await DiscordRequest(`/channels/${fallbackChannelId}/messages`, {
            method: 'POST',
            body: {
              content: `<@${ownerId}>`,
              embeds:  [authEmbed],
              components: authComponents,
            }
          });

          auth.authMessageId = msg.id;
          auth.authChannelId = fallbackChannelId;
          auth.sentVia       = 'channel';
          await auth.save();

        } catch {
          await this.followUpEphemeral(interaction, {
            embeds: [{
              description:
                `${E.pensando} Não consegui enviar a solicitação para o servidor \`${ownerGuildId}\`.\n` +
                `Verifique se tenho permissão de enviar mensagens lá.`,
              color: DEFAULT_COLOR,
            }]
          });
          return;
        }
      }
    }

    await this.followUpEphemeral(interaction, {
      embeds: [{
        description:
          `${E.feliz} Solicitação enviada para o dono do servidor \`${ownerGuild.name}\`!\n` +
          `Assim que aprovada, você poderá continuar a configuração~`,
        color: DEFAULT_COLOR,
      }]
    });
  }

  // Busca o primeiro canal de texto onde o bot pode enviar mensagens
  async _findTextChannel(guildId) {
    try {
      const channels = await DiscordRequest(`/guilds/${guildId}/channels`, { method: 'GET' });
      const text = channels.find(c => c.type === 0); // GUILD_TEXT
      return text?.id || null;
    } catch {
      return null;
    }
  }

  async handleAuthResponse(interaction, approve) {

    const data = JSON.parse(interaction.data.custom_id);
    const auth = await AuthorizationDb.findById(data.authId);

    if (!auth || auth.status !== 'pending') {
      return this.reply(interaction, {
        content: `${E.pensando} Esta solicitação já foi respondida.`, flags: 64,
      });
    }

    // Apenas o dono do servidor pode aceitar/recusar
    const responderId = interaction.member?.user?.id || interaction.user?.id;
    if (responderId !== auth.ownerId) {
      return this.reply(interaction, {
        content: `${E.pensando} Apenas o **dono do servidor** pode responder esta solicitação!`,
        flags: 64,
      });
    }

    auth.status     = approve ? 'approved' : 'denied';
    auth.approvedBy = responderId;
    auth.resolvedAt = new Date();
    await auth.save();

    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: 'POST',
        body: {
          type: 7,
          data: {
            embeds: [{
              title: approve ? `${E.festa} Autorização Concedida!` : `${E.pensando} Solicitação Recusada`,
              description: approve
                ? `O servidor \`${auth.requesterGuildId}\` foi autorizado com sucesso!`
                : `A solicitação de \`${auth.requesterGuildId}\` foi recusada.`,
              color: approve ? 0x57F287 : 0xED4245,
            }],
            components: [],
          }
        }
      }
    );
  }

  /* ═══════════════════════════════════════
     UTILS
  ═══════════════════════════════════════ */

  _parseDuration(str) {
    const match = str?.trim().match(/^(\d+)(d|h|m|s)$/i);
    if (!match) return null;
    const ms = { d: 864e5, h: 36e5, m: 6e4, s: 1e3 };
    return parseInt(match[1]) * (ms[match[2].toLowerCase()] || 0) || null;
  }

  _reqLabel(req) {
    const map = {
      REQUIRED_ROLE:             `Cargo obrigatório: <@&${req.value}>`,
      FORBIDDEN_ROLE:            `Cargo proibido: <@&${req.value}>`,
      MIN_MESSAGES:              `Mínimo ${req.value} mensagem(s)`,
      MIN_DAYS_IN_SERVER:        `${req.value} dia(s) no servidor`,
      MIN_ACCOUNT_AGE:           `Conta com ${req.value}+ dias`,
      IN_SERVER:                 `Estar no servidor \`${req.guildId}\``,
      REQUIRED_ROLE_IN_SERVER:   `Cargo em servidor externo`,
      FORBIDDEN_ROLE_IN_SERVER:  `Sem cargo em servidor externo`,
      MIN_DAYS_IN_EXT_SERVER:    `${req.value} dia(s) em servidor externo`,
      MIN_MESSAGES_IN_EXT_SERVER:`${req.value} msgs em servidor externo`,
      MIN_HOURS_IN_CALL:         `${req.value}h em call`,
      MIN_LEVEL:                 `Nível ${req.value}+`,
      MIN_XP:                    `${req.value} XP+`,
      HAS_BOOSTER_ROLE:          `Cargo Booster`,
      HAS_SUPPORTER_ROLE:        `Cargo Apoiador`,
    };
    return map[req.type] || req.type;
  }
}

module.exports = GiveawaySystem;
