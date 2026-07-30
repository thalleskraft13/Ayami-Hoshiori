'use strict';

const DiscordRequest   = require('../../DiscordRequest.js');
const CV2              = require('../../Messages/CV2.js');
const getPerm          = require('../../Utils/GetPerm.js');
const { localeCtx }    = require('../../Utils/ctxLocale.js');
const TwitchChannelDb  = require('../../../Mongodb/twitchChannel.js');
const TwitchApi        = require('./TwitchApiService.js');

const FEATURE_ID = 'twitch';
const ACCENT      = 0x9146FF;
const ACCENT_SOFT = 0x2F3136;
const ACCENT_DENY = 0xED4245;

const CATEGORIES = [
  { value: 'conta',        label: 'Conta',        desc: 'Conectar, trocar ou remover a conta Twitch vinculada', emoji: '🔗' },
  { value: 'anuncios',     label: 'Anúncios',     desc: 'Canal, cargo e mensagens de notificação de live',      emoji: '📢' },
  { value: 'agenda',       label: 'Agenda',       desc: 'Agendamentos, eventos automáticos e lembretes',        emoji: '🗓️' },
  { value: 'estatisticas', label: 'Estatísticas', desc: 'Lives, horas transmitidas e jogos mais jogados',       emoji: '📊' },
  { value: 'metas',        label: 'Metas',        desc: 'Metas de transmissão do streamer',                    emoji: '🎯' },
  { value: 'missoes',      label: 'Missões',      desc: 'Missões relacionadas às transmissões',                emoji: '🧩' },
  { value: 'equipe',       label: 'Equipe',       desc: 'Membros responsáveis pelo módulo Twitch',              emoji: '🧑‍🤝‍🧑' },
];

class TwitchConfigSystem {

  constructor(client) {
    this.client = client;
  }

