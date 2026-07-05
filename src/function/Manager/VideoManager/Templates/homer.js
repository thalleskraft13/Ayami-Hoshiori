'use strict';

const path      = require('path');
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

        // ── Frames do vídeo base de fundo verde ficam no disco, nunca ──────
        // todos na RAM (antes: extractFrames carregava tudo como Buffers,
        // causando o pico de memória no render de vídeo).
        if (!this._baseFramesDir) {
            const videoPath = context.assets.videos.get('homer');
            if (!videoPath) throw new Error('[Homer] Asset "homer" não encontrado em videos/.');

            this._baseFramesDir = await FFmpeg.extractFramesToDir(videoPath, 15);

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

        // ── 2. Frame do vídeo verde em canvas separado (carrega do disco) ──
        const { dir, files } = this._baseFramesDir;
        const baseIndex = frameIndex % files.length;
        const baseFrame = await loadImage(path.join(dir, files[baseIndex]));

        const bgCanvas = canvasModule.createCanvas(W, H);
        const bgCtx    = bgCanvas.getContext('2d');
        bgCtx.drawImage(baseFrame, 0, 0, W, H);

        // ── 3. Remove o verde deste frame (sem mistura/translucidez) ──────
        chromaKeyGreen(bgCtx, W, H, 160, false);

        // ── 4. Compõe por cima ──────────────────────────────────────────────
        ctx.drawImage(bgCanvas, 0, 0);
        _freeCanvas(bgCanvas);

        const buffer = canvas.toBuffer('image/png');
        _freeCanvas(canvas);
        return buffer;
    }

    // Chamado automaticamente pelo VideoRenderer ao final do render
    // (sucesso ou erro) — apaga o diretório de frames extraídos do disco.
    dispose() {
        FFmpeg.cleanupFrameDir(this._baseFramesDir?.dir);
        this._baseFramesDir = null;
    }
}

/**
 * Zera as dimensões do canvas para forçar o Cairo a liberar o buffer de
 * pixels nativo na hora, em vez de esperar o GC do V8 coletar o wrapper JS
 * (o V8 não sente pressão de heap por causa desse objeto — o wrapper é
 * pequeno, o buffer de pixels é nativo e fica fora da contagem do V8).
 *
 * @param {import('canvas').Canvas} canvas
 */
function _freeCanvas(canvas) {
    if (!canvas) return;
    try { canvas.width = 0; canvas.height = 0; } catch {}
}

module.exports = HomerTemplate;
