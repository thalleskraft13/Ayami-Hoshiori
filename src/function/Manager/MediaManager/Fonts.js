'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * @typedef {Object} FontRecord
 * @property {string} family  - Font family name used when drawing text.
 * @property {string} file    - Absolute path to the font file.
 * @property {string} weight  - CSS-style weight string ('normal', 'bold', '700', …).
 * @property {string} style   - 'normal' or 'italic'.
 */

/**
 * Font naming conventions (applied to the filename):
 *
 *   Roboto-Bold.ttf        → family: Roboto,  weight: bold,   style: normal
 *   Roboto-BoldItalic.ttf  → family: Roboto,  weight: bold,   style: italic
 *   Roboto-Regular.ttf     → family: Roboto,  weight: normal, style: normal
 *   OpenSans.ttf           → family: OpenSans, weight: normal, style: normal
 *
 * If `canvas` is available, fonts are registered with `canvas.registerFont`.
 */
class Fonts {
    constructor() {
        /** @type {Map<string, FontRecord>} lowercased family key → FontRecord */
        this._fonts = new Map();
        this._registered = false;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Discover and register all fonts found in the given asset map.
     *
     * @param {Map<string, string>} fontMap - name → absolute path (from Loader)
     * @param {object|null}         canvas  - The `canvas` module (or null if unavailable)
     */
    registerAll(fontMap, canvas) {
        for (const [, filePath] of fontMap) {
            this._registerOne(filePath, canvas);
        }
        this._registered = true;
    }

    /**
     * Register a single font file programmatically.
     *
     * @param {string}      filePath  - Absolute path to the font file.
     * @param {object|null} canvas    - The `canvas` module.
     */
    register(filePath, canvas) {
        this._registerOne(filePath, canvas);
    }

    /**
     * Get registered font details.
     *
     * @param {string} family - Family name (case-insensitive).
     * @returns {FontRecord|undefined}
     */
    get(family) {
        return this._fonts.get(family.toLowerCase());
    }

    /**
     * List all registered font family names.
     *
     * @returns {string[]}
     */
    list() {
        return [...this._fonts.keys()];
    }

    /**
     * Return whether at least one font has been registered.
     *
     * @returns {boolean}
     */
    isReady() {
        return this._registered;
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /**
     * @param {string}      filePath
     * @param {object|null} canvas
     */
    _registerOne(filePath, canvas) {
        if (!fs.existsSync(filePath)) return;

        const record = this._parse(filePath);
        const key    = record.family.toLowerCase();

        // Avoid re-registering the same family/style/weight combination
        if (this._fonts.has(key)) return;

        this._fonts.set(key, record);
        //console.log('Registrando:', { family: record.family, weight: record.weight, style: record.style, file: filePath });

        if (canvas?.registerFont) {
            try {
                canvas.registerFont(filePath, {
                    family: record.family,
                    weight: record.weight,
                    style:  record.style,
                });
            } catch (err) {
                console.warn(`[Fonts] Could not register "${record.family}" (${filePath}):`, err.message);
            }
        }
    }

    /**
     * Parse a font file path into a FontRecord.
     *
     * @param {string} filePath
     * @returns {FontRecord}
     */
    _parse(filePath) {
    const base  = path.basename(filePath, path.extname(filePath));
    const parts = base.split('-');

    const raw    = parts[0] ?? base;
    const family = raw.replace(/([a-z])([A-Z])/g, '$1 $2');
    const variant  = (parts[1] ?? '').toLowerCase();

    const style  = variant.includes('italic') ? 'italic' : 'normal';
    const weight = variant.includes('bold')    ? 'bold'
                 : variant.includes('thin')    ? '100'
                 : variant.includes('light')   ? '300'
                 : variant.includes('medium')  ? '500'
                 : variant.includes('semibold') ? '600'
                 : variant.includes('extrabold')? '800'
                 : variant.includes('black')   ? '900'
                 : 'normal';

    return { family, file: filePath, weight, style };
}
}

module.exports = Fonts;
