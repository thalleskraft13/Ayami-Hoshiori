'use strict';

const CV2               = require('../../Messages/CV2.js');
const CreatorModuleBase  = require('../Creators/CreatorModuleBase.js');
const YoutubeChannelDb   = require('../../../Mongodb/youtubeChannel.js');
const YouTubeApi         = require('./YouTubeApiService.js');

const FEATURE_ID = 'youtube';

const CATEGORIES = [
  { value: 'conta',        label: 'Conta',        desc: 'Conectar, trocar ou remover o canal YouTube vinculado', emoji: '🔗' },
  { value: 'anuncios',     label: 'Anúncios',     desc: 'Canal, cargo e mensagens de vídeos, Shorts e lives',     emoji: '📢' },
  { value: 'agenda',       label: 'Agenda',       desc: 'Agenda de estreias e lembretes de estreia',              emoji: '🗓️' },
  { value: 'estatisticas', label: 'Estatísticas', desc: 'Vídeos, Shorts e lives publicados',                      emoji: '📊' },
  { value: 'metas',        label: 'Metas',        desc: 'Metas do canal',                                        emoji: '🎯' },
  { value: 'missoes',      label: 'Missões',      desc: 'Missões relacionadas ao canal',                         emoji: '🧩' },
  { value: 'equipe',       label: 'Equipe',       desc: 'Membros responsáveis pelo módulo YouTube',               emoji: '🧑‍🤝‍🧑' },
];

class YouTubeConfigSystem extends CreatorModuleBase {

  constructor(client) {
    super(client, {
      featureId:   FEATURE_ID,
      moduleLabel: 'YouTube',
      accent:      0xFF0000,
    });
  }

  async _getChannelDoc(guildId) {
    return YoutubeChannelDb.findOne({ guildId }).lean();
  }

