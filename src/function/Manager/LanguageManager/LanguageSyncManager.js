
class LanguageSyncManager {
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


  async getUserLocale(userId) {
    if (!this.adapter) return null;

    try {
      return await this.adapter.getUserLocale(userId);
    } catch (err) {
      console.warn(`[SyncManager] ⚠️  Falha ao buscar locale do user ${userId}:`, err.message);
      return null;
    }
  }

  async getGuildLocale(guildId) {
    if (!this.adapter) return null;

    try {
      return await this.adapter.getGuildLocale(guildId);
    } catch (err) {
      console.warn(`[SyncManager] ⚠️  Falha ao buscar locale da guild ${guildId}:`, err.message);
      return null;
    }
  }


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

  listenReloads(onReload) {
    if (!this.adapter) return;

    this.adapter.subscribe("ayami:reload:*", (channel, payload) => {
      const systemId = channel.replace("ayami:reload:", "");
      onReload(systemId, payload.version);
    });
  }


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