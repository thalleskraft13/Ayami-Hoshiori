'use strict';

/**
 * Processo filho isolado — roda exatamente 1 render de vídeo e termina.
 *
 * Spawnado pelo `VideoProcessManager` via `child_process.fork()`. O motivo
 * de existir: o `VideoManager` original (`./VideoManager.js`) roda o loop de
 * frames (canvas, chroma key, ffmpeg) de forma síncrona na thread que o
 * chama. Se isso rodar na mesma thread que atende comandos/gateway do
 * Discord, o bot inteiro trava até o render terminar.
 *
 * Rodando aqui, num processo do sistema operacional totalmente separado:
 *   - a thread principal do bot nunca fica bloqueada durante o render;
 *   - quando este processo termina (`process.exit()`), o SO devolve TODA a
 *     memória usada (canvas, ffmpeg, frames) de forma imediata e garantida —
 *     sem depender do V8 decidir liberar heap/nativo depois.
 *
 * Protocolo (via IPC do `child_process`):
 *   pai  → filho:  { Template, data, root }
 *   filho → pai:   { ok: true,  buffer }   | { ok: false, error }
 */

const VideoManager = require('./VideoManager');

process.once('message', async (msg) => {
    const { Template, data, root } = msg || {};

    try {
        const manager = new VideoManager({ root });
        await manager.init();

        const buffer = await manager.render({ Template, ...data });

        process.send({ ok: true, buffer });
    } catch (err) {
        process.send({ ok: false, error: err?.message ?? String(err) });
    } finally {
        // Encerra sempre, com sucesso ou erro — é isso que garante a RAM
        // sendo devolvida ao SO na hora, o ponto principal de existir este
        // processo separado.
        process.exit(0);
    }
});

// Segurança extra: se algo além do render em si explodir de forma inesperada
// (ex. erro fora do try/catch acima), ainda tentamos avisar o pai antes de
// morrer, em vez de deixar o processo pendurado sem resposta.
process.on('uncaughtException', (err) => {
    try { process.send({ ok: false, error: err?.message ?? String(err) }); } catch {}
    process.exit(1);
});

