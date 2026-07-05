'use strict';

const { spawn }    = require('child_process');
const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const { randomUUID } = require('crypto');

/**
 * Low-level ffmpeg wrapper.
 * Accepts an array of frame Buffers and encodes them into MP4, WebM or GIF.
 * Also supports extracting frames and audio from an existing video file.
 */
class FFmpeg {

    /**
     * Encode PNG frames into a video/gif Buffer (no audio).
     *
     * Accepts either:
     *   - `frames`: a pre-built Buffer[] (original behavior — FFmpeg creates the
     *     tmp dir and writes each frame to disk itself), or
     *   - `frameDir` + `frameCount`: a directory where the caller has *already*
     *     written `frame_000000.png … frame_NNNNNN.png` (streaming mode — used
     *     by VideoRenderer so frames never pile up as Buffers in memory).
     *
     * @param {object}   options
     * @param {Buffer[]} [options.frames]
     * @param {string}   [options.frameDir]
     * @param {number}   [options.frameCount]
     * @param {number}   options.fps
     * @param {number}   options.width
     * @param {number}   options.height
     * @param {'mp4'|'webm'|'gif'} [options.format='mp4']
     * @param {string[]} [options.extraArgs]
     * @returns {Promise<Buffer>}
     */
    static async encode(options) {
        const {
            frames,
            frameDir,
            frameCount,
            fps,
            width,
            height,
            format    = 'mp4',
            extraArgs = [],
        } = options;

        const ownsDir = !frameDir;
        const tmpDir  = frameDir ?? path.join(os.tmpdir(), `ayami_${randomUUID()}`);
        const outputExt = format === 'gif' ? 'gif' : format === 'webm' ? 'webm' : 'mp4';
        const outputPath = path.join(tmpDir, `output.${outputExt}`);

        try {
            if (ownsDir) {
                if (!frames?.length) throw new Error('[FFmpeg] No frames provided.');
                fs.mkdirSync(tmpDir, { recursive: true });
                for (let i = 0; i < frames.length; i++) {
                    const framePath = path.join(tmpDir, `frame_${String(i).padStart(6, '0')}.png`);
                    fs.writeFileSync(framePath, frames[i]);
                }
            } else if (!frameCount) {
                throw new Error('[FFmpeg] frameCount is required when using frameDir.');
            }

            const args = FFmpeg._buildArgs({
                tmpDir, outputPath, fps, width, height, format, extraArgs
            });

            await FFmpeg._run(args);

            return fs.readFileSync(outputPath);

        } finally {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }
    }

    /**
     * Encode frames + mixa um áudio externo no resultado final.
     *
     * Accepts either `frames` (Buffer[], original behavior) or `frameDir` +
     * `frameCount` (frames already written to disk by the caller) — see `encode()`.
     *
     * @param {object}   options
     * @param {Buffer[]} [options.frames]
     * @param {string}   [options.frameDir]
     * @param {number}   [options.frameCount]
     * @param {Buffer|null} options.audio - Buffer de áudio (AAC). null = sem áudio.
     * @param {number}   options.fps
     * @param {number}   options.width
     * @param {number}   options.height
     * @param {'mp4'|'webm'} [options.format='mp4']
     * @returns {Promise<Buffer>}
     */
    static async encodeWithAudio(options) {
        const { frames, frameDir, frameCount, audio, fps, width, height, format = 'mp4' } = options;

        const ownsDir = !frameDir;
        const tmpDir     = frameDir ?? path.join(os.tmpdir(), `ayami_${randomUUID()}`);
        const audioPath  = path.join(tmpDir, 'audio_in.aac');
        const outputPath = path.join(tmpDir, `output.${format}`);

        try {
            if (ownsDir) {
                if (!frames?.length) throw new Error('[FFmpeg] No frames provided.');
                fs.mkdirSync(tmpDir, { recursive: true });
                for (let i = 0; i < frames.length; i++) {
                    fs.writeFileSync(
                        path.join(tmpDir, `frame_${String(i).padStart(6, '0')}.png`),
                        frames[i]
                    );
                }
            } else if (!frameCount) {
                throw new Error('[FFmpeg] frameCount is required when using frameDir.');
            }

            if (audio) fs.writeFileSync(audioPath, audio);

            const inputPattern = path.join(tmpDir, 'frame_%06d.png');

            const videoArgs = format === 'webm'
                ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30']
                : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

            const args = audio
                ? [
                    '-y',
                    '-framerate', String(fps), '-i', inputPattern,
                    '-i', audioPath,
                    ...videoArgs,
                    '-c:a', 'aac',
                    '-shortest',
                    outputPath
                  ]
                : [
                    '-y',
                    '-framerate', String(fps), '-i', inputPattern,
                    ...videoArgs,
                    '-an',
                    outputPath
                  ];

            await FFmpeg._run(args);

            return fs.readFileSync(outputPath);

        } finally {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }
    }

