'use strict';

const path = require('path');

class Utils {

    static deg2rad(deg) {
        return (deg * Math.PI) / 180;
    }

    static clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    static hexToRgba(hex) {
        const clean = hex.replace('#', '');
        const full  = clean.length === 3
            ? clean.split('').map((c) => c + c).join('')
            : clean;

        return {
            r: parseInt(full.slice(0, 2), 16),
            g: parseInt(full.slice(2, 4), 16),
            b: parseInt(full.slice(4, 6), 16),
            a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
        };
    }

    static rgba(r, g, b, a = 1) {
        return `rgba(${r},${g},${b},${a})`;
    }

    static mimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const map = {
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif':  'image/gif',
            '.webp': 'image/webp',
            '.svg':  'image/svg+xml',
            '.mp4':  'video/mp4',
            '.webm': 'video/webm',
        };
        return map[ext] ?? 'application/octet-stream';
    }

    static cacheBust() {
        return Date.now().toString(36);
    }

    static formatNumber(n) {
        return n.toLocaleString('en-US');
    }

    static abbreviateNumber(n) {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
        return String(n);
    }

    static timer() {
        const start = Date.now();
        return () => Date.now() - start;
    }

    static sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = Utils;
