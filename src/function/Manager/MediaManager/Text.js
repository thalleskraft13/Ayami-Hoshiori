'use strict';

/**
 * @typedef {Object} TextOptions
 * @property {string}        text           - The string to draw.
 * @property {number}        x              - Left position.
 * @property {number}        y              - Top position (baseline by default).
 * @property {string}        [font]         - CSS font string e.g. 'bold 32px Roboto'.
 * @property {string}        [color]        - Fill color. Default: '#FFFFFF'.
 * @property {string}        [align]        - 'left' | 'center' | 'right'. Default: 'left'.
 * @property {string}        [baseline]     - Canvas textBaseline. Default: 'top'.
 * @property {number}        [maxWidth]     - Max pixel width. Triggers word-wrap / shrink.
 * @property {number}        [lineHeight]   - Pixels between lines. Default: fontSize * 1.2.
 * @property {number}        [maxLines]     - Clamp to N lines, appending '…'.
 * @property {boolean}       [autoShrink]   - Reduce font size until text fits maxWidth.
 * @property {number}        [minFontSize]  - Floor for autoShrink. Default: 8.
 * @property {OutlineOpts}   [outline]
 * @property {ShadowOpts}    [shadow]
 * @property {GradientOpts}  [gradient]
 */

/**
 * @typedef {Object} OutlineOpts
 * @property {string} color  - Stroke color.
 * @property {number} width  - Stroke width in px.
 */

/**
 * @typedef {Object} ShadowOpts
 * @property {string} color   - Shadow color.
 * @property {number} blur    - Blur radius.
 * @property {number} offsetX
 * @property {number} offsetY
 */

/**
 * @typedef {Object} GradientOpts
 * @property {'linear'|'radial'} type
 * @property {Array<{stop: number, color: string}>} stops
 * @property {number} [x0] @property {number} [y0]
 * @property {number} [x1] @property {number} [y1]
 */

/**
 * Text rendering engine for Canvas2D contexts.
 *
 * Supports word-wrap, alignment, outline, drop shadow,
 * linear/radial gradient fills, auto-shrink, and max-line clamping.
 */
class Text {
    /**
     * Draw text onto a canvas context.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {TextOptions}              options
     * @returns {{ width: number, height: number }} Bounding box of the rendered text.
     */
    static draw(ctx, options) {
        const {
            text,
            x,
            y,
            color      = '#FFFFFF',
            align      = 'left',
            baseline   = 'top',
            maxWidth,
            lineHeight : explicitLineHeight,
            maxLines,
            autoShrink = false,
            minFontSize = 8,
            outline,
            shadow,
            gradient,
        } = options;

        // ── Resolve font ──────────────────────────────────────────────────────
        let font     = options.font ?? '24px sans-serif';
        let fontSize = Text._extractFontSize(font);

        if (autoShrink && maxWidth) {
            while (fontSize > minFontSize) {
                ctx.font = font;
                const measured = ctx.measureText(text).width;
                if (measured <= maxWidth) break;
                fontSize -= 1;
                font = Text._replaceFontSize(font, fontSize);
            }
        }

        ctx.font         = font;
        ctx.textAlign    = align;
        ctx.textBaseline = baseline;

        const lineH = explicitLineHeight ?? fontSize * 1.2;

        // ── Word-wrap ─────────────────────────────────────────────────────────
        const lines = maxWidth
            ? Text._wrapText(ctx, text, maxWidth)
            : [text];

        // Clamp lines
        const visibleLines = maxLines && lines.length > maxLines
            ? [...lines.slice(0, maxLines - 1), Text._truncate(ctx, lines[maxLines - 1], maxWidth ?? Infinity)]
            : lines;

        // ── Save context ──────────────────────────────────────────────────────
        ctx.save();

        // ── Shadow ────────────────────────────────────────────────────────────
        if (shadow) {
            ctx.shadowColor   = shadow.color   ?? 'rgba(0,0,0,0.6)';
            ctx.shadowBlur    = shadow.blur    ?? 4;
            ctx.shadowOffsetX = shadow.offsetX ?? 2;
            ctx.shadowOffsetY = shadow.offsetY ?? 2;
        }

        // ── Draw lines ────────────────────────────────────────────────────────
        let maxMeasuredWidth = 0;

        for (let i = 0; i < visibleLines.length; i++) {
            const lineY  = y + i * lineH;
            const line   = visibleLines[i];
            const lineW  = ctx.measureText(line).width;
            if (lineW > maxMeasuredWidth) maxMeasuredWidth = lineW;

            // Gradient fill (per line, anchored to x/y)
            const fillStyle = gradient
                ? Text._makeGradient(ctx, gradient, x, lineY, lineW, lineH)
                : color;

            // Outline
            if (outline) {
                ctx.strokeStyle = outline.color ?? '#000000';
                ctx.lineWidth   = outline.width ?? 3;
                ctx.lineJoin    = 'round';
                ctx.strokeText(line, x, lineY);
            }

            ctx.fillStyle = fillStyle;
            ctx.fillText(line, x, lineY);
        }

        ctx.restore();

        return {
            width:  maxMeasuredWidth,
            height: visibleLines.length * lineH,
        };
    }

    // ─── Word-wrap ────────────────────────────────────────────────────────────

    /**
     * Wrap text to fit within maxWidth, breaking on spaces.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} maxWidth
     * @returns {string[]}
     */
    static _wrapText(ctx, text, maxWidth) {
        const words  = text.split(' ');
        const lines  = [];
        let current  = '';

        for (const word of words) {
            const test = current ? `${current} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        }

        if (current) lines.push(current);
        return lines;
    }

    /**
     * Truncate a single line to fit maxWidth, appending '…'.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} maxWidth
     * @returns {string}
     */
    static _truncate(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;

        let truncated = text;
        while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '…';
    }

    // ─── Gradient ─────────────────────────────────────────────────────────────

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {GradientOpts}             opts
     * @param {number} x @param {number} y @param {number} w @param {number} h
     * @returns {CanvasGradient}
     */
    static _makeGradient(ctx, opts, x, y, w, h) {
        let grad;

        if (opts.type === 'radial') {
            grad = ctx.createRadialGradient(
                opts.x0 ?? x + w / 2, opts.y0 ?? y + h / 2, 0,
                opts.x1 ?? x + w / 2, opts.y1 ?? y + h / 2, w / 2
            );
        } else {
            grad = ctx.createLinearGradient(
                opts.x0 ?? x, opts.y0 ?? y,
                opts.x1 ?? x + w, opts.y1 ?? y
            );
        }

        for (const { stop, color } of opts.stops ?? []) {
            grad.addColorStop(stop, color);
        }

        return grad;
    }

    // ─── Font helpers ─────────────────────────────────────────────────────────

    /** Extract numeric font size from a CSS font string. */
    static _extractFontSize(font) {
        const match = font.match(/(\d+(\.\d+)?)(px|pt|em|rem)/);
        return match ? parseFloat(match[1]) : 24;
    }

    /** Replace the numeric size in a CSS font string. */
    static _replaceFontSize(font, newSize) {
        return font.replace(/(\d+(\.\d+)?)(px|pt|em|rem)/, `${newSize}$3`);
    }
}

module.exports = Text;
