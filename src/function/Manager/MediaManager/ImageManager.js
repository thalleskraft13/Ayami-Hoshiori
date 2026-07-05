'use strict';

const path = require('path');

const Cache    = require('./Cache');
const Queue    = require('./Queue');
const Loader   = require('./Loader');
const Fonts    = require('./Fonts');
const Avatar   = require('./Avatar');
const Renderer = require('./Renderer');
const Utils    = require('./Utils');

/**
 * @typedef {Object} RenderOptions
 * @property {string}  Template - Template name (case-insensitive).
 * @property {boolean} [cache=false] - Cache the output Buffer by a hash of the options.
 * @property {*}       [...]         - Any extra properties are forwarded to the template.
 */

/**
 * Top-level orchestrator for the MediaManager rendering pipeline.
 *
 * Responsibilities:
 *   - Bootstrap: discover assets, register fonts, load templates.
 *   - Maintain a shared RenderContext for all templates.
 *   - Dispatch render requests through the Queue.
 *   - Optionally cache render outputs.
 *
 * @example
 * const manager = new ImageManager({ root: path.join(__dirname, '../../../../') });
 * await manager.init();
 * const buffer = await manager.render({ Template: 'wanted', avatarUrl: '…', username: 'John' });
 */
class ImageManager {
    /**
     * @param {object} [options]
     * @param {string} [options.root]         - Project root. Defaults to CWD.
     * @param {number} [options.concurrency=4] - Max parallel renders.
     * @param {boolean}[options.outputCache=true] - Cache render outputs.
     * @param {number} [options.outputCacheTtl=120_000] - Output cache TTL (ms).
     */
    constructor(options = {}) {
        this._root        = options.root        ?? process.cwd();
        this._concurrency = options.concurrency ?? 4;

        const publicDir    = path.join(this._root, "src", 'public', 'media');
        const templatesDir = path.join(__dirname, 'Templates');

        this._loader = new Loader({ publicDir, templatesDir });
        this._fonts  = new Fonts();
        this._avatar = new Avatar({ cache: new Cache({ ttl: 600_000, name: 'AvatarCache' }) });
        this._queue  = new Queue({ concurrency: this._concurrency });

        this._outputCache = options.outputCache !== false
            ? new Cache({ ttl: options.outputCacheTtl ?? 120_000, name: 'RenderCache' })
            : null;

        /** @type {Map<string, Function>} Template name → class */
        this._templates = new Map();

        /** @type {object} Pre-loaded asset maps */
        this._assets = null;

        /** @type {object|null} canvas npm module */
        this._canvas = null;

        this._ready = false;
    }

    // ─── Initialisation ──────────────────────────────────────────────────────

    /**
     * Discover assets, register fonts and load template modules.
     * Must be called once before any render.
     *
     * @returns {Promise<void>}
     */
    async init() {
        if (this._ready) return;

        // 1. Load the canvas module
        this._canvas = this._requireCanvas();

        // 2. Discover assets
        this._assets = this._loader.loadAssets();

        // 3. Register fonts
        this._fonts.registerAll(this._assets.fonts, this._canvas);

        // 4. Discover templates
        const discovered = this._loader.loadTemplates();
        for (const [name, mod] of discovered) {
            this._registerTemplate(name, mod);
        }

        this._ready = true;

        console.log(
            `[ImageManager] Ready — ` +
            `templates: ${this._templates.size}, ` +
            `fonts: ${this._fonts.list().length}, ` +
            `backgrounds: ${this._assets.backgrounds.size}`
        );
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Render a template and return a PNG Buffer.
     *
     * @param {RenderOptions} options
     * @returns {Promise<Buffer>}
     */
    async render(options) {
        this._assertReady();

        const { Template, cache: useCache = false, ...data } = options;

        if (!Template) throw new Error('[ImageManager] options.Template is required.');

        const name = Template.toLowerCase();
        const TemplateClass = this._templates.get(name);
        if (!TemplateClass) {
            throw new Error(
                `[ImageManager] Template "${name}" not found. ` +
                `Available: ${[...this._templates.keys()].join(', ') || '(none)'}`
            );
        }

        // Check output cache
        if (useCache && this._outputCache) {
            const key    = this._cacheKey(name, data);
            const cached = this._outputCache.get(key);
            if (cached) return cached;

            const buffer = await this._queue.add(() => this._doRender(TemplateClass, data));
            this._outputCache.set(key, buffer);
            return buffer;
        }

        return this._queue.add(() => this._doRender(TemplateClass, data));
    }

    /**
     * Register a template class at runtime (e.g. for hot-reloading).
     *
     * @param {string}   name
     * @param {Function} TemplateClass
     */
    addTemplate(name, TemplateClass) {
        this._registerTemplate(name.toLowerCase(), TemplateClass);
    }

    /**
     * List all registered template names.
     *
     * @returns {string[]}
     */
    listTemplates() {
        return [...this._templates.keys()];
    }

    /**
     * Return statistics from the queue and caches.
     *
     * @returns {object}
     */
    stats() {
        return {
            queue:       this._queue.stats(),
            outputCache: this._outputCache?.stats() ?? null,
            avatarCache: this._avatar._cache.stats(),
        };
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    async _doRender(TemplateClass, data) {
        const context = this._buildContext();
        const renderer = new Renderer(context);
        return renderer.run(TemplateClass, data);
    }

    _buildContext() {
        return {
            canvas:    this._canvas,
            assets:    this._assets,
            fonts:     this._fonts,
            loadImage: this._canvas.loadImage.bind(this._canvas),
            avatar:    this._avatar,
        };
    }

    /**
     * @param {string}   name
     * @param {Function|object} mod - Class or { default: Class } or instance with render()
     */
    _registerTemplate(name, mod) {
        // Support both `class X` and `module.exports = { default: class X }`
        const TemplateClass = mod?.default ?? mod;

        if (typeof TemplateClass !== 'function') {
            console.warn(`[ImageManager] Template "${name}" does not export a class — skipping.`);
            return;
        }

        this._templates.set(name, TemplateClass);
    }

    _requireCanvas() {
        try {
            return require('canvas');
        } catch {
            throw new Error(
                '[ImageManager] The "canvas" package is required. Install it with: npm install canvas'
            );
        }
    }

    _assertReady() {
        if (!this._ready) {
            throw new Error('[ImageManager] Call init() before rendering.');
        }
    }

    /**
     * Generate a deterministic cache key from template name + data.
     *
     * @param {string} name
     * @param {object} data
     * @returns {string}
     */
    _cacheKey(name, data) {
        try {
            return `render:${name}:${JSON.stringify(data)}`;
        } catch {
            return `render:${name}:${Utils.cacheBust()}`;
        }
    }
}

module.exports = ImageManager;
