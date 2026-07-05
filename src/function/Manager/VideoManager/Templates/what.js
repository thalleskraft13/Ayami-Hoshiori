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

            // Expõe o caminho do vídeo para o VideoRenderer extrair o áudio
            this.constructor._audioSourcePath = videoPath;
        }

        const W = WhatTemplate.meta.width;
        const H = WhatTemplate.meta.height;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        // Frame base — carrega direto do disco, 1 frame por vez.
        const { dir, files } = this._baseFramesDir;
        const baseFrame = await loadImage(path.join(dir, files[frameIndex % files.length]));

        // Avatar decodificado uma única vez e reaproveitado em todos os
        // frames (antes: era baixado do cache e decodificado de novo em
        // cada um dos ~86 frames).
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

        return canvas.toBuffer('image/png');
    }

    // Chamado automaticamente pelo VideoRenderer ao final do render
    // (sucesso ou erro) — apaga o diretório de frames extraídos do disco.
    dispose() {
        FFmpeg.cleanupFrameDir(this._baseFramesDir?.dir);
        this._baseFramesDir = null;
        this._avatarImg = null;
    }
}

module.exports = WhatTemplate;