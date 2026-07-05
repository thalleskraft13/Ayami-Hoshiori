'use strict';

/**
 * Low-level Canvas2D utility functions.
 *
 * All functions accept a `canvas` module instance so they remain
 * decoupled from any specific import location.
 */
class Canvas {

    // ─── Canvas Creation ─────────────────────────────────────────────────────

    /**
     * Create a new canvas of the given dimensions.
     *
     * @param {object} canvasModule - The `canvas` npm module.
     * @param {number} width
     * @param {number} height
     * @returns {{ canvas: import('canvas').Canvas, ctx: CanvasRenderingContext2D }}
     */
    static create(canvasModule, width, height) {
        const canvas = canvasModule.createCanvas(width, height);
        const ctx    = canvas.getContext('2d');
        return { canvas, ctx };
    }

    // ─── Drawing Primitives ──────────────────────────────────────────────────

    /**
     * Draw an image onto the context, with optional destination crop.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {CanvasImageSource}        image
     * @param {number} dx  - Destination x.
     * @param {number} dy  - Destination y.
     * @param {number} [dw] - Destination width (defaults to natural size).
     * @param {number} [dh] - Destination height.
     */
    static drawImage(ctx, image, dx, dy, dw, dh) {
        if (dw !== undefined && dh !== undefined) {
            ctx.drawImage(image, dx, dy, dw, dh);
        } else {
            ctx.drawImage(image, dx, dy);
        }
    }

    /**
     * Draw a filled rectangle.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {string} color
     */
    static fillRect(ctx, x, y, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    /**
     * Draw a filled circle.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx  - Centre x.
     * @param {number} cy  - Centre y.
     * @param {number} r   - Radius.
     * @param {string} color
     */
    static fillCircle(ctx, cx, cy, r, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw a filled rounded rectangle.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} [radius=8]
     * @param {string} [color='#000000']
     */
    static fillRoundRect(ctx, x, y, w, h, radius = 8, color = '#000000') {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y,     x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h,     x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y,         x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ─── Gradients ───────────────────────────────────────────────────────────

    /**
     * Create and fill a linear gradient over a rectangular area.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x @param {number} y @param {number} w @param {number} h
     * @param {Array<{stop: number, color: string}>} stops
     * @param {'horizontal'|'vertical'|'diagonal'} [direction='vertical']
     */
    static linearGradient(ctx, x, y, w, h, stops, direction = 'vertical') {
        const [x0, y0, x1, y1] = direction === 'horizontal'
            ? [x, y, x + w, y]
            : direction === 'diagonal'
            ? [x, y, x + w, y + h]
            : [x, y, x, y + h];

        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        for (const { stop, color } of stops) grad.addColorStop(stop, color);

        ctx.save();
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    // ─── Image Transformation ────────────────────────────────────────────────

    /**
     * Resize and crop an image to fit dimensions (cover mode).
     * Returns the pixel coordinates/dimensions for drawImage source rect.
     *
     * @param {number} imgW @param {number} imgH
     * @param {number} destW @param {number} destH
     * @returns {{ sx: number, sy: number, sw: number, sh: number }}
     */
    static coverCrop(imgW, imgH, destW, destH) {
        const scaleW = destW / imgW;
        const scaleH = destH / imgH;
        const scale  = Math.max(scaleW, scaleH);

        const sw = destW / scale;
        const sh = destH / scale;
        const sx = (imgW - sw) / 2;
        const sy = (imgH - sh) / 2;

        return { sx, sy, sw, sh };
    }

    /**
     * Draw a Buffer (loaded as an image) covering a destination rectangle.
     *
     * @param {object}                  canvasModule
     * @param {CanvasRenderingContext2D} ctx
     * @param {Buffer|string}           src    - Buffer or data URL.
     * @param {number} dx @param {number} dy @param {number} dw @param {number} dh
     */
    static async drawImageCover(canvasModule, ctx, src, dx, dy, dw, dh) {
        const img   = await canvasModule.loadImage(src);
        const { sx, sy, sw, sh } = Canvas.coverCrop(img.width, img.height, dw, dh);
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    // ─── Export ──────────────────────────────────────────────────────────────

    /**
     * Export the canvas as a PNG Buffer.
     *
     * @param {import('canvas').Canvas} canvas
     * @returns {Buffer}
     */
    static toBuffer(canvas) {
        return canvas.toBuffer('image/png');
    }

    /**
     * Export the canvas as a JPEG Buffer.
     *
     * @param {import('canvas').Canvas} canvas
     * @param {number} [quality=0.9]
     * @returns {Buffer}
     */
    static toJpegBuffer(canvas, quality = 0.9) {
        return canvas.toBuffer('image/jpeg', { quality });
    }
}

module.exports = Canvas;
