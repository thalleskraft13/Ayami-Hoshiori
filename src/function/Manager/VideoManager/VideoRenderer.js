'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
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
        // Cada frame é escrito em disco assim que é renderizado, e o Buffer
        // é descartado em seguida — nunca mais de 1 frame fica retido na RAM
        // ao mesmo tempo (antes, todos os N frames ficavam vivos até o fim
        // do loop). Ordem e timing continuam idênticos ao original: todos os
        // frames ainda são gerados sequencialmente ANTES de checar
        // `audioPath`, então o mecanismo de setar `_audioSourcePath` dentro
        // de `renderFrame` continua funcionando exatamente igual.
        const frameDir = path.join(os.tmpdir(), `ayami_frames_${randomUUID()}`);
        fs.mkdirSync(frameDir, { recursive: true });

        try {
            for (let i = 0; i < totalFrames; i++) {
                const frame = await template.renderFrame(i, totalFrames, data, this._context);

                if (!Buffer.isBuffer(frame)) {
                    throw new TypeError(
                        `[VideoRenderer] Template "${TemplateClass.templateName}" ` +
                        `renderFrame() must return a Buffer, got: ${typeof frame}`
                    );
                }

                fs.writeFileSync(
                    path.join(frameDir, `frame_${String(i).padStart(6, '0')}.png`),
                    frame
                );
                // `frame` sai de escopo aqui e fica elegível pro GC imediatamente.
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
            // FFmpeg recebe o diretório já populado (frameDir) em vez de um
            // array de Buffers, e cuida de limpar frameDir ao final.
            return audio
                ? FFmpeg.encodeWithAudio({
                    frameDir, frameCount: totalFrames, audio,
                    fps:    meta.fps,
                    width:  meta.width,
                    height: meta.height,
                    format: meta.format ?? 'mp4',
                  })
                : FFmpeg.encode({
                    frameDir, frameCount: totalFrames,
                    fps:    meta.fps,
                    width:  meta.width,
                    height: meta.height,
                    format: meta.format ?? 'gif',
                  });

        } catch (err) {
            // Se falhar antes de chegar no FFmpeg (que limpa frameDir sozinho
            // em seu `finally`), limpamos aqui pra não deixar lixo em /tmp.
            try { fs.rmSync(frameDir, { recursive: true, force: true }); } catch {}
            throw err;
        }
    }
}

module.exports = VideoRenderer;