  async _upsertChannelDoc(guildId, patch) {
    return YoutubeChannelDb.findOneAndUpdate(
      { guildId },
      { $set: patch },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
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
      CV2.text('🔴 **Módulo YouTube**'),
      CV2.separator(),
      CV2.text('Central de configurações da integração com o YouTube. Escolha uma categoria abaixo para começar.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(select),
      this.navRow(user, (i) => this.client.creatorsMenu.open(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelConta(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);

    const conectarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: doc?.youtubeChannelId ? 'Alterar Canal' : 'Conectar Canal', style: doc?.youtubeChannelId ? 2 : 3, emoji: { name: doc?.youtubeChannelId ? '🔄' : '🔗' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalCanal(i, (ii) => this.painelConta(ii));
      },
    });

    const botoes = [conectarBtn];

    if (doc?.youtubeChannelId) {
      botoes.push(this.client.interactions.createButton({
        user,
        feature: FEATURE_ID,
        data: { label: 'Remover Canal', style: 4, emoji: { name: '🗑️' } },
        funcao: this._guarded((i) => this._removerCanal(i)),
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

    const statusTexto = doc?.youtubeChannelId
      ? (
        `**Canal:** [${doc.title || doc.handle || doc.youtubeChannelId}](https://youtube.com/channel/${doc.youtubeChannelId})\n` +
        `**Status do módulo:** ${doc.moduleEnabled ? '🟢 Ativado' : '🔴 Desativado'}\n` +
        `**Monitoramento:** ${doc.state?.isLive ? '🔴 Ao vivo agora' : '⚪ Sem transmissão'}\n` +
        `**Vinculado por:** <@${doc.connectedBy}>`
      )
      : 'Nenhum canal YouTube vinculado a este servidor ainda.\n\nUse o botão abaixo para conectar informando a URL, o nome ou o @handle do canal.';

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🔗 **Canal YouTube**'),
      CV2.separator(),
      CV2.text(statusTexto),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(...botoes),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalCanal(interaction, destino) {
    const user = interaction.member.user.id;

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: 'Conectar Canal YouTube',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'canal',
            label: 'URL, nome ou @handle do canal',
            style: 1,
            required: true,
            max_length: 150,
            placeholder: 'Ex: @minhacriadora ou https://youtube.com/@minhacriadora',
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

    if (!YouTubeApi.parseChannelInput(entrada)) {
      return responder([this._errorContainer(
        'Canal Inválido',
        'Não foi possível reconhecer essa URL, nome ou @handle de canal.\n\nInforme a URL completa (ex: `https://youtube.com/@minhacriadora`), o @handle (ex: `@minhacriadora`) ou o nome do canal.',
        user, destino,
      )]);
    }

    let ytChannel;
    try {
      ytChannel = await YouTubeApi.resolveChannel(entrada);
    } catch (err) {
      console.error('[YouTubeConfigSystem] Erro ao validar canal no YouTube:', err.message);
      return responder([this._errorContainer(
        'Falha na Validação',
        'Não foi possível validar o canal com a API do YouTube no momento. Tente novamente em instantes.',
        user, destino,
      )]);
    }

    if (!ytChannel?.id) {
      return responder([this._errorContainer(
        'Canal Não Encontrado',
        `Nenhum canal do YouTube foi encontrado para \`${entrada}\`. Verifique o nome, o @handle ou a URL e tente novamente.`,
        user, destino,
      )]);
    }

    const doc = await this._upsertChannelDoc(guildId, {
      youtubeChannelId:  ytChannel.id,
      handle:             ytChannel.handle,
      title:              ytChannel.title,
      thumbnailUrl:        ytChannel.thumbnailUrl,
      uploadsPlaylistId:   ytChannel.uploadsPlaylistId,
      connectedBy:  user,
      connectedAt:  new Date(),
      moduleEnabled: true,
    });

    this.client.youtubeMonitor?.checkOne(guildId).catch(() => {});

    return responder([CV2.container([
      CV2.text('✅ **Canal Conectado**'),
      CV2.separator(),
      CV2.text(`O canal [${doc.title || doc.handle}](https://youtube.com/channel/${doc.youtubeChannelId}) foi vinculado a este servidor com sucesso.`),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, destino),
    ], { accentColor: this.ACCENT })]);
  }

  async _removerCanal(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    await YoutubeChannelDb.deleteOne({ guildId });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🗑️ **Canal Removido**'),
      CV2.separator(),
      CV2.text('O canal YouTube vinculado a este servidor foi removido. Nenhum anúncio será enviado até que um novo canal seja conectado.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelConta(i)),
    ], { accentColor: this.ACCENT_SOFT })]);
  }

  async _alternarModulo(interaction) {
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);
    if (!doc) return this.painelConta(interaction);

    await YoutubeChannelDb.updateOne({ guildId }, { $set: { moduleEnabled: !doc.moduleEnabled } });

    return this.painelConta(interaction);
  }

  async painelAnuncios(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);

    if (!doc?.youtubeChannelId) {
      return this.editOriginal(interaction, [CV2.container([
        CV2.text('📢 **Anúncios de Conteúdo**'),
        CV2.separator(),
        CV2.text('Nenhum canal YouTube conectado a este servidor ainda.\n\nConecte um canal na categoria **Conta** antes de configurar os anúncios.'),
        CV2.separator(),
        this._betaNotice(),
        this.navRow(user, (i) => this.home(i)),
      ], { accentColor: this.ACCENT })]);
    }

    const anuncio = doc.announce ?? {};
    const botOk   = await this._botCanAnnounceIn(guildId, anuncio.channelId);

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
      { tipo: 'video', titulo: 'Mensagem de Vídeo', label: 'Msg. Vídeo', style: 1, emoji: '🎬' },
      { tipo: 'short', titulo: 'Mensagem de Short',  label: 'Msg. Short', style: 1, emoji: '📱' },
      { tipo: 'live',  titulo: 'Mensagem de Live',   label: 'Msg. Live',  style: 1, emoji: '🔴' },
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

    const toggles = [
      { campo: 'videosEnabled', label: 'Vídeos', emoji: '🎬' },
      { campo: 'shortsEnabled', label: 'Shorts',  emoji: '📱' },
      { campo: 'livesEnabled',  label: 'Lives',   emoji: '🔴' },
    ];

    const botoesToggle = toggles.map(t => {
      const ativo = anuncio[t.campo] !== false;
      return this.client.interactions.createButton({
        user,
        feature: FEATURE_ID,
        data: {
          label: `${t.label}: ${ativo ? 'Ativado' : 'Desativado'}`,
          style: ativo ? 3 : 2,
          emoji: { name: t.emoji },
        },
        funcao: this._guarded(async (i) => {
          await this._upsertChannelDoc(guildId, { [`announce.${t.campo}`]: !ativo });
          return this.painelAnuncios(i);
        }),
      });
    });

    const avisoPermissao = (anuncio.channelId && !botOk)
      ? '\n\n⚠️ O bot não tem permissão para ver/enviar mensagens no canal de anúncios selecionado.'
      : '';

    const statusTexto =
      `**Canal de anúncios:** ${anuncio.channelId ? `<#${anuncio.channelId}>` : '`Não definido`'}\n` +
      `**Cargo mencionado:** ${anuncio.roleId ? `<@&${anuncio.roleId}>` : '`Nenhum`'}\n` +
      `**Vídeos:** ${anuncio.videosEnabled === false ? '🔴 Desativado' : '🟢 Ativado'}  •  ` +
      `**Shorts:** ${anuncio.shortsEnabled === false ? '🔴 Desativado' : '🟢 Ativado'}  •  ` +
      `**Lives:** ${anuncio.livesEnabled === false ? '🔴 Desativado' : '🟢 Ativado'}\n\n` +
      'Use `{canal}`, `{titulo}`, `{link}` e `{data}` nas mensagens personalizadas.' +
      avisoPermissao;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('📢 **Anúncios de Conteúdo**'),
      CV2.separator(),
      CV2.text(statusTexto),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(canalSelect),
      CV2.row(cargoSelect),
      CV2.row(...botoesMensagem),
      CV2.row(...botoesToggle),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalAnuncioMensagem(interaction, tipo, titulo, destino) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const doc     = await this._getChannelDoc(guildId);

    const campo = tipo === 'video' ? 'videoMessage' : tipo === 'short' ? 'shortMessage' : 'liveMessage';
    const atual = doc?.announce?.[campo] ?? '';

    const placeholders = {
      video: 'Ex: 🎬 {canal} publicou um novo vídeo: {titulo}! {link}',
      short: 'Ex: 📱 {canal} publicou um novo Short: {titulo}! {link}',
      live:  'Ex: 🔴 {canal} está ao vivo agora! {link}',
    };

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
            placeholder: placeholders[tipo],
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
    const campo   = tipo === 'video' ? 'videoMessage' : tipo === 'short' ? 'shortMessage' : 'liveMessage';
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
      ], { accentColor: this.ACCENT })], { ephemeral: false }),
    });
  }

  async painelAgenda(interaction) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🗓️ **Agenda de Estreias**'),
      CV2.separator(),
      CV2.text('Configurações futuras de agenda de estreias e lembretes.\n\nNenhuma informação é salva nesta etapa.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelEstatisticas(interaction) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('📊 **Estatísticas do YouTube**'),
      CV2.separator(),
      CV2.text(
        '**Vídeos publicados:** `—`\n' +
        '**Shorts publicados:** `—`\n' +
        '**Lives realizadas:** `—`\n' +
        '**Última publicação:** `—`\n\n' +
        'Ainda não existem dados coletados para este servidor.'
      ),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelMetas(interaction) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🎯 **Metas do Canal**'),
      CV2.separator(),
      CV2.text('Nenhuma meta configurada ainda.\n\nEsta tela abrigará futuramente as metas do canal (vídeos, inscritos e mais).'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelMissoes(interaction) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🧩 **Missões do YouTube**'),
      CV2.separator(),
      CV2.text('Nenhuma missão configurada ainda.\n\nEsta tela abrigará futuramente as missões relacionadas ao canal.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelEquipe(interaction) {
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🧑‍🤝‍🧑 **Equipe do Módulo YouTube**'),
      CV2.separator(),
      CV2.text('Nenhum membro da equipe configurado ainda.\n\nEsta tela permitirá futuramente gerenciar quem pode administrar o módulo YouTube.'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
  }
}

module.exports = YouTubeConfigSystem;
