'use strict';

const BaseVideo = require('../BaseVideo');
const FFmpeg    = require('../FFmpeg');
const { chromaKeyGreen } = require('../chromaKeyVideo');

// ── Debug: mostra marcadores de posição nos frames ────────────────────────────
const DEBUG = true;

class HenryDangerTemplate extends BaseVideo {

    static get templateName() { return 'henrydanger'; }
    static get description()  { return 'Henry Danger — avatar na tela do tablet'; }

    static get meta() {
        return { fps: 20, width: 736, height: 414, duration: 18, format: 'mp4' };
    }

    async renderFrame(frameIndex, totalFrames, data, context) {
        const { canvas: canvasModule, loadImage } = context;
        const { avatarUrl1, avatarBuffer } = data;

        if (!this._baseFrames) {
            const videoPath = context.assets.videos.get('henrydanger');
            if (!videoPath) throw new Error('[HenryDanger] Asset "henrydanger" não encontrado em videos/.');
            this._baseFrames = await FFmpeg.extractFrames(videoPath, 20);
            this.constructor._audioSourcePath = videoPath;
        }

        if (!this._avatarImg && (avatarUrl1 || avatarBuffer)) {
            this._avatarImg = avatarBuffer
                ? await loadImage(avatarBuffer)
                : await loadImage(await context.avatar.fetch(avatarUrl1, 512));
        }

        const W = HenryDangerTemplate.meta.width;
        const H = HenryDangerTemplate.meta.height;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        const slot = _getSlot(frameIndex);

        if (this._avatarImg && slot) {
            const coords = _calcCoords(slot);
            _drawPerspective(ctx, canvasModule, this._avatarImg, coords);

            if (DEBUG) _drawDebug(ctx, coords, slot, frameIndex);
        }

        // Frame base + chroma key
        const baseFrame = await loadImage(this._baseFrames[frameIndex % this._baseFrames.length]);
        const bgCanvas  = canvasModule.createCanvas(W, H);
        const bgCtx     = bgCanvas.getContext('2d');
        bgCtx.drawImage(baseFrame, 0, 0, W, H);
        chromaKeyGreen(bgCtx, W, H, 160, false);
        ctx.drawImage(bgCanvas, 0, 0);

        if (DEBUG && slot) {
            _drawDebugOver(ctx, _calcCoords(slot), slot, frameIndex);
        }

        return canvas.toBuffer('image/png');
    }
}


function _getSlot(frameIndex) {

    // ── Frame 33–39 ───────────────────────────────────────────────────────
    if (frameIndex > 31 && frameIndex < 40) return {
        x: 0, y: 0,   // posição do canto sup esquerdo
        w: 410, h: 300,  // largura e altura
        skewX: -0.15,    // inclinação horizontal
        skewY:  0.02,    // inclinação vertical
    };

    // ── Frame 40–52 ───────────────────────────────────────────────────────
    if (frameIndex > 39 && frameIndex < 50) return {
        x: 0, y: 0,
        w: 530, h: 440,
        skewX: -0.15,
        skewY:  0.02,
    };

    // ── Frame 53–55 ───────────────────────────────────────────────────────
    if (frameIndex > 49 && frameIndex < 56) return {
        x: 0, y: 0,
        w: 630, h: 520,
        skewX: -0.10,
        skewY:  0.00,
    };

    // ── Frame 56–61 ───────────────────────────────────────────────────────
    if (frameIndex > 55 && frameIndex < 62) return {
        x: 0, y: 0,
        w: 630, h: 520,
        skewX: -0.10,
        skewY:  0.00,
    };

    // ── Frame 62–77 ───────────────────────────────────────────────────────
    if (frameIndex > 61 && frameIndex < 78) return {
        x: 0, y: 0,
        w: 630, h: 525,
        skewX: -0.10,
        skewY:  0.00,
    };

    // ── Frame 189–213 ─────────────────────────────────────────────────────
    if (frameIndex > 188 && frameIndex < 214) return {
        x: 150, y: 40,
         w: 380, h: 370,
        skewX: -0.09,
        skewY:  0.00,
    };

    // ── Frame 234–242 ─────────────────────────────────────────────────────
    if (frameIndex > 233 && frameIndex < 255) return {
         x: 0, y: 0,
        w: 470, h: 380,
        skewX: -0.06,
        skewY:  0.00,
    };

    // ── Frame 255–260 ─────────────────────────────────────────────────────
    if (frameIndex > 254 && frameIndex < 261) return {
        x: 0, y: 0,
        w: 760, h: 610,
        skewX: -0.12,
        skewY:  0.00,
    };

    // ── Frame 261–275 ─────────────────────────────────────────────────────
    if (frameIndex > 260 && frameIndex < 276) return {
        x: 0, y: 0,
     w: 760, h: 610,
        skewX: -0.12,
        skewY:  0.00,
    };

    return null;
}

