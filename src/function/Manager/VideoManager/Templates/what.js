'use strict';

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

        // ── Carrega o vídeo base de fundo verde (uma vez só) ───────────────
        if (!this._baseFrames) {
            const videoPath = context.assets.videos.get('what');
            if (!videoPath) throw new Error('[Asset  não encontrado em videos/.');

            this._baseFrames = await FFmpeg.extractFrames(videoPath, 15);

            // Expõe o caminho do vídeo para o VideoRenderer extrair o áudio
            this.constructor._audioSourcePath = videoPath;
        }

        const W = WhatTemplate.meta.width;
        const H = WhatTemplate.meta.height;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

       
        const baseIndex = frameIndex % this._baseFrames.length;
        const baseFrame = await loadImage(this._baseFrames[frameIndex % this._baseFrames.length]);

        if (frameIndex < 21){
             if (avatarUrl || avatarBuffer) {
                const img = avatarBuffer
                    ? await loadImage(avatarBuffer)
                    : await loadImage(await context.avatar.fetch(avatarUrl, W));
             ctx.drawImage(img, 0, 0, W, H);
           }
        }

        if (frameIndex < 56 && frameIndex > 21){
             if (avatarUrl || avatarBuffer) {
                const img = avatarBuffer
                    ? await loadImage(avatarBuffer)
                    : await loadImage(await context.avatar.fetch(avatarUrl, W));
             ctx.drawImage(img, 100, 0, 570, 300);
           }
        }

          if (frameIndex < 57 && frameIndex > 55){
             if (avatarUrl || avatarBuffer) {
                const img = avatarBuffer
                    ? await loadImage(avatarBuffer)
                    : await loadImage(await context.avatar.fetch(avatarUrl, W));
             ctx.drawImage(img, 160, 0, 400, 270);
           }
        }

          if (frameIndex < 86 && frameIndex > 56){
             if (avatarUrl || avatarBuffer) {
                const img = avatarBuffer
                    ? await loadImage(avatarBuffer)
                    : await loadImage(await context.avatar.fetch(avatarUrl, W));
             ctx.drawImage(img, 210, 0, 350, 250);
           }
        }
   

        const bgCanvas = canvasModule.createCanvas(W, H);
        const bgCtx    = bgCanvas.getContext('2d');
        bgCtx.drawImage(baseFrame, 0, 0, W, H);

       
        chromaKeyGreen(bgCtx, W, H, 160, false);

      
        ctx.drawImage(bgCanvas, 0, 0);

        return canvas.toBuffer('image/png');
    }
}

module.exports = WhatTemplate;