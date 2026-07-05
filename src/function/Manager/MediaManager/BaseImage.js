'use strict';

/**
 * @typedef {Object} RenderContext
 * @property {object}          canvas   - The `canvas` npm module.
 * @property {object}          assets   - Pre-loaded asset maps from Loader.
 * @property {object}          fonts    - Fonts manager instance.
 * @property {Function}        loadImage - Shorthand for `canvas.loadImage`.
 * @property {import('./Avatar')} avatar  - Avatar manager instance.
 */

/**
 * Abstract base class for all MediaManager templates.
 *
 * Every template file must export a class that extends BaseImage
 * and implements the `render(data, ctx)` method.
 *
 * @abstract
 *
 * @example
 * // Templates/wanted.js
 * 'use strict';
 * const BaseImage = require('../BaseImage');
 *
 * class WantedTemplate extends BaseImage {
 *     static get name()        { return 'wanted'; }
 *     static get description() { return 'Wild West WANTED poster'; }
 *
 *     async render(data, context) {
 *         const { canvas, loadImage, assets } = context;
 *         // ... build and return a Buffer
 *     }
 * }
 *
 * module.exports = WantedTemplate;
 */
class BaseImage {

    // ─── Static metadata ─────────────────────────────────────────────────────

    /**
     * The template's identifier (should match the filename, lowercase).
     * Override in subclasses.
     *
     * @returns {string}
     */
    static get templateName() {
        return 'base';
    }

    /**
     * Optional human-readable description.
     *
     * @returns {string}
     */
    static get description() {
        return '';
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    /**
     * Render the template and return a PNG Buffer.
     *
     * @abstract
     * @param {object}        data    - Template-specific data passed by the caller.
     * @param {RenderContext} context - Shared rendering context from ImageManager.
     * @returns {Promise<Buffer>}
     */
    // eslint-disable-next-line no-unused-vars
    async render(data, context) {
        throw new Error(
            `[BaseImage] Template "${this.constructor.templateName ?? this.constructor.name}" ` +
            `must implement the render(data, context) method.`
        );
    }

    // ─── Convenience helpers (available to all templates) ────────────────────

    /**
     * Load an asset image by category and name.
     *
     * @param {RenderContext} context
     * @param {'backgrounds'|'overlays'|'masks'|'icons'} category
     * @param {string}        name   - Asset name (without extension).
     * @returns {Promise<import('canvas').Image>}
     */
    async loadAsset(context, category, name) {
        const assetMap = context.assets[category];
        if (!assetMap) throw new Error(`[BaseImage] Unknown asset category: "${category}"`);

        const filePath = assetMap.get(name.toLowerCase());
        if (!filePath) throw new Error(`[BaseImage] Asset not found: ${category}/${name}`);

        return context.loadImage(filePath);
    }

    /**
     * Fetch and load an avatar image from a URL.
     *
     * @param {RenderContext} context
     * @param {string}        url
     * @param {number}        [size=256]
     * @returns {Promise<import('canvas').Image>}
     */
    async loadAvatar(context, url, size = 256) {
        const buffer = await context.avatar.fetch(url, size);
        return context.loadImage(buffer);
    }
}

module.exports = BaseImage;
