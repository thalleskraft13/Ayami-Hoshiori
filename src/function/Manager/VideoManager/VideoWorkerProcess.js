'use strict';


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

    process.send(response, () => {
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    try {
        process.send({ ok: false, error: err?.message ?? String(err) }, () => process.exit(1));
    } catch {
        process.exit(1);
    }
});

