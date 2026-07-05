'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * @typedef {Object} AssetMap
 * @property {Map<string, string>} backgrounds - name → absolute file path
 * @property {Map<string, string>} overlays
 * @property {Map<string, string>} masks
 * @property {Map<string, string>} icons
 * @property {Map<string, string>} fonts       - name → absolute file path
 * @property {Map<string, string>} templates   - name → absolute file path (raw files)
 */

/** Supported image extensions for auto-discovery. */
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

/** Supported font extensions. */
const FONT_EXTS  = new Set(['.ttf', '.otf', '.woff', '.woff2']);

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

/**
 * Scans the `public/media` directory tree and the Templates folder,
 * building maps of every available asset and template module.
 */
class Loader {
    /**
     * @param {object} options
     * @param {string} options.publicDir    - Absolute path to `public/media`.
     * @param {string} options.templatesDir - Absolute path to the Templates folder.
     */
    constructor({ publicDir, templatesDir }) {
        this._publicDir    = publicDir;
        this._templatesDir = templatesDir;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Discover all assets and return an AssetMap.
     * Each sub-map uses the file's base name (without extension) as key.
     *
     * @returns {AssetMap}
     */
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

    /**
     * Discover all template modules inside the Templates directory.
     * Only `.js` files are considered; index.js is ignored.
     *
     * @returns {Map<string, object>} Template name (lowercased filename) → exported module.
     */
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

    // ─── Private ──────────────────────────────────────────────────────────────

    /**
     * Scan a directory for files matching the given extensions.
     *
     * @param {string}   dir
     * @param {Set<string>} exts
     * @returns {Map<string, string>}
     */
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

    /** @param {string} dir */
    _dirExists(dir) {
        try {
            return fs.statSync(dir).isDirectory();
        } catch {
            return false;
        }
    }
}

module.exports = Loader;
