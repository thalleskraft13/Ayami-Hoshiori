'use strict';

const TwitchChannelDb = require('../../../Mongodb/twitchChannel.js');
const TwitchHistoryDb = require('../../../Mongodb/twitchHistory.js');
const TwitchApi       = require('./TwitchApiService.js');
const DiscordRequest  = require('../../DiscordRequest.js');
const CV2             = require('../../Messages/CV2.js');

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos — respeita o rate limit da Helix

const ACCENT_LIVE    = 0x9146FF;
const ACCENT_OFFLINE = 0x2F3136;

const DEFAULT_LIVE_MESSAGE    = '🔴 **{streamer}** está ao vivo agora!';
const DEFAULT_OFFLINE_MESSAGE = '⏹️ **{streamer}** encerrou a transmissão.';

class TwitchMonitorService {

  constructor(client) {
    this.client   = client;
    this._timer   = null;
    this._running = false;
  }

  async boot() {
    this.stop();

    this._timer = setInterval(() => {
      this.checkAll().catch((err) =>
        console.error('[TwitchMonitorService] Erro no ciclo de verificação:', err.message));
    }, CHECK_INTERVAL_MS);

    if (this._timer.unref) this._timer.unref();

    console.log(`[TwitchMonitorService] Monitoramento iniciado (intervalo: ${CHECK_INTERVAL_MS / 1000}s).`);

    await this.checkAll().catch((err) =>
      console.error('[TwitchMonitorService] Erro na verificação inicial:', err.message));
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async checkAll() {
    if (this._running) return;
    this._running = true;

    try {
      const channels = await TwitchChannelDb.find({
        moduleEnabled: true,
        twitchId: { $ne: null },
      }).lean();

      if (!channels.length) return;

      const userIds = channels.map((c) => c.twitchId);
      const streams = await TwitchApi.getStreamsByUserIds(userIds).catch((err) => {
        console.error('[TwitchMonitorService] Falha ao consultar streams na Twitch:', err.message);
        return null;
      });

      if (!streams) return;

      const streamByUserId = new Map(streams.map((s) => [s.user_id, s]));

      for (const doc of channels) {
        await this._processChannel(doc, streamByUserId.get(doc.twitchId) ?? null)
          .catch((err) => console.error(`[TwitchMonitorService] Erro ao processar guild ${doc.guildId}:`, err.message));
      }
    } finally {
      this._running = false;
    }
  }

  async checkOne(guildId) {
    const doc = await TwitchChannelDb.findOne({ guildId }).lean();
    if (!doc?.twitchId || !doc.moduleEnabled) return;

    const stream = await TwitchApi.getStreamByUserId(doc.twitchId).catch(() => null);
    await this._processChannel(doc, stream);
  }

  async _processChannel(doc, stream) {
    const wasLive = !!doc.state?.isLive;
    const isLive  = !!stream;

    // impede anúncios duplicados: só dispara início se não estava ao vivo
    // ou se a stream mudou (ex.: bot ficou offline entre uma live e outra)
    if (isLive && (!wasLive || doc.state?.streamId !== stream.id)) {
      return this._handleLiveStart(doc, stream);
    }

    if (!isLive && wasLive) {
      return this._handleLiveEnd(doc);
    }
  }

  async _handleLiveStart(doc, stream) {
    const startedAt = new Date(stream.started_at);

    const history = await TwitchHistoryDb.create({
      guildId:  doc.guildId,
      twitchId: doc.twitchId,
      streamId: stream.id,
      title:    stream.title ?? '',
      category: stream.game_name ?? '',
      startedAt,
    });

    await TwitchChannelDb.updateOne({ guildId: doc.guildId }, {
      $set: {
        'state.isLive':           true,
        'state.streamId':         stream.id,
        'state.startedAt':        startedAt,
        'state.title':            stream.title ?? '',
        'state.category':         stream.game_name ?? '',
        'state.lastCheckedAt':    new Date(),
        'state.currentHistoryId': history._id,
      },
    });

    if (doc.announce?.enabled && doc.announce?.channelId) {
      await this._sendAnnounce(doc, stream, 'live').catch((err) =>
        console.error(`[TwitchMonitorService] Falha ao anunciar início (guild ${doc.guildId}):`, err.message));
    }
  }

  async _handleLiveEnd(doc) {
    const endedAt   = new Date();
    const startedAt = doc.state?.startedAt ? new Date(doc.state.startedAt) : endedAt;
    const durationSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));

    if (doc.state?.currentHistoryId) {
      await TwitchHistoryDb.updateOne(
        { _id: doc.state.currentHistoryId },
        { $set: { endedAt, durationSeconds } },
      ).catch(() => {});
    }

    await TwitchChannelDb.updateOne({ guildId: doc.guildId }, {
      $set: {
        'state.isLive':           false,
        'state.streamId':         null,
        'state.startedAt':        null,
        'state.lastCheckedAt':    new Date(),
        'state.currentHistoryId': null,
      },
    });

    if (doc.announce?.enabled && doc.announce?.offlineEnabled && doc.announce?.channelId) {
      await this._sendAnnounce(doc, null, 'offline').catch((err) =>
        console.error(`[TwitchMonitorService] Falha ao anunciar encerramento (guild ${doc.guildId}):`, err.message));
    }
  }

  _fillPlaceholders(template, doc, stream) {
    const link = `https://twitch.tv/${doc.twitchLogin}`;

    return String(template)
      .replaceAll('{streamer}', doc.displayName || doc.twitchLogin || '')
      .replaceAll('{titulo}',    stream?.title     ?? '')
      .replaceAll('{categoria}', stream?.game_name ?? '')
      .replaceAll('{link}',      link);
  }

  async _sendAnnounce(doc, stream, kind) {
    const link    = `https://twitch.tv/${doc.twitchLogin}`;
    const mention = doc.announce?.roleId ? `<@&${doc.announce.roleId}> ` : '';

    let container;

    if (kind === 'live') {
      const template = doc.announce.liveMessage || DEFAULT_LIVE_MESSAGE;
      const texto     = this._fillPlaceholders(template, doc, stream);
      const thumbUrl  = (stream.thumbnail_url || '')
        .replace('{width}', '640')
        .replace('{height}', '360');

      const children = [
        CV2.text(`${mention}${texto}`.trim()),
        CV2.separator(),
        CV2.text(
          `**Título:** ${stream.title || '—'}\n` +
          `**Categoria:** ${stream.game_name || '—'}\n` +
          `**Link:** ${link}`,
        ),
      ];

      if (thumbUrl) {
        children.push(CV2.mediaGallery([{ url: thumbUrl, description: stream.title || doc.displayName }]));
      }

      container = CV2.container(children, { accentColor: ACCENT_LIVE });
    } else {
      const template = doc.announce.offlineMessage || DEFAULT_OFFLINE_MESSAGE;
      const texto     = this._fillPlaceholders(template, doc, null);

      container = CV2.container([CV2.text(texto)], { accentColor: ACCENT_OFFLINE });
    }

    const allowedMentions = doc.announce?.roleId
      ? { parse: [], roles: [doc.announce.roleId] }
      : { parse: [] };

    await DiscordRequest(`/channels/${doc.announce.channelId}/messages`, {
      method: 'POST',
      body: {
        flags:            CV2.IS_COMPONENTS_V2,
        components:       [container],
        allowed_mentions: allowedMentions,
      },
    });
  }
}

module.exports = TwitchMonitorService;
