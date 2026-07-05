'use strict';

/**
 * @typedef {Object} VideoRenderContext
 * @property {object}   canvas    - The `canvas` npm module.
 * @property {object}   assets    - Pre-loaded asset maps from Loader.
 * @property {object}   fonts     - Fonts manager instance.
 * @property {Function} loadImage - Shorthand for canvas.loadImage.
 * @property {import('../MediaManager/Avatar')} avatar - Avatar manager.
 */

/**
 * @typedef {Object} VideoMeta
 * @property {number} fps     - Frames per second.
 * @property {number} width   - Frame width in pixels.
 * @property {number} height  - Frame height in pixels.
 * @property {number} duration - Total duration in seconds.
 * @property {'mp4'|'webm'|'gif'} format - Output format.
 */

/**
 * Abstract base class for all video/gif templates.
 *
 * Subclasses must implement:
 *   - static get meta()  → VideoMeta
 *   - renderFrame(frameIndex, totalFrames, data, context) → Promise<Buffer>
 *
 * @abstract
 *
 * @example
 * class TriggeredTemplate extends BaseVideo {
 *     static get templateName() { return 'triggered'; }
 *     static get meta() {
 *         return { fps: 15, width: 256, height: 256, duration: 1.5, format: 'gif' };
 *     }
 *     async renderFrame(index, total, data, context) { ... }
 * }
 */
class BaseVideo {

    // ─── Static metadata ─────────────────────────────────────────────────────

    /** @returns {string} */
    static get templateName() { return 'base_video'; }

    /** @returns {string} */
    static get description() { return ''; }

    /**
     * Video metadata — override in subclasses.
     *
     * @returns {VideoMeta}
     */
    static get meta() {
        return {
            fps:      15,
            width:    256,
            height:   256,
            duration: 1,
            format:   'gif',
        };
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    /**
     * Render a single frame and return a PNG Buffer.
     *
     * @abstract
     * @param {number}           frameIndex  - Current frame index (0-based).
     * @param {number}           totalFrames - Total number of frames.
     * @param {object}           data        - Template data.
     * @param {VideoRenderContext} context
     * @returns {Promise<Buffer>}
     */
    // eslint-disable-next-line no-unused-vars
    async renderFrame(frameIndex, totalFrames, data, context) {
        throw new Error(
            `[BaseVideo] Template "${this.constructor.templateName}" ` +
            `must implement renderFrame(frameIndex, totalFrames, data, context).`
        );
    }

    // ─── Helpers available to all templates ──────────────────────────────────

    /**
     * Normalized progress from 0.0 to 1.0 across the animation.
     *
     * @param {number} frameIndex
     * @param {number} totalFrames
     * @returns {number}
     */
    progress(frameIndex, totalFrames) {
        return totalFrames <= 1 ? 1 : frameIndex / (totalFrames - 1);
    }

    /**
     * Load a background/overlay/mask/icon asset.
     *
     * @param {VideoRenderContext} context
     * @param {'backgrounds'|'overlays'|'masks'|'icons'} category
     * @param {string} name
     * @returns {Promise<import('canvas').Image>}
     */
    async loadAsset(context, category, name) {
        const assetMap = context.assets[category];
        if (!assetMap) throw new Error(`[BaseVideo] Unknown asset category: "${category}"`);
        const filePath = assetMap.get(name.toLowerCase());
        if (!filePath) throw new Error(`[BaseVideo] Asset not found: ${category}/${name}`);
        return context.loadImage(filePath);
    }

    /**
     * Fetch and load an avatar.
     *
     * @param {VideoRenderContext} context
     * @param {string} url
     * @param {number} [size=256]
     * @returns {Promise<import('canvas').Image>}
     */
    async loadAvatar(context, url, size = 256) {
        const buffer = await context.avatar.fetch(url, size);
        return context.loadImage(buffer);
    }
}

module.exports = BaseVideo;
