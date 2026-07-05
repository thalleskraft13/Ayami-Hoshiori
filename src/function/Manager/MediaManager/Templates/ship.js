'use strict';

const BaseImage = require('../BaseImage');
const Canvas    = require('../Canvas');
const Effects   = require('../Effects');
const Text      = require('../Text');

/**
 * Ship template — compatibilidade entre dois usuários.
 * Design: dark romantic, rosa/roxo, partículas de coração, barra de progresso.
 *
 * @example
 * const buffer = await MediaManager.Render({
 *     Template:      'ship',
 *     avatarUrl1:    '…',
 *     avatarUrl2:    '…',
 *     username1:     'João',
 *     username2:     'Maria',
 *     porcentagem:   85,
 * });
 */
class ShipTemplate extends BaseImage {

    static get templateName() { return 'ship'; }
    static get description()  { return 'Compatibilidade romântica entre dois usuários'; }

    async render(data, context) {
        const { canvas: canvasModule } = context;
        const {
            avatarUrl1,    avatarUrl2,
            avatarBuffer1, avatarBuffer2,
            username1 = 'Usuário 1',
            username2 = 'Usuário 2',
            porcentagem,
        } = data;

        const W = 700;
        const H = 280;
        const { canvas, ctx } = Canvas.create(canvasModule, W, H);

        const pct = porcentagem ?? Math.floor(Math.random() * 101);

        // ── 1. Fundo ──────────────────────────────────────────────────────
        this._drawBackground(ctx, W, H);

        // ── 2. Partículas decorativas ─────────────────────────────────────
        this._drawParticles(ctx, W, H);

        // ── 3. Linha de conexão ───────────────────────────────────────────
        this._drawConnectionLine(ctx, W, H);

        // ── 4. Avatares ───────────────────────────────────────────────────
        const AVATAR_SIZE = 130;
        const avatarY     = (H - AVATAR_SIZE) / 2 - 15;

        const img1 = await this._resolveImage(context, avatarUrl1, avatarBuffer1, AVATAR_SIZE);
        const img2 = await this._resolveImage(context, avatarUrl2, avatarBuffer2, AVATAR_SIZE);

        this._drawAvatar(ctx, img1, 40, avatarY, AVATAR_SIZE, pct);
        this._drawAvatar(ctx, img2, W - 40 - AVATAR_SIZE, avatarY, AVATAR_SIZE, pct);

        // ── 5. Coração central ────────────────────────────────────────────
        this._drawHeart(ctx, W / 2, H / 2 - 28, 36, pct);

        // ── 6. Barra de progresso ─────────────────────────────────────────
        this._drawProgressBar(ctx, W, H, pct);

        // ── 7. Porcentagem ────────────────────────────────────────────────
        Text.draw(ctx, {
            text:   `${pct}%`,
            x:      W / 2,
            y:      H / 2 + 30,
            font:   'bold 22px Arial',
            color:  this._pctColor(pct),
            align:  'center',
            shadow: { color: 'rgba(0,0,0,0.8)', blur: 8, offsetX: 0, offsetY: 0 },
        });

        // ── 8. Mensagem ───────────────────────────────────────────────────
        Text.draw(ctx, {
            text:  this._message(pct),
            x:     W / 2,
            y:     H / 2 + 56,
            font:  '13px Arial',
            color: 'rgba(255,255,255,0.55)',
            align: 'center',
        });

        // ── 9. Nomes ──────────────────────────────────────────────────────
        const nameY = avatarY + AVATAR_SIZE + 14;

        Text.draw(ctx, {
            text:       username1,
            x:          40 + AVATAR_SIZE / 2,
            y:          nameY,
            font:       'bold 15px Arial',
            color:      '#ffffff',
            align:      'center',
            maxWidth:   AVATAR_SIZE + 20,
            autoShrink: true,
            minFontSize: 10,
            shadow:     { color: 'rgba(0,0,0,0.9)', blur: 6, offsetX: 0, offsetY: 0 },
        });

        Text.draw(ctx, {
            text:       username2,
            x:          W - 40 - AVATAR_SIZE / 2,
            y:          nameY,
            font:       'bold 15px Arial',
            color:      '#ffffff',
            align:      'center',
            maxWidth:   AVATAR_SIZE + 20,
            autoShrink: true,
            minFontSize: 10,
            shadow:     { color: 'rgba(0,0,0,0.9)', blur: 6, offsetX: 0, offsetY: 0 },
        });

        return Canvas.toBuffer(canvas);
    }

    // ─── Métodos de desenho ───────────────────────────────────────────────────

