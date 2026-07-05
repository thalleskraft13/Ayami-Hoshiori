'use strict';

const FFmpeg = require('./FFmpeg');

/**
 * Renderiza todos os frames de um template e encoda via FFmpeg.
 * Se o template expuser `audioSourcePath`, o áudio original é mixado de volta.
 */
class VideoRenderer {
    /**
     * @param {object} context - VideoRenderContext compartilhado.
     */
    constructor(context) {
        this._context = context;
    }

    /**
     * Executa um template de vídeo: renderiza cada frame, depois encoda.
     *
     * @param {Function} TemplateClass - Classe estendendo BaseVideo.
     * @param {object}   data
     * @returns {Promise<Buffer>}
     */
    async run(TemplateClass, data) {
        const meta        = TemplateClass.meta;
        const totalFrames = Math.ceil(meta.fps * meta.duration);
        const template     = new TemplateClass();

        // ── Renderiza frames ─────────────────────────────────────────────
        const frames = [];

        for (let i = 0; i < totalFrames; i++) {
            const frame = await template.renderFrame(i, totalFrames, data, this._context);

            if (!Buffer.isBuffer(frame)) {
                throw new TypeError(
                    `[VideoRenderer] Template "${TemplateClass.templateName}" ` +
                    `renderFrame() must return a Buffer, got: ${typeof frame}`
                );
            }

            frames.push(frame);
        }

        // ── Extrai áudio do vídeo base, se o template indicar um ──────────
        // O template pode definir isso de duas formas:
        //   1. static get audioSourcePath() { return '/caminho/fixo.mp4'; }
        //   2. this.constructor._audioSourcePath = videoPath; (definido dentro de renderFrame)
        const audioPath = TemplateClass.audioSourcePath ?? TemplateClass._audioSourcePath ?? null;

        let audio = null;
      
        if (audioPath) {
            audio = await FFmpeg.extractAudio(audioPath);
        }

        // ── Encoda ────────────────────────────────────────────────────────
        return audio
            ? FFmpeg.encodeWithAudio({
                frames, audio,
                fps:    meta.fps,
                width:  meta.width,
                height: meta.height,
                format: meta.format ?? 'mp4',
              })
            : FFmpeg.encode({
                frames,
                fps:    meta.fps,
                width:  meta.width,
                height: meta.height,
                format: meta.format ?? 'gif',
              });
    }
}

module.exports = VideoRenderer;
