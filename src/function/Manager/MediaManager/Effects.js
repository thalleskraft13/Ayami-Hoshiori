'use strict';

class Effects {


    static blur(ctx, radius) {
        ctx.filter = `blur(${radius}px)`;
    }

    static grayscale(ctx, amount = 1) {
        ctx.filter = `grayscale(${amount * 100}%)`;
    }

    static brightness(ctx, amount) {
        ctx.filter = `brightness(${amount * 100}%)`;
    }

    static saturation(ctx, amount) {
        ctx.filter = `saturate(${amount * 100}%)`;
    }

    static resetFilter(ctx) {
        ctx.filter = 'none';
    }


    static shadow(ctx, opts = {}) {
        ctx.shadowColor   = opts.color   ?? 'rgba(0,0,0,0.5)';
        ctx.shadowBlur    = opts.blur    ?? 10;
        ctx.shadowOffsetX = opts.offsetX ?? 0;
        ctx.shadowOffsetY = opts.offsetY ?? 4;
    }

    static glow(ctx, color, blur = 15) {
        ctx.shadowColor   = color;
        ctx.shadowBlur    = blur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    static clearShadow(ctx) {
        ctx.shadowColor   = 'transparent';
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }


    static opacity(ctx, value) {
        ctx.globalAlpha = Math.min(1, Math.max(0, value));
    }

    static resetOpacity(ctx) {
        ctx.globalAlpha = 1;
    }


    static tint(ctx, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }


    static clipCircle(ctx, cx, cy, r) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
    }

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


    static flipH(ctx, w) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
    }

    static flipV(ctx, h) {
        ctx.save();
        ctx.translate(0, h);
        ctx.scale(1, -1);
    }

    static rotate(ctx, px, py, angle) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.translate(-px, -py);
    }


    static applyMask(ctx, maskImage, x, y, w, h) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskImage, x, y, w, h);
        ctx.restore();
    }

static chromaKey(ctx, w, h, opts = {}) {
    const threshold = opts.threshold ?? 80;
    const smooth    = opts.smooth    ?? true;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data      = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

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
