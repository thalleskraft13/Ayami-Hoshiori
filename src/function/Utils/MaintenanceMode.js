'use strict';


const DEFAULT_MESSAGE =
  '⚠️ A Ayami entrará em atualização em breve. Alguns recursos poderão ficar temporariamente indisponíveis durante a manutenção.';

let _state = {
  active:      false,
  message:     DEFAULT_MESSAGE,
  activatedBy: null,
  activatedAt: null,
};

let _loadedFromDb = false;

function applyLocalState(partial) {
  _state = {
    active:      !!partial.active,
    message:     partial.message || DEFAULT_MESSAGE,
    activatedBy: partial.activatedBy ?? null,
    activatedAt: partial.activatedAt ?? null,
  };
}

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

function isActive() {
  return _state.active;
}

function getMessage() {
  return _state.message || DEFAULT_MESSAGE;
}

function getState() {
  return { ..._state };
}

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
