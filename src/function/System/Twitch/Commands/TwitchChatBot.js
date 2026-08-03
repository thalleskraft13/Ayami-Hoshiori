'use strict';

const tmi = require('tmi.js');

const TwitchChannelDb  = require('../../../../Mongodb/twitchChannel.js');
const CommandLog       = require('../../../../Mongodb/commandLog.js');
const TwitchCommandService     = require('./TwitchCommandService.js');
const TwitchViewerStatsService = require('../Stats/TwitchViewerStatsService.js');
const TwitchApiService = require('../TwitchApiService.js');
const TwitchAlertService = require('../Alerts/TwitchAlertService.js');
const { TYPES: ALERT_TYPES } = TwitchAlertService;
const CreatorMissionService = require('../../Missions/CreatorMissionService.js');
const { MISSION_TYPES } = CreatorMissionService;
const AccountLinkService = require('../../CreatorAccounts/AccountLinkService.js');

const FEATURE_ID = 'twitch';

const CHANNEL_SYNC_INTERVAL_MS = 2 * 60 * 1000;  // igual ao TwitchMonitorService
const WATCH_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;  // amostragem de "Get Chatters"
const WATCH_SAMPLE_SECONDS     = WATCH_SAMPLE_INTERVAL_MS / 1000;

// Nome usado no CommandLog (mesma coleção `command_logs` que já é usada
// pelas Missões/Dashboard e pelos comandos de barra do Discord) — não
// cria coleção nova, só um valor próprio de `commandName` pra esta
// origem (ver §5/§9 de docs/INTEGRACAO_CRIADORES.md).
const CHAT_LOG_COMMAND = 'twitch_chat_command';

/**
 * Bot de chat dedicado da Ayami na Twitch ("AyamiBot") via IRC clássico
 * (tmi.js). Duas responsabilidades, ambas sobre a MESMA conexão de
 * chat (não cria uma segunda conexão pra cada finalidade):
 *
 *   1. EXECUTAR os Comandos Personalizados (Fase 6) — nunca duplica a
 *      definição de comando, cooldown ou permissão, que vivem
 *      inteiramente em TwitchCommandService.js.
 *   2. ALIMENTAR as Estatísticas por Espectador (Fase 7) — contagem de
 *      mensagens (em tempo real, por mensagem) e tempo assistido
 *      (amostragem periódica via Helix "Get Chatters") — nunca duplica
 *      a lógica de agregação, que vive em TwitchViewerStatsService.js.
 *   3. DISPARAR os Alertas de Eventos (Subscribe/Resub/GiftSub/Bits/
 *      Raid) — nos eventos nativos do tmi.js, na mesma conexão IRC.
 *      Nunca duplica a lógica de disparo/limiar/renderização, que vive
 *      inteiramente em Alerts/TwitchAlertService.js#triggerAlert. Follow
 *      não entra aqui (não é um evento IRC) — ver polling da Helix numa
 *      etapa futura.
 *
 * Credenciais (variáveis de ambiente, únicas pra toda a aplicação —
 * não por servidor):
 *   TWITCH_BOT_USERNAME     — login da conta dedicada da Ayami na Twitch
 *   TWITCH_BOT_OAUTH_TOKEN  — token de acesso da MESMA conta, escopos
 *                              chat:read + chat:edit + moderator:read:chatters
 *                              (aceita com ou sem o prefixo "oauth:")
 *
 * Pra que a AyamiBot consiga falar em modo lento/só-inscritos/só-mod de
 * um canal E pra que a leitura de "Get Chatters" funcione (Fase 7), o
 * streamer precisa dar cargo de Moderador pra conta configurada acima
 * dentro do próprio chat da Twitch — isso é feito na Twitch, não tem
 * configuração equivalente aqui.
 */
class TwitchChatBot {

