'use strict';

/* ═══════════════════════════════════════════════════════════
   MAINTENANCE MODE — "Atualização Programada"

   Estado global (persistido no Mongo, singleton em botConfig.js) +
   cache em memória por processo, atualizado instantaneamente via IPC
   (parentPort/ClusterManager — o mesmo mecanismo já usado por
   setPresenceAllClusters) sempre que a Staff ativa/desativa.

   Toda checagem de interação passa por `isActive()`/`getMessage()`
   deste módulo — centralizado aqui pra evitar duplicação (ver
   DiscordGatewayClient.js#_onInteraction).
   ═══════════════════════════════════════════════════════════ */

const DEFAULT_MESSAGE =
  '⚠️ A Ayami entrará em atualização em breve. Alguns recursos poderão ficar temporariamente indisponíveis durante a manutenção.';

// Cache local do processo — instantâneo pra quem ativou (mesmo cluster),
// e atualizado via IPC assim que o ClusterManager repassa o broadcast
// pros outros clusters (ver ClusterWorker.js / ClusterManager.js).
let _state = {
  active:      false,
  message:     DEFAULT_MESSAGE,
  activatedBy: null,
  activatedAt: null,
};

let _loadedFromDb = false;

/** Aplica um novo estado ao cache local deste processo (sem tocar o Mongo). */
function applyLocalState(partial) {
  _state = {
    active:      !!partial.active,
    message:     partial.message || DEFAULT_MESSAGE,
    activatedBy: partial.activatedBy ?? null,
    activatedAt: partial.activatedAt ?? null,
  };
}

/** Carrega o estado persistido no boot de cada cluster (uma vez). */
async function loadFromDb() {
  if (_loadedFromDb) return _state;
  _loadedFromDb = true;
  try {
    const BotConfig = require('../../Mongodb/botConfig.js');
    const cfg = await BotConfig.findOne({ key: 'global' }).lean();
    if (cfg?.maintenance) applyLocalState(cfg.maintenance);
  } catch { /* Mongo pode não estar pronto ainda — assume inativo */ }
  return _state;
}

/** Checagem síncrona (cache em memória) — segura pra chamar em toda interação. */
function isActive() {
  return _state.active;
}

function getMessage() {
  return _state.message || DEFAULT_MESSAGE;
}

function getState() {
  return { ..._state };
}

/**
 * Ativa/desativa e persiste no Mongo + pede pro ClusterManager replicar
 * pra todos os clusters (broadcast via parentPort, igual setPresenceAllClusters).
 * `client` é o DiscordGatewayClient da instância que rodou o comando.
 */
async function setActive(client, active, { staffId = null, message = null } = {}) {
  const BotConfig = require('../../Mongodb/botConfig.js');

  const next = {
    active,
    message:     active ? (message || DEFAULT_MESSAGE) : null,
    activatedBy: active ? staffId : null,
    activatedAt: active ? Date.now() : null,
  };

  await BotConfig.findOneAndUpdate(
    { key: 'global' },
    { key: 'global', maintenance: next },
    { upsert: true }
  );

  // Aplica localmente já-já (sem esperar o round-trip do IPC) e pede
  // pro ClusterManager replicar pros OUTROS clusters imediatamente.
  applyLocalState(next);
  client?.broadcastMaintenanceMode?.(next);

  return getState();
}

module.exports = {
  DEFAULT_MESSAGE,
  loadFromDb,
  applyLocalState,
  isActive,
  getMessage,
  getState,
  setActive,
};
