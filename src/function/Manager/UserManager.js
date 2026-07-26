'use strict';

const DiscordRequest = require('../DiscordRequest.js');

const CDN = 'https://cdn.discordapp.com';

const DEFAULT_TTL_MS       = parseInt(process.env.USER_CACHE_TTL_MS, 10)       || 30 * 60 * 1000;
const DEFAULT_SWEEP_MS     = parseInt(process.env.USER_CACHE_SWEEP_MS, 10)     || 5  * 60 * 1000;
const APPROX_BASE_BYTES    = 220;



class User {

    constructor(client, data) {
        this.client = client;
        this._patch(data);
    }

    _patch(data) {
        this.id            = data.id            ?? this.id            ?? null;
        this.username       = data.username      ?? this.username       ?? null;
        this.globalName     = data.global_name   ?? this.globalName     ?? null;
        this.discriminator  = data.discriminator ?? this.discriminator  ?? '0';
        this.avatar         = data.avatar        ?? this.avatar         ?? null;
        this.banner         = data.banner        ?? this.banner         ?? null;
        this.accentColor    = data.accent_color  ?? this.accentColor    ?? null;
        this.bot            = data.bot           ?? this.bot            ?? false;
        this.system         = data.system        ?? this.system         ?? false;
        this.flags          = data.public_flags  ?? this.flags          ?? 0;
        this.premiumType    = data.premium_type  ?? this.premiumType    ?? 0;
        this.cachedAt       = Date.now();
        return this;
    }

    get tag()      { return this.discriminator === '0' ? this.username : `${this.username}#${this.discriminator}`; }
    get mention()  { return `<@${this.id}>`; }
    get displayName() { return this.globalName ?? this.username; }

    avatarURL({ format = 'webp', size = 1024, dynamic = true } = {}) {
        if (!this.avatar) {
            const index = this.discriminator === '0'
                ? Number(BigInt(this.id) >> 22n) % 6
                : Number(this.discriminator) % 5;
            return `${CDN}/embed/avatars/${index}.png`;
        }
        const ext = dynamic && this.avatar.startsWith('a_') ? 'gif' : format;
        return `${CDN}/avatars/${this.id}/${this.avatar}.${ext}?size=${size}`;
    }

    bannerURL({ format = 'webp', size = 1024 } = {}) {
        if (!this.banner) return null;
        return `${CDN}/banners/${this.id}/${this.banner}.${format}?size=${size}`;
    }

    toJSON() {
        return {
            id: this.id, username: this.username, globalName: this.globalName,
            discriminator: this.discriminator, avatar: this.avatar, bot: this.bot,
        };
    }
}



class UserManager {

    constructor(client, options = {}) {
        this.client = client;

        this.cache = new Map();

        this.ttl      = options.ttl      ?? DEFAULT_TTL_MS;
        this.sweepInterval = options.sweepInterval ?? DEFAULT_SWEEP_MS;

        this._sweeper = setInterval(() => this._sweep(), this.sweepInterval);
        if (this._sweeper.unref) this._sweeper.unref();
    }


    async getUser(userId, force = false) {
        if (!force) {
            const cached = this.cache.get(userId);
            if (cached && !this._isExpired(cached)) return cached;
        }

        const data = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        return this._upsert(data);
    }

    get(userId) {
        const cached = this.cache.get(userId);
        if (!cached || this._isExpired(cached)) return null;
        return cached;
    }

    set(data)       { return this._upsert(data); }
    has(userId)      { return this.get(userId) !== null; }
    delete(userId)   { return this.cache.delete(userId); }
    clear()          { this.cache.clear(); }
    values()         { return this.cache.values(); }
    keys()           { return this.cache.keys(); }


    _upsert(data) {
        if (!data?.id) return null;
        const existing = this.cache.get(data.id);
        if (existing) return existing._patch(data);
        const user = new User(this.client, data);
        this.cache.set(user.id, user);
        return user;
    }

    _isExpired(user) {
        if (this.ttl <= 0) return false;
        return (Date.now() - user.cachedAt) > this.ttl;
    }

    _sweep() {
        if (this.ttl <= 0) return;
        const now = Date.now();
        for (const [id, user] of this.cache) {
            if (now - user.cachedAt > this.ttl) this.cache.delete(id);
        }
    }

    getStats() {
        return {
            count:       this.cache.size,
            approxBytes: this._approxMemory(),
        };
    }

    _approxMemory() {
        let total = 0;
        for (const user of this.cache.values()) {
            total += APPROX_BASE_BYTES
                + ((user.username   ?? '').length * 2)
                + ((user.globalName ?? '').length * 2)
                + ((user.avatar     ?? '').length * 2);
        }
        return total;
    }

    destroy() {
        clearInterval(this._sweeper);
    }
}

module.exports = UserManager;