    _drawBackground(ctx, W, H) {
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0,    '#0d0015');
        grad.addColorStop(0.35, '#1a0030');
        grad.addColorStop(0.65, '#200020');
        grad.addColorStop(1,    '#0d0015');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Brilho central suave
        const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 200);
        glow.addColorStop(0,   'rgba(180,0,120,0.18)');
        glow.addColorStop(0.5, 'rgba(120,0,180,0.08)');
        glow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Borda interna
        ctx.strokeStyle = 'rgba(255,100,200,0.12)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(6, 6, W - 12, H - 12);
    }

    _drawParticles(ctx, W, H) {
        const pontos = [
            [60,30],[120,55],[200,20],[320,15],[420,25],
            [540,40],[630,20],[680,60],[50,220],[150,240],
            [280,255],[450,250],[580,235],[660,245],
        ];

        ctx.save();
        for (const [x, y] of pontos) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,180,220,0.5)';
            ctx.fill();
        }

        ctx.font      = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,120,180,0.25)';
        for (const [x, y] of [[90,80],[590,70],[340,240],[180,200],[500,220]]) {
            ctx.fillText('♥', x, y);
        }
        ctx.restore();
    }

    _drawConnectionLine(ctx, W, H) {
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.lineWidth   = 1;
        ctx.strokeStyle = 'rgba(255,100,180,0.25)';
        ctx.beginPath();
        ctx.moveTo(185, H / 2 - 10);
        ctx.lineTo(W - 185, H / 2 - 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    _drawAvatar(ctx, img, x, y, size, pct) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r  = size / 2;

        // Anel externo colorido
        const ringGrad = ctx.createLinearGradient(x, y, x + size, y + size);
        ringGrad.addColorStop(0, this._pctColor(pct));
        ringGrad.addColorStop(1, 'rgba(255,255,255,0.2)');
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = ringGrad;
        ctx.lineWidth   = 3;
        ctx.stroke();
        ctx.restore();

        // Glow atrás do avatar
        ctx.save();
        Effects.glow(ctx, this._pctColor(pct), 18);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fill();
        Effects.clearShadow(ctx);
        ctx.restore();

        // Clip circular + imagem
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        if (img) {
            ctx.drawImage(img, x, y, size, size);
        } else {
            const ph = ctx.createLinearGradient(x, y, x + size, y + size);
            ph.addColorStop(0, '#3a0050');
            ph.addColorStop(1, '#600030');
            ctx.fillStyle = ph;
            ctx.fillRect(x, y, size, size);
            ctx.font         = `${size * 0.4}px sans-serif`;
            ctx.fillStyle    = 'rgba(255,255,255,0.3)';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', cx, cy);
        }
        ctx.restore();
    }

    _drawHeart(ctx, cx, cy, size, pct) {
        ctx.save();
        Effects.glow(ctx, this._pctColor(pct), 20);

        ctx.beginPath();
        ctx.moveTo(cx, cy + size * 0.3);
        ctx.bezierCurveTo(cx - size*1.2, cy - size*0.6, cx - size*2, cy + size*0.6, cx, cy + size*1.4);
        ctx.bezierCurveTo(cx + size*2,   cy + size*0.6, cx + size*1.2, cy - size*0.6, cx, cy + size*0.3);

        const hg = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
        hg.addColorStop(0, '#ff80c0');
        hg.addColorStop(1, this._pctColor(pct));
        ctx.fillStyle = hg;
        ctx.fill();

        Effects.clearShadow(ctx);
        ctx.restore();
    }

    _drawProgressBar(ctx, W, H, pct) {
        const barW = 260;
        const barH = 8;
        const barX = (W - barW) / 2;
        const barY = H / 2 + 16;
        const barR = barH / 2;

        // Fundo
        Canvas.fillRoundRect(ctx, barX, barY, barW, barH, barR, 'rgba(255,255,255,0.08)');

        // Fill colorido
        const fillW    = Math.max(barR * 2, (pct / 100) * barW);
        const fillGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        fillGrad.addColorStop(0, '#ff4da6');
        fillGrad.addColorStop(1, this._pctColor(pct));

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(barX + barR, barY);
        ctx.lineTo(barX + fillW - barR, barY);
        ctx.quadraticCurveTo(barX + fillW, barY,        barX + fillW, barY + barR);
        ctx.quadraticCurveTo(barX + fillW, barY + barH, barX + fillW - barR, barY + barH);
        ctx.lineTo(barX + barR, barY + barH);
        ctx.quadraticCurveTo(barX, barY + barH, barX, barY + barR);
        ctx.quadraticCurveTo(barX, barY,        barX + barR, barY);
        ctx.closePath();
        ctx.fillStyle = fillGrad;
        ctx.fill();
        ctx.restore();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    async _resolveImage(context, url, buffer, size) {
        if (buffer) return context.loadImage(buffer);
        if (url)    return this.loadAvatar(context, url, size);
        return null;
    }

    _pctColor(pct) {
        if (pct >= 90) return '#ff3399';
        if (pct >= 70) return '#ff69b4';
        if (pct >= 50) return '#ff99cc';
        if (pct >= 30) return '#cc99ff';
        return '#9999cc';
    }

    _message(pct) {
        if (pct >= 95) return '💞 Almas gêmeas — feitos um para o outro!';
        if (pct >= 80) return '💕 Combinação incrível!';
        if (pct >= 60) return '💗 Boa combinação, vale a pena tentar!';
        if (pct >= 40) return '💛 Amizade forte, quem sabe um dia...';
        if (pct >= 20) return '🤍 Opostos às vezes se atraem...';
        return '💔 Talvez seja melhor só amizade.';
    }
}

module.exports = ShipTemplate;
