'use strict';

class Canvas {


    static create(canvasModule, width, height) {
        const canvas = canvasModule.createCanvas(width, height);
        const ctx    = canvas.getContext('2d');
        return { canvas, ctx };
    }


    static drawImage(ctx, image, dx, dy, dw, dh) {
        if (dw !== undefined && dh !== undefined) {
            ctx.drawImage(image, dx, dy, dw, dh);
        } else {
            ctx.drawImage(image, dx, dy);
        }
    }

    static fillRect(ctx, x, y, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    static fillCircle(ctx, cx, cy, r, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

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

    static async drawImageCover(canvasModule, ctx, src, dx, dy, dw, dh) {
        const img   = await canvasModule.loadImage(src);
        const { sx, sy, sw, sh } = Canvas.coverCrop(img.width, img.height, dw, dh);
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }


    static toBuffer(canvas) {
        return canvas.toBuffer('image/png');
    }

    static toJpegBuffer(canvas, quality = 0.9) {
        return canvas.toBuffer('image/jpeg', { quality });
    }
}

module.exports = Canvas;
