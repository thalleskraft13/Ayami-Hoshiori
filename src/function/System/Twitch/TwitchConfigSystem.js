'use strict';

const CV2              = require('../../Messages/CV2.js');
const CreatorModuleBase = require('../Creators/CreatorModuleBase.js');
const TwitchChannelDb   = require('../../../Mongodb/twitchChannel.js');
const TwitchApi         = require('./TwitchApiService.js');
const CreatorMissionService = require('../Missions/CreatorMissionService.js');
const {
  MISSION_TYPES,
  PERIODS: MISSION_PERIODS,
} = CreatorMissionService;
const AccountLinkService    = require('../CreatorAccounts/AccountLinkService.js');
const TwitchCommandService  = require('./Commands/TwitchCommandService.js');
const { PERMISSIONS: CMD_PERMISSIONS } = TwitchCommandService;
const TwitchStreamStatsService = require('./Stats/TwitchStreamStatsService.js');
const TwitchViewerStatsService = require('./Stats/TwitchViewerStatsService.js');
const TwitchAlertService = require('./Alerts/TwitchAlertService.js');
const {
  TYPES:            ALERT_TYPES,
  TYPE_LABELS:       ALERT_TYPE_LABELS,
  DEFAULT_MESSAGES:  ALERT_DEFAULT_MESSAGES,
} = TwitchAlertService;
const ALERT_AMOUNT_TYPES = [ALERT_TYPES.BITS, ALERT_TYPES.RAID, ALERT_TYPES.GIFT_SUB];

function formatHoras(segundos) {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return horas > 0 ? `${horas}h${minutos}min assistidos` : `${minutos}min assistidos`;
}

const FEATURE_ID = 'twitch';

const CATEGORIES = [
  { value: 'conta',        label: 'Conta',        desc: 'Conectar, trocar ou remover a conta Twitch vinculada', emoji: '🔗' },
  { value: 'anuncios',     label: 'Anúncios',     desc: 'Canal, cargo e mensagens de notificação de live',      emoji: '📢' },
  { value: 'agenda',       label: 'Agenda',       desc: 'Agendamentos, eventos automáticos e lembretes',        emoji: '🗓️' },
  { value: 'estatisticas', label: 'Estatísticas', desc: 'Lives, horas transmitidas e jogos mais jogados',       emoji: '📊' },
  { value: 'metas',        label: 'Metas',        desc: 'Metas de transmissão do streamer',                    emoji: '🎯' },
  { value: 'missoes',      label: 'Missões',      desc: 'Missões relacionadas às transmissões',                emoji: '🧩' },
  { value: 'comandos',     label: 'Comandos',     desc: 'Comandos personalizados do chat da Twitch',            emoji: '⌨️' },
  { value: 'alertas',      label: 'Alertas',      desc: 'Alertas de seguidores, inscrições, bits e raids',      emoji: '🔔' },
  { value: 'equipe',       label: 'Equipe',       desc: 'Membros responsáveis pelo módulo Twitch',              emoji: '🧑‍🤝‍🧑' },
];

const MISSION_TYPE_LABELS = {
  [MISSION_TYPES.WATCH_STREAM]:   'Assistir Transmissão',
  [MISSION_TYPES.WATCH_DURATION]: 'Acompanhar Duração',
  [MISSION_TYPES.STREAK]:         'Sequência de Lives',
  [MISSION_TYPES.EVENT]:          'Participação em Evento',
  [MISSION_TYPES.MESSAGE_COUNT]:  'Quantidade de Mensagens',
  [MISSION_TYPES.CUSTOM]:         'Personalizada',
};

const MISSION_PERIOD_LABELS = {
  [MISSION_PERIODS.ONCE]:    'Única',
  [MISSION_PERIODS.DAILY]:   'Diária',
  [MISSION_PERIODS.WEEKLY]:  'Semanal',
  [MISSION_PERIODS.MONTHLY]: 'Mensal',
};

const MISSION_REWARD_TYPES = Object.freeze({
  BADGE:  'badge',
  ROLE:   'role',
  CUSTOM: 'custom',
});

const MISSION_REWARD_TYPE_LABELS = {
  [MISSION_REWARD_TYPES.BADGE]:  'Emblema (Badge)',
  [MISSION_REWARD_TYPES.ROLE]:   'Cargo do Discord',
  [MISSION_REWARD_TYPES.CUSTOM]: 'Texto Personalizado',
};

const PERMISSION_LABELS = {
  [CMD_PERMISSIONS.EVERYONE]:    'Todo mundo',
  [CMD_PERMISSIONS.SUBSCRIBER]:  'Inscritos',
  [CMD_PERMISSIONS.VIP]:         'VIPs',
  [CMD_PERMISSIONS.MODERATOR]:   'Moderadores',
  [CMD_PERMISSIONS.BROADCASTER]: 'Só o streamer',
};

class TwitchConfigSystem extends CreatorModuleBase {