    /**
     * Extrai todos os frames de um vídeo como Buffers PNG.
     *
     * ⚠️ Carrega TODOS os frames na RAM de uma vez (um Buffer por frame).
     * Para vídeos longos ou em alta resolução isso pode causar picos de
     * memória enormes (ex.: 360 frames a partir de um vídeo 1080p podem
     * passar de 500MB-1GB facilmente). Sempre que os frames forem usados
     * como "fundo" que se repete ao longo de várias chamadas de
     * `renderFrame` (caso dos templates de vídeo), prefira
     * `extractFramesToDir()` abaixo, que mantém os frames no disco e
     * carrega apenas 1 por vez.
     *
     * @param {string} videoPath
     * @param {number} [fps]
     * @returns {Promise<Buffer[]>}
     */
    static async extractFrames(videoPath, fps = null) {
        const tmpDir = path.join(os.tmpdir(), `ayami_extract_${randomUUID()}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        try {
            const fpsArg = fps ? ['-vf', `fps=${fps}`] : [];

            await FFmpeg._run([
                '-i', videoPath,
                ...fpsArg,
                path.join(tmpDir, 'frame_%06d.png')
            ]);

            const files  = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort();
            const frames = files.map(f => fs.readFileSync(path.join(tmpDir, f)));

            return frames;

        } finally {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }
    }

    /**
     * Extrai todos os frames de um vídeo para um diretório temporário no
     * disco, SEM carregar nenhum deles na RAM. Retorna o diretório e a
     * lista de nomes de arquivo (já ordenados), para o chamador carregar
     * (`loadImage(path)`) um frame por vez, conforme precisa.
     *
     * O chamador é responsável por apagar o diretório quando terminar,
     * chamando `FFmpeg.cleanupFrameDir(dir)` (ex.: no `dispose()` do
     * template).
     *
     * @param {string} videoPath
     * @param {number} [fps]
     * @returns {Promise<{ dir: string, files: string[], count: number }>}
     */
    static async extractFramesToDir(videoPath, fps = null) {
        const dir = path.join(os.tmpdir(), `ayami_extract_${randomUUID()}`);
        fs.mkdirSync(dir, { recursive: true });

        try {
            const fpsArg = fps ? ['-vf', `fps=${fps}`] : [];

            await FFmpeg._run([
                '-i', videoPath,
                ...fpsArg,
                path.join(dir, 'frame_%06d.png')
            ]);

            const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();

            if (!files.length) {
                throw new Error(`[FFmpeg] Nenhum frame extraído de: ${videoPath}`);
            }

            return { dir, files, count: files.length };

        } catch (err) {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
            throw err;
        }
    }

    /**
     * Remove um diretório de frames criado por `extractFramesToDir()`.
     * Seguro de chamar múltiplas vezes / com diretório inexistente.
     *
     * @param {string} dir
     */
    static cleanupFrameDir(dir) {
        if (!dir) return;
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }

    /**
     * Extrai o áudio de um vídeo como Buffer (AAC).
     * Retorna null se o vídeo não tiver faixa de áudio.
     *
     * @param {string} videoPath
     * @returns {Promise<Buffer|null>}
     */
    static async extractAudio(videoPath) {
        const tmpDir    = path.join(os.tmpdir(), `ayami_audio_${randomUUID()}`);
        const audioPath = path.join(tmpDir, 'audio.aac');

        fs.mkdirSync(tmpDir, { recursive: true });

        try {
            await FFmpeg._run([
                '-i', videoPath,
                '-vn',
                '-acodec', 'aac',
                audioPath
            ]);

            if (!fs.existsSync(audioPath)) return null;
            return fs.readFileSync(audioPath);

        } catch {
            return null; // vídeo sem áudio
        } finally {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    static _buildArgs({ tmpDir, outputPath, fps, width, height, format, extraArgs }) {
        const inputPattern = path.join(tmpDir, 'frame_%06d.png');

        const base = [
            '-y',
            '-framerate', String(fps),
            '-i', inputPattern,
        ];

        let formatArgs;

        if (format === 'gif') {
            formatArgs = [
                '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
                '-loop', '0',
            ];
        } else if (format === 'webm') {
            formatArgs = [
                '-c:v', 'libvpx-vp9',
                '-pix_fmt', 'yuva420p',
                '-b:v', '0',
                '-crf', '30',
                '-an',
            ];
        } else {
            formatArgs = [
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                '-an',
            ];
        }

        return [...base, ...formatArgs, ...extraArgs, outputPath];
    }

    static _run(args) {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', args);
            const stderr = [];

            proc.stderr.on('data', (chunk) => stderr.push(chunk));

            proc.on('close', (code) => {
                if (code === 0) return resolve();
                reject(new Error(
                    `[FFmpeg] Process exited with code ${code}:\n` +
                    Buffer.concat(stderr).toString().slice(-2000)
                ));
            });

            proc.on('error', (err) => {
                reject(new Error(`[FFmpeg] Failed to spawn: ${err.message}`));
            });
        });
    }
}

module.exports = FFmpeg;
