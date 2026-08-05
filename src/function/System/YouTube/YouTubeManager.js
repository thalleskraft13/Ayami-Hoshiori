'use strict';

const YoutubeChannelDb = require('../../../Mongodb/youtubeChannel.js');
const YoutubeHistoryDb = require('../../../Mongodb/youtubeHistory.js');
const YouTubeApi       = require('./YouTubeApiService.js');
const DiscordRequest   = require('../../DiscordRequest.js');
const CV2              = require('../../Messages/CV2.js');

const CHECK_INTERVAL_MS      = 5 * 60 * 1000; 
const RECENT_UPLOADS_LIMIT   = 5;
const KNOWN_IDS_CACHE_LIMIT  = 30;
const SHORTS_MAX_SECONDS     = 180; 

const ACCENT = {
  video: 0xFF0000,
  short: 0xFF0000,
  live:  0xCC0000,
};

const DEFAULT_MESSAGES = {
  video: '🎬 **{canal}** publicou um novo vídeo!',
  short: '📱 **{canal}** publicou um novo Short!',
  live:  '🔴 **{canal}** está ao vivo agora!',
};

const ROTULOS = {
  video: '🎬 Novo vídeo',
  short: '📱 Novo Short',
  live:  '🔴 Nova live',
};

function parseISO8601Duration(iso) {
  if (!iso) return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;

  const h  = parseInt(m[1] || '0', 10);
  const mi = parseInt(m[2] || '0', 10);
  const s  = parseInt(m[3] || '0', 10);

  return (h * 3600) + (mi * 60) + s;
}

class YouTubeManager {

  constructor(client) {
    this.client   = client;
    this._timer   = null;
    this._running = false;
  }

  async boot() {
    this.stop();

    this._timer = setInterval(() => {
      this.checkAll().catch((err) =>
        console.error('[YouTubeManager] Erro no ciclo de verificação:', err.message));
    }, CHECK_INTERVAL_MS);

    if (this._timer.unref) this._timer.unref();

    console.log(`[YouTubeManager] Monitoramento iniciado (intervalo: ${CHECK_INTERVAL_MS / 1000}s).`);

    await this.checkAll().catch((err) =>
      console.error('[YouTubeManager] Erro na verificação inicial:', err.message));
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
      const channels = await YoutubeChannelDb.find({
        moduleEnabled: true,
        youtubeChannelId: { $ne: null },
      }).lean();

      for (const doc of channels) {
        await this._checkChannel(doc).catch((err) =>
          console.error(`[YouTubeManager] Erro ao processar guild ${doc.guildId}:`, err.message));
      }
    } finally {
      this._running = false;
    }
  }

  async checkOne(guildId) {
    const doc = await YoutubeChannelDb.findOne({ guildId }).lean();
    if (!doc?.youtubeChannelId || !doc.moduleEnabled) return;

    await this._checkChannel(doc);
  }

  async _checkChannel(doc) {
    if (!doc.uploadsPlaylistId) return;

    const uploads = await YouTubeApi.getRecentUploads(doc.uploadsPlaylistId, RECENT_UPLOADS_LIMIT);

    const known = new Set(doc.state?.knownVideoIds ?? []);
    const novos = uploads.filter((u) => !known.has(u.videoId));

    if (!novos.length) {
      await YoutubeChannelDb.updateOne({ guildId: doc.guildId }, {
        $set: { 'state.lastCheckedAt': new Date() },
      });
      return;
    }

    const detalhes    = await YouTubeApi.getVideosDetails(novos.map((n) => n.videoId)).catch((err) => {
      console.error(`[YouTubeManager] Falha ao obter detalhes dos vídeos (guild ${doc.guildId}):`, err.message);
      return [];
    });
    const detailsById  = new Map(detalhes.map((d) => [d.id, d]));

    
    const ordenados = [...novos].reverse();

    let lastLiveVideoId = doc.state?.lastLiveVideoId ?? null;
    let isLiveAtual      = false;

    for (const item of ordenados) {
      const detail = detailsById.get(item.videoId);
      if (!detail) continue;

      const tipo = this._classify(detail);

      if (tipo === 'live') {
        if (lastLiveVideoId === detail.id) continue; 
        lastLiveVideoId = detail.id;
        isLiveAtual = detail.liveBroadcastContent === 'live';
      }

      await this._registrarHistorico(doc, detail, tipo);
      await this._anunciar(doc, detail, tipo).catch((err) =>
        console.error(`[YouTubeManager] Falha ao anunciar (guild ${doc.guildId}):`, err.message));
    }

    const knownVideoIds = [...known, ...novos.map((n) => n.videoId)].slice(-KNOWN_IDS_CACHE_LIMIT);

    await YoutubeChannelDb.updateOne({ guildId: doc.guildId }, {
      $set: {
        'state.knownVideoIds':   knownVideoIds,
        'state.lastLiveVideoId': lastLiveVideoId,
        'state.isLive':          isLiveAtual,
        'state.lastCheckedAt':   new Date(),
      },
    });
  }

  _classify(detail) {
    if (detail.liveBroadcastContent === 'live' || detail.liveBroadcastContent === 'upcoming') {
      return 'live';
    }

    const seconds = parseISO8601Duration(detail.duration);
    if (seconds > 0 && seconds <= SHORTS_MAX_SECONDS) return 'short';

    return 'video';
  }

  async _registrarHistorico(doc, detail, tipo) {
    await YoutubeHistoryDb.updateOne(
      { guildId: doc.guildId, videoId: detail.id },
      {
        $setOnInsert: {
          guildId:          doc.guildId,
          youtubeChannelId: doc.youtubeChannelId,
          videoId:          detail.id,
          type:             tipo,
          title:            detail.title,
          link:             `https://youtu.be/${detail.id}`,
          publishedAt:      detail.publishedAt ? new Date(detail.publishedAt) : new Date(),
        },
      },
      { upsert: true },
    ).catch(() => {});
  }

  _tipoHabilitado(doc, tipo) {
    const a = doc.announce ?? {};
    if (tipo === 'video') return a.videosEnabled !== false;
    if (tipo === 'short') return a.shortsEnabled !== false;
    if (tipo === 'live')  return a.livesEnabled  !== false;
    return false;
  }

  _fillPlaceholders(template, doc, detail) {
    const link = `https://youtu.be/${detail.id}`;
    const data = detail.publishedAt
      ? new Date(detail.publishedAt).toLocaleDateString('pt-BR')
      : '';

    return String(template)
      .replaceAll('{canal}',  doc.title || doc.handle || '')
      .replaceAll('{titulo}', detail.title ?? '')
      .replaceAll('{link}',   link)
      .replaceAll('{data}',   data);
  }

  async _anunciar(doc, detail, tipo) {
    if (!doc.announce?.channelId) return;
    if (!this._tipoHabilitado(doc, tipo)) return;

    const mention = doc.announce?.roleId ? `<@&${doc.announce.roleId}> ` : '';
    const link    = `https://youtu.be/${detail.id}`;

    const campoMsg = tipo === 'video' ? 'videoMessage' : tipo === 'short' ? 'shortMessage' : 'liveMessage';
    const template = doc.announce?.[campoMsg] || DEFAULT_MESSAGES[tipo];
    const texto    = this._fillPlaceholders(template, doc, detail);

    const children = [
      CV2.text(`${mention}${texto}`.trim()),
      CV2.separator(),
      CV2.text(`**${ROTULOS[tipo]}:** ${detail.title || '—'}\n**Link:** ${link}`),
    ];

    if (detail.thumbnailUrl) {
      children.push(CV2.mediaGallery([{ url: detail.thumbnailUrl, description: detail.title }]));
    }

    const container = CV2.container(children, { accentColor: ACCENT[tipo] });

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

module.exports = YouTubeManager;
