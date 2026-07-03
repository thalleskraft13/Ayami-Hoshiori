'use strict';

/* ═══════════════════════════════════════════
   LOGIC SCRIPT — BOT INTERNAL API v2
   Arquivo: src/function/System/LogicScript/InternalApi.js

   Rotas:
   POST /internal/logicscript/invalidate         → invalida cache de handlers
   POST /internal/logicscript/invalidate-config  → invalida cache de configuração
   POST /internal/logicscript/validate           → valida sintaxe
   POST /internal/logicscript/run               → executa script
   POST /internal/logicscript/emit              → dispara custom event

   Adicione no DiscordGatewayClient.js:
     const { startInternalApi } = require('./System/LogicScript/InternalApi.js');
     // após o bot estar pronto:
     startInternalApi(this);
   ═══════════════════════════════════════════ */

const http = require('http');

const INTERNAL_PORT   = process.env.BOT_INTERNAL_PORT   ?? 3001;
const INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET ?? '';

let _server = null;

function startInternalApi(client) {
  if (_server) return;

  _server = http.createServer(async (req, res) => {

    /* ── Auth ── */
    const auth = req.headers['authorization'] ?? '';
    if (INTERNAL_SECRET && auth !== INTERNAL_SECRET) {
      res.writeHead(403);
      res.end(JSON.stringify({ ok: false, error: 'Forbidden' }));
      return;
    }

    /* ── Body ── */
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}

    res.setHeader('Content-Type', 'application/json');

    const url    = req.url;
    const runner = client.logicScriptRunner;

    /* ── Invalidar cache de handlers ── */
    if (url === '/internal/logicscript/invalidate' && req.method === 'POST') {
      if (data.guildId && runner) runner.invalidateCache(data.guildId);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    /* ── Invalidar cache de configuração ── */
    if (url === '/internal/logicscript/invalidate-config' && req.method === 'POST') {
      if (data.guildId && runner) runner.invalidateConfig(data.guildId);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    /* ── Validar sintaxe ── */
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

    /* ── Executar script manualmente ── */
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

    /* ── Disparar evento customizado ── */
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
