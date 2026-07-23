'use strict';

const path      = require('path');
const { fork }  = require('child_process');
const Queue     = require('../MediaManager/Queue');
const VideoManager = require('./VideoManager');

class VideoProcessManager {
    constructor(options = {}) {
        this._root        = options.root ?? process.cwd();
        this._concurrency = options.concurrency ?? 1;
        this._timeoutMs   = options.timeout ?? 480_000;
        this._workerPath  = path.join(__dirname, 'VideoWorkerProcess.js');

        this._queue = new Queue({ concurrency: this._concurrency, timeout: this._timeoutMs + 15_000 });

        this._meta = null;
    }


    async render(options) {
        const { Template, ...data } = options;
        if (!Template) throw new Error('[VideoProcessManager] options.Template is required.');

        const name = Template.toLowerCase();

        const available = await this.listTemplates();
        if (!available.includes(name)) {
            throw new Error(
                `[VideoProcessManager] Template "${name}" not found. ` +
                `Available: ${available.join(', ') || '(none)'}`
            );
        }

        return this._queue.add(() => this._runInChildProcess('render', name, data));
    }

    async renderFrames(options) {
        const { Template, ...data } = options;
        if (!Template) throw new Error('[VideoProcessManager] options.Template is required.');

        const name = Template.toLowerCase();

        const available = await this.listTemplates();
        if (!available.includes(name)) {
            throw new Error(
                `[VideoProcessManager] Template "${name}" not found. ` +
                `Available: ${available.join(', ') || '(none)'}`
            );
        }

        return this._queue.add(() => this._runInChildProcess('renderFrames', name, data));
    }

    async listTemplates() {
        const meta = await this._getMeta();
        return meta.listTemplates();
    }

    stats() {
        return { queue: this._queue.stats() };
    }


    async _getMeta() {
        if (!this._meta) {
            this._meta = new VideoManager({ root: this._root });
            await this._meta.init();
        }
        return this._meta;
    }

    _runInChildProcess(mode, Template, data) {
        return new Promise((resolve, reject) => {
            const child = fork(this._workerPath, [], {
                cwd:           this._root,
                serialization: 'advanced', // permite Buffer nativo (e arrays deles) ida e volta pelo IPC
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
                    if (!msg?.ok) {
                        reject(new Error(msg?.error || `[VideoProcessManager] Render "${Template}" falhou no processo filho.`));
                        return;
                    }

                    if (mode === 'renderFrames') {
                        const frames = (msg.frames || []).map(f => Buffer.isBuffer(f) ? f : Buffer.from(f));
                        resolve(frames);
                    } else {
                        resolve(Buffer.isBuffer(msg.buffer) ? msg.buffer : Buffer.from(msg.buffer));
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

            child.send({ mode, Template, data, root: this._root });
        });
    }
}

module.exports = VideoProcessManager;
