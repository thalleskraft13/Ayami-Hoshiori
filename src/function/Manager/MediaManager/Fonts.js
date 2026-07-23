'use strict';

const fs   = require('fs');
const path = require('path');


class Fonts {
    constructor() {
        this._fonts = new Map();
        this._registered = false;
    }


    registerAll(fontMap, canvas) {
        for (const [, filePath] of fontMap) {
            this._registerOne(filePath, canvas);
        }
        this._registered = true;
    }

    register(filePath, canvas) {
        this._registerOne(filePath, canvas);
    }

    get(family) {
        return this._fonts.get(family.toLowerCase());
    }

    list() {
        return [...this._fonts.keys()];
    }

    isReady() {
        return this._registered;
    }


    _registerOne(filePath, canvas) {
        if (!fs.existsSync(filePath)) return;

        const record = this._parse(filePath);
        const key    = record.family.toLowerCase();

        if (this._fonts.has(key)) return;

        this._fonts.set(key, record);

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
