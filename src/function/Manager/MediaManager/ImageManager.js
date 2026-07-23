'use strict';

const path = require('path');

const Cache    = require('./Cache');
const Queue    = require('./Queue');
const Loader   = require('./Loader');
const Fonts    = require('./Fonts');
const Avatar   = require('./Avatar');
const Renderer = require('./Renderer');
const Utils    = require('./Utils');


class ImageManager {
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

        this._templates = new Map();

        this._assets = null;

        this._canvas = null;

        this._ready = false;
    }


    async init() {
        if (this._ready) return;

        this._canvas = this._requireCanvas();

        this._assets = this._loader.loadAssets();

        this._fonts.registerAll(this._assets.fonts, this._canvas);

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

    addTemplate(name, TemplateClass) {
        this._registerTemplate(name.toLowerCase(), TemplateClass);
    }

    listTemplates() {
        return [...this._templates.keys()];
    }

    stats() {
        return {
            queue:       this._queue.stats(),
            outputCache: this._outputCache?.stats() ?? null,
            avatarCache: this._avatar._cache.stats(),
        };
    }


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

    _registerTemplate(name, mod) {
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

    _cacheKey(name, data) {
        try {
            return `render:${name}:${JSON.stringify(data)}`;
        } catch {
            return `render:${name}:${Utils.cacheBust()}`;
        }
    }
}

module.exports = ImageManager;
