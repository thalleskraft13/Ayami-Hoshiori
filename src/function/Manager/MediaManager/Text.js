'use strict';





class Text {
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

        const lines = maxWidth
            ? Text._wrapText(ctx, text, maxWidth)
            : [text];

        const visibleLines = maxLines && lines.length > maxLines
            ? [...lines.slice(0, maxLines - 1), Text._truncate(ctx, lines[maxLines - 1], maxWidth ?? Infinity)]
            : lines;

        ctx.save();

        if (shadow) {
            ctx.shadowColor   = shadow.color   ?? 'rgba(0,0,0,0.6)';
            ctx.shadowBlur    = shadow.blur    ?? 4;
            ctx.shadowOffsetX = shadow.offsetX ?? 2;
            ctx.shadowOffsetY = shadow.offsetY ?? 2;
        }

        let maxMeasuredWidth = 0;

        for (let i = 0; i < visibleLines.length; i++) {
            const lineY  = y + i * lineH;
            const line   = visibleLines[i];
            const lineW  = ctx.measureText(line).width;
            if (lineW > maxMeasuredWidth) maxMeasuredWidth = lineW;

            const fillStyle = gradient
                ? Text._makeGradient(ctx, gradient, x, lineY, lineW, lineH)
                : color;

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

    static _truncate(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;

        let truncated = text;
        while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '…';
    }


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


    static _extractFontSize(font) {
        const match = font.match(/(\d+(\.\d+)?)(px|pt|em|rem)/);
        return match ? parseFloat(match[1]) : 24;
    }

    static _replaceFontSize(font, newSize) {
        return font.replace(/(\d+(\.\d+)?)(px|pt|em|rem)/, `${newSize}$3`);
    }
}

module.exports = Text;
