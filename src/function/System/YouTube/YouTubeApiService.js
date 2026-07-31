'use strict';

const API_URL = 'https://www.googleapis.com/youtube/v3';

const CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;
const HANDLE_RE     = /^@[a-zA-Z0-9._-]{3,30}$/;

class YouTubeApiService {

  _apiKey() {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      throw new Error('[YouTubeApiService] YOUTUBE_API_KEY não configurada no ambiente.');
    }
    return key;
  }

  async _request(path, params = {}) {
    const apiKey = this._apiKey();

    const query = new URLSearchParams({ key: apiKey });
    for (const [k, v] of Object.entries(params)) {
      if (v != null) query.append(k, v);
    }

    const url = `${API_URL}${path}?${query.toString()}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`[YouTubeApiService] HTTP ${res.status} em ${path}: ${JSON.stringify(data?.error ?? data)}`);
    }

    return data;
  }

  parseChannelInput(input) {
    if (!input) return null;

    let value = String(input).trim();

    const channelUrlMatch = value.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/i);
    if (channelUrlMatch) return { type: 'id', value: channelUrlMatch[1] };

    const handleUrlMatch = value.match(/youtube\.com\/@([a-zA-Z0-9._-]{3,30})/i);
    if (handleUrlMatch) return { type: 'handle', value: `@${handleUrlMatch[1]}` };

    const legacyUrlMatch = value.match(/youtube\.com\/(?:c|user)\/([a-zA-Z0-9._-]+)/i);
    if (legacyUrlMatch) return { type: 'query', value: legacyUrlMatch[1] };

    if (CHANNEL_ID_RE.test(value)) return { type: 'id', value };

    if (value.startsWith('@')) {
      return HANDLE_RE.test(value) ? { type: 'handle', value } : null;
    }

    if (!value) return null;
    return { type: 'query', value };
  }

  async _getChannelById(id) {
    const data = await this._request('/channels', { part: 'snippet,contentDetails', id });
    return data?.items?.[0] ?? null;
  }

  async _getChannelByHandle(handle) {
    const data = await this._request('/channels', { part: 'snippet,contentDetails', forHandle: handle });
    return data?.items?.[0] ?? null;
  }

  async _searchChannel(query) {
    const data = await this._request('/search', { part: 'snippet', type: 'channel', maxResults: 1, q: query });
    const channelId = data?.items?.[0]?.snippet?.channelId ?? data?.items?.[0]?.id?.channelId;
    if (!channelId) return null;
    return this._getChannelById(channelId);
  }

  _normalizeChannel(raw) {
    if (!raw) return null;

    return {
      id:                raw.id,
      title:             raw.snippet?.title ?? null,
      handle:            raw.snippet?.customUrl ?? null,
      thumbnailUrl:      raw.snippet?.thumbnails?.high?.url ?? raw.snippet?.thumbnails?.default?.url ?? null,
      uploadsPlaylistId: raw.contentDetails?.relatedPlaylists?.uploads ?? null,
    };
  }

  async resolveChannel(input) {
    const parsed = this.parseChannelInput(input);
    if (!parsed) return null;

    let raw = null;

    if (parsed.type === 'id') {
      raw = await this._getChannelById(parsed.value);
    } else if (parsed.type === 'handle') {
      raw = await this._getChannelByHandle(parsed.value) ?? await this._searchChannel(parsed.value);
    } else {
      raw = await this._searchChannel(parsed.value);
    }

    return this._normalizeChannel(raw);
  }

  async getRecentUploads(playlistId, maxResults = 5) {
    if (!playlistId) return [];

    const data = await this._request('/playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults,
    });

    return (data?.items ?? []).map((item) => ({
      videoId:     item.snippet?.resourceId?.videoId,
      title:       item.snippet?.title,
      publishedAt: item.snippet?.publishedAt,
    })).filter((item) => item.videoId);
  }

  async getVideosDetails(videoIds = []) {
    const ids = [...new Set(videoIds.filter(Boolean))];
    if (!ids.length) return [];

    const data = await this._request('/videos', {
      part: 'snippet,contentDetails,liveStreamingDetails',
      id: ids.join(','),
    });

    return (data?.items ?? []).map((v) => ({
      id:                  v.id,
      title:               v.snippet?.title ?? '',
      publishedAt:         v.snippet?.publishedAt ?? null,
      thumbnailUrl:        v.snippet?.thumbnails?.maxres?.url ?? v.snippet?.thumbnails?.high?.url ?? null,
      liveBroadcastContent: v.snippet?.liveBroadcastContent ?? 'none',
      duration:             v.contentDetails?.duration ?? null,
    }));
  }
}

module.exports = new YouTubeApiService();
