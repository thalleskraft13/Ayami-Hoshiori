'use strict';

const path      = require('path');
const BaseVideo = require('../BaseVideo');
const FFmpeg    = require('../FFmpeg');
const { chromaKeyGreen } = require('../chromaKeyVideo');


const DEBUG = false;

class HomerLanderTemplate extends BaseVideo {

    static get templateName() { return 'homerlander'; }
    static get description()  { return 'HomerLand — avatar na tela'; }

    static get meta() {
        return { fps: 20, width: 736, height: 414, duration: 20.7, format: 'mp4' };
    }

    async renderFrame(frameIndex, totalFrames, data, context) {
        const { canvas: canvasModule, loadImage } = context;
        const { avatarUrl1, avatarBuffer } = data;

    
        if (!this._baseFramesDir) {
            const videoPath = context.assets.videos.get('homelander');
            if (!videoPath) throw new Error('[HomerLander] Asset "HomerLander" não encontrado em videos/.');
            this._baseFramesDir = await FFmpeg.extractFramesToDir(videoPath, 20);
            this.constructor._audioSourcePath = videoPath;
        }

        if (!this._avatarImg && (avatarUrl1 || avatarBuffer)) {
            this._avatarImg = avatarBuffer
                ? await loadImage(avatarBuffer)
                : await loadImage(await context.avatar.fetch(avatarUrl1, 512));
        }

        const W = HomerLanderTemplate.meta.width;
        const H = HomerLanderTemplate.meta.height;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        const slot = _getSlot(frameIndex);

        if (this._avatarImg && slot) {
            const coords = _calcCoords(slot);
            _drawPerspective(ctx, canvasModule, this._avatarImg, coords);

            if (DEBUG) _drawDebug(ctx, coords, slot, frameIndex);
        }

        const { dir, files } = this._baseFramesDir;
        const baseFramePath  = path.join(dir, files[frameIndex % files.length]);
        const baseFrame      = await loadImage(baseFramePath);
        const bgCanvas  = canvasModule.createCanvas(W, H);
        const bgCtx     = bgCanvas.getContext('2d');
        bgCtx.drawImage(baseFrame, 0, 0, W, H);
        chromaKeyGreen(bgCtx, W, H, 160, false);
        ctx.drawImage(bgCanvas, 0, 0);
        _freeCanvas(bgCanvas); 

        if (DEBUG && slot) {
            _drawDebugOver(ctx, _calcCoords(slot), slot, frameIndex);
            console.log("FRAME RENDERIZADA: " + frameIndex)
        }

        const buffer = canvas.toBuffer('image/png');
        _freeCanvas(canvas); 
        return buffer;
    }

    dispose() {
        FFmpeg.cleanupFrameDir(this._baseFramesDir?.dir);
        this._baseFramesDir = null;
        this._avatarImg = null;
    }
}


function _getSlot(frameIndex) {

    
    if (frameIndex > 46 && frameIndex < 107) return {
        x: 360, y: 7,   // posição do canto sup esquerdo
        w: 210, h: 215,  // largura e altura
        skewX: -0.15,    // inclinação horizontal
        skewY:  0.02,    // inclinação vertical
    };
    if (frameIndex > 106 && frameIndex < 140) return {
        x: 300, y: 10,  
        w: 400, h: 350, 
        skewX: -0.15, 
        skewY:  0.02,    
    };
     if (frameIndex > 283 && frameIndex < 367) return {
        x: 0, y: 0,   
        w: 800, h: 550, 
        skewX: -0.15,    
        skewY:  0.02,
    };

   

    return null;
}


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

    _freeCanvas(tmp);
}

function _freeCanvas(canvas) {
    if (!canvas) return;
    try { canvas.width = 0; canvas.height = 0; } catch {}
}


function _drawDebug(ctx, { topoEsq, topDir, baixEsq }, slot, frameIndex) {
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

        ctx.beginPath(); ctx.moveTo(p.x - 8, p.y); ctx.lineTo(p.x + 8, p.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8); ctx.stroke();

        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = cor; ctx.fill();

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

module.exports = HomerLanderTemplate;