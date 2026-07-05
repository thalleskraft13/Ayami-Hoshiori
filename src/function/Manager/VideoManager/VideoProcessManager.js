'use strict';

const path      = require('path');
const { fork }  = require('child_process');
const Queue     = require('../MediaManager/Queue');
const VideoManager = require('./VideoManager');

/**
 * Roda cada render de vídeo em um `child_process` isolado, em vez de na
 * própria thread que o chama.
 *
 * Por quê: o render (canvas por frame + chroma key + ffmpeg) é síncrono e
 * pesado. Se rodar na mesma thread que atende o gateway/comandos do
 * Discord, o bot inteiro fica sem responder durante os 20-40s+ que um
 * vídeo leva pra gerar. Isolando num processo separado, a thread principal
 * nunca trava — e quando o processo filho termina, o sistema operacional
 * devolve toda a memória usada de forma imediata (sem depender do GC do V8
 * decidir liberar depois, que era o motivo do RSS "não baixar" após cada
 * render pesado).
 *
 * A concorrência de quantos renders acontecem ao mesmo tempo continua
 * controlada por uma `Queue` — só que agora cada "slot" da fila é um
 * processo filho inteiro, não mais uma Promise rodando in-process.
 *
 * @example
 * const pool = new VideoProcessManager({ root: __dirname });
 * const buffer = await pool.render({ Template: 'henrydanger', avatarUrl: '…' });
 */
class VideoProcessManager {
    /**
     * @param {object} [options]
     * @param {string} [options.root]          - Project root (mesmo passado ao VideoManager).
     * @param {number} [options.concurrency=1] - Max de processos filhos de render simultâneos.
     * @param {number} [options.timeout=100000] - Timeout (ms) por render antes de matar o processo filho.
     */
    constructor(options = {}) {
        this._root        = options.root ?? process.cwd();
        this._concurrency = options.concurrency ?? 1;
        this._timeoutMs   = options.timeout ?? 100_000;
        this._workerPath  = path.join(__dirname, 'VideoWorkerProcess.js');

        // Timeout da Queue fica um pouco acima do timeout do processo filho:
        // ele é só um backstop — quem garante o kill do processo é o timer
        // interno de `_renderInChildProcess`, não a Queue.
        this._queue = new Queue({ concurrency: this._concurrency, timeout: this._timeoutMs + 15_000 });

        /**
         * Instância leve do VideoManager original, usada só pra metadata
         * (listar templates). Nunca é usada pra renderizar de fato — isso
         * sempre acontece no processo filho.
         * @type {VideoManager|null}
         */
        this._meta = null;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Renderiza um template de vídeo/gif num processo filho isolado.
     *
     * @param {object} options
     * @param {string} options.Template - Nome do template (case-insensitive).
     * @returns {Promise<Buffer>}
     */
    async render(options) {
        const { Template, ...data } = options;
        if (!Template) throw new Error('[VideoProcessManager] options.Template is required.');

        const name = Template.toLowerCase();

        // Valida o template ANTES de gastar o custo de criar um processo
        // filho (fork tem overhead — não vale pagar isso só pra descobrir
        // que o nome do template está errado).
        const available = await this.listTemplates();
        if (!available.includes(name)) {
            throw new Error(
                `[VideoProcessManager] Template "${name}" not found. ` +
                `Available: ${available.join(', ') || '(none)'}`
            );
        }

        return this._queue.add(() => this._renderInChildProcess(name, data));
    }

    /** @returns {Promise<string[]>} */
    async listTemplates() {
        const meta = await this._getMeta();
        return meta.listTemplates();
    }

    stats() {
        return { queue: this._queue.stats() };
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    async _getMeta() {
        if (!this._meta) {
            this._meta = new VideoManager({ root: this._root });
            await this._meta.init();
        }
        return this._meta;
    }

    /**
     * Faz o fork, manda os dados, espera a resposta via IPC, e garante que
     * o processo filho sempre morra — mesmo em caso de timeout ou erro.
     *
     * @param {string} Template
     * @param {object} data
     * @returns {Promise<Buffer>}
     */
    _renderInChildProcess(Template, data) {
        return new Promise((resolve, reject) => {
            const child = fork(this._workerPath, [], {
                cwd:           this._root,
                serialization: 'advanced', // permite Buffer nativo ida e volta pelo IPC
            });

            let settled = false;

            const settle = (fn) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                fn();
            };

            const timer = setTimeout(() => {
                settle(() => reject(new Error(
                    `[VideoProcessManager] Render "${Template}" excedeu ${this._timeoutMs}ms — processo filho encerrado.`
                )));
                try { child.kill('SIGKILL'); } catch {}
            }, this._timeoutMs);

            child.once('message', (msg) => {
                settle(() => {
                    if (msg?.ok) {
                        resolve(Buffer.isBuffer(msg.buffer) ? msg.buffer : Buffer.from(msg.buffer));
                    } else {
                        reject(new Error(msg?.error || `[VideoProcessManager] Render "${Template}" falhou no processo filho.`));
                    }
                });
                try { child.kill(); } catch {}
            });

            child.once('error', (err) => {
                settle(() => reject(err));
            });

            child.once('exit', (code) => {
                settle(() => reject(new Error(
                    `[VideoProcessManager] Processo de render "${Template}" encerrou inesperadamente (code ${code}).`
                )));
            });

            child.send({ Template, data, root: this._root });
        });
    }
}

module.exports = VideoProcessManager;
