'use strict';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX_URL = 'https://api.twitch.tv/helix';

const TOKEN_SAFETY_MARGIN_MS = 60_000;
const MAX_IDS_PER_REQUEST    = 100;

class TwitchApiService {

  constructor() {
    this._token          = null;
    this._tokenExpiresAt = 0;
    this._tokenPromise   = null;
  }

  _credentials() {
    const clientId     = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('[TwitchApiService] TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET não configurados no ambiente.');
    }

    return { clientId, clientSecret };
  }

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiresAt - TOKEN_SAFETY_MARGIN_MS) {
      return this._token;
    }

    if (!this._tokenPromise) {
      this._tokenPromise = this._requestToken().finally(() => {
        this._tokenPromise = null;
      });
    }

    return this._tokenPromise;
  }

  async _requestToken() {
    const { clientId, clientSecret } = this._credentials();

    const params = new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'client_credentials',
    });

    const res  = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: 'POST' });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.access_token) {
      throw new Error(`[TwitchApiService] Falha ao obter token de acesso: HTTP ${res.status} ${JSON.stringify(data)}`);
    }

    this._token          = data.access_token;
    this._tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    return this._token;
  }

  async _request(path, params = {}) {
    const { clientId } = this._credentials();
    const token = await this._getToken();

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) query.append(key, v);
      } else if (value != null) {
        query.append(key, value);
      }
    }

    const url = `${HELIX_URL}${path}${query.toString() ? `?${query.toString()}` : ''}`;

    const res = await fetch(url, {
      headers: {
        'Client-Id':     clientId,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      this._token = null;
      throw new Error('[TwitchApiService] Token da Twitch inválido ou expirado.');
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`[TwitchApiService] HTTP ${res.status} em ${path}: ${JSON.stringify(data)}`);
    }

    return data;
  }

  parseChannelInput(input) {
    if (!input) return null;

    let value = String(input).trim();

    const urlMatch = value.match(/twitch\.tv\/([a-zA-Z0-9_]{2,25})/i);
    if (urlMatch) value = urlMatch[1];

    value = value.replace(/^@/, '').trim();

    if (!/^[a-zA-Z0-9_]{2,25}$/.test(value)) return null;

    return value.toLowerCase();
  }

  async getUserByLogin(loginOrUrl) {
    const login = this.parseChannelInput(loginOrUrl);
    if (!login) return null;

    const data = await this._request('/users', { login });
    return data?.data?.[0] ?? null;
  }

  async getStreamsByUserIds(userIds = []) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return [];

    const results = [];

    for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
      const chunk = ids.slice(i, i + MAX_IDS_PER_REQUEST);
      const data  = await this._request('/streams', { user_id: chunk });
      results.push(...(data?.data ?? []));
    }

    return results;
  }

  async getStreamByUserId(userId) {
    const streams = await this.getStreamsByUserIds([userId]);
    return streams[0] ?? null;
  }

  /**
   * "Get Chatters" — diferente do resto desta classe, exige um TOKEN
   * DE USUÁRIO (moderador ou broadcaster do canal), não o app token de
   * `client_credentials` usado em `_request`. Usado pela AyamiBot
   * (Stats/TwitchViewerStatsService.js, via TwitchChatBot.js) com o
   * próprio token dela — ela precisa ser moderadora do canal (mesmo
   * requisito já documentado na Fase 6, pros comandos de chat).
   *
   * Retorna array de { user_id, user_login, user_name } (paginado
   * internamente até 1000 chatters, suficiente pra esta finalidade).
   */
  async getChattersWithUserToken(broadcasterId, moderatorId, userAccessToken) {
    const { clientId } = this._credentials();
    let cursor = null;
    const chatters = [];

    do {
      const query = new URLSearchParams({
        broadcaster_id: broadcasterId,
        moderator_id: moderatorId,
        first: '100',
        ...(cursor ? { after: cursor } : {}),
      });

      const res = await fetch(`${HELIX_URL}/chat/chatters?${query.toString()}`, {
        headers: {
          'Client-Id': clientId,
          'Authorization': `Bearer ${userAccessToken}`,
        },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`[TwitchApiService] HTTP ${res.status} em /chat/chatters: ${JSON.stringify(data)}`);
      }

      chatters.push(...(data?.data ?? []));
      cursor = data?.pagination?.cursor || null;
    } while (cursor && chatters.length < 1000);

    return chatters;
  }

  /**
   * "Get Channel Followers" — assim como "Get Chatters", exige TOKEN DE
   * USUÁRIO (broadcaster ou moderador com escopo
   * `moderator:read:followers`), não o app token de `client_credentials`
   * usado em `_request`. Usado pelo polling de Follow (Alertas), só
   * disponível pra canais conectados via Dashboard/OAuth — ver
   * `Twitch/Alerts/TwitchFollowPollingService.js`.
   *
   * Retorna a lista de seguidores da página mais recente, no formato
   * { user_id, user_login, user_name, followed_at }. A Twitch retorna
   * este endpoint ordenado do seguidor mais recente pro mais antigo
   * quando nenhum `user_id` é informado — é essa ordem que o polling
   * usa pra parar de paginar assim que cruza o checkpoint já processado,
   * então não puxa o histórico inteiro de seguidores a cada ciclo.
   */
  async getChannelFollowers(broadcasterId, userAccessToken, { after = null, first = 100 } = {}) {
    const { clientId } = this._credentials();

    const query = new URLSearchParams({
      broadcaster_id: broadcasterId,
      first: String(first),
      ...(after ? { after } : {}),
    });

    const res = await fetch(`${HELIX_URL}/channels/followers?${query.toString()}`, {
      headers: {
        'Client-Id': clientId,
        'Authorization': `Bearer ${userAccessToken}`,
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`[TwitchApiService] HTTP ${res.status} em /channels/followers: ${JSON.stringify(data)}`);
    }

    return {
      followers:  data?.data ?? [],
      cursor:     data?.pagination?.cursor ?? null,
      total:      data?.total ?? 0,
    };
  }

  /**
   * Renova o access_token de um usuário a partir do refresh_token salvo
   * em `CreatorAccountLink#oauth.refreshToken` — equivalente do lado do
   * Bot pra `ayami-fixed/services/twitchOAuth.js#refreshToken`
   * (Dashboard). Reaproveita as MESMAS credenciais de app
   * (TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET) já usadas em `_requestToken`
   * acima — é a mesma Application no Twitch Developer Console.
   */
  async refreshUserToken(refreshToken) {
    const { clientId, clientSecret } = this._credentials();

    const body = new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`[TwitchApiService] Falha ao renovar token de usuário: HTTP ${res.status} ${JSON.stringify(data)}`);
    }

    return data; // { access_token, refresh_token, expires_in, scope, token_type }
  }
}

module.exports = new TwitchApiService();
