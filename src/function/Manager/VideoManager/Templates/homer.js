'use strict';

const path      = require('path');
const BaseVideo = require('../BaseVideo');
const FFmpeg     = require('../FFmpeg');
const { chromaKeyGreen } = require('../chromaKeyVideo');

class HomerTemplate extends BaseVideo {

    static get templateName() { return 'homer'; }
    static get description()  { return 'Cena do Homer com fundo verde substituído'; }

    static get meta() {
        return { fps: 15, width: 736, height: 414, duration: 8, format: 'mp4' };
    }

    async renderFrame(frameIndex, totalFrames, data, context) {
        const { canvas: canvasModule, loadImage } = context;
        const { avatarUrl, avatarBuffer } = data;

        if (!this._baseFramesDir) {
            const videoPath = context.assets.videos.get('homer');
            if (!videoPath) throw new Error('[Homer] Asset "homer" não encontrado em videos/.');

            this._baseFramesDir = await FFmpeg.extractFramesToDir(videoPath, 15);

            this.constructor._audioSourcePath = videoPath;
        }

        const W = HomerTemplate.meta.width;
        const H = HomerTemplate.meta.height;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        if (avatarUrl || avatarBuffer) {
            const img = avatarBuffer
                ? await loadImage(avatarBuffer)
                : await loadImage(await context.avatar.fetch(avatarUrl, W));
            ctx.drawImage(img, 300, 0, 400, 500);
        }

        const { dir, files } = this._baseFramesDir;
        const baseIndex = frameIndex % files.length;
        const baseFrame = await loadImage(path.join(dir, files[baseIndex]));

        const bgCanvas = canvasModule.createCanvas(W, H);
        const bgCtx    = bgCanvas.getContext('2d');
        bgCtx.drawImage(baseFrame, 0, 0, W, H);

        chromaKeyGreen(bgCtx, W, H, 160, false);

        ctx.drawImage(bgCanvas, 0, 0);
        _freeCanvas(bgCanvas);

        const buffer = canvas.toBuffer('image/png');
        _freeCanvas(canvas);
        return buffer;
    }

    dispose() {
        FFmpeg.cleanupFrameDir(this._baseFramesDir?.dir);
        this._baseFramesDir = null;
    }
}

function _freeCanvas(canvas) {
    if (!canvas) return;
    try { canvas.width = 0; canvas.height = 0; } catch {}
}

module.exports = HomerTemplate;
