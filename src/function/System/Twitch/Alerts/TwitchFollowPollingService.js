'use strict';

const TwitchChannelDb    = require('../../../../Mongodb/twitchChannel.js');
const TwitchAlertService = require('./TwitchAlertService.js');
const { TYPES }          = TwitchAlertService;
const AccountLinkService = require('../../CreatorAccounts/AccountLinkService.js');
const TwitchApiService   = require('../TwitchApiService.js');

const POLL_INTERVAL_MS       = 3 * 60 * 1000; 
const TOKEN_SAFETY_MARGIN_MS = 60_000;        
const MAX_PAGES_PER_CHANNEL  = 5;             

class TwitchFollowPollingService {

  constructor(client) {
    this.client   = client; 
    this._timer   = null;
    this._running = false;
  }

  boot() {
    this.stop();

    this._timer = setInterval(() => {
      this.pollAll().catch((err) =>
        console.error('[TwitchFollowPollingService] Erro no ciclo de polling:', err.message));
    }, POLL_INTERVAL_MS);
    if (this._timer.unref) this._timer.unref();

    console.log(`[TwitchFollowPollingService] Polling de Follow iniciado (intervalo: ${POLL_INTERVAL_MS / 1000}s).`);

    return this.pollAll().catch((err) =>
      console.error('[TwitchFollowPollingService] Erro na verificação inicial:', err.message));
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async pollAll() {
    if (this._running) return;
    this._running = true;

    try {
      
      
      
      const guildIds = await TwitchAlertService.listGuildIdsWithActiveAlerts(TYPES.FOLLOW);
      if (!guildIds.length) return;

      const channels = await TwitchChannelDb.find({
        guildId:      { $in: guildIds },
        moduleEnabled: true,
        twitchId:      { $ne: null },
        connectedBy:   { $ne: null }, 
      }).lean();

      for (const doc of channels) {
        await this._pollChannel(doc).catch((err) =>
          console.error(`[TwitchFollowPollingService] Erro ao verificar seguidores (guild ${doc.guildId}):`, err.message));
      }
    } finally {
      this._running = false;
    }
  }

  async _pollChannel(doc) {
    const link = await AccountLinkService.getLink(doc.connectedBy, 'twitch');
    if (!link || link.status !== 'connected' || !link.oauth?.accessToken || !link.oauth?.refreshToken) {
      
      
      return;
    }

    const accessToken = await this._ensureFreshToken(link);
    if (!accessToken) return; 

    const checkpoint = doc.alertsState?.lastFollowedAt ? new Date(doc.alertsState.lastFollowedAt) : null;

    
    
    
    
    if (!checkpoint) {
      const { followers } = await TwitchApiService.getChannelFollowers(doc.twitchId, accessToken, { first: 1 });
      const newest = followers[0];
      if (newest) await this._saveCheckpoint(doc.guildId, newest);
      return;
    }

    const novosFollowers = await this._collectNewFollowersSince(doc, accessToken, checkpoint);
    if (!novosFollowers.length) return;

    
    for (const follower of [...novosFollowers].reverse()) {
      await TwitchAlertService.triggerAlert(doc.guildId, TYPES.FOLLOW, {
        platformUserId:     follower.user_id,
        userLogin:          follower.user_login,
        userDisplayName:    follower.user_name,
        channelLogin:       doc.twitchLogin,
        channelDisplayName: doc.displayName,
      }).catch((err) =>
        console.error(`[TwitchFollowPollingService] Falha ao disparar alerta de follow (guild ${doc.guildId}):`, err.message));
    }

    
    await this._saveCheckpoint(doc.guildId, novosFollowers[0]);
  }

  

  async _collectNewFollowersSince(doc, accessToken, checkpoint) {
    const novos = [];
    let cursor = null;

    for (let page = 0; page < MAX_PAGES_PER_CHANNEL; page += 1) {
      const { followers, cursor: nextCursor } = await TwitchApiService.getChannelFollowers(
        doc.twitchId, accessToken, { after: cursor, first: 100 },
      );
      if (!followers.length) break;

      let cruzouCheckpoint = false;
      for (const follower of followers) {
        if (new Date(follower.followed_at) > checkpoint) {
          novos.push(follower);
        } else {
          cruzouCheckpoint = true;
          break;
        }
      }

      if (cruzouCheckpoint || !nextCursor) break;
      cursor = nextCursor;
    }

    return novos;
  }

  async _saveCheckpoint(guildId, follower) {
    await TwitchChannelDb.updateOne({ guildId }, {
      $set: {
        'alertsState.lastFollowedAt': new Date(follower.followed_at),
        'alertsState.lastFollowerId': follower.user_id,
      },
    }).catch((err) =>
      console.error(`[TwitchFollowPollingService] Falha ao gravar checkpoint de follow (guild ${guildId}):`, err.message));
  }

  

  async _ensureFreshToken(link) {
    const expiresAt = link.oauth?.expiresAt ? new Date(link.oauth.expiresAt).getTime() : 0;
    if (expiresAt && Date.now() < expiresAt - TOKEN_SAFETY_MARGIN_MS) {
      return link.oauth.accessToken;
    }

    try {
      const tokens = await TwitchApiService.refreshUserToken(link.oauth.refreshToken);
      await AccountLinkService.updateOauthTokens(link._id, {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token || link.oauth.refreshToken,
        expiresAt:    new Date(Date.now() + tokens.expires_in * 1000),
      });
      return tokens.access_token;
    } catch (err) {
      console.error(`[TwitchFollowPollingService] Falha ao renovar token de usuário (link ${link._id}):`, err.message);
      await AccountLinkService.markLinkStatus(link._id, 'expired', err.message).catch(() => {});
      return null;
    }
  }
}

module.exports = TwitchFollowPollingService;
