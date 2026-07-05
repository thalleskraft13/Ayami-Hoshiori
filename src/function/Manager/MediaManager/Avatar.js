'use strict';

const https  = require('https');
const http   = require('http');
const Cache  = require('./Cache');

const DEFAULT_SIZE    = 256;
const DEFAULT_TIMEOUT = 10_000; // ms

/**
 * Downloads, resizes and caches user avatars (or any image URL).
 * Returns a raw Buffer in PNG format.
 *
 * This module has zero Discord-specific dependencies.
 * It only needs a URL.
 *
 * @example
 * const avatar = new Avatar();
 * const buffer = await avatar.fetch('https://cdn.discordapp.com/avatars/…/….png?size=512');
 */
class Avatar {
    /**
     * @param {object} [options]
     * @param {Cache}  [options.cache]   - Shared Cache instance. Creates its own if not provided.
     * @param {number} [options.size=256]         - Default resize dimension (px).
     * @param {number} [options.timeout=10_000]   - Request timeout in ms.
     */
    constructor(options = {}) {
        this._cache   = options.cache   ?? new Cache({ ttl: 600_000, name: 'AvatarCache' });
        this._size    = options.size    ?? DEFAULT_SIZE;
        this._timeout = options.timeout ?? DEFAULT_TIMEOUT;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Fetch an avatar from URL, resize it, and return a PNG Buffer.
     * Results are cached by `${url}@${size}`.
     *
     * @param {string}  url
     * @param {number}  [size] - Override the default resize dimension.
     * @returns {Promise<Buffer>}
     */
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

    /**
     * Pre-warm the cache for multiple URLs.
     *
     * @param {string[]} urls
     * @param {number}   [size]
     * @returns {Promise<void>}
     */
    async prefetch(urls, size) {
        await Promise.allSettled(urls.map((u) => this.fetch(u, size)));
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /**
     * Download a URL into a Buffer.
     *
     * @param {string} url
     * @returns {Promise<Buffer>}
     */
    _download(url) {
        return new Promise((resolve, reject) => {
            const parsed  = new URL(url);
            const lib     = parsed.protocol === 'https:' ? https : http;
            const timeout = this._timeout;

            const req = lib.get(url, { timeout }, (res) => {
                // Follow a single redirect
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

    /**
     * Resize a raw image buffer using the `sharp` library (if available)
     * or falls back to returning the original buffer unchanged.
     *
     * @param {Buffer} buffer
     * @param {number} size
     * @returns {Promise<Buffer>}
     */
    async _resize(buffer, size) {
        try {
            // sharp is optional — only used when installed
            const sharp = require('sharp');
            return await sharp(buffer)
                .resize(size, size, { fit: 'cover' })
                .png()
                .toBuffer();
        } catch (err) {
            if (err.code === 'MODULE_NOT_FOUND') {
                // sharp not installed — try canvas-based resize
                return this._resizeWithCanvas(buffer, size);
            }
            throw new Error(`[Avatar] Resize failed: ${err.message}`);
        }
    }

    /**
     * Fallback resize using the `canvas` package.
     *
     * @param {Buffer} buffer
     * @param {number} size
     * @returns {Promise<Buffer>}
     */
    async _resizeWithCanvas(buffer, size) {
        try {
            const { createCanvas, loadImage } = require('canvas');
            const img    = await loadImage(buffer);
            const canvas = createCanvas(size, size);
            const ctx    = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, size, size);
            return canvas.toBuffer('image/png');
        } catch {
            // Last resort: return original buffer (no resize)
            return buffer;
        }
    }

    /**
 * Carrega uma imagem a partir de um Buffer enviado pelo usuário.
 * Valida tipo, tamanho e integridade antes de aceitar.
 *
 * @param {Buffer} buffer       - Buffer do arquivo enviado.
 * @param {object} [opts]
 * @param {number} [opts.maxBytes=8_000_000]  - Tamanho máximo (padrão 8MB).
 * @param {number} [opts.size=256]            - Redimensionar para este tamanho.
 * @returns {Promise<Buffer>}
 */
async fromBuffer(buffer, opts = {}) {
    const maxBytes = opts.maxBytes ?? 8_000_000;
    const size     = opts.size     ?? this._size;

    // ── Segurança 1: tamanho ─────────────────────────────────────────────
    if (buffer.length > maxBytes) {
        throw new Error(`[Avatar] Arquivo muito grande (${(buffer.length / 1_000_000).toFixed(1)}MB). Máximo: ${maxBytes / 1_000_000}MB.`);
    }

    // ── Segurança 2: magic bytes (tipo real, não extensão) ───────────────
    if (!Avatar._isAllowedType(buffer)) {
        throw new Error('[Avatar] Tipo de arquivo não permitido. Envie PNG ou JPEG.');
    }

    return this._resize(buffer, size);
}

/**
 * Verifica o tipo real do arquivo pelos magic bytes.
 * Não confia na extensão nem no Content-Type declarado.
 *
 * @param {Buffer} buf
 * @returns {boolean}
 */
static _isAllowedType(buf) {
    // PNG: 89 50 4E 47
    const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    // JPEG: FF D8 FF
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;

    return isPng || isJpeg;
}
}

module.exports = Avatar;
