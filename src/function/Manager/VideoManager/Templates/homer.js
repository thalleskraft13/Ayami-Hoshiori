'use strict';

const BaseVideo = require('../BaseVideo');
const FFmpeg     = require('../FFmpeg');
const { chromaKeyGreen } = require('../chromaKeyVideo');

/**
 * Cena do Homer fechando a porta no fundo verde — usuário aparece
 * "na cena" no lugar do chroma key. Áudio original é preservado.
 *
 * @example
 * const buffer = await MediaManager.Video.Render({
 *     Template:  'homer',
 *     avatarUrl: 'https://…',
 * });
 */
class HomerTemplate extends BaseVideo {

    static get templateName() { return 'homer'; }
    static get description()  { return 'Cena do Homer com fundo verde substituído'; }

    static get meta() {
        return { fps: 15, width: 736, height: 414, duration: 8, format: 'mp4' };
    }

    async renderFrame(frameIndex, totalFrames, data, context) {
        const { canvas: canvasModule, loadImage } = context;
        const { avatarUrl, avatarBuffer } = data;

        // ── Carrega o vídeo base de fundo verde (uma vez só) ───────────────
        if (!this._baseFrames) {
            const videoPath = context.assets.videos.get('homer');
            if (!videoPath) throw new Error('[Homer] Asset "homer" não encontrado em videos/.');

            this._baseFrames = await FFmpeg.extractFrames(videoPath, 15);

            // Expõe o caminho do vídeo para o VideoRenderer extrair o áudio
            this.constructor._audioSourcePath = videoPath;
        }

        const W = HomerTemplate.meta.width;
        const H = HomerTemplate.meta.height;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        // ── 1. Avatar atrás (aparece onde o verde for removido) ───────────
        if (avatarUrl || avatarBuffer) {
            const img = avatarBuffer
                ? await loadImage(avatarBuffer)
                : await loadImage(await context.avatar.fetch(avatarUrl, W));
            ctx.drawImage(img, 300, 0, 400, 500);
        }

        // ── 2. Frame do vídeo verde em canvas separado ────────────────────
        const baseIndex = frameIndex % this._baseFrames.length;
        const baseFrame = await loadImage(this._baseFrames[baseIndex]);

        const bgCanvas = canvasModule.createCanvas(W, H);
        const bgCtx    = bgCanvas.getContext('2d');
        bgCtx.drawImage(baseFrame, 0, 0, W, H);

        // ── 3. Remove o verde deste frame (sem mistura/translucidez) ──────
        chromaKeyGreen(bgCtx, W, H, 160, false);

        // ── 4. Compõe por cima ──────────────────────────────────────────────
        ctx.drawImage(bgCanvas, 0, 0);

        return canvas.toBuffer('image/png');
    }
}

module.exports = HomerTemplate;
