'use strict';

const fs   = require('fs');
const path = require('path');


const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

const FONT_EXTS  = new Set(['.ttf', '.otf', '.woff', '.woff2']);

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

class Loader {
    constructor({ publicDir, templatesDir }) {
        this._publicDir    = publicDir;
        this._templatesDir = templatesDir;
    }


    loadAssets() {
        return {
            backgrounds: this._scanDir(path.join(this._publicDir, 'backgrounds'), IMAGE_EXTS),
            overlays:    this._scanDir(path.join(this._publicDir, 'overlays'),    IMAGE_EXTS),
            masks:       this._scanDir(path.join(this._publicDir, 'masks'),       IMAGE_EXTS),
            icons:       this._scanDir(path.join(this._publicDir, 'icons'),       IMAGE_EXTS),
            fonts:       this._scanDir(path.join(this._publicDir, 'fonts'),       FONT_EXTS),
            videos:     this._scanDir(path.join(this._publicDir, 'videos'),     VIDEO_EXTS),
        };
    }

    loadTemplates() {
        const templates = new Map();

        if (!this._dirExists(this._templatesDir)) {
            console.warn(`[Loader] Templates directory not found: ${this._templatesDir}`);
            return templates;
        }

        const entries = fs.readdirSync(this._templatesDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile()) continue;
            if (path.extname(entry.name) !== '.js') continue;
            if (entry.name === 'index.js') continue;

            const fullPath = path.join(this._templatesDir, entry.name);
            const name     = path.basename(entry.name, '.js').toLowerCase();

            try {
                const mod = require(fullPath);
                templates.set(name, mod);
            } catch (err) {
                console.error(`[Loader] Failed to load template "${name}":`, err.message);
            }
        }

        return templates;
    }


    _scanDir(dir, exts) {
        const map = new Map();
        if (!this._dirExists(dir)) return map;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!exts.has(ext)) continue;

            const name     = path.basename(entry.name, ext).toLowerCase();
            const fullPath = path.join(dir, entry.name);
            map.set(name, fullPath);
        }

        return map;
    }

    _dirExists(dir) {
        try {
            return fs.statSync(dir).isDirectory();
        } catch {
            return false;
        }
    }
}

module.exports = Loader;