  constructor(client) {
    super(client, {
      featureId:   FEATURE_ID,
      moduleLabel: 'Twitch',
      accent:      0x9146FF,
    });
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
          case 'comandos':     return this.painelComandos(i);
          case 'alertas':      return this.painelAlertas(i);
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
    ], { accentColor: this.ACCENT })]);
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
    ], { accentColor: this.ACCENT })]);
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
    ], { accentColor: this.ACCENT_SOFT })]);
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

    const avisoPermissao = (anuncio.channelId && !botOk)
      ? '\n\n⚠️ O bot não tem permissão para ver/enviar mensagens no canal de anúncios selecionado.'
      : '';

    const statusTexto =
      `**Canal de anúncios:** ${anuncio.channelId ? `<#${anuncio.channelId}>` : '`Não definido`'}\n` +
      `**Cargo mencionado:** ${anuncio.roleId ? `<@&${anuncio.roleId}>` : '`Nenhum`'}\n` +
      `**Anúncios de início:** ${anuncio.enabled === false ? '🔴 Desativado' : '🟢 Ativado'}\n` +
      `**Mensagem de encerramento:** ${anuncio.offlineEnabled === false ? '🔴 Desativada' : '🟢 Ativada'}\n\n` +
      'Use `{streamer}`, `{titulo}`, `{categoria}` e `{link}` nas mensagens personalizadas.' +
      avisoPermissao;

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
    ], { accentColor: this.ACCENT })]);
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
      ], { accentColor: this.ACCENT })], { ephemeral: false }),
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
    ], { accentColor: this.ACCENT })]);
  }

  async painelEstatisticas(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const [overview, ranking] = await Promise.all([
      TwitchStreamStatsService.getStatsOverview(guildId),
      TwitchViewerStatsService.getRanking(guildId, 10),
    ]);

    const jogos = overview.topGames.length
      ? overview.topGames.map((g) => `${g.name} (${g.count}x)`).join(', ')
      : '—';

    const rankingTexto = ranking.length
      ? ranking.map((r, idx) =>
        `**${idx + 1}.** ${r.viewerDisplayName || r.viewerLogin}${r.discord ? ` _(<@${r.discord.discordUserId}>)_` : ''} — ` +
        `${formatHoras(r.watchSeconds)}, ${r.messageCount} msgs, ${r.livesWatched} lives`,
      ).join('\n')
      : 'Ainda não há dados de espectadores coletados para este servidor.';

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('📊 **Estatísticas da Twitch**'),
      CV2.separator(),
      CV2.text(
        `**Lives realizadas:** \`${overview.livesCount}\`\n` +
        `**Horas transmitidas:** \`${overview.hoursStreamed}h\`\n` +
        `**Última live:** \`${overview.lastLiveAt ? new Date(overview.lastLiveAt).toLocaleDateString('pt-BR') : '—'}\`\n` +
        `**Jogos mais transmitidos:** ${jogos}\n` +
        `**Sequência de transmissões:** \`${overview.streakDays} dia(s)\`\n` +
        `**Missões concluídas:** \`${overview.missionsCompleted}\` _(${overview.missionParticipants} participante(s))_`,
      ),
      CV2.separator(),
      CV2.text(`🏆 **Ranking de Espectadores**\n${rankingTexto}`),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.home(i)),
    ], { accentColor: this.ACCENT })]);
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
    ], { accentColor: this.ACCENT })]);
  }

  async painelMissoes(interaction) {
    const user = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const [missoes, vinculado] = await Promise.all([
      CreatorMissionService.listMissions(guildId, FEATURE_ID),
      AccountLinkService.isLinked(user, FEATURE_ID),
    ]);

    const linhas = missoes.length
      ? missoes.map((m) => {
        const periodo = MISSION_PERIOD_LABELS[m.period] || m.period;
        return `${m.active ? '🟢' : '🔴'} **${m.title}** _(${periodo})_\n${m.description || 'Sem descrição.'}\nMeta: \`${m.goal?.target ?? 1}${m.goal?.unit ? ` ${m.goal.unit}` : ''}\``;
      }).join('\n\n')
      : 'Nenhuma missão configurada ainda para este servidor.';

    const avisoVinculo = vinculado
      ? null
      : '\n\n⚠️ **Conecte sua conta Twitch em Contas Conectadas para participar das missões.**';

    const criarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Criar Missão', style: 3, emoji: { name: '🧩' } },
      funcao: this._guarded((i) => this._abrirSelectTipoMissao(i)),
    });

    const componentes = [
      CV2.text('🧩 **Missões da Twitch**'),
      CV2.separator(),
      CV2.text(`${linhas}${avisoVinculo || ''}`),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(criarBtn),
    ];

    if (missoes.length) {
      const gerenciarSelect = this.client.interactions.createSelect({
        user,
        feature: FEATURE_ID,
        data: {
          placeholder: 'Selecione uma missão para gerenciar',
          options: missoes.slice(0, 25).map((m) => ({
            label: m.title.slice(0, 100),
            description: `${MISSION_TYPE_LABELS[m.type] || m.type} · ${MISSION_PERIOD_LABELS[m.period] || m.period}`,
            value: String(m._id),
          })),
        },
        funcao: this._guarded((i) => this.painelMissaoDetalhe(i, i.data.values?.[0])),
      });

      componentes.push(CV2.row(gerenciarSelect));
    }

    componentes.push(this.navRow(user, (i) => this.home(i)));

    return this.editOriginal(interaction, [CV2.container(componentes, { accentColor: this.ACCENT })]);
  }

  async _abrirSelectTipoMissao(interaction) {
    const user = interaction.member.user.id;

    const tipoSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Selecione o tipo da missão',
        options: Object.values(MISSION_TYPES).map((type) => ({
          label: MISSION_TYPE_LABELS[type],
          value: type,
        })),
      },
      funcao: this._guarded((i) => {
        const type = i.data.values?.[0];
        if (!Object.values(MISSION_TYPES).includes(type)) return this.painelMissoes(i);
        return this._selecionarPeriodoMissao(i, type);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🧩 **Criar Missão — Passo 1 de 4**'),
      CV2.separator(),
      CV2.text('Selecione o tipo de objetivo desta missão.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(tipoSelect),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _selecionarPeriodoMissao(interaction, type) {
    const user = interaction.member.user.id;

    const periodoSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Selecione o período da missão',
        options: Object.values(MISSION_PERIODS).map((period) => ({
          label: MISSION_PERIOD_LABELS[period],
          value: period,
        })),
      },
      funcao: this._guarded((i) => {
        const period = i.data.values?.[0];
        if (!Object.values(MISSION_PERIODS).includes(period)) return this._selecionarPeriodoMissao(i, type);
        return this._selecionarRecompensaMissao(i, type, period);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🧩 **Criar Missão de ${MISSION_TYPE_LABELS[type]} — Passo 2 de 4**`),
      CV2.separator(),
      CV2.text('Selecione com que frequência esta missão é renovada.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(periodoSelect),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

    async _selecionarRecompensaMissao(interaction, type, period) {
    const user = interaction.member.user.id;

    const recompensaSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Selecione o tipo de recompensa (opcional)',
        options: Object.values(MISSION_REWARD_TYPES).map((rewardType) => ({
          label: MISSION_REWARD_TYPE_LABELS[rewardType],
          value: rewardType,
        })),
      },
      funcao: this._guarded((i) => {
        const rewardType = i.data.values?.[0] || null;
        if (rewardType === MISSION_REWARD_TYPES.ROLE) return this._selecionarCargoRecompensaMissao(i, type, period, rewardType);
        return this._selecionarLogRecompensaMissao(i, type, period, rewardType, null);
      }),
    });

    const semRecompensaBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Sem Recompensa', style: 2, emoji: { name: '⏭️' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalCriarMissao(i, type, period, null, null, null);
      },
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🧩 **Criar Missão de ${MISSION_TYPE_LABELS[type]} — Passo 3 de 6**`),
      CV2.separator(),
      CV2.text(
        `Período: ${MISSION_PERIOD_LABELS[period]}\n\n` +
        'Selecione um tipo de recompensa estrutural para quem concluir esta missão ' +
        '(nunca moeda/saldo — cargo atribui de verdade, badge/texto ficam só registrados), ou pule esta etapa.',
      ),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(recompensaSelect),
      CV2.row(semRecompensaBtn),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _selecionarCargoRecompensaMissao(interaction, type, period, rewardType) {
    const user = interaction.member.user.id;

    const cargoSelect = this.client.interactions.createRoleSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o cargo a atribuir' },
      funcao: this._guarded((i) => {
        const roleId = i.data.values?.[0] || null;
        return this._selecionarLogRecompensaMissao(i, type, period, rewardType, roleId);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🧩 **Criar Missão de ${MISSION_TYPE_LABELS[type]} — Passo 4 de 6**`),
      CV2.separator(),
      CV2.text('Selecione o cargo do Discord que será atribuído a quem concluir e tiver a recompensa registrada.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(cargoSelect),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

    async _selecionarLogRecompensaMissao(interaction, type, period, rewardType, roleId) {
    const user = interaction.member.user.id;

    const logSelect = this.client.interactions.createChannelSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o canal onde o log de recompensa será publicado', channel_types: [0, 5] },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdminModal(i);
        const logChannelId = i.data.values?.[0] || null;
        return this._abrirModalCriarMissao(i, type, period, rewardType, roleId, logChannelId);
      },
    });

    const semLogBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Sem Log', style: 2, emoji: { name: '⏭️' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalCriarMissao(i, type, period, rewardType, roleId, null);
      },
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🧩 **Criar Missão de ${MISSION_TYPE_LABELS[type]} — Passo 5 de 6**`),
      CV2.separator(),
      CV2.text(
        'Selecione um canal do Discord pra publicar uma mensagem sempre que a recompensa desta missão for registrada, ou pule esta etapa.',
      ),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(logSelect),
      CV2.row(semLogBtn),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalCriarMissao(interaction, type, period, rewardType, roleId, logChannelId) {
    const user = interaction.member.user.id;

    const components = [
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'titulo', label: 'Título da missão', style: 1,
          required: true, max_length: 100, placeholder: 'Ex: Assista a live de hoje',
        }],
      },
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'descricao', label: 'Descrição (opcional)', style: 2,
          required: false, max_length: 300,
        }],
      },
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'meta', label: 'Meta (número)', style: 1,
          required: true, max_length: 6, placeholder: 'Ex: 30',
        }],
      },
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'unidade', label: 'Unidade da meta (opcional)', style: 1,
          required: false, max_length: 30, placeholder: 'Ex: minutos, lives',
        }],
      },
    ];

    if (rewardType) {
      components.push({
        type: 1,
        components: [{
          type: 4, custom_id: 'recompensa', label: 'Descrição da recompensa', style: 1,
          required: true, max_length: 200, placeholder: 'Ex: Cargo VIP da comunidade',
        }],
      });
    }

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: `Criar Missão — ${MISSION_TYPE_LABELS[type]}`,
      components,
      funcao: this._guardedModal((mi, fields) => this._confirmarCriarMissao(mi, type, period, rewardType, roleId, logChannelId, fields)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _confirmarCriarMissao(mi, type, period, rewardType, roleId, logChannelId, fields) {
    const user    = mi.member.user.id;
    const guildId = mi.guild_id;

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

            const key = String(fields.titulo || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || `mission_${Date.now()}`;

    try {
      await CreatorMissionService.createMission({
        guildId,
        platform: FEATURE_ID,
        key,
        type,
        title: fields.titulo,
        description: fields.descricao || '',
        goal: { target: Math.max(1, Number(fields.meta) || 1), unit: fields.unidade || null },
        period,
        requiredPlan: 'FREE',
        createdBy: user,
        reward: rewardType ? {
          type: rewardType,
          description: fields.recompensa || null,
          roleId: rewardType === MISSION_REWARD_TYPES.ROLE ? roleId : null,
          logChannelId: logChannelId || null,
        } : null,
      });
    } catch (err) {
      return responder([this._errorContainer(
        'Não foi possível criar a missão', err.message, user, (i) => this.painelMissoes(i),
      )]);
    }

    return responder([CV2.container([
      CV2.text('✅ **Missão criada!**'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelMissaoDetalhe(interaction, missionId) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const missao = await CreatorMissionService.getMission(missionId);
    if (!missao || missao.guildId !== guildId) {
      return this.painelMissoes(interaction);
    }

    const toggleBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: {
        label: missao.active ? 'Desativar' : 'Ativar',
        style: missao.active ? 2 : 3,
        emoji: { name: missao.active ? '🔕' : '✅' },
      },
      funcao: this._guarded(async (i) => {
        await CreatorMissionService.setMissionActive(missionId, !missao.active);
        return this.painelMissaoDetalhe(i, missionId);
      }),
    });

    const editarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Editar Título/Descrição/Meta', style: 1, emoji: { name: '✏️' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalEditarMissao(i, missionId);
      },
    });

    const tipoSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Trocar o tipo da missão',
        options: Object.values(MISSION_TYPES).map((type) => ({
          label: MISSION_TYPE_LABELS[type], value: type, default: type === missao.type,
        })),
      },
      funcao: this._guarded(async (i) => {
        const type = i.data.values?.[0];
        if (type) await CreatorMissionService.updateMission(missionId, { type });
        return this.painelMissaoDetalhe(i, missionId);
      }),
    });

    const periodoSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Trocar o período da missão',
        options: Object.values(MISSION_PERIODS).map((period) => ({
          label: MISSION_PERIOD_LABELS[period], value: period, default: period === missao.period,
        })),
      },
      funcao: this._guarded(async (i) => {
        const period = i.data.values?.[0];
        if (period) await CreatorMissionService.updateMission(missionId, { period });
        return this.painelMissaoDetalhe(i, missionId);
      }),
    });

    const configurarRecompensaBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Configurar Recompensa', style: 1, emoji: { name: '🎁' } },
      funcao: this._guarded((i) => this._selecionarTipoRecompensaEdicao(i, missionId)),
    });

    const removerBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Remover', style: 4, emoji: { name: '🗑️' } },
      funcao: this._guarded(async (i) => {
        await CreatorMissionService.deleteMission(missionId);
        return this.painelMissoes(i);
      }),
    });

    const recompensaTexto = missao.reward?.type
      ? `${MISSION_REWARD_TYPE_LABELS[missao.reward.type] || missao.reward.type}` +
        `${missao.reward.description ? ` — ${missao.reward.description}` : ''}` +
        `${missao.reward.roleId ? `\nCargo: <@&${missao.reward.roleId}>` : ''}` +
        `${missao.reward.logChannelId ? `\nLog em: <#${missao.reward.logChannelId}>` : ''}`
      : 'Nenhuma';

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🧩 **${missao.title}**`),
      CV2.separator(),
      CV2.text(
        `**Descrição:** ${missao.description || 'Sem descrição.'}\n` +
        `**Status:** ${missao.active ? '🟢 Ativa' : '🔴 Inativa'}\n` +
        `**Tipo:** ${MISSION_TYPE_LABELS[missao.type] || missao.type}\n` +
        `**Período:** ${MISSION_PERIOD_LABELS[missao.period] || missao.period}\n` +
        `**Meta:** ${missao.goal?.target ?? 1}${missao.goal?.unit ? ` ${missao.goal.unit}` : ''}\n` +
        `**Recompensa:** ${recompensaTexto}`,
      ),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(tipoSelect),
      CV2.row(periodoSelect),
      CV2.row(toggleBtn, editarBtn, configurarRecompensaBtn, removerBtn),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _selecionarTipoRecompensaEdicao(interaction, missionId) {
    const user = interaction.member.user.id;
    const missao = await CreatorMissionService.getMission(missionId);
    if (!missao) return this.painelMissoes(interaction);

    const recompensaSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Selecione o tipo de recompensa',
        options: [
          { label: 'Nenhuma (remover recompensa)', value: 'none', default: !missao.reward?.type },
          ...Object.values(MISSION_REWARD_TYPES).map((rewardType) => ({
            label: MISSION_REWARD_TYPE_LABELS[rewardType], value: rewardType, default: rewardType === missao.reward?.type,
          })),
        ],
      },
      funcao: this._guarded(async (i) => {
        const valor = i.data.values?.[0];
        if (valor === 'none') {
          await CreatorMissionService.updateMission(missionId, { reward: null });
          return this.painelMissaoDetalhe(i, missionId);
        }
        if (valor === MISSION_REWARD_TYPES.ROLE) return this._selecionarCargoRecompensaEdicao(i, missionId, valor);
        return this._selecionarLogRecompensaEdicao(i, missionId, valor, null);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🎁 **Configurar Recompensa — ${missao.title}**`),
      CV2.separator(),
      CV2.text('Selecione o tipo de recompensa (nunca moeda/saldo), ou escolha "Nenhuma" pra remover a recompensa atual.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(recompensaSelect),
      this.navRow(user, (i) => this.painelMissaoDetalhe(i, missionId)),
    ], { accentColor: this.ACCENT })]);
  }

  async _selecionarCargoRecompensaEdicao(interaction, missionId, rewardType) {
    const user = interaction.member.user.id;

    const cargoSelect = this.client.interactions.createRoleSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o cargo a atribuir' },
      funcao: this._guarded((i) => {
        const roleId = i.data.values?.[0] || null;
        return this._selecionarLogRecompensaEdicao(i, missionId, rewardType, roleId);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🎁 **Configurar Recompensa — Passo 2 de 4**'),
      CV2.separator(),
      CV2.text('Selecione o cargo do Discord que será atribuído a quem concluir e tiver a recompensa registrada.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(cargoSelect),
      this.navRow(user, (i) => this.painelMissaoDetalhe(i, missionId)),
    ], { accentColor: this.ACCENT })]);
  }

  async _selecionarLogRecompensaEdicao(interaction, missionId, rewardType, roleId) {
    const user = interaction.member.user.id;

    const logSelect = this.client.interactions.createChannelSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o canal onde o log de recompensa será publicado', channel_types: [0, 5] },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdminModal(i);
        const logChannelId = i.data.values?.[0] || null;
        return this._abrirModalRecompensaEdicao(i, missionId, rewardType, roleId, logChannelId);
      },
    });

    const semLogBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Sem Log', style: 2, emoji: { name: '⏭️' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalRecompensaEdicao(i, missionId, rewardType, roleId, null);
      },
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🎁 **Configurar Recompensa — Passo 3 de 4**'),
      CV2.separator(),
      CV2.text('Selecione um canal do Discord pra publicar uma mensagem sempre que a recompensa for registrada, ou pule esta etapa.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(logSelect),
      CV2.row(semLogBtn),
      this.navRow(user, (i) => this.painelMissaoDetalhe(i, missionId)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalRecompensaEdicao(interaction, missionId, rewardType, roleId, logChannelId) {
    const user = interaction.member.user.id;
    const missao = await CreatorMissionService.getMission(missionId);
    if (!missao) return this.painelMissoes(interaction);

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: 'Configurar Recompensa',
      components: [
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'recompensa', label: 'Descrição da recompensa', style: 1,
            required: true, max_length: 200,
            value: rewardType === missao.reward?.type ? (missao.reward?.description || undefined) : undefined,
            placeholder: 'Ex: Cargo VIP da comunidade',
          }],
        },
      ],
      funcao: this._guardedModal((mi, fields) => this._salvarRecompensaEdicao(mi, missionId, rewardType, roleId, logChannelId, fields)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _salvarRecompensaEdicao(mi, missionId, rewardType, roleId, logChannelId, fields) {
    const user = mi.member.user.id;

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

    try {
      await CreatorMissionService.updateMission(missionId, {
        reward: {
          type: rewardType,
          description: fields.recompensa || null,
          roleId: rewardType === MISSION_REWARD_TYPES.ROLE ? roleId : null,
          logChannelId: logChannelId || null,
        },
      });
    } catch (err) {
      return responder([this._errorContainer(
        'Não foi possível salvar a recompensa', err.message, user, (i) => this.painelMissoes(i),
      )]);
    }

    return responder([CV2.container([
      CV2.text('✅ **Recompensa atualizada!**'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalEditarMissao(interaction, missionId) {
    const user  = interaction.member.user.id;
    const missao = await CreatorMissionService.getMission(missionId);
    if (!missao) return this.painelMissoes(interaction);

    const components = [
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'titulo', label: 'Título da missão', style: 1,
          required: true, max_length: 100, value: missao.title,
        }],
      },
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'descricao', label: 'Descrição (opcional)', style: 2,
          required: false, max_length: 300, value: missao.description || undefined,
        }],
      },
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'meta', label: 'Meta (número)', style: 1,
          required: true, max_length: 6, value: String(missao.goal?.target ?? 1),
        }],
      },
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'unidade', label: 'Unidade da meta (opcional)', style: 1,
          required: false, max_length: 30, value: missao.goal?.unit || undefined,
        }],
      },
    ];

    if (missao.reward?.type) {
      components.push({
        type: 1,
        components: [{
          type: 4, custom_id: 'recompensa', label: 'Descrição da recompensa', style: 1,
          required: true, max_length: 200, value: missao.reward.description || undefined,
        }],
      });
    }

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: `Editar Missão — ${missao.title.slice(0, 30)}`,
      components,
      funcao: this._guardedModal((mi, fields) => this._salvarEdicaoMissao(mi, missionId, fields)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _salvarEdicaoMissao(mi, missionId, fields) {
    const user = mi.member.user.id;

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

    try {
      const missaoAtual = await CreatorMissionService.getMission(missionId);
      const patch = {
        title:       fields.titulo,
        description: fields.descricao || '',
        goal: {
          target: Math.max(1, Number(fields.meta) || 1),
          unit:   fields.unidade || null,
        },
      };
      if (missaoAtual?.reward?.type && fields.recompensa !== undefined) {
        patch.reward = { type: missaoAtual.reward.type, description: fields.recompensa };
      }
      await CreatorMissionService.updateMission(missionId, patch);
    } catch (err) {
      return responder([this._errorContainer(
        'Não foi possível salvar a missão', err.message, user, (i) => this.painelMissoes(i),
      )]);
    }

    return responder([CV2.container([
      CV2.text('✅ **Missão atualizada!**'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelMissoes(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelComandos(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const comandos = await TwitchCommandService.listCommands(guildId);

    const linhas = comandos.length
      ? comandos.map((c) =>
        `${c.active ? '🟢' : '🔴'} **!${c.trigger}** _(${PERMISSION_LABELS[c.permission]}, cooldown ${c.cooldownSeconds}s, usado ${c.usageCount}x)_\n${c.response}`,
      ).join('\n\n')
      : 'Nenhum comando personalizado configurado ainda para este servidor.';

    const criarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Criar Comando', style: 3, emoji: { name: '➕' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalCriarComando(i);
      },
    });

    const componentes = [
      CV2.text('⌨️ **Comandos da Twitch**'),
      CV2.separator(),
      CV2.text(linhas),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(criarBtn),
    ];

    if (comandos.length) {
      const gerenciarSelect = this.client.interactions.createSelect({
        user,
        feature: FEATURE_ID,
        data: {
          placeholder: 'Selecione um comando para gerenciar',
          options: comandos.slice(0, 25).map((c) => ({
            label: `!${c.trigger}`,
            description: c.response.slice(0, 90),
            value: String(c._id),
          })),
        },
        funcao: this._guarded((i) => this.painelComandoDetalhe(i, i.data.values?.[0])),
      });

      componentes.push(CV2.row(gerenciarSelect));
    }

    componentes.push(this.navRow(user, (i) => this.home(i)));

    return this.editOriginal(interaction, [CV2.container(componentes, { accentColor: this.ACCENT })]);
  }

  async _abrirModalCriarComando(interaction) {
    const user = interaction.member.user.id;

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: 'Criar Comando de Chat',
      components: [
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'gatilho', label: 'Gatilho (sem o "!")', style: 1,
            required: true, max_length: 30, placeholder: 'Ex: discord',
          }],
        },
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'resposta', label: 'Resposta', style: 2,
            required: true, max_length: 450,
            placeholder: 'Ex: Entre no nosso Discord: {url} 🎉 Variáveis: {user} {channel} {game} {titulo} {uptime} {count}',
          }],
        },
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'cooldown', label: 'Cooldown em segundos (padrão 10)', style: 1,
            required: false, max_length: 5, placeholder: '10',
          }],
        },
      ],
      funcao: this._guardedModal((mi, fields) => this._confirmarCriarComando(mi, fields)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _confirmarCriarComando(mi, fields) {
    const user    = mi.member.user.id;
    const guildId = mi.guild_id;

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

    try {
      await TwitchCommandService.createCommand({
        guildId,
        trigger: fields.gatilho,
        response: fields.resposta,
        cooldownSeconds: fields.cooldown ? Number(fields.cooldown) : 10,
        createdBy: user,
      });
    } catch (err) {
      return responder([this._errorContainer(
        'Não foi possível criar o comando', err.message, user, (i) => this.painelComandos(i),
      )]);
    }

    return responder([CV2.container([
      CV2.text('✅ **Comando criado!**'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelComandos(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelComandoDetalhe(interaction, commandId) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const comando = await TwitchCommandService.getCommand(commandId);
    if (!comando || comando.guildId !== guildId) {
      return this.painelComandos(interaction);
    }

    const toggleBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: {
        label: comando.active ? 'Desativar' : 'Ativar',
        style: comando.active ? 2 : 3,
        emoji: { name: comando.active ? '🔕' : '✅' },
      },
      funcao: this._guarded(async (i) => {
        await TwitchCommandService.toggleCommandActive(commandId, guildId);
        return this.painelComandoDetalhe(i, commandId);
      }),
    });

    const editarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Editar Resposta/Cooldown', style: 1, emoji: { name: '✏️' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalEditarComando(i, commandId);
      },
    });

    const removerBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Remover', style: 4, emoji: { name: '🗑️' } },
      funcao: this._guarded(async (i) => {
        await TwitchCommandService.deleteCommand(commandId, guildId);
        return this.painelComandos(i);
      }),
    });

    const permissaoSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Quem pode usar este comando',
        options: Object.entries(PERMISSION_LABELS).map(([value, label]) => ({
          label, value, default: value === comando.permission,
        })),
      },
      funcao: this._guarded(async (i) => {
        const valor = i.data.values?.[0];
        if (valor) await TwitchCommandService.updateCommand(commandId, guildId, { permission: valor });
        return this.painelComandoDetalhe(i, commandId);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`⌨️ **!${comando.trigger}**`),
      CV2.separator(),
      CV2.text(
        `**Resposta:** ${comando.response}\n` +
        `**Status:** ${comando.active ? '🟢 Ativo' : '🔴 Inativo'}\n` +
        `**Permissão:** ${PERMISSION_LABELS[comando.permission]}\n` +
        `**Cooldown:** ${comando.cooldownSeconds}s\n` +
        `**Usos:** ${comando.usageCount}`,
      ),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(permissaoSelect),
      CV2.row(toggleBtn, editarBtn, removerBtn),
      this.navRow(user, (i) => this.painelComandos(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalEditarComando(interaction, commandId) {
    const user    = interaction.member.user.id;
    const comando = await TwitchCommandService.getCommand(commandId);
    if (!comando) return this.painelComandos(interaction);

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: `Editar !${comando.trigger}`,
      components: [
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'resposta', label: 'Resposta', style: 2,
            required: true, max_length: 450, value: comando.response,
          }],
        },
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'cooldown', label: 'Cooldown em segundos', style: 1,
            required: false, max_length: 5, value: String(comando.cooldownSeconds),
          }],
        },
      ],
      funcao: this._guardedModal((mi, fields) => this._salvarEdicaoComando(mi, commandId, fields)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _salvarEdicaoComando(mi, commandId, fields) {
    const user    = mi.member.user.id;
    const guildId = mi.guild_id;

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

    try {
      await TwitchCommandService.updateCommand(commandId, guildId, {
        response: fields.resposta,
        cooldownSeconds: fields.cooldown ? Number(fields.cooldown) : undefined,
      });
    } catch (err) {
      return responder([this._errorContainer(
        'Não foi possível salvar o comando', err.message, user, (i) => this.painelComandos(i),
      )]);
    }

    return responder([CV2.container([
      CV2.text('✅ **Comando atualizado!**'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelComandos(i)),
    ], { accentColor: this.ACCENT })]);
  }

  _alertAmountLabel(type) {
    switch (type) {
      case ALERT_TYPES.BITS:     return 'Bits mínimos (opcional)';
      case ALERT_TYPES.RAID:     return 'Viewers mínimos (opcional)';
      case ALERT_TYPES.GIFT_SUB: return 'Inscrições mínimas do lote (opcional)';
      default:                    return 'Quantidade mínima (opcional)';
    }
  }

  async painelAlertas(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const alertas = await TwitchAlertService.listAlerts(guildId);

    const linhas = alertas.length
      ? alertas.map((a) => {
        const limiar = ALERT_AMOUNT_TYPES.includes(a.type) && a.minAmount != null
          ? ` _(mínimo: ${a.minAmount})_`
          : '';
        const ultimo = a.lastTriggeredAt
          ? ` · Último: <t:${Math.floor(new Date(a.lastTriggeredAt).getTime() / 1000)}:R>`
          : '';
        return `${a.active ? '🟢' : '🔴'} **${ALERT_TYPE_LABELS[a.type]}**${limiar} — <#${a.discordChannelId}>${a.roleId ? ` · <@&${a.roleId}>` : ''}\n_Disparos: ${a.usageCount}${ultimo}_`;
      }).join('\n\n')
      : 'Nenhum alerta configurado ainda para este servidor.';

    const criarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Criar Alerta', style: 3, emoji: { name: '➕' } },
      funcao: this._guarded((i) => this._abrirSelectTipoAlerta(i)),
    });

    const componentes = [
      CV2.text('🔔 **Alertas de Eventos da Twitch**'),
      CV2.separator(),
      CV2.text(linhas),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(criarBtn),
    ];

    if (alertas.length) {
      const gerenciarSelect = this.client.interactions.createSelect({
        user,
        feature: FEATURE_ID,
        data: {
          placeholder: 'Selecione um alerta para gerenciar',
          options: alertas.slice(0, 25).map((a) => ({
            label: `${ALERT_TYPE_LABELS[a.type]}${a.active ? '' : ' (inativo)'}`,
            description: `Disparos: ${a.usageCount}`,
            value: String(a._id),
          })),
        },
        funcao: this._guarded((i) => this.painelAlertaDetalhe(i, i.data.values?.[0])),
      });

      componentes.push(CV2.row(gerenciarSelect));
    }

    componentes.push(this.navRow(user, (i) => this.home(i)));

    return this.editOriginal(interaction, [CV2.container(componentes, { accentColor: this.ACCENT })]);
  }

  async _abrirSelectTipoAlerta(interaction) {
    const user = interaction.member.user.id;

    const tipoSelect = this.client.interactions.createSelect({
      user,
      feature: FEATURE_ID,
      data: {
        placeholder: 'Selecione o tipo do alerta',
        options: Object.values(ALERT_TYPES).map((type) => ({
          label: ALERT_TYPE_LABELS[type],
          value: type,
        })),
      },
      funcao: this._guarded((i) => {
        const type = i.data.values?.[0];
        if (!TwitchAlertService.isValidType(type)) return this.painelAlertas(i);
        return this._selecionarCanalAlerta(i, type);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text('🔔 **Criar Alerta — Passo 1 de 3**'),
      CV2.separator(),
      CV2.text('Selecione o tipo de evento que vai disparar este alerta.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(tipoSelect),
      this.navRow(user, (i) => this.painelAlertas(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _selecionarCanalAlerta(interaction, type) {
    const user = interaction.member.user.id;

    const canalSelect = this.client.interactions.createChannelSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o canal onde o alerta será publicado', channel_types: [0, 5] },
      funcao: this._guarded((i) => {
        const channelId = i.data.values?.[0];
        if (!channelId) return this._selecionarCanalAlerta(i, type);
        return this._selecionarCargoAlerta(i, type, channelId);
      }),
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🔔 **Criar Alerta de ${ALERT_TYPE_LABELS[type]} — Passo 2 de 3**`),
      CV2.separator(),
      CV2.text('Selecione o canal do Discord onde este alerta será publicado.'),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(canalSelect),
      this.navRow(user, (i) => this.painelAlertas(i)),
    ], { accentColor: this.ACCENT })]);
  }

    async _selecionarCargoAlerta(interaction, type, channelId) {
    const user = interaction.member.user.id;

    const cargoSelect = this.client.interactions.createRoleSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Selecione o cargo a atribuir (opcional)' },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdminModal(i);
        const roleId = i.data.values?.[0] || null;
        return this._abrirModalCriarAlerta(i, type, channelId, roleId);
      },
    });

    const semCargoBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Sem Cargo', style: 2, emoji: { name: '⏭️' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalCriarAlerta(i, type, channelId, null);
      },
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🔔 **Criar Alerta de ${ALERT_TYPE_LABELS[type]} — Passo 3 de 3**`),
      CV2.separator(),
      CV2.text(
        `Canal selecionado: <#${channelId}>\n\n` +
        'Selecione um cargo do Discord para atribuir a quem disparar este alerta ' +
        '(só é aplicado se a pessoa já tiver vinculado a conta Twitch em Contas Conectadas ' +
        'da Dashboard — nunca bloqueia o envio da mensagem), ou pule esta etapa.',
      ),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(cargoSelect),
      CV2.row(semCargoBtn),
      this.navRow(user, (i) => this.painelAlertas(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalCriarAlerta(interaction, type, channelId, roleId) {
    const user = interaction.member.user.id;

    const components = [
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'mensagem', label: 'Mensagem do alerta (em branco = padrão)', style: 2,
          required: false, max_length: 450,
          placeholder: ALERT_DEFAULT_MESSAGES[type],
        }],
      },
    ];

    if (ALERT_AMOUNT_TYPES.includes(type)) {
      components.push({
        type: 1,
        components: [{
          type: 4, custom_id: 'limiar', label: this._alertAmountLabel(type), style: 1,
          required: false, max_length: 6, placeholder: 'Ex: 100',
        }],
      });
    }

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: `Criar Alerta — ${ALERT_TYPE_LABELS[type]}`,
      components,
      funcao: this._guardedModal((mi, fields) => this._confirmarCriarAlerta(mi, type, channelId, roleId, fields)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _confirmarCriarAlerta(mi, type, channelId, roleId, fields) {
    const user    = mi.member.user.id;
    const guildId = mi.guild_id;

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

    try {
      await TwitchAlertService.createAlert({
        guildId,
        type,
        discordChannelId: channelId,
        roleId,
        message:   fields.mensagem,
        minAmount: ALERT_AMOUNT_TYPES.includes(type) ? fields.limiar : null,
        createdBy: user,
      });
    } catch (err) {
      return responder([this._errorContainer(
        'Não foi possível criar o alerta', err.message, user, (i) => this.painelAlertas(i),
      )]);
    }

    return responder([CV2.container([
      CV2.text('✅ **Alerta criado!**'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelAlertas(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async painelAlertaDetalhe(interaction, alertId) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const alerta = await TwitchAlertService.getAlert(alertId);
    if (!alerta || alerta.guildId !== guildId) {
      return this.painelAlertas(interaction);
    }

    const toggleBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: {
        label: alerta.active ? 'Desativar' : 'Ativar',
        style: alerta.active ? 2 : 3,
        emoji: { name: alerta.active ? '🔕' : '✅' },
      },
      funcao: this._guarded(async (i) => {
        await TwitchAlertService.toggleAlertActive(alertId, guildId);
        return this.painelAlertaDetalhe(i, alertId);
      }),
    });

    const editarBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Editar Mensagem/Limiar', style: 1, emoji: { name: '✏️' } },
      funcao: async (i) => {
        if (!(await this._hasAdminPerm(i))) return this._denyAdmin(i);
        return this._abrirModalEditarAlerta(i, alertId);
      },
    });

    const removerCargoBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Remover Cargo', style: 2, emoji: { name: '🚫' } },
      funcao: this._guarded(async (i) => {
        await TwitchAlertService.updateAlert(alertId, guildId, { roleId: null });
        return this.painelAlertaDetalhe(i, alertId);
      }),
    });

    const removerBtn = this.client.interactions.createButton({
      user,
      feature: FEATURE_ID,
      data: { label: 'Remover Alerta', style: 4, emoji: { name: '🗑️' } },
      funcao: this._guarded(async (i) => {
        await TwitchAlertService.deleteAlert(alertId, guildId);
        return this.painelAlertas(i);
      }),
    });

            const canalSelect = this.client.interactions.createChannelSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Trocar o canal do alerta', channel_types: [0, 5] },
      funcao: this._guarded(async (i) => {
        const channelId = i.data.values?.[0];
        if (!channelId) return this.painelAlertaDetalhe(i, alertId);
        await TwitchAlertService.updateAlert(alertId, guildId, { discordChannelId: channelId });
        return this.painelAlertaDetalhe(i, alertId);
      }),
    });

    const cargoSelect = this.client.interactions.createRoleSelect({
      user,
      feature: FEATURE_ID,
      data: { placeholder: 'Trocar o cargo atribuído' },
      funcao: this._guarded(async (i) => {
        const roleId = i.data.values?.[0] || null;
        await TwitchAlertService.updateAlert(alertId, guildId, { roleId });
        return this.painelAlertaDetalhe(i, alertId);
      }),
    });

    const limiarTexto = ALERT_AMOUNT_TYPES.includes(alerta.type)
      ? `\n**Limiar mínimo:** ${alerta.minAmount != null ? alerta.minAmount : 'Nenhum'}`
      : '';
    const ultimoTexto = alerta.lastTriggeredAt
      ? `<t:${Math.floor(new Date(alerta.lastTriggeredAt).getTime() / 1000)}:R>`
      : 'Nunca disparado';

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🔔 **${ALERT_TYPE_LABELS[alerta.type]}**`),
      CV2.separator(),
      CV2.text(
        `**Status:** ${alerta.active ? '🟢 Ativo' : '🔴 Inativo'}\n` +
        `**Canal:** <#${alerta.discordChannelId}>\n` +
        `**Cargo:** ${alerta.roleId ? `<@&${alerta.roleId}>` : 'Nenhum'}\n` +
        `**Mensagem:** ${alerta.message}${limiarTexto}\n` +
        `**Disparos:** ${alerta.usageCount}\n` +
        `**Último disparo:** ${ultimoTexto}`,
      ),
      CV2.separator(),
      this._betaNotice(),
      CV2.row(canalSelect),
      CV2.row(cargoSelect),
      CV2.row(toggleBtn, editarBtn, removerCargoBtn, removerBtn),
      this.navRow(user, (i) => this.painelAlertas(i)),
    ], { accentColor: this.ACCENT })]);
  }

  async _abrirModalEditarAlerta(interaction, alertId) {
    const user   = interaction.member.user.id;
    const alerta = await TwitchAlertService.getAlert(alertId);
    if (!alerta) return this.painelAlertas(interaction);

    const components = [
      {
        type: 1,
        components: [{
          type: 4, custom_id: 'mensagem', label: 'Mensagem do alerta', style: 2,
          required: true, max_length: 450, value: alerta.message,
        }],
      },
    ];

    if (ALERT_AMOUNT_TYPES.includes(alerta.type)) {
      components.push({
        type: 1,
        components: [{
          type: 4, custom_id: 'limiar', label: this._alertAmountLabel(alerta.type), style: 1,
          required: false, max_length: 6,
          value: alerta.minAmount != null ? String(alerta.minAmount) : undefined,
        }],
      });
    }

    const modal = this.client.interactions.createModal({
      user,
      feature: FEATURE_ID,
      title: `Editar Alerta — ${ALERT_TYPE_LABELS[alerta.type]}`,
      components,
      funcao: this._guardedModal((mi, fields) => this._salvarEdicaoAlerta(mi, alertId, alerta.type, fields)),
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _salvarEdicaoAlerta(mi, alertId, type, fields) {
    const user    = mi.member.user.id;
    const guildId = mi.guild_id;

    const responder = (containers) => this.client.interactions._callback(mi, {
      type: 7,
      data: CV2.payload(containers, { ephemeral: false }),
    });

    try {
      await TwitchAlertService.updateAlert(alertId, guildId, {
        message:   fields.mensagem,
        minAmount: ALERT_AMOUNT_TYPES.includes(type) ? (fields.limiar || null) : undefined,
      });
    } catch (err) {
      return responder([this._errorContainer(
        'Não foi possível salvar o alerta', err.message, user, (i) => this.painelAlertas(i),
      )]);
    }

    return responder([CV2.container([
      CV2.text('✅ **Alerta atualizado!**'),
      CV2.separator(),
      this._betaNotice(),
      this.navRow(user, (i) => this.painelAlertas(i)),
    ], { accentColor: this.ACCENT })]);
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
    ], { accentColor: this.ACCENT })]);
  }
}

module.exports = TwitchConfigSystem;