  constructor(client) {
    this.client = client;    // client do Discord (pra logs/erros consistentes com o resto do bot)
    this.irc    = null;
    this._channelTimer = null;
    this._watchTimer   = null;
    this._joinedLogins = new Set();
    this._botUserId    = null; // ID oficial da própria AyamiBot na Twitch (moderator_id do Get Chatters)
  }

  _credentialsPresent() {
    return !!(process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_BOT_OAUTH_TOKEN);
  }

  _userToken() {
    return process.env.TWITCH_BOT_OAUTH_TOKEN.replace(/^oauth:/, '');
  }

  async boot() {
    if (!this._credentialsPresent()) {
      console.warn('[TwitchChatBot] TWITCH_BOT_USERNAME/TWITCH_BOT_OAUTH_TOKEN não configurados — Comandos de chat e Estatísticas por Espectador da Twitch desativados.');
      return;
    }

    const password = process.env.TWITCH_BOT_OAUTH_TOKEN.startsWith('oauth:')
      ? process.env.TWITCH_BOT_OAUTH_TOKEN
      : `oauth:${process.env.TWITCH_BOT_OAUTH_TOKEN}`;

    this.irc = new tmi.Client({
      options: { debug: false },
      connection: { reconnect: true, secure: true },
      identity: {
        username: process.env.TWITCH_BOT_USERNAME,
        password,
      },
      channels: [],
    });

    this.irc.on('message', (channel, tags, message, self) => {
      if (self) return;
      this._handleMessage(channel, tags, message).catch((err) =>
        console.error('[TwitchChatBot] Erro ao processar mensagem de chat:', err.message));
    });

    // Alertas de Eventos (Fase Alertas — disparo real) — MESMA conexão
    // IRC já aberta acima, nenhuma conexão nova é criada. Cada handler
    // resolve o `doc` do canal (mesmo padrão de `_handleMessage`) e
    // delega inteiramente a `TwitchAlertService.triggerAlert`, que já é
    // defensivo (nunca lança). O `.catch` aqui é só uma segunda camada
    // de proteção pra garantir que uma falha de Alertas nunca derrube a
    // conexão de chat usada por Comandos/Estatísticas.
    this.irc.on('subscription', (channel, username, method, message, userstate) => {
      this._handleSubscription(channel, username, method, userstate).catch((err) =>
        console.error('[TwitchChatBot] Erro ao processar subscription (Alertas):', err.message));
    });

    this.irc.on('resub', (channel, username, months, message, userstate, methods) => {
      this._handleResub(channel, username, months, userstate, methods).catch((err) =>
        console.error('[TwitchChatBot] Erro ao processar resub (Alertas):', err.message));
    });

    this.irc.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
      this._handleSubGift(channel, username, methods, userstate).catch((err) =>
        console.error('[TwitchChatBot] Erro ao processar subgift (Alertas):', err.message));
    });

    this.irc.on('submysterygift', (channel, username, numbOfSubs, methods, userstate) => {
      this._handleMysteryGift(channel, username, numbOfSubs, methods, userstate).catch((err) =>
        console.error('[TwitchChatBot] Erro ao processar submysterygift (Alertas):', err.message));
    });

    this.irc.on('cheer', (channel, userstate, message) => {
      this._handleCheer(channel, userstate).catch((err) =>
        console.error('[TwitchChatBot] Erro ao processar cheer (Alertas):', err.message));
    });

    this.irc.on('raided', (channel, username, viewers) => {
      this._handleRaid(channel, username, viewers).catch((err) =>
        console.error('[TwitchChatBot] Erro ao processar raided (Alertas):', err.message));
    });

    this.irc.on('disconnected', (reason) =>
      console.warn(`[TwitchChatBot] Desconectado do chat da Twitch: ${reason}`));

    await this.irc.connect().catch((err) =>
      console.error('[TwitchChatBot] Falha ao conectar no chat da Twitch:', err.message));

    // ID oficial da própria AyamiBot — necessário como `moderator_id`
    // do endpoint "Get Chatters" (Fase 7). Resolvido uma vez no boot.
    try {
      const botUser = await TwitchApiService.getUserByLogin(process.env.TWITCH_BOT_USERNAME);
      this._botUserId = botUser?.id || null;
      if (!this._botUserId) {
        console.warn('[TwitchChatBot] Não foi possível resolver o ID da AyamiBot na Twitch — tempo assistido (Fase 7) ficará desativado.');
      }
    } catch (err) {
      console.error('[TwitchChatBot] Falha ao resolver o ID da AyamiBot na Twitch:', err.message);
    }

    this._channelTimer = setInterval(() => {
      this._syncChannels().catch((err) =>
        console.error('[TwitchChatBot] Erro ao sincronizar canais:', err.message));
    }, CHANNEL_SYNC_INTERVAL_MS);
    if (this._channelTimer.unref) this._channelTimer.unref();

    if (this._botUserId) {
      this._watchTimer = setInterval(() => {
        this._sampleWatchTime().catch((err) =>
          console.error('[TwitchChatBot] Erro na amostragem de tempo assistido:', err.message));
      }, WATCH_SAMPLE_INTERVAL_MS);
      if (this._watchTimer.unref) this._watchTimer.unref();
    }

    await this._syncChannels();
  }

  stop() {
    if (this._channelTimer) clearInterval(this._channelTimer);
    if (this._watchTimer) clearInterval(this._watchTimer);
    this._channelTimer = null;
    this._watchTimer   = null;
    if (this.irc) this.irc.disconnect().catch(() => {});
  }

  /**
   * Entra em TODOS os canais conectados e com o módulo habilitado —
   * necessário tanto pros Comandos (Fase 6, só dispara se o servidor
   * tiver comando ativo) quanto pras Estatísticas por Espectador
   * (Fase 7, precisa contar mensagens em qualquer canal conectado,
   * mesmo sem nenhum comando configurado).
   */
  async _syncChannels() {
    const canais = await TwitchChannelDb.find({
      moduleEnabled: true,
      twitchLogin: { $ne: null },
    }).lean();

    const desejados = new Set(canais.map((c) => c.twitchLogin.toLowerCase()));

    for (const login of desejados) {
      if (!this._joinedLogins.has(login)) {
        await this.irc.join(login).catch((err) =>
          console.error(`[TwitchChatBot] Falha ao entrar no canal #${login}:`, err.message));
        this._joinedLogins.add(login);
      }
    }

    for (const login of this._joinedLogins) {
      if (!desejados.has(login)) {
        await this.irc.part(login).catch(() => {});
        this._joinedLogins.delete(login);
      }
    }
  }

  /**
   * A cada WATCH_SAMPLE_INTERVAL_MS, consulta "Get Chatters" pra cada
   * canal AO VIVO conectado e credita WATCH_SAMPLE_SECONDS de tempo
   * assistido pra cada espectador presente (Fase 7). Canais offline
   * são pulados (sem stream, não há "tempo assistido" pra creditar).
   */
  async _sampleWatchTime() {
    const canaisAoVivo = await TwitchChannelDb.find({
      moduleEnabled: true,
      twitchLogin: { $ne: null },
      'state.isLive': true,
    }).lean();

    for (const canal of canaisAoVivo) {
      try {
        const chatters = await TwitchApiService.getChattersWithUserToken(
          canal.twitchId, this._botUserId, this._userToken(),
        );

        for (const chatter of chatters) {
          if (chatter.user_login === process.env.TWITCH_BOT_USERNAME?.toLowerCase()) continue; // ignora a própria AyamiBot

          await TwitchViewerStatsService.recordWatchSample(
            canal.guildId,
            { id: chatter.user_id, login: chatter.user_login, displayName: chatter.user_name },
            canal.state.streamId,
            WATCH_SAMPLE_SECONDS,
          );
        }
      } catch (err) {
        // Falha isolada por canal (ex.: AyamiBot ainda não é moderadora
        // desse canal) não pode interromper a amostragem dos demais.
        console.error(`[TwitchChatBot] Falha ao amostrar chatters de #${canal.twitchLogin}:`, err.message);
      }
    }
  }

  async _handleMessage(channel, tags, message) {
    const login = channel.replace(/^#/, '').toLowerCase();

    const doc = await TwitchChannelDb.findOne({ twitchLogin: login, moduleEnabled: true }).lean();
    if (!doc) return;

    // Estatísticas por Espectador (Fase 7) — conta TODA mensagem, tenha
    // ela disparado um comando ou não. Nunca bloqueia a resposta do
    // comando abaixo se falhar.
    TwitchViewerStatsService.recordMessage(doc.guildId, {
      id: tags['user-id'],
      login: tags.username,
      displayName: tags['display-name'] || tags.username,
    }).catch((err) => console.error('[TwitchChatBot] Falha ao registrar mensagem para Estatísticas:', err.message));

    // Missões do tipo "Quantidade de Mensagens" — credita 1 de progresso
    // por mensagem enviada no chat, pra quem tiver a conta Twitch
    // vinculada ao Discord. Nunca bloqueia o restante do fluxo (comandos)
    // se a conta não estiver vinculada ou se a missão já estiver completa.
    this._registerMessageCountProgress(doc.guildId, tags['user-id']).catch((err) =>
      console.error('[TwitchChatBot] Falha ao registrar progresso de missão (mensagens):', err.message));

    const command = await TwitchCommandService.resolveCommand(doc.guildId, message);
    if (!command) return;

    const badges = {
      broadcaster: tags.badges?.broadcaster === '1',
      moderator:   tags.mod === true || tags.badges?.moderator === '1',
      vip:         !!tags.badges?.vip,
      subscriber:  !!tags.subscriber,
    };

    if (!TwitchCommandService.canUseCommand(command, badges)) return;
    if (TwitchCommandService.isOnCooldown(command)) return;

    const texto = TwitchCommandService.renderResponse(command.response, {
      userDisplayName: tags['display-name'] || tags.username,
      userLogin: tags.username,
      channelDisplayName: doc.displayName,
      channelLogin: doc.twitchLogin,
      game: doc.state?.category,
      title: doc.state?.title,
      startedAt: doc.state?.isLive ? doc.state?.startedAt : null,
      usageCount: command.usageCount,
    });

    await this.irc.say(channel, texto).catch((err) => {
      console.error(`[TwitchChatBot] Falha ao responder no chat de #${login}:`, err.message);
      throw err;
    });

    await TwitchCommandService.registerUsage(command._id, tags.username);

    // Log best-effort — nunca bloqueia a resposta do comando. Reaproveita
    // a MESMA coleção `command_logs` já usada pelo resto da Ayami (ver
    // twitchChannelDashboardService.js#logDashboardAction); como o
    // schema exige `userId`, usamos o dono da conexão (connectedBy) já
    // que a execução acontece no chat da Twitch, não no Discord.
    CommandLog.create({
      commandName: CHAT_LOG_COMMAND,
      subcommandName: command.trigger,
      options: { twitchLogin: login, viewerLogin: tags.username },
      guildId: doc.guildId,
      guildName: null,
      userId: doc.connectedBy,
      username: doc.displayName || doc.twitchLogin,
    }).catch((err) => console.error('[TwitchChatBot] Falha ao registrar log de comando:', err.message));
  }

  /**
   * Credita 1 de progresso em toda missão ativa do tipo "Quantidade de
   * Mensagens" (MISSION_TYPES.MESSAGE_COUNT) deste servidor, pro
   * espectador que enviou a mensagem — só se a conta Twitch dele
   * estiver vinculada a um Discord ID (CreatorMissionService já exige
   * isso internamente, mas resolvemos aqui pra não chamar
   * registerProgress sem necessidade quando não há vínculo).
   */
  async _registerMessageCountProgress(guildId, twitchUserId) {
    if (!twitchUserId) return;

    const discordUserId = await AccountLinkService.resolveDiscordUserId(FEATURE_ID, twitchUserId);
    if (!discordUserId) return;

    const missoes = await CreatorMissionService.listActiveMissions(guildId, FEATURE_ID);
    const missoesDeMensagem = missoes.filter((m) => m.type === MISSION_TYPES.MESSAGE_COUNT);
    if (!missoesDeMensagem.length) return;

    for (const missao of missoesDeMensagem) {
      const progresso = await CreatorMissionService.registerProgress(discordUserId, missao._id, 1).catch((err) => {
        // NoLinkedAccountError/MissionNotFoundError não deveriam ocorrer
        // aqui (já filtramos acima), mas nunca deixamos uma missão com
        // problema derrubar o progresso das demais.
        console.error(`[TwitchChatBot] Falha ao registrar progresso da missão ${missao._id}:`, err.message);
        return null;
      });

      // registerProgress só ATUALIZA o progresso — a recompensa (cargo,
      // etc.) só é efetivamente entregue por registerReward. Sem esta
      // chamada, a missão fica "completed" no banco mas o cargo nunca
      // é atribuído no Discord.
      if (progresso?.status === 'completed') {
        await CreatorMissionService.registerReward(discordUserId, missao._id).catch((err) => {
          console.error(`[TwitchChatBot] Falha ao registrar recompensa da missão ${missao._id}:`, err.message);
        });
      }
    }
  }

  /* ─────────────────────────────────────────────
     Alertas de Eventos — handlers (ver registro dos listeners no
     boot()). Todos seguem o mesmo formato: resolver `doc` do canal
     (mesmo padrão de `_handleMessage`) e delegar a
     `TwitchAlertService.triggerAlert`, que já filtra por alertas
     ativos/limiar e nunca lança erro.
     ───────────────────────────────────────────── */

  async _findChannelDoc(channel) {
    const login = channel.replace(/^#/, '').toLowerCase();
    return TwitchChannelDb.findOne({ twitchLogin: login, moduleEnabled: true }).lean();
  }

  /** Converte o `method`/`methods` do tmi.js (plano da inscrição) no valor de {tier}. */
  _tierLabel(method = {}) {
    if (!method) return null;
    if (method.prime) return 'Prime';
    switch (method.plan) {
      case '1000': return '1';
      case '2000': return '2';
      case '3000': return '3';
      default:     return method.plan || null;
    }
  }

  async _handleSubscription(channel, username, method, userstate) {
    const doc = await this._findChannelDoc(channel);
    if (!doc) return;

    await TwitchAlertService.triggerAlert(doc.guildId, ALERT_TYPES.SUBSCRIBE, {
      platformUserId:     userstate['user-id'],
      userLogin:          username,
      userDisplayName:    userstate['display-name'] || username,
      channelLogin:       doc.twitchLogin,
      channelDisplayName: doc.displayName,
      tier:               this._tierLabel(method),
    });
  }

  async _handleResub(channel, username, months, userstate, methods) {
    const doc = await this._findChannelDoc(channel);
    if (!doc) return;

    // `msg-param-cumulative-months` (tag do IRC) é a contagem total real
    // de meses acumulados; `months` (argumento do tmi.js) é só um
    // fallback caso a tag não venha por algum motivo.
    const totalMonths = Number(userstate['msg-param-cumulative-months']) || Number(months) || 0;

    await TwitchAlertService.triggerAlert(doc.guildId, ALERT_TYPES.RESUB, {
      platformUserId:     userstate['user-id'],
      userLogin:          username,
      userDisplayName:    userstate['display-name'] || username,
      channelLogin:       doc.twitchLogin,
      channelDisplayName: doc.displayName,
      months:             totalMonths,
      tier:               this._tierLabel(methods),
    });
  }

  /**
   * Gift sub individual. Quando faz parte de um "Mystery Gift" (lote),
   * a tag `msg-param-community-gift-id` vem preenchida — nesse caso o
   * disparo já é feito uma única vez em `_handleMysteryGift` (com
   * `count` = total do lote), então este handler não dispara de novo
   * pra cada presente individual do mesmo lote (evitaria contar 1 + N).
   * Só dispara aqui um gift sub AVULSO (fora de um mystery gift), com
   * `count: 1`.
   */
  async _handleSubGift(channel, username, methods, userstate) {
    if (userstate['msg-param-community-gift-id']) return;

    const doc = await this._findChannelDoc(channel);
    if (!doc) return;

    await TwitchAlertService.triggerAlert(doc.guildId, ALERT_TYPES.GIFT_SUB, {
      platformUserId:     userstate['user-id'],
      userLogin:          username,
      userDisplayName:    userstate['display-name'] || username,
      channelLogin:       doc.twitchLogin,
      channelDisplayName: doc.displayName,
      tier:               this._tierLabel(methods),
      count:              1,
    });
  }

  /** Lote de gift subs ("Mystery Gift") — um único disparo com `count` = total do lote. */
  async _handleMysteryGift(channel, username, numbOfSubs, methods, userstate) {
    const doc = await this._findChannelDoc(channel);
    if (!doc) return;

    await TwitchAlertService.triggerAlert(doc.guildId, ALERT_TYPES.GIFT_SUB, {
      platformUserId:     userstate['user-id'],
      userLogin:          username,
      userDisplayName:    userstate['display-name'] || username,
      channelLogin:       doc.twitchLogin,
      channelDisplayName: doc.displayName,
      tier:               this._tierLabel(methods),
      count:              Number(numbOfSubs) || 0,
    });
  }

  async _handleCheer(channel, userstate) {
    const doc = await this._findChannelDoc(channel);
    if (!doc) return;

    await TwitchAlertService.triggerAlert(doc.guildId, ALERT_TYPES.BITS, {
      platformUserId:     userstate['user-id'],
      userLogin:          userstate.username,
      userDisplayName:    userstate['display-name'] || userstate.username,
      channelLogin:       doc.twitchLogin,
      channelDisplayName: doc.displayName,
      bits:               Number(userstate.bits) || 0,
    });
  }

  /**
   * O evento `raided` do tmi.js só traz o login de quem raidou (sem
   * `user-id`) — pra atribuir cargo (que depende de `platformUserId`
   * pra resolver o vínculo Discord) é preciso resolver o usuário via
   * Helix (`TwitchApiService.getUserByLogin`). Só faz essa chamada
   * extra se houver ao menos um alerta ATIVO do tipo Raid pra este
   * servidor — evita gastar chamada de API em raids de servidores sem
   * esse alerta configurado.
   */
  async _handleRaid(channel, username, viewers) {
    const doc = await this._findChannelDoc(channel);
    if (!doc) return;

    const activeAlerts = await TwitchAlertService.listActiveAlertsByType(doc.guildId, ALERT_TYPES.RAID);
    if (!activeAlerts.length) return;

    let platformUserId = null;
    let displayName = username;
    try {
      const raiderUser = await TwitchApiService.getUserByLogin(username);
      if (raiderUser) {
        platformUserId = raiderUser.id;
        displayName = raiderUser.display_name || username;
      }
    } catch (err) {
      console.error(`[TwitchChatBot] Falha ao resolver usuário da raid em #${doc.twitchLogin}:`, err.message);
    }

    await TwitchAlertService.triggerAlert(doc.guildId, ALERT_TYPES.RAID, {
      platformUserId,
      userLogin:          username,
      userDisplayName:    displayName,
      channelLogin:       doc.twitchLogin,
      channelDisplayName: doc.displayName,
      viewers:            Number(viewers) || 0,
    });
  }
}

module.exports = TwitchChatBot;
