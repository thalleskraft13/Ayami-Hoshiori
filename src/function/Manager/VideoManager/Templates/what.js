'use strict';

const path      = require('path');
const BaseVideo = require('../BaseVideo');
const FFmpeg     = require('../FFmpeg');
const { chromaKeyGreen } = require('../chromaKeyVideo');


class WhatTemplate extends BaseVideo {

    static get templateName() { return 'what'; }
    static get description()  { return 'C'; }

    static get meta() {
        return { fps: 15, width: 736, height: 414, duration: 5.6, format: 'mp4' };
    }

    async renderFrame(frameIndex, totalFrames, data, context) {
        const { canvas: canvasModule, loadImage } = context;
        const { avatarUrl, avatarBuffer } = data;

        if (!this._baseFramesDir) {
            const videoPath = context.assets.videos.get('what');
            if (!videoPath) throw new Error('[What] Asset "what" não encontrado em videos/.');

            this._baseFramesDir = await FFmpeg.extractFramesToDir(videoPath, 15);

            this.constructor._audioSourcePath = videoPath;
        }

        const W = WhatTemplate.meta.width;
        const H = WhatTemplate.meta.height;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        const { dir, files } = this._baseFramesDir;
        const baseFrame = await loadImage(path.join(dir, files[frameIndex % files.length]));

        if (!this._avatarImg && (avatarUrl || avatarBuffer)) {
            this._avatarImg = avatarBuffer
                ? await loadImage(avatarBuffer)
                : await loadImage(await context.avatar.fetch(avatarUrl, W));
        }

        if (this._avatarImg) {
            if (frameIndex < 21) {
                ctx.drawImage(this._avatarImg, 0, 0, W, H);
            } else if (frameIndex < 56) {
                ctx.drawImage(this._avatarImg, 100, 0, 570, 300);
            } else if (frameIndex < 57) {
                ctx.drawImage(this._avatarImg, 160, 0, 400, 270);
            } else if (frameIndex < 86) {
                ctx.drawImage(this._avatarImg, 210, 0, 350, 250);
            }
        }

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
        this._avatarImg = null;
    }
}

function _freeCanvas(canvas) {
    if (!canvas) return;
    try { canvas.width = 0; canvas.height = 0; } catch {}
}

module.exports = WhatTemplate;