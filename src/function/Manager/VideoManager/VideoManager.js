'use strict';

const path          = require('path');
const Loader        = require('../MediaManager/Loader');
const Fonts         = require('../MediaManager/Fonts');
const Avatar        = require('../MediaManager/Avatar');
const Cache         = require('../MediaManager/Cache');
const Queue         = require('../MediaManager/Queue');
const VideoRenderer = require('./VideoRenderer');

class VideoManager {
    constructor(options = {}) {
        this._root        = options.root        ?? process.cwd();
        this._concurrency = options.concurrency ?? 1;

        const publicDir      = path.join(this._root, 'src', 'public', 'media');
        const templatesDir   = path.join(__dirname, 'Templates');

        this._loader = new Loader({ publicDir, templatesDir });
        this._fonts  = new Fonts();
        this._avatar = new Avatar({ cache: new Cache({ ttl: 600_000, name: 'VideoAvatarCache' }) });
        this._queue  = new Queue({ concurrency: this._concurrency, timeout: 240_000 }); 

        this._templates = new Map();
        this._assets    = null;
        this._canvas    = null;
        this._ready     = false;
    }


    async init() {
        if (this._ready) return;

        this._canvas = this._requireCanvas();
        this._assets = this._loader.loadAssets();
        this._fonts.registerAll(this._assets.fonts, this._canvas);

        const discovered = this._loader.loadTemplates();
        for (const [name, mod] of discovered) {
            this._register(name, mod);
        }

        this._ready = true;

        console.log(
            `[VideoManager] Ready — templates: ${this._templates.size}`
        );
    }


    async render(options) {
        this._assertReady();

        const { Template, ...data } = options;
        if (!Template) throw new Error('[VideoManager] options.Template is required.');

        const name          = Template.toLowerCase();
        const TemplateClass = this._templates.get(name);

        if (!TemplateClass) {
            throw new Error(
                `[VideoManager] Template "${name}" not found. ` +
                `Available: ${[...this._templates.keys()].join(', ') || '(none)'}`
            );
        }

        return this._queue.add(() => this._doRender(TemplateClass, data));
    }

    listTemplates() {
        return [...this._templates.keys()];
    }

    stats() {
        return { queue: this._queue.stats() };
    }


    async _doRender(TemplateClass, data) {
        const context  = this._buildContext();
        const renderer = new VideoRenderer(context);
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

    _register(name, mod) {
        const TemplateClass = mod?.default ?? mod;
        if (typeof TemplateClass !== 'function') return;
        this._templates.set(name, TemplateClass);
    }

    _requireCanvas() {
        try { return require('canvas'); }
        catch { throw new Error('[VideoManager] npm install canvas'); }
    }

    _assertReady() {
        if (!this._ready) throw new Error('[VideoManager] Call init() before rendering.');
    }

    async renderFrames(options) {
        this._assertReady();

        const { Template, ...data } = options;
        if (!Template) throw new Error('[VideoManager] options.Template is required.');

        const name          = Template.toLowerCase();
        const TemplateClass = this._templates.get(name);

        if (!TemplateClass) {
            throw new Error(
                `[VideoManager] Template "${name}" not found. ` +
                `Available: ${[...this._templates.keys()].join(', ') || '(none)'}`
            );
        }

        return this._queue.add(() => this._doRenderFrames(TemplateClass, data));
    }

    async _doRenderFrames(TemplateClass, data) {
        const meta        = TemplateClass.meta;
        const totalFrames = Math.ceil(meta.fps * meta.duration);
        const template    = new TemplateClass();
        const context     = this._buildContext();

        try {
            const frames = [];
            for (let i = 0; i < totalFrames; i++) {
                const frame = await template.renderFrame(i, totalFrames, data, context);
                frames.push(frame);
            }
            return frames;
        } finally {
            try { await template.dispose?.(); } catch {}
            global.gc?.(); 
        }
    }
}

module.exports = VideoManager;
