// src/functions/Managers/LanguageManager/LanguageSyncManager.js

/**
 * SyncManager — camada de preparação para sincronização entre shards.
 *
 * HOJE:   opera em modo "local" (sem Redis/DB)
 * FUTURO: plugar Redis pub/sub ou DB adapter aqui
 *
 * Responsabilidades:
 *  - Buscar language config de users/guilds (DB)
 *  - Emitir eventos de reload entre shards
 *  - Versionar systems em produção
 */
class LanguageSyncManager {
  /**
   * @param {object} options
   * @param {object} [options.adapter]   Adapter DB/Redis (opcional)
   * @param {string} [options.shardId]   ID do shard atual
   */
  constructor(options = {}) {
    this.adapter = options.adapter ?? null;
    this.shardId = options.shardId ?? "local";
    this._mode   = this.adapter ? "connected" : "local";

    if (this._mode === "local") {
      console.info(
        "[SyncManager] 🟡 Modo local — sem sincronização entre shards.\n" +
        "              Plugue um adapter Redis/DB para habilitar sync."
      );
    }
  }

  // ── Language Config ────────────────────────────────

  /**
   * Retorna o idioma preferido de um usuário.
   * HOJE: retorna null (sem DB)
   * FUTURO: busca no Redis/DB
   *
   * @param {string} userId
   * @returns {Promise<string|null>}
   */
  async getUserLocale(userId) {
    if (!this.adapter) return null;

    try {
      return await this.adapter.getUserLocale(userId);
    } catch (err) {
      console.warn(`[SyncManager] ⚠️  Falha ao buscar locale do user ${userId}:`, err.message);
      return null;
    }
  }

  /**
   * Retorna o idioma preferido de uma guild.
   * HOJE: retorna null (sem DB)
   * FUTURO: busca no Redis/DB
   *
   * @param {string} guildId
   * @returns {Promise<string|null>}
   */
  async getGuildLocale(guildId) {
    if (!this.adapter) return null;

    try {
      return await this.adapter.getGuildLocale(guildId);
    } catch (err) {
      console.warn(`[SyncManager] ⚠️  Falha ao buscar locale da guild ${guildId}:`, err.message);
      return null;
    }
  }

  // ── Reload entre Shards ────────────────────────────

  /**
   * Emite sinal de reload de um system para outros shards.
   * HOJE: log local
   * FUTURO: Redis PUBLISH "ayami:reload:level_system"
   *
   * @param {string} systemId
   * @param {string} version
   */
  async broadcastReload(systemId, version) {
    if (!this.adapter) {
      console.info(
        `[SyncManager] 📡 [LOCAL] Reload de "${systemId}@${version}" ` +
        `(sem broadcast — modo local)`
      );
      return;
    }

    try {
      await this.adapter.publish(`ayami:reload:${systemId}`, { version, shardId: this.shardId });
      console.info(`[SyncManager] 📡 Reload broadcast: "${systemId}@${version}"`);
    } catch (err) {
      console.error("[SyncManager] ❌ Broadcast falhou:", err.message);
    }
  }

  /**
   * Escuta reloads emitidos por outros shards.
   * HOJE: no-op
   * FUTURO: Redis SUBSCRIBE
   *
   * @param {Function} onReload  callback(systemId, version)
   */
  listenReloads(onReload) {
    if (!this.adapter) return;

    this.adapter.subscribe("ayami:reload:*", (channel, payload) => {
      const systemId = channel.replace("ayami:reload:", "");
      onReload(systemId, payload.version);
    });
  }

  // ── Versionamento ──────────────────────────────────

  /**
   * Registra a versão ativa de um system no store global.
   * HOJE: log local
   * FUTURO: Redis SET "ayami:system:level_system:version" "1.2.0"
   *
   * @param {string} systemId
   * @param {string} version
   */
  async registerVersion(systemId, version) {
    if (!this.adapter) {
      console.info(`[SyncManager] 📌 [LOCAL] "${systemId}" → v${version}`);
      return;
    }

    try {
      await this.adapter.set(`ayami:system:${systemId}:version`, version);
    } catch (err) {
      console.warn("[SyncManager] ⚠️  Falha ao registrar versão:", err.message);
    }
  }

  get mode() {
    return this._mode;
  }
}

module.exports = { LanguageSyncManager };