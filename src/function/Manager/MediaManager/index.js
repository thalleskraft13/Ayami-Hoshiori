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
const VideoManager = require('../VideoManager/VideoManager');

// ─── Singletons ───────────────────────────────────────────────────────────────

/** @type {ImageManager} */
let _image = null;

/** @type {VideoManager} */
let _video = null;

function _getImage() {
    if (!_image) {
        const root = path.resolve(__dirname, '../../../../');
        _image = new ImageManager({ root });
    }
    return _image;
}

function _getVideo() {
    if (!_video) {
        const root = path.resolve(__dirname, '../../../../');
        _video = new VideoManager({ root });
    }
    return _video;
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
            _image = new ImageManager(options);
            _video = new VideoManager(options);
        }
        await Promise.all([
            _getImage().init(),
            _getVideo().init(),
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
            return _getVideo().render(options);
        },

        /** @returns {string[]} */
        listTemplates() {
            return _getVideo().listTemplates();
        },

         async renderFrames(options) {
            return _getVideo().renderFrames(options);
        },

        stats() {
            return _getVideo().stats();
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
            video: _getVideo().stats(),
        };
    },


};

module.exports = MediaManager;
