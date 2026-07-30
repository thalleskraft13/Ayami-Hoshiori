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
}

module.exports = new TwitchApiService();
