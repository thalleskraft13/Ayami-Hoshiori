'use strict';

/**
 * Remove pixels verdes de um canvas (chroma key).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {number} [threshold=80]
 * @param {boolean} [smooth=true] - true = bordas suaves (semi-transparência),
 *                                   false = corte definitivo (sem mistura).
 */
function chromaKeyGreen(ctx, w, h, threshold = 80, smooth = true) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data       = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const isGreen = g > 80 && g > r * 1.15 && g > b * 1.15;

        if (isGreen) {
            const diff = g - Math.max(r, b);

            if (diff > threshold) {
                if (smooth) {
                    data[i + 3] = Math.max(0, Math.round((1 - diff / 255) * 255));
                } else {
                    data[i + 3] = 0;
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

module.exports = { chromaKeyGreen };