  async deferUpdate(interaction) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 6 } }
    );
  }

  async editOriginal(interaction, containers, opts = {}) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body: CV2.payload(containers, { ephemeral: false, ...opts }) }
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

  async _getChannelDoc(guildId) {
    return TwitchChannelDb.findOne({ guildId }).lean();
  }

  async _upsertChannelDoc(guildId, patch) {
    return TwitchChannelDb.findOneAndUpdate(
      { guildId },
      { $set: patch },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }

  _errorContainer(titulo, descricao, user, destino) {
    return CV2.container([
      CV2.text(`⚠️ **${titulo}**`),
      CV2.separator(),
      CV2.text(descricao),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, destino),
    ], { accentColor: ACCENT_DENY });
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

  async _denyAdminModal(mi) {
    return this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload([this._noPermissionContainer(mi)], { ephemeral: false }),
    });
  }

  _guarded(destinoFn) {
    return async (i) => {
      await this.deferUpdate(i);
      if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
      return destinoFn(i);
    };
  }

  _guardedModal(destinoFn) {
    return async (mi, client, fields) => {
      if (!(await this._hasAdminPerm(mi))) return this._denyAdminModal(mi);
      return destinoFn(mi, fields);
    };
  }

  _betaNotice() {
    return CV2.text('-# 🧪 Módulo em Acesso Antecipado — recurso Beta exclusivo para assinantes ✨ Constellation.');
  }

  navRow(user, destino) {
    return CV2.row(
      this.client.interactions.createButton({
        user,
        feature: FEATURE_ID,
        data: { label: 'Voltar', style: 2, emoji: { name: '◀️' } },
        funcao: this._guarded(destino),
      }),
      this.client.interactions.createButton({
        user,
        feature: FEATURE_ID,
        data: { label: 'Fechar', style: 4, emoji: { name: '✖️' } },
        funcao: async (i) => {
          await this.deferUpdate(i);
          return this.close(i);
        },
      }),
    );
  }

  async close(interaction) {
    return this.editOriginal(interaction, [CV2.container([
      CV2.text('👋 **Painel fechado.**'),
    ], { accentColor: ACCENT_SOFT })]);
  }

  async comingSoon(interaction, titulo, destino) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🚧 **${titulo}**`),
      CV2.separator(),
      CV2.text('Essa configuração ainda não está disponível — será implementada em uma atualização futura.\n\nNenhuma informação é salva nesta etapa.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, destino),
    ], { accentColor: ACCENT })]);
  }

  _comingSoonModalContainer(titulo, user, destino) {
    return CV2.container([
      CV2.text(`✉️ **${titulo}**`),
      CV2.separator(),
      CV2.text('Essa mensagem ainda não pode ser configurada — será implementada em uma atualização futura.\n\nNenhuma informação é salva nesta etapa.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, destino),
    ], { accentColor: ACCENT });
  }

  async openCreatorsMenu(interaction) {
    if (!(await this._hasAdminPerm(interaction))) return this._denyAdmin(interaction);

    const user = interaction.member.user.id;

    const select = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: 'Selecione um módulo de criadores',
        options: [
          { label: 'Twitch (Beta)', description: 'Configurações de integração com a Twitch', value: 'twitch', emoji: { name: '🟣' } },
        ],
      },
      funcao: async (i) => {
        await this.deferUpdate(i);
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);

        const valor = i.data.values?.[0];
        if (valor !== 'twitch') return;

        if (!(await this.client.featureManager.guardDeferred(i, FEATURE_ID))) return;

        return this.home(i);
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

  async open(interaction) {
    if (!(await this.client.featureManager.guardDeferred(interaction, FEATURE_ID))) return;
    if (!(await this._hasAdminPerm(interaction))) return this._denyAdmin(interaction);

    return this.home(interaction);
  }

  async home(interaction) {
    const user = interaction.member.user.id;

    const select = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Selecione uma categoria',
        options: CATEGORIES.map(c => ({
          label: c.label,
          description: c.desc,
          value: c.value,
          emoji: { name: c.emoji },
        })),
      },
      funcao: this._guarded((i) => {
        const valor = i.data.values?.[0];
        switch (valor) {
          case 'conta':        return this.painelConta(i);
          case 'anuncios':     return this.painelAnuncios(i);
          case 'agenda':       return this.painelAgenda(i);
          case 'estatisticas': return this.painelEstatisticas(i);
          case 'metas':        return this.painelMetas(i);
          case 'missoes':      return this.painelMissoes(i);
          case 'equipe':       return this.painelEquipe(i);
        }
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🟣 **Módulo Twitch**'),
      CV2.separator(),
      CV2.text('Central de configurações da integração com a Twitch. Escolha uma categoria abaixo para começar.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(select),
      this.navRow(user, (i) => this.openCreatorsMenu(i)),
    ], { accentColor: ACCENT })]);
  }

  async painelConta(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);

    const conectarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: doc?.twitchId ? 'Alterar Conta' : 'Conectar Conta', style: doc?.twitchId ? 2 : 3, emoji: { name: doc?.twitchId ? '🔄' : '🔗' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalCanal(i, (ii) => this.painelConta(ii));
      },
    });

    const botoes = [conectarBtn];

    if (doc?.twitchId) {
      botoes.push(this.client.interactions.createButton({
        user,
        feature: FEATURE_ID,
        data: { label: 'Remover Conta', style: 4, emoji: { name: '🗑️' } },
        funcao: this._guarded((i) => this._removerConta(i)),
      }));

      botoes.push(this.client.interactions.createButton({
        user,
        feature: FEATURE_ID,
        data: {
          label: doc.moduleEnabled ? 'Desativar Módulo' : 'Ativar Módulo',
          style: doc.moduleEnabled ? 4 : 3,
          emoji: { name: doc.moduleEnabled ? '⏸️' : '▶️' },
        },
        funcao: this._guarded((i) => this._alternarModulo(i)),
      }));
    }

    const statusTexto = doc?.twitchId
      ? (
        `**Canal:** [${doc.displayName || doc.twitchLogin}](https://twitch.tv/${doc.twitchLogin})\n` +
        `**Status do módulo:** ${doc.moduleEnabled ? '🟢 Ativado' : '🔴 Desativado'}\n` +
        `**Monitoramento:** ${doc.state?.isLive ? '🔴 Ao vivo agora' : '⚪ Offline'}\n` +
        `**Vinculado por:** <@${doc.connectedBy}>`
      )
      : 'Nenhuma conta Twitch vinculada a este servidor ainda.\n\nUse o botão abaixo para conectar informando o nome ou a URL do canal.';

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🔗 **Conta Twitch**'),
      CV2.separator(),
      CV2.text(statusTexto),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(...botoes),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: ACCENT })]);
  }

  async _abrirModalCanal(interaction, destino) {
    const user = interaction.member.user.id;

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: 'Conectar Canal Twitch',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'canal',
            label: 'Nome ou URL do canal',
            style: 1,
            required: true,
            max_length: 100,
            placeholder: 'Ex: minhastreamer ou https://twitch.tv/minhastreamer',
          }],
        },
      ],
      funcao: this._guardedModal((mi, fields) => this._confirmarCanal(mi, fields, destino)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _confirmarCanal(mi, fields, destino) {
    const user    = mi.member.user.id;
    const guildId = mi.guild_id;
    const entrada = (fields.canal ?? '').trim();

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

    if (!TwitchApi.parseChannelInput(entrada)) {
      return responder([this._errorContainer(
        'Canal Inválido',
        'Não foi possível reconhecer esse nome ou URL de canal.\n\nInforme apenas o nome do canal (ex: `minhastreamer`) ou a URL completa (ex: `https://twitch.tv/minhastreamer`).',
        user, destino,
      )]);
    }

    let twitchUser;
    try {
      twitchUser = await TwitchApi.getUserByLogin(entrada);
    } catch (err) {
      console.error('[TwitchConfigSystem] Erro ao validar canal na Twitch:', err.message);
      return responder([this._errorContainer(
        'Falha na Validação',
        'Não foi possível validar o canal com a API da Twitch no momento. Tente novamente em instantes.',
        user, destino,
      )]);
    }

    if (!twitchUser) {
      return responder([this._errorContainer(
        'Canal Não Encontrado',
        `Nenhum canal da Twitch foi encontrado para \`${entrada}\`. Verifique o nome e tente novamente.`,
        user, destino,
      )]);
    }

    const doc = await this._upsertChannelDoc(guildId, {
      twitchId:     twitchUser.id,
      twitchLogin:  twitchUser.login,
      displayName:  twitchUser.display_name,
      profileImage: twitchUser.profile_image_url ?? null,
      connectedBy:  user,
      connectedAt:  new Date(),
      moduleEnabled: true,
    });

    this.client.twitchMonitor?.checkOne(guildId).catch(() => {});

    return responder([CV2.container([
      CV2.text('✅ **Canal Conectado**'),
      CV2.separator(),
      CV2.text(`O canal [${doc.displayName || doc.twitchLogin}](https://twitch.tv/${doc.twitchLogin}) foi vinculado a este servidor com sucesso.`),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, destino),
    ], { accentColor: ACCENT })]);
  }

  async _removerConta(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    await TwitchChannelDb.deleteOne({ guildId });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🗑️ **Conta Removida**'),
      CV2.separator(),
      CV2.text('O canal Twitch vinculado a este servidor foi removido. Nenhum anúncio será enviado até que uma nova conta seja conectada.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelConta(i)),
    ], { accentColor: ACCENT_SOFT })]);
  }

  async _alternarModulo(interaction) {
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);
    if (!doc) return this.painelConta(interaction);

    await TwitchChannelDb.updateOne({ guildId }, { $set: { moduleEnabled: !doc.moduleEnabled } });

    return this.painelConta(interaction);
  }

  async painelAnuncios(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);

    if (!doc?.twitchId) {
      return this.editOriginal(interaction, [CV2.container([
        CV2.text('📢 **Anúncios de Live**'),
        CV2.separator(),
        CV2.text('Nenhum canal Twitch conectado a este servidor ainda.\n\nConecte um canal na categoria **Conta** antes de configurar os anúncios.'),
        CV2.separator(),
        this._betaNotice(),
        this.navRow(user, (i) => this.home(i)),
      ], { accentColor: ACCENT })]);
    }

    const anuncio = doc.announce ?? {};

    const canalSelect = this.client.interactions.createChannelSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o canal de anúncios', channel_types: [0, 5] },
      funcao: this._guarded(async (i) => {
        const canalId = i.data.values?.[0];
        if (!canalId) return this.painelAnuncios(i);
        await this._upsertChannelDoc(guildId, { 'announce.channelId': canalId });
        return this.painelAnuncios(i);
      }),
    });

    const cargoSelect = this.client.interactions.createRoleSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o cargo para mencionar' },
      funcao: this._guarded(async (i) => {
        const cargoId = i.data.values?.[0];
        if (!cargoId) return this.painelAnuncios(i);
        await this._upsertChannelDoc(guildId, { 'announce.roleId': cargoId });
        return this.painelAnuncios(i);
      }),
    });

    const mensagens = [
      { tipo: 'live',    titulo: 'Mensagem de Início da Live', label: 'Mensagem de Início', style: 1, emoji: '🔴' },
      { tipo: 'offline', titulo: 'Mensagem de Encerramento',   label: 'Mensagem de Fim',    style: 1, emoji: '⏹️' },
    ];

    const botoesMensagem = mensagens.map(m => this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: m.label, style: m.style, emoji: { name: m.emoji } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalAnuncioMensagem(i, m.tipo, m.titulo, (ii) => this.painelAnuncios(ii));
      },
    }));

    const toggleAnuncios = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: {
        label: anuncio.enabled === false ? 'Ativar Anúncios' : 'Desativar Anúncios',
        style: anuncio.enabled === false ? 3 : 2,
        emoji: { name: anuncio.enabled === false ? '✅' : '🔕' },
      },
      funcao: this._guarded(async (i) => {
        await this._upsertChannelDoc(guildId, { 'announce.enabled': anuncio.enabled === false });
        return this.painelAnuncios(i);
      }),
    });

    const toggleEncerramento = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: {
        label: anuncio.offlineEnabled === false ? 'Ativar Msg. de Encerramento' : 'Desativar Msg. de Encerramento',
        style: anuncio.offlineEnabled === false ? 3 : 2,
        emoji: { name: anuncio.offlineEnabled === false ? '✅' : '🔕' },
      },
      funcao: this._guarded(async (i) => {
        await this._upsertChannelDoc(guildId, { 'announce.offlineEnabled': anuncio.offlineEnabled === false });
        return this.painelAnuncios(i);
      }),
    });

    const statusTexto =
      `**Canal de anúncios:** ${anuncio.channelId ? `<#${anuncio.channelId}>` : '`Não definido`'}\n` +
      `**Cargo mencionado:** ${anuncio.roleId ? `<@&${anuncio.roleId}>` : '`Nenhum`'}\n` +
      `**Anúncios de início:** ${anuncio.enabled === false ? '🔴 Desativado' : '🟢 Ativado'}\n` +
      `**Mensagem de encerramento:** ${anuncio.offlineEnabled === false ? '🔴 Desativada' : '🟢 Ativada'}\n\n` +
      'Use `{streamer}`, `{titulo}`, `{categoria}` e `{link}` nas mensagens personalizadas.';

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('📢 **Anúncios de Live**'),
      CV2.separator(),
      CV2.text(statusTexto),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(canalSelect),
      CV2.row(cargoSelect),
      CV2.row(...botoesMensagem),
      CV2.row(toggleAnuncios, toggleEncerramento),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: ACCENT })]);
  }

  async _abrirModalAnuncioMensagem(interaction, tipo, titulo, destino) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);

    const campo = tipo === 'live' ? 'liveMessage' : 'offlineMessage';
    const atual = doc?.announce?.[campo] ?? '';

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: titulo,
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'mensagem',
            label: 'Conteúdo da mensagem',
            style: 2,
            required: false,
            max_length: 1000,
            value: atual || undefined,
            placeholder: tipo === 'live'
              ? 'Ex: 🔴 {streamer} está ao vivo agora! Confira: {link}'
              : 'Ex: ⏹️ {streamer} encerrou a transmissão. Até a próxima!',
          }],
        },
      ],
      funcao: this._guardedModal((mi, fields) => this._salvarMensagemAnuncio(mi, tipo, fields, destino)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _salvarMensagemAnuncio(mi, tipo, fields, destino) {
    const user    = mi.member.user.id;
    const guildId = mi.guild_id;
    const campo   = tipo === 'live' ? 'liveMessage' : 'offlineMessage';
    const texto   = (fields.mensagem ?? '').trim();

    await this._upsertChannelDoc(guildId, { [`announce.${campo}`]: texto || null });

    return this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload([CV2.container([
        CV2.text('✅ **Mensagem Salva**'),
        CV2.separator(),
        CV2.text(texto ? `Nova mensagem:\n> ${texto}` : 'A mensagem padrão será utilizada.'),
        CV2.separator(),
        this._betaNotice(),
        this.navRow(user, destino),
      ], { accentColor: ACCENT })], { ephemeral: false }),
    });
  }

  async painelAgenda(interaction) {
    const user = interaction.member.user.id;

    const itens = [
      { titulo: 'Agendamentos',       label: 'Agendamentos',       emoji: '🗓️' },
      { titulo: 'Eventos Automáticos', label: 'Eventos Automáticos', emoji: '⚡' },
      { titulo: 'Lembretes',          label: 'Lembretes',          emoji: '🔔' },
    ];

    const botoes = itens.map(it => this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: it.label, style: 2, emoji: { name: it.emoji } },
      funcao: this._guarded((i) => this.comingSoon(i, it.titulo, (ii) => this.painelAgenda(ii))),
    }));

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🗓️ **Agenda de Transmissões**'),
      CV2.separator(),
      CV2.text('Configurações futuras de agendamentos, eventos automáticos e lembretes de live.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(...botoes),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: ACCENT })]);
  }

  async painelEstatisticas(interaction) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('📊 **Estatísticas da Twitch**'),
      CV2.separator(),
      CV2.text(
        '**Lives realizadas:** `—`\n' +
        '**Horas transmitidas:** `—`\n' +
        '**Última live:** `—`\n' +
        '**Jogos mais transmitidos:** `—`\n' +
        '**Sequência de transmissões:** `—`\n\n' +
        'Ainda não existem dados coletados para este servidor.'
      ),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: ACCENT })]);
  }

  async painelMetas(interaction) {
    const user = interaction.member.user.id;

    const criarMeta = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Criar Meta', style: 3, emoji: { name: '🎯' } },
      funcao: this._guarded((i) => this.comingSoon(i, 'Criar Meta', (ii) => this.painelMetas(ii))),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🎯 **Metas de Transmissão**'),
      CV2.separator(),
      CV2.text('Nenhuma meta configurada ainda.\n\nEsta tela abrigará futuramente as metas de transmissão do streamer (horas, seguidores, doações e mais).'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(criarMeta),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: ACCENT })]);
  }

  async painelMissoes(interaction) {
    const user = interaction.member.user.id;

    const select = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Selecione uma categoria de missão',
        options: [
          { label: 'Missões Diárias',  description: 'Missões renovadas a cada dia',  value: 'diarias',  emoji: { name: '📅' } },
          { label: 'Missões Semanais', description: 'Missões renovadas a cada semana', value: 'semanais', emoji: { name: '🗓️' } },
        ],
      },
      funcao: this._guarded((i) => this.comingSoon(i, 'Missões da Twitch', (ii) => this.painelMissoes(ii))),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🧩 **Missões da Twitch**'),
      CV2.separator(),
      CV2.text('Nenhuma missão configurada ainda.\n\nEsta tela abrigará futuramente as missões relacionadas às transmissões.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(select),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: ACCENT })]);
  }

  async painelEquipe(interaction) {
    const user = interaction.member.user.id;

    const adicionarSelect = this.client.interactions.createUserSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione um membro para adicionar à equipe' },
      funcao: this._guarded((i) => this.comingSoon(i, 'Adicionar Membro à Equipe', (ii) => this.painelEquipe(ii))),
    });

    const removerBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Remover Membro', style: 4, emoji: { name: '🗑️' } },
      funcao: this._guarded((i) => this.comingSoon(i, 'Remover Membro da Equipe', (ii) => this.painelEquipe(ii))),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🧑‍🤝‍🧑 **Equipe do Módulo Twitch**'),
      CV2.separator(),
      CV2.text('Nenhum membro da equipe configurado ainda.\n\nEsta tela permitirá futuramente gerenciar quem pode administrar o módulo Twitch.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(adicionarSelect),
      CV2.row(removerBtn),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: ACCENT })]);
  }
}

module.exports = TwitchConfigSystem;
