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
 *   pai  → filho:  { mode: 'render' | 'renderFrames', Template, data, root }
 *   filho → pai:   { ok: true,  buffer }              (mode: 'render')
 *                | { ok: true,  frames: Buffer[] }    (mode: 'renderFrames')
 *                | { ok: false, error }
 */

const VideoManager = require('./VideoManager');

process.once('message', async (msg) => {
    const { mode = 'render', Template, data, root } = msg || {};

    let response;
    try {
        const manager = new VideoManager({ root });
        await manager.init();

        if (mode === 'renderFrames') {
            const frames = await manager.renderFrames({ Template, ...data });
            response = { ok: true, frames };
        } else {
            const buffer = await manager.render({ Template, ...data });
            response = { ok: true, buffer };
        }
    } catch (err) {
        response = { ok: false, error: err?.message ?? String(err) };
    }

    // `process.send()` é assíncrono — ele só enfileira a mensagem pra ser
    // escrita no pipe do IPC, não garante que ela já foi entregue. Chamar
    // `process.exit()` logo em seguida (sem esperar essa confirmação) corre
    // o risco de matar o processo com a mensagem ainda na fila de saída, e
    // o pai nunca chega a recebê-la (só vê o processo encerrar). Por isso
    // só encerramos dentro do callback, depois que o envio é confirmado.
    process.send(response, () => {
        process.exit(0);
    });
});

// Segurança extra: se algo além do render em si explodir de forma inesperada
// (ex. erro fora do try/catch acima), ainda tentamos avisar o pai antes de
// morrer, em vez de deixar o processo pendurado sem resposta.
process.on('uncaughtException', (err) => {
    try {
        process.send({ ok: false, error: err?.message ?? String(err) }, () => process.exit(1));
    } catch {
        process.exit(1);
    }
});

