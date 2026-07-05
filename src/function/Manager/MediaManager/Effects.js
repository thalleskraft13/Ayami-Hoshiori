'use strict';

/**
 * Collection of reusable Canvas2D visual effects.
 * Every method operates on an existing context or canvas
 * and returns nothing (modifies in place) unless stated otherwise.
 */
class Effects {

    // ─── Filters (applied to the entire canvas) ───────────────────────────────

    /**
     * Apply a Gaussian blur using the CSS filter API.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} radius - Blur radius in pixels.
     */
    static blur(ctx, radius) {
        ctx.filter = `blur(${radius}px)`;
    }

    /**
     * Convert canvas to greyscale via filter.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} [amount=1] - 0 = original, 1 = fully greyscale.
     */
    static grayscale(ctx, amount = 1) {
        ctx.filter = `grayscale(${amount * 100}%)`;
    }

    /**
     * Adjust brightness.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} amount - 0 = black, 1 = normal, 2 = double brightness.
     */
    static brightness(ctx, amount) {
        ctx.filter = `brightness(${amount * 100}%)`;
    }

    /**
     * Adjust saturation.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} amount - 0 = greyscale, 1 = normal, 2 = double saturated.
     */
    static saturation(ctx, amount) {
        ctx.filter = `saturate(${amount * 100}%)`;
    }

    /**
     * Clear all CSS filters.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    static resetFilter(ctx) {
        ctx.filter = 'none';
    }

    // ─── Shadow / Glow ───────────────────────────────────────────────────────

    /**
     * Set up a drop shadow before drawing an element.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} [opts]
     * @param {string} [opts.color='rgba(0,0,0,0.5)']
     * @param {number} [opts.blur=10]
     * @param {number} [opts.offsetX=0]
     * @param {number} [opts.offsetY=4]
     */
    static shadow(ctx, opts = {}) {
        ctx.shadowColor   = opts.color   ?? 'rgba(0,0,0,0.5)';
        ctx.shadowBlur    = opts.blur    ?? 10;
        ctx.shadowOffsetX = opts.offsetX ?? 0;
        ctx.shadowOffsetY = opts.offsetY ?? 4;
    }

    /**
     * Glow effect — a coloured shadow with zero offset.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} color
     * @param {number} [blur=15]
     */
    static glow(ctx, color, blur = 15) {
        ctx.shadowColor   = color;
        ctx.shadowBlur    = blur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    /** Clear shadow settings. */
    static clearShadow(ctx) {
        ctx.shadowColor   = 'transparent';
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // ─── Opacity ─────────────────────────────────────────────────────────────

    /**
     * Set the global opacity for subsequent draw calls.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} value - 0.0 (transparent) to 1.0 (opaque).
     */
    static opacity(ctx, value) {
        ctx.globalAlpha = Math.min(1, Math.max(0, value));
    }

    /** Reset opacity to fully opaque. */
    static resetOpacity(ctx) {
        ctx.globalAlpha = 1;
    }

    // ─── Color Overlay / Tint ────────────────────────────────────────────────

    /**
     * Paint a semi-transparent colour tint over the entire canvas area.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} w
     * @param {number} h
     * @param {string} color   - e.g. 'rgba(255,0,0,0.3)'
     */
    static tint(ctx, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    // ─── Shape Clipping ──────────────────────────────────────────────────────

    /**
     * Clip subsequent drawing to a circle centred at (cx, cy) with radius r.
     * Call `ctx.restore()` to remove the clip.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx
     * @param {number} cy
     * @param {number} r
     */
    static clipCircle(ctx, cx, cy, r) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
    }

    /**
     * Clip subsequent drawing to a rounded rectangle.
     * Call `ctx.restore()` to remove the clip.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} [radius=12]
     */
    static clipRoundRect(ctx, x, y, w, h, radius = 12) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y,         x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h,     x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x,     y + h,     x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x,     y,         x + radius, y);
        ctx.closePath();
        ctx.clip();
    }

    // ─── Transformations ─────────────────────────────────────────────────────

    /**
     * Flip an image horizontally before drawing it, then restore.
     * Wrap your `ctx.drawImage` call between `flipH` and `ctx.restore()`.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} w - Canvas or element width, for translation.
     */
    static flipH(ctx, w) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
    }

    /**
     * Flip vertically.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} h
     */
    static flipV(ctx, h) {
        ctx.save();
        ctx.translate(0, h);
        ctx.scale(1, -1);
    }

    /**
     * Rotate around a point (px, py) by `angle` radians.
     * Wrap your draw call between `rotate` and `ctx.restore()`.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} px
     * @param {number} py
     * @param {number} angle - Radians.
     */
    static rotate(ctx, px, py, angle) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.translate(-px, -py);
    }

    // ─── Mask ────────────────────────────────────────────────────────────────

    /**
     * Apply a mask image to a canvas using `destination-in` compositing.
     * The mask should be a greyscale image where white = fully visible.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {CanvasImageSource}        maskImage
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    static applyMask(ctx, maskImage, x, y, w, h) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskImage, x, y, w, h);
        ctx.restore();
    }

    /**
 * Remove uma cor de fundo (chroma key) de um canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {object} [opts]
 * @param {number[]} [opts.color=[0, 255, 0]]  - Cor a remover [R, G, B].
 * @param {number}   [opts.threshold=80]        - Tolerância (0–255).
 * @param {boolean}  [opts.smooth=true]         - Suaviza as bordas.
 */
static chromaKey(ctx, w, h, opts = {}) {
    const threshold = opts.threshold ?? 80;
    const smooth    = opts.smooth    ?? true;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data      = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Verde dominante: g alto, r e b baixos
        const isGreen = g > 100 && r < 100 && b < 100;
        const diff    = g - Math.max(r, b);

        if (isGreen && diff > threshold) {
            if (smooth) {
                data[i + 3] = Math.round((1 - diff / 255) * 255);
            } else {
                data[i + 3] = 0;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}
}

module.exports = Effects;
