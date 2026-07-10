'use strict';

/* ═══════════════════════════════════════════════════════════
   SAFE HTTP — cliente HTTP protegido, compartilhado entre
   Logic Script (function global `http`) e Logic Builder
   (ações `http_request` / `send_webhook` do ActionRunner.js).

   Antes desta atualização, `http_request`/`send_webhook` no
   ActionRunner.js chamavam `fetch()` cru: sem timeout, sem
   limite de tamanho de resposta, sem bloqueio de localhost/IP
   privado e sem limite de requisições por execução — ou seja,
   qualquer fluxo podia ser usado para SSRF contra a rede interna
   (incluindo a própria API interna do bot em 127.0.0.1:3001).

   Este módulo centraliza TODAS as proteções pedidas:
     - Rate limit (por guild, janela deslizante)
     - Timeout por requisição
     - Limite de tamanho da resposta
     - Bloqueio de localhost
     - Bloqueio de IPs privados/reservados
     - Limite de requisições por execução (contador passado pelo caller)
     - Logs (o caller decide o que logar — ver LogicScript/Interpreter.js
       e ActionRunner.js, que só logam ações que de fato saem pra rede)
   ═══════════════════════════════════════════════════════════ */

const dns = require('dns').promises;
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS     = 10_000;       // 10s por requisição
const MAX_RESPONSE_BYTES     = 2 * 1024 * 1024; // 2MB
const MAX_REQUESTS_PER_RUN   = 10;           // por execução de script/fluxo
const RATE_LIMIT_WINDOW_MS   = 60_000;       // janela de 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 30;          // por guild, por janela

// guildId -> array de timestamps das requisições feitas na janela atual
const _rateLimitBuckets = new Map();

class SafeHttpError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'SAFE_HTTP_ERROR';
  }
}

/* ─────────────────────────────────────────────
   BLOQUEIO DE LOCALHOST / IP PRIVADO
   ───────────────────────────────────────────── */

function isPrivateOrReservedIp(ip) {
  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127) return true;                          // loopback
    if (a === 10) return true;                            // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16
    if (a === 169 && b === 254) return true;               // link-local / metadata cloud
    if (a === 0) return true;                              // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT 100.64.0.0/10
    return false;
  }

  // IPv6
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                        // loopback
  if (lower.startsWith('fe80:')) return true;               // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA (fc00::/7)
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped — reaplica a checagem de IPv4
    const mapped = lower.split(':').pop();
    if (mapped && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mapped)) {
      return isPrivateOrReservedIp(mapped);
    }
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', 'metadata.google.internal']);

async function assertUrlIsSafe(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SafeHttpError('URL inválida.', 'INVALID_URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SafeHttpError('Apenas URLs http/https são permitidas.', 'INVALID_PROTOCOL');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SafeHttpError('Requisições para localhost não são permitidas.', 'BLOCKED_HOST');
  }

  // Se já for um literal de IP, valida direto.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(':')) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new SafeHttpError('Requisições para IPs privados/reservados não são permitidas.', 'BLOCKED_IP');
    }
    return;
  }

  // Resolve o hostname e valida TODOS os IPs retornados (evita DNS rebinding
  // básico — se qualquer IP resolvido for privado, bloqueia a requisição inteira).
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SafeHttpError('Não foi possível resolver o domínio informado.', 'DNS_ERROR');
  }

  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new SafeHttpError('O domínio resolve para um IP privado/reservado — bloqueado.', 'BLOCKED_IP');
    }
  }
}

/* ─────────────────────────────────────────────
   RATE LIMIT POR GUILD
   ───────────────────────────────────────────── */

function checkRateLimit(guildId) {
  const now = Date.now();
  let bucket = _rateLimitBuckets.get(guildId) ?? [];
  bucket = bucket.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

  if (bucket.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw new SafeHttpError(
      `Limite de requisições HTTP atingido para este servidor (${RATE_LIMIT_MAX_REQUESTS}/min). Tente novamente em instantes.`,
      'RATE_LIMITED'
    );
  }

  bucket.push(now);
  _rateLimitBuckets.set(guildId, bucket);
}

/* ─────────────────────────────────────────────
   LEITURA DE RESPOSTA COM LIMITE DE TAMANHO
   ───────────────────────────────────────────── */

async function readBodyWithLimit(response, maxBytes) {
  if (!response.body) return await response.text();

  const reader = response.body.getReader();
  let received = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.length;
    if (received > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw new SafeHttpError(
        `Resposta excedeu o limite de tamanho permitido (${(maxBytes / 1024 / 1024).toFixed(1)}MB).`,
        'RESPONSE_TOO_LARGE'
      );
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf-8');
}

/* ─────────────────────────────────────────────
   REQUISIÇÃO PROTEGIDA
   ─────────────────────────────────────────────

   opts:
     method, headers, body (já serializado ou objeto — objeto vira JSON)
     guildId          — obrigatório, usado no rate limit
     requestCounter   — { count } mutável, compartilhado pela execução
                        inteira (script ou fluxo) pra aplicar o limite
                        de requisições por execução
*/
async function safeRequest(rawUrl, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    body = undefined,
    guildId,
    requestCounter = { count: 0 },
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = MAX_RESPONSE_BYTES,
  } = opts;

  if (!guildId) {
    throw new SafeHttpError('guildId é obrigatório para requisições HTTP protegidas.', 'MISSING_GUILD');
  }

  requestCounter.count = (requestCounter.count || 0) + 1;
  if (requestCounter.count > MAX_REQUESTS_PER_RUN) {
    throw new SafeHttpError(
      `Limite de ${MAX_REQUESTS_PER_RUN} requisições HTTP por execução atingido.`,
      'MAX_REQUESTS_PER_RUN'
    );
  }

  checkRateLimit(guildId);
  await assertUrlIsSafe(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let finalBody = body;
  const finalHeaders = { ...headers };
  if (finalBody && typeof finalBody === 'object' && !(finalBody instanceof Buffer)) {
    finalBody = JSON.stringify(finalBody);
    if (!finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
  }

  let response;
  try {
    response = await fetch(rawUrl, {
      method: String(method).toUpperCase(),
      headers: finalHeaders,
      body: ['GET', 'HEAD'].includes(String(method).toUpperCase()) ? undefined : finalBody,
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new SafeHttpError(`Requisição excedeu o tempo limite (${timeoutMs}ms).`, 'TIMEOUT');
    }
    throw new SafeHttpError(`Falha na requisição: ${err.message}`, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }

  const text = await readBodyWithLimit(response, maxResponseBytes);

  let json = null;
  try { json = JSON.parse(text); } catch { /* não é JSON, tudo bem */ }

  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text,
    json,
  };
}

module.exports = {
  SafeHttpError,
  safeRequest,
  assertUrlIsSafe,
  isPrivateOrReservedIp,
  MAX_REQUESTS_PER_RUN,
  MAX_RESPONSE_BYTES,
  DEFAULT_TIMEOUT_MS,
};
