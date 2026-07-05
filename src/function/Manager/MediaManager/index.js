'use strict';

/**
 * MediaManager — Ayami's official media rendering engine.
 *
 * Exposes two namespaces:
 *   MediaManager.Render(...)         → image (PNG)
 *   MediaManager.Image.Render(...)   → image (PNG)
 *   MediaManager.Video.Render(...)   → video/gif (MP4, WebM, GIF)
 *
 * @example
 * await MediaManager.init();
 *
 * const png = await MediaManager.Render({ Template: 'wanted', avatarUrl: '…' });
 * const gif = await MediaManager.Video.Render({ Template: 'triggered', avatarUrl: '…' });
 */

const path         = require('path');
const ImageManager = require('./ImageManager');
const VideoProcessManager = require('../VideoManager/VideoProcessManager');

// ─── Singletons ───────────────────────────────────────────────────────────────

/** @type {ImageManager} */
let _image = null;

/** @type {VideoProcessManager} */
let _videoPool = null;

function _getImage() {
    if (!_image) {
        const root = path.resolve(__dirname, '../../../../');
        _image = new ImageManager({ root });
    }
    return _image;
}

function _getVideoPool() {
    if (!_videoPool) {
        const root = path.resolve(__dirname, '../../../../');
        _videoPool = new VideoProcessManager({ root });
    }
    return _videoPool;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const MediaManager = {

    // ── Lifecycle ────────────────────────────────────────────────────────────

    /**
     * Initialise both image and video engines.
     * Call once at startup before any render.
     *
     * @param {object} [options]
     * @param {string} [options.root]
     * @param {number} [options.concurrency]
     * @returns {Promise<void>}
     */
    async init(options = {}) {
        if (options.root) {
            _image     = new ImageManager(options);
            _videoPool = new VideoProcessManager(options);
        }
        await Promise.all([
            _getImage().init(),
            _getVideoPool().listTemplates(), // esquenta + valida os templates de vídeo no boot
        ]);
    },

    // ── Image rendering ──────────────────────────────────────────────────────

    /**
     * Render an image template → PNG Buffer.
     *
     * @param {object} options
     * @param {string} options.Template
     * @returns {Promise<Buffer>}
     */
    async Render(options) {
        return _getImage().render(options);
    },

    Image: {
        /**
         * @param {object} options
         * @returns {Promise<Buffer>}
         */
        async Render(options) {
            return _getImage().render(options);
        },
    },

    // ── Video rendering ──────────────────────────────────────────────────────

    Video: {
        /**
         * Render a video/gif template → Buffer.
         * Roda num processo filho isolado — não trava a thread principal
         * do bot enquanto o vídeo está sendo gerado.
         *
         * @param {object} options
         * @param {string} options.Template - Template name.
         * @returns {Promise<Buffer>}
         *
         * @example
         * const gif = await MediaManager.Video.Render({
         *     Template:  'triggered',
         *     avatarUrl: 'https://…',
         * });
         */
        async Render(options) {
            return _getVideoPool().render(options);
        },

        /** @returns {Promise<string[]>} */
        async listTemplates() {
            return _getVideoPool().listTemplates();
        },

        stats() {
            return _getVideoPool().stats();
        },
    },

    // ── Utilities ────────────────────────────────────────────────────────────

    listTemplates() {
        return _getImage().listTemplates();
    },

    addTemplate(name, TemplateClass) {
        _getImage().addTemplate(name, TemplateClass);
    },

    stats() {
        return {
            image: _getImage().stats(),
            video: _getVideoPool().stats(),
        };
    },


};

module.exports = MediaManager;