// ─── Calcula os 3 cantos a partir do slot ─────────────────────────────────────

function _calcCoords({ x, y, w, h, skewX, skewY }) {
    return {
        topoEsq: {
            x: x,
            y: y,
        },
        topDir: {
            x: x + w,
            y: y + w * skewX,       // skewX inclina o topo
        },
        baixEsq: {
            x: x + h * skewY,       // skewY inclina o lado esquerdo
            y: y + h,
        },
    };
}

// ─── Perspectiva ──────────────────────────────────────────────────────────────

function _drawPerspective(ctx, canvasModule, img, { topoEsq, topDir, baixEsq }) {
    const tW = topDir.x  - topoEsq.x;
    const tH = baixEsq.y - topoEsq.y;

    if (tW <= 0 || tH <= 0) return;

    const tmp    = canvasModule.createCanvas(tW, tH);
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.drawImage(img, 0, 0, tW, tH);

    const sX = (topDir.y  - topoEsq.y) / tW;
    const sY = (baixEsq.x - topoEsq.x) / tH;

    ctx.save();
    ctx.setTransform(1, sX, sY, 1, topoEsq.x, topoEsq.y);
    ctx.drawImage(tmp, 0, 0, tW, tH);
    ctx.restore();
}

// ─── Debug ────────────────────────────────────────────────────────────────────

function _drawDebug(ctx, { topoEsq, topDir, baixEsq }, slot, frameIndex) {
    // Linha do contorno
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,0,0.7)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(topoEsq.x, topoEsq.y);
    ctx.lineTo(topDir.x,  topDir.y);
    ctx.lineTo(topDir.x  + (baixEsq.x - topoEsq.x), topDir.y  + (baixEsq.y - topoEsq.y));
    ctx.lineTo(baixEsq.x, baixEsq.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

function _drawDebugOver(ctx, { topoEsq, topDir, baixEsq }, slot, frameIndex) {
    const pontos = [
        { p: topoEsq, label: 'topoEsq', cor: '#00FF00' },
        { p: topDir,  label: 'topDir',  cor: '#FF3333' },
        { p: baixEsq, label: 'baixEsq', cor: '#3399FF' },
    ];

    for (const { p, label, cor } of pontos) {
        ctx.save();
        ctx.strokeStyle = '#000';
        ctx.fillStyle   = cor;
        ctx.lineWidth   = 2;

        // Cruz
        ctx.beginPath(); ctx.moveTo(p.x - 8, p.y); ctx.lineTo(p.x + 8, p.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8); ctx.stroke();

        // Círculo
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = cor; ctx.fill();

        // Label
        ctx.font         = 'bold 11px Arial';
        ctx.fillStyle    = cor;
        ctx.strokeStyle  = '#000';
        ctx.lineWidth    = 3;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        const txt = `${label} x:${Math.round(p.x)} y:${Math.round(p.y)}`;
        ctx.strokeText(txt, p.x + 6, p.y + 2);
        ctx.fillText(txt,   p.x + 6, p.y + 2);
        ctx.restore();
    }

    // Slot info no canto
    ctx.save();
    ctx.font         = 'bold 12px Arial';
    ctx.fillStyle    = '#FFFF00';
    ctx.strokeStyle  = '#000';
    ctx.lineWidth    = 3;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    const info = `f:${frameIndex}  x:${slot.x} y:${slot.y}  w:${slot.w} h:${slot.h}  skewX:${slot.skewX} skewY:${slot.skewY}`;
    ctx.strokeText(info, 6, 6);
    ctx.fillText(info,   6, 6);
    ctx.restore();
}

module.exports = HenryDangerTemplate;