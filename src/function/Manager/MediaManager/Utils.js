'use strict';

const path = require('path');

/**
 * General-purpose utility helpers for MediaManager.
 */
class Utils {

    /**
     * Convert degrees to radians.
     *
     * @param {number} deg
     * @returns {number}
     */
    static deg2rad(deg) {
        return (deg * Math.PI) / 180;
    }

    /**
     * Clamp a value between min and max.
     *
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    /**
     * Linear interpolation.
     *
     * @param {number} a
     * @param {number} b
     * @param {number} t - 0..1
     * @returns {number}
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Parse a hex color string into { r, g, b, a }.
     *
     * @param {string} hex - e.g. '#FF5733' or '#FF573380'
     * @returns {{ r: number, g: number, b: number, a: number }}
     */
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

    /**
     * Convert r,g,b,a to a CSS rgba() string.
     *
     * @param {number} r @param {number} g @param {number} b @param {number} [a=1]
     * @returns {string}
     */
    static rgba(r, g, b, a = 1) {
        return `rgba(${r},${g},${b},${a})`;
    }

    /**
     * Safely determine the MIME type from a file path or URL.
     *
     * @param {string} filePath
     * @returns {string}
     */
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

    /**
     * Generate a cache-buster string based on current timestamp.
     *
     * @returns {string}
     */
    static cacheBust() {
        return Date.now().toString(36);
    }

    /**
     * Format a number with thousands separators.
     *
     * @param {number} n
     * @returns {string}
     */
    static formatNumber(n) {
        return n.toLocaleString('en-US');
    }

    /**
     * Abbreviate large numbers (1200 → '1.2K', 1500000 → '1.5M').
     *
     * @param {number} n
     * @returns {string}
     */
    static abbreviateNumber(n) {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
        return String(n);
    }

    /**
     * Measure elapsed time. Returns a function that, when called,
     * returns elapsed ms since `timer` was called.
     *
     * @returns {() => number}
     */
    static timer() {
        const start = Date.now();
        return () => Date.now() - start;
    }

    /**
     * Sleep for a given number of milliseconds.
     *
     * @param {number} ms
     * @returns {Promise<void>}
     */
    static sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = Utils;
