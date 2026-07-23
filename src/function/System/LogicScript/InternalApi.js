'use strict';


const http = require('http');

const INTERNAL_PORT   = process.env.BOT_INTERNAL_PORT   ?? 3001;
const INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET ?? '';

let _server = null;

function startInternalApi(client) {
  if (_server) return;

  _server = http.createServer(async (req, res) => {

    const auth = req.headers['authorization'] ?? '';
    if (INTERNAL_SECRET && auth !== INTERNAL_SECRET) {
      res.writeHead(403);
      res.end(JSON.stringify({ ok: false, error: 'Forbidden' }));
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}

    res.setHeader('Content-Type', 'application/json');

    const url    = req.url;
    const runner = client.logicScriptRunner;

    if (url === '/internal/logicscript/invalidate' && req.method === 'POST') {
      if (data.guildId && runner) runner.invalidateCache(data.guildId);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url === '/internal/logicscript/invalidate-config' && req.method === 'POST') {
      if (data.guildId && runner) runner.invalidateConfig(data.guildId);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url === '/internal/logicscript/validate' && req.method === 'POST') {
      if (!runner) {
        res.writeHead(503);
        res.end(JSON.stringify({ ok: false, error: 'Runner não disponível' }));
        return;
      }
      const result = runner.validate(data.content ?? '');
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    if (url === '/internal/logicscript/run' && req.method === 'POST') {
      if (!runner) {
        res.writeHead(503);
        res.end(JSON.stringify({ ok: false, error: 'Runner não disponível' }));
        return;
      }
      try {
        const result = await runner.runManual(data.guildId, data.path, {
          channelId: data.channelId,
          userId:    data.userId,
        });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: false, error: err.message, logs: err.logs ?? [] }));
      }
      return;
    }

    if (url === '/internal/logicscript/emit' && req.method === 'POST') {
      if (!runner) {
        res.writeHead(503);
        res.end(JSON.stringify({ ok: false, error: 'Runner não disponível' }));
        return;
      }
      try {
        await runner.emitCustomEvent(data.guildId, data.event, data.ctx ?? {});
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Rota não encontrada' }));
  });

  _server.listen(Number(INTERNAL_PORT), '127.0.0.1', () => {
    console.log(`[LogicScript] Internal API rodando em 127.0.0.1:${INTERNAL_PORT}`);
  });

  _server.on('error', err => {
    console.error('[LogicScript] Internal API erro:', err.message);
  });
}

function stopInternalApi() {
  if (_server) { _server.close(); _server = null; }
}

module.exports = { startInternalApi, stopInternalApi };
