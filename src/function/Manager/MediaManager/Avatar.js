'use strict';

const https  = require('https');
const http   = require('http');
const Cache  = require('./Cache');

const DEFAULT_SIZE    = 256;
const DEFAULT_TIMEOUT = 10_000; 

class Avatar {
    constructor(options = {}) {
        this._cache   = options.cache   ?? new Cache({ ttl: 600_000, name: 'AvatarCache' });
        this._size    = options.size    ?? DEFAULT_SIZE;
        this._timeout = options.timeout ?? DEFAULT_TIMEOUT;
    }


    async fetch(url, size) {
        const targetSize = size ?? this._size;
        const cacheKey   = `avatar:${url}@${targetSize}`;

        const cached = this._cache.get(cacheKey);
        if (cached) return cached;

        const rawBuffer = await this._download(url);
        const resized   = await this._resize(rawBuffer, targetSize);

        this._cache.set(cacheKey, resized);
        return resized;
    }

    async prefetch(urls, size) {
        await Promise.allSettled(urls.map((u) => this.fetch(u, size)));
    }


    _download(url) {
        return new Promise((resolve, reject) => {
            const parsed  = new URL(url);
            const lib     = parsed.protocol === 'https:' ? https : http;
            const timeout = this._timeout;

            const req = lib.get(url, { timeout }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    if (!res.headers.location) {
                        return reject(new Error('[Avatar] Redirect without Location header'));
                    }
                    return this._download(res.headers.location).then(resolve).catch(reject);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`[Avatar] HTTP ${res.statusCode} fetching avatar: ${url}`));
                }

                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end',  () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`[Avatar] Request timed out after ${timeout}ms: ${url}`));
            });

            req.on('error', reject);
        });
    }

    async _resize(buffer, size) {
        try {
            const sharp = require('sharp');
            return await sharp(buffer)
                .resize(size, size, { fit: 'cover' })
                .png()
                .toBuffer();
        } catch (err) {
            if (err.code === 'MODULE_NOT_FOUND') {
                return this._resizeWithCanvas(buffer, size);
            }
            throw new Error(`[Avatar] Resize failed: ${err.message}`);
        }
    }

    async _resizeWithCanvas(buffer, size) {
        try {
            const { createCanvas, loadImage } = require('canvas');
            const img    = await loadImage(buffer);
            const canvas = createCanvas(size, size);
            const ctx    = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, size, size);
            return canvas.toBuffer('image/png');
        } catch {
            return buffer;
        }
    }

async fromBuffer(buffer, opts = {}) {
    const maxBytes = opts.maxBytes ?? 8_000_000;
    const size     = opts.size     ?? this._size;

    if (buffer.length > maxBytes) {
        throw new Error(`[Avatar] Arquivo muito grande (${(buffer.length / 1_000_000).toFixed(1)}MB). Máximo: ${maxBytes / 1_000_000}MB.`);
    }

    if (!Avatar._isAllowedType(buffer)) {
        throw new Error('[Avatar] Tipo de arquivo não permitido. Envie PNG ou JPEG.');
    }

    return this._resize(buffer, size);
}

static _isAllowedType(buf) {
    const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;

    return isPng || isJpeg;
}
}

module.exports = Avatar;
