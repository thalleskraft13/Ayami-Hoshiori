'use strict';


const dns = require('dns').promises;
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS     = 10_000;       
const MAX_RESPONSE_BYTES     = 2 * 1024 * 1024; 
const MAX_REQUESTS_PER_RUN   = 10;           
const RATE_LIMIT_WINDOW_MS   = 60_000;       
const RATE_LIMIT_MAX_REQUESTS = 30;          

const _rateLimitBuckets = new Map();

class SafeHttpError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'SAFE_HTTP_ERROR';
  }
}


function isPrivateOrReservedIp(ip) {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127) return true;                          
    if (a === 10) return true;                            
    if (a === 172 && b >= 16 && b <= 31) return true;      
    if (a === 192 && b === 168) return true;               
    if (a === 169 && b === 254) return true;               
    if (a === 0) return true;                              
    if (a === 100 && b >= 64 && b <= 127) return true;      
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                        
  if (lower.startsWith('fe80:')) return true;               
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; 
  if (lower.startsWith('::ffff:')) {
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

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(':')) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new SafeHttpError('Requisições para IPs privados/reservados não são permitidas.', 'BLOCKED_IP');
    }
    return;
  }

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
