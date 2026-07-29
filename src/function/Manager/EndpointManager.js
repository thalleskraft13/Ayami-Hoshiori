'use strict';

const ClusterSyncManager = require('./ClusterSyncManager.js');
const {
  LogicEndpointModel,
  LogicEndpointRequestModel,
  LogicEndpointLogModel,
} = require('../../Mongodb/logicEndpoint.js');
const PremiumManager = require('../Utils/PremiumManager.js');
const { getPlan }    = require('../Utils/PremiumPlans.js');

const POLL_FALLBACK_MS = 2_000;
const MAX_PRINTLOG_LINES_STORED = 50;

const WORKER_ID = `${process.env.CLUSTER_ID ?? '0'}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;

class EndpointManager {
  constructor(client) {
    this.client = client;
    this._sync  = new ClusterSyncManager();
  }

  async start() {
    this._sync.watch('logic-endpoint-requests', LogicEndpointRequestModel, (change) => {
      this._onChange(change).catch(err =>
        console.error('[Endpoints] Erro ao tratar mudança na fila:', err.message)
      );
    }, { pollIntervalMs: POLL_FALLBACK_MS });

    console.log('[Endpoints] EndpointManager pronto — ouvindo a fila de Endpoints via Mongo.');
  }

  stop() {
    this._sync.destroy();
  }

  async _onChange(change) {
    const doc = change.fullDocument;
    if (!doc || doc.status !== 'pending') return;
    if (!this._ownsGuild(doc.guildId)) return;

    const claimed = await LogicEndpointRequestModel.findOneAndUpdate(
      { _id: doc._id, status: 'pending' },
      { status: 'processing', claimedBy: WORKER_ID },
      { new: true }
    ).catch(() => null);

    if (!claimed) return;

    await this._process(claimed);
  }

  _ownsGuild(guildId) {

    if (!this.client.guilds) return true;
    return this.client.guilds.has(guildId);
  }

  async _process(reqDoc) {
    const startedAt = Date.now();
    const { guildId, logicScriptId } = reqDoc;

    let status, responseStatus, responseHeaders, responseBody, error, logs = [];

    try {
      const runner = this.client.logicScriptRunner;
      if (!runner) throw new Error('ScriptRunner indisponível.');

      const result = await runner.runEndpoint(guildId, logicScriptId, {
        method:    reqDoc.method,
        headers:   reqDoc.headers,
        query:     reqDoc.query,
        body:      reqDoc.body,
        ip:        reqDoc.ip,
        userAgent: reqDoc.userAgent,
      });

      logs = result.logs ?? [];

      if (!result.found) {
        status = 'error'; responseStatus = 404;
        error = 'Arquivo do Logic Script não encontrado (o Endpoint pode ter sido removido).';
        responseBody = { success: false, error };
      } else if (result.disabled) {
        status = 'error'; responseStatus = 403;
        error = 'Este Endpoint está desativado.';
        responseBody = { success: false, error };
      } else if (result.noHandler) {
        status = 'error'; responseStatus = 501;
        error = "Este script não possui um bloco 'on endpoint(event) ... end'.";
        responseBody = { success: false, error };
      } else if (!result.ok) {
        status = 'error'; responseStatus = 500;
        error = result.error;
        responseBody = { success: false, error };
      } else {
        status = 'done';
        responseStatus  = result.status ?? 200;
        responseHeaders = result.headers ?? {};
        responseBody    = result.body ?? { success: true };
      }
    } catch (err) {
      status = 'error'; responseStatus = 500;
      error = err.message;
      responseBody = { success: false, error };
    }

    await LogicEndpointRequestModel.updateOne({ _id: reqDoc._id }, {
      status,
      responseStatus,
      responseHeaders: responseHeaders ?? {},
      responseBody,
      error: error ?? null,
      processedAt: new Date(),
    }).catch(err => console.error('[Endpoints] Erro ao gravar resposta na fila:', err.message));

    await this._recordStats(reqDoc, responseStatus, error, logs, Date.now() - startedAt);
  }

  async _recordStats(reqDoc, statusCode, error, logs, durationMs) {
    const { guildId, logicScriptId } = reqDoc;

    try {
      await LogicEndpointModel.updateOne(
        { guildId, logicScriptId },
        { $inc: { requestCount: 1 }, $set: { lastRequestAt: new Date(), lastStatus: statusCode } }
      );
    } catch (err) {
      console.error('[Endpoints] Erro ao atualizar estatísticas do Endpoint:', err.message);
    }

    let plan;
    try {
      let planKey = null;
      const premium = await PremiumManager.getGuildPremium(guildId);
      if (premium.status) planKey = premium.planId;
      plan = getPlan(planKey);
    } catch {
      plan = getPlan(null);
    }

    const historyLimit = plan.endpoints?.historyLimit ?? 20;
    const keepLogs      = !!plan.endpoints?.errorLogs;

    try {
      await LogicEndpointLogModel.create({
        guildId, logicScriptId,
        method:     reqDoc.method,
        statusCode,
        ip:         reqDoc.ip,
        durationMs,
        error:      error ?? null,
        logs:       keepLogs ? logs.slice(0, MAX_PRINTLOG_LINES_STORED) : [],
      });

      const total = await LogicEndpointLogModel.countDocuments({ guildId, logicScriptId });
      if (total > historyLimit) {
        const excess = await LogicEndpointLogModel.find({ guildId, logicScriptId })
          .sort({ createdAt: 1 })
          .limit(total - historyLimit)
          .select('_id')
          .lean();
        if (excess.length) {
          await LogicEndpointLogModel.deleteMany({ _id: { $in: excess.map(d => d._id) } });
        }
      }
    } catch (err) {
      console.error('[Endpoints] Erro ao gravar histórico:', err.message);
    }
  }
}

module.exports = EndpointManager;
