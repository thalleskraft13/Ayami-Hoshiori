'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const FFmpeg = require('./FFmpeg');

class VideoRenderer {
    constructor(context) {
        this._context = context;
    }

    async run(TemplateClass, data) {
        const meta        = TemplateClass.meta;
        const totalFrames = Math.ceil(meta.fps * meta.duration);
        const template     = new TemplateClass();

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

            const audioPath = TemplateClass.audioSourcePath ?? TemplateClass._audioSourcePath ?? null;

            let audio = null;

            if (audioPath) {
                audio = await FFmpeg.extractAudio(audioPath);
            }

            return await (audio
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
                  }));

        } catch (err) {
            try { fs.rmSync(frameDir, { recursive: true, force: true }); } catch {}
            throw err;
        } finally {
            try { await template.dispose?.(); } catch {}

            global.gc?.();
        }
    }
}

module.exports = VideoRenderer;
