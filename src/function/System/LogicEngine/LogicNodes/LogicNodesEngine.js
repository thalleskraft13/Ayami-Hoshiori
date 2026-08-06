'use strict';

const { LogicNodeFlowModel } = require('../../../../Mongodb/logicNodeFlow.js');
const { GuildDb } = require('../../../../Mongodb/guild.js');
const ExecutionContext = require('../LogicBuilder/ExecutionContext.js');
const DiscordRequest = require('../../../DiscordRequest.js');

const MAX_STEPS = 200;

class LogicNodesEngine {

  constructor(client) {
    this.client = client;
    this._running = false;

    this._flowCache = new Map();
    this._CACHE_TTL_MS = 20_000;

    this._prefixCache = new Map();
    this._PREFIX_TTL_MS = 20_000;
  }

  start() {
    if (this._running) return;
    this._running = true;

    const registry = this.client.logicEngine.triggerRegistry;

    registry.on('trigger', ({ triggerCategory, triggerType, guildId, discordCtx }) => {
      this._onTrigger(triggerCategory, triggerType, guildId, discordCtx)
        .catch(err => console.error('[LogicNodesEngine] Erro no pipeline de trigger:', err));
    });

    console.log('[LogicNodesEngine] Iniciado.');
  }

  stop() {
    this._running = false;
  }

  invalidateGuildCache(guildId) {
    this._flowCache.delete(guildId);
    this._prefixCache.delete(guildId);
  }

  async _onTrigger(triggerCategory, triggerType, guildId, discordCtx) {
    if (!guildId) return;

    const { allowed } = await this.client.featureManager.canUse('logicNodes', { guildId });
    if (!allowed) return;

    if (triggerCategory === 'message' && triggerType === 'message_created') {
      return this._handleCommand(guildId, discordCtx);
    }

    if (triggerCategory === 'component' && ['button_clicked', 'select_used', 'modal_submitted'].includes(triggerType)) {
      return this._handleInteraction(guildId, discordCtx);
    }
  }

  async _getFlows(guildId) {
    const cached = this._flowCache.get(guildId);
    if (cached && cached.expires > Date.now()) return cached.flows;

    const flows = await LogicNodeFlowModel.find({ guildId }).lean();
    this._flowCache.set(guildId, { flows, expires: Date.now() + this._CACHE_TTL_MS });
    return flows;
  }

  async _getPrefix(guildId) {
    const cached = this._prefixCache.get(guildId);
    if (cached && cached.expires > Date.now()) return cached.prefix;

    const doc = await GuildDb.findOne({ guildId }).lean();
    const prefix = doc?.logicEngine?.prefix || '!';

    this._prefixCache.set(guildId, { prefix, expires: Date.now() + this._PREFIX_TTL_MS });
    return prefix;
  }

  async _handleCommand(guildId, discordCtx) {
    const content = discordCtx.message?.content;
    if (!content) return;

    const prefix = await this._getPrefix(guildId);
    const flows = await this._getFlows(guildId);

    for (const flow of flows) {
      const startNode = (flow.nodes || []).find(n => n.type === 'command');
      if (!startNode) continue;

      const name = startNode.properties?.commandName;
      if (!name) continue;

      const full = `${prefix}${name}`;
      const matched = content === full || content.startsWith(`${full} `);
      if (!matched) continue;

      const args = content.slice(full.length).trim().split(/\s+/).filter(Boolean);
      await this._runFlowFrom(flow, startNode, { ...discordCtx, customData: { args } });
      break;
    }
  }

  async _handleInteraction(guildId, discordCtx) {
    const customId = discordCtx.customData?.customId;
    if (!customId) return;

    const flows = await this._getFlows(guildId);

    for (const flow of flows) {
      const startNode = (flow.nodes || []).find(
        n => n.type === 'interaction_create' && n.properties?.customId === customId
      );
      if (!startNode) continue;

      await this._runFlowFrom(flow, startNode, discordCtx);
      break;
    }
  }

  async _runFlowFrom(flow, startNode, discordCtx) {
    const ctx = new ExecutionContext({
      flow: { flowId: flow.flowId, variables: [] },
      discordCtx,
      client: this.client
    });

    let current = startNode;
    let steps = 0;

    while (current && steps < MAX_STEPS && !ctx.shouldStop()) {
      steps++;
      current = await this._runNode(flow, current, ctx);
    }
  }

  async _runNode(flow, node, ctx) {
    try {
      if (node.category === 'evento') {
        return this._nextFrom(flow, node.id, 'out');
      }

      if (node.category === 'condicao') {
        const result = await this._evalCondition(node, ctx);
        return this._nextFrom(flow, node.id, result ? 'true' : 'false');
      }

      if (node.category === 'acao') {
        if (node.type === 'edit_reply') {
          await this._runEditReply(node, ctx);
        } else {
          const action = this._mapAction(node);
          if (action) await this.client.logicEngine.actionRunner.run([action], ctx);
        }
        return this._nextFrom(flow, node.id, 'out');
      }

      return null;
    } catch (err) {
      console.error(`[LogicNodesEngine] Erro no nó ${node.id} (${node.type}):`, err);
      return this._nextFrom(flow, node.id, 'out');
    }
  }

  _nextFrom(flow, nodeId, port) {
    const edge = (flow.edges || []).find(e => e.source === nodeId && e.sourcePort === port);
    if (!edge) return null;
    return (flow.nodes || []).find(n => n.id === edge.target) || null;
  }

  _mapAction(node) {
    const p = node.properties || {};

    switch (node.type) {
      case 'send_message':
        return { category: 'message', type: 'send_message', params: { channelId: p.channel, content: p.message } };

      case 'edit_message':
        return { category: 'message', type: 'edit_message', params: { messageId: p.messageId, content: p.message } };

      case 'reply_interaction':
      case 'reply_message':
        return { category: 'message', type: 'reply_message', params: { content: p.message } };

      case 'ephemeral_reply':
        return { category: 'message', type: 'reply_message', params: { content: p.message, ephemeral: true } };

      case 'delay':
        return { category: 'time', type: 'wait_seconds', params: { seconds: p.seconds } };

      default:
        return null;
    }
  }

  async _runEditReply(node, ctx) {
    const interaction = ctx.discord.interaction;
    if (!interaction) return;

    const content = await ctx.interpolate(node.properties?.message || '');
    await DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body: { content } }
    );
  }

  async _evalCondition(node, ctx) {
    const result = await this.client.logicEngine.conditionEval.evaluate(
      [{ category: 'value', type: node.type, params: node.properties || {} }],
      ctx
    );
    return result;
  }
}

module.exports = LogicNodesEngine;
