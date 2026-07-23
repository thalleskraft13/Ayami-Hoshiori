'use strict';

const mongoose = require('mongoose');

const { FlowModel, CustomCommandModel, FlowRunLogModel, PersistentVarModel} = require('../../../Mongodb/flow.js');
const TriggerRegistry    = require('./TriggerRegistry.js');
const ConditionEvaluator = require('./ConditionEvaluator.js');
const ActionRunner       = require('./ActionRunner.js');
const ExecutionContext   = require('./ExecutionContext.js');
const DiscordRequest = require("../../DiscordRequest.js")


const AUDIT_LOG_CHANNEL = '1511462019545563237';
const MAX_CONCURRENT_FLOWS = 50; 

function parseDuration(input) {
  if (input === undefined || input === null || input === '') return 0;
  if (typeof input === 'number') return Math.max(0, input);

  const str = String(input).trim().toLowerCase();
  if (/^\d+$/.test(str)) return Number(str); 

  const UNIT_MS = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };
  const regex   = /(\d+)\s*(d|h|m|s)/g;

  let total = 0;
  let match;
  let matched = false;
  while ((match = regex.exec(str)) !== null) {
    matched = true;
    total += Number(match[1]) * UNIT_MS[match[2]];
  }

  return matched ? total : 0;
}

function formatDuration(ms) {
  if (ms <= 0) return 'agora';

  const days    = Math.floor(ms / 86_400_000);
  const hours   = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);

  const parts = [];
  if (days)    parts.push(`${days} dia${days > 1 ? 's' : ''}`);
  if (hours)   parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
  if (!days && !hours && !minutes && seconds) parts.push(`${seconds} segundo${seconds > 1 ? 's' : ''}`);

  if (!parts.length) return 'menos de 1 minuto';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1];
}

class LogicEngine {

  constructor(client) {
    this.client    = client;
    this._running  = false;

    this.triggerRegistry = new TriggerRegistry(client);
    this.conditionEval   = new ConditionEvaluator(client);
    this.actionRunner    = new ActionRunner(client);

    this._concurrentMap = new Map();  

    this._flowCache    = new Map();   
    this._CACHE_TTL_MS = 30_000;
  }


  start() {
    if (this._running) return;
    this._running = true;

    this.triggerRegistry.on('trigger', ({ triggerCategory, triggerType, guildId, discordCtx }) => {
      this._onTrigger(triggerCategory, triggerType, guildId, discordCtx)
        .catch(err => console.error('[LogicEngine] Erro no pipeline de trigger:', err));
    });

    this._hookCustomCommands();

    this._hookTaskManager();

    console.log('[LogicEngine] Iniciado.');
  }

  stop() {
    this._running = false;
    this.triggerRegistry.removeAllListeners();
    console.log('[LogicEngine] Parado.');
  }


  handleGateway(payload) {
    this.triggerRegistry.handle(payload);
  }


  async _onTrigger(triggerCategory, triggerType, guildId, discordCtx) {
    if (!guildId) return;

    const current = this._concurrentMap.get(guildId) || 0;
    if (current >= MAX_CONCURRENT_FLOWS) {
      console.warn(`[LogicEngine] Guild ${guildId} atingiu limite de fluxos concorrentes.`);
      return;
    }

    const flows = await this._findFlows(guildId, triggerCategory, triggerType);
    if (!flows.length) return;

    this._concurrentMap.set(guildId, current + flows.length);

    const promises = flows.map(flow =>
      this._runFlow(flow, discordCtx)
        .finally(() => {
          const c = this._concurrentMap.get(guildId) || 1;
          this._concurrentMap.set(guildId, c - 1);
        })
    );

    await Promise.allSettled(promises);
  }


  async _runFlow(flow, discordCtx) {
    const start = Date.now();
    let result  = 'success';
    let errorMsg = null;

    try {
      if (flow.cooldown > 0 && discordCtx.userId) {
        const expires = flow.cooldownMap?.[discordCtx.userId] || 0;
        const remaining = expires - Date.now();
        if (remaining > 0) {
          result = 'cooldown_blocked';
          await this._sendCooldownWarning(discordCtx, remaining);
          return;
        }
      }

      const ctx = new ExecutionContext({ flow, discordCtx, client: this.client });
     ctx.runtimeVars = await this._loadGlobalVars(discordCtx.guildId); 
      await ctx.loadPersistent();
      

      const condOk = await this.conditionEval.evaluate(flow.conditions, ctx);
      if (!condOk) {
        result = 'condition_blocked';
        return;
      }

      await this.actionRunner.run(flow.actions, ctx, flow.executionMode);

      await ctx.savePersistent();

      if (flow.cooldown > 0 && discordCtx.userId) {
        const expiresAt = Date.now() + flow.cooldown;
        flow.cooldownMap = { ...(flow.cooldownMap || {}), [discordCtx.userId]: expiresAt };
        await FlowModel.updateOne(
          { flowId: flow.flowId },
          { $set: { [`cooldownMap.${discordCtx.userId}`]: expiresAt } }
        );
      }

      this._invalidateCache(discordCtx.guildId, flow.trigger.category, flow.trigger.type);

    } catch (err) {
      result   = 'failed';
      errorMsg = err?.message || String(err);
      console.error(`[LogicEngine] Fluxo ${flow.flowId} falhou:`, err);
    } finally {
      const duration = Date.now() - start;

      const statsUpdate = { $inc: { 'stats.totalRuns': 1 }, $set: { 'stats.lastRunAt': new Date() } };
      if (result === 'success') statsUpdate.$inc['stats.successRuns'] = 1;
      if (result === 'failed')  statsUpdate.$inc['stats.failedRuns']  = 1;

      FlowModel.updateOne({ flowId: flow.flowId }, statsUpdate).catch(() => {});

      if (result !== 'condition_blocked') {
        FlowRunLogModel.create({
          flowId:   flow.flowId,
          guildId:  discordCtx.guildId,
          result,
          context:  { userId: discordCtx.userId, channelId: discordCtx.channelId },
          error:    errorMsg,
          duration
        }).catch(() => {});
      }
    }
  }

  async _sendCooldownWarning(discordCtx, remainingMs) {
    const timeText = formatDuration(remainingMs);
    const content  = `⏳ Ainda faltam **${timeText}** pra poder usar isso de novo!`;

    try {
      if (discordCtx.interaction) {
        const interaction = discordCtx.interaction;
        await DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          { method: 'POST', body: { type: 4, data: { content, flags: 64 } } }
        );
      } else if (discordCtx.channelId) {
        await DiscordRequest(`/channels/${discordCtx.channelId}/messages`, {
          method: 'POST',
          body:   { content }
        });
      }
    } catch (err) {
      console.error('[LogicEngine] Falha ao enviar aviso de cooldown:', err?.message || err);
    }
  }


  async runById(flowId, discordCtx) {
    const flow = await FlowModel.findOne({ flowId, enabled: true }).lean();
    if (!flow) return;
    return this._runFlow(flow, discordCtx);
  }


  async _findFlows(guildId, triggerCategory, triggerType) {
    const key    = `${guildId}:${triggerCategory}:${triggerType}`;
    const cached = this._flowCache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.flows;
    }

    const flows = await FlowModel.find({
      guildId,
      'trigger.category': triggerCategory,
      'trigger.type':     triggerType,
      enabled:            true
    }).lean();

    this._flowCache.set(key, { flows, expires: Date.now() + this._CACHE_TTL_MS });
    return flows;
  }

  _invalidateCache(guildId, category, type) {
    const key = `${guildId}:${category}:${type}`;
    this._flowCache.delete(key);
  }

  invalidateGuildCache(guildId) {
    for (const key of this._flowCache.keys()) {
      if (key.startsWith(`${guildId}:`)) this._flowCache.delete(key);
    }
  }


  _hookCustomCommands() {

    this.triggerRegistry.on('trigger', async ({ triggerCategory, triggerType, guildId, discordCtx }) => {
      if (triggerCategory !== 'message' || triggerType !== 'message_created') return;

      const content = discordCtx.message?.content;
      if (!content) return;

      await this._handleCustomCommand(guildId, discordCtx, content)
        .catch(err => console.error('[LogicEngine] Erro em comando customizado:', err));
    });
  }

  async _handleCustomCommand(guildId, discordCtx, content) {
  const commands = await this._getCustomCommands(guildId);
  if (!commands.length) return;

  for (const cmd of commands) {
    if (!cmd.enabled) continue;

    const prefix  = cmd.prefix || '!';
    const names   = [cmd.name, ...(cmd.aliases || [])];
    const matched = names.find(n =>
      content.toLowerCase() === `${prefix}${n}`.toLowerCase() ||
      content.toLowerCase().startsWith(`${prefix}${n} `)
    );

    if (!matched) continue;

    if (cmd.cooldown > 0) {
      const expires   = cmd.cooldownMap?.[discordCtx.userId] || 0;
      const remaining = expires - Date.now();
      if (remaining > 0) {
        await this._sendCooldownWarning(discordCtx, remaining);
        return;
      }
    }

    await this.runById(cmd.flowId, {
      ...discordCtx,
      customData: {
        command: cmd,
        args: content.slice(prefix.length + matched.length).trim().split(/ +/)
      }
    });

    if (cmd.cooldown > 0) {
      const expiresAt = Date.now() + cmd.cooldown;
      CustomCommandModel.updateOne(
        { commandId: cmd.commandId },
        { $set: { [`cooldownMap.${discordCtx.userId}`]: expiresAt } }
      ).catch(() => {});

      this._flowCache.delete(`cmd:${guildId}`);
    }

    break;
  }
}

async _getCustomCommands(guildId) {
  const key    = `cmd:${guildId}`;
  const cached = this._flowCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.flows;

  const commands = await CustomCommandModel.find({ guildId, enabled: true }).lean();
  this._flowCache.set(key, { flows: commands, expires: Date.now() + 60_000 });
  return commands;
}


  _hookTaskManager() {
    const tm = this.client.taskManager;
    if (!tm) return;

    const originalExecute = tm.execute.bind(tm);

    tm.execute = async (task) => {
      switch (task.tipo) {

        case 'run_flow': {
          const { flowId, discordCtx } = task.dados;
          await this.runById(flowId, discordCtx || {});
          break;
        }

        case 'remove_role': {
          const { guildId, userId, roleId } = task.dados;
          await require('../../DiscordRequest.js')(
            `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
            { method: 'DELETE' }
          ).catch(() => {});
          break;
        }

        case 'time_trigger': {
          const { flowId, guildId } = task.dados;
          await this.runById(flowId, { guildId, channelId: null, userId: null });
          break;
        }

        default:
          await originalExecute(task);
      }
    };

    console.log('[LogicEngine] TaskManager hooked.');
  }


  async createFlow(data) {
    const { randomUUID } = require('crypto');
    const flow = await FlowModel.create({
      flowId:        randomUUID(),
      guildId:       data.guildId,
      name:          data.name,
      description:   data.description || '',
      trigger:       data.trigger,
      conditions:    data.conditions || [],
      actions:       data.actions || [],
      variables:     data.variables || [],
      executionMode: data.executionMode || 'sequential',
      cooldown:      data.cooldown || 0,
      createdBy:     data.createdBy || null
    });
    
    this._auditLog('flow_create', data.guildId, {
  name:       flow.name,
  flowId:     flow.flowId,
  trigger:    flow.trigger,
  conditions: flow.conditions,
  actions:    flow.actions,
  variables:  flow.variables
}).catch(() => {});

    this.invalidateGuildCache(data.guildId);
    return flow;
  }

  async updateFlow(flowId, guildId, updates) {
    const flow = await FlowModel.findOneAndUpdate(
      { flowId, guildId },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
    
    if (flow) {
  this._auditLog('flow_update', guildId, {
    name:       flow.name,
    flowId:     flow.flowId,
    trigger:    flow.trigger,
    conditions: flow.conditions,
    actions:    flow.actions,
    variables:  flow.variables
  }).catch(() => {});
}
    if (flow) this.invalidateGuildCache(guildId);
    return flow;
  }
  
  async deleteFlow(flowId, guildId) {
  const flow = await FlowModel.findOne({ flowId, guildId }).lean();
  await FlowModel.deleteOne({ flowId, guildId });
  this.invalidateGuildCache(guildId);

  if (flow) {
    this._auditLog('flow_delete', guildId, {
      name:   flow.name,
      flowId: flow.flowId
    }).catch(() => {});
  }
}

  

  async getFlows(guildId) {
    return FlowModel.find({ guildId }).lean();
  }

  async toggleFlow(flowId, guildId) {
  const flow = await FlowModel.findOne({ flowId, guildId });
  if (!flow) return null;
  flow.enabled = !flow.enabled;
  await flow.save();
  
  this._auditLog('flow_toggle', guildId, {
  name:    flow.name,
  flowId:  flow.flowId,
  enabled: flow.enabled
}).catch(() => {});

  if (flow.trigger?.type === 'scheduled_trigger') {
    if (flow.enabled) {
      const { hour = 0, minute = 0 } = flow.trigger.filters || {};
      const task = await this.client.taskManager.createScheduled({
        guildId,
        flowId,
        hour:   Number(hour),
        minute: Number(minute)
      });
      await FlowModel.updateOne(
  { flowId },
  { $set: { 'trigger.filters.taskId': task.taskId } }
);
    } else {
      const taskId = flow.trigger.filters?.taskId;
      if (taskId) await this.client.taskManager.cancel(taskId);
    }
  }

  this.invalidateGuildCache(guildId);
  return flow;
}


async _auditLog(action, guildId, data) {
  try {
    const guild = await DiscordRequest(`/guilds/${guildId}`).catch(() => null);
    const guildName = guild?.name || guildId;

    const actionLabel = {
      flow_create:    '✅ Fluxo Criado',
      flow_update:    '✏️ Fluxo Editado',
      flow_delete:    '🗑️ Fluxo Excluído',
      flow_toggle:    '🔄 Fluxo Alternado',
      cmd_create:     '✅ Comando Criado',
      cmd_delete:     '🗑️ Comando Excluído'
    }[action] || action;

    const fields = [
      { name: '🏠 Servidor', value: `${guildName} \`(${guildId})\``, inline: false }
    ];

    if (data.name)    fields.push({ name: '📌 Nome',    value: data.name,    inline: true });
    if (data.enabled !== undefined) fields.push({ name: '⚡ Status', value: data.enabled ? '🟢 Ativo' : '🔴 Desativado', inline: true });

    if (data.trigger) {
      const t = data.trigger;
      fields.push({
        name:  '🎯 Trigger',
        value: `Categoria: \`${t.category}\`\nTipo: \`${t.type}\`` +
               (Object.keys(t.filters || {}).length ? `\nFiltros: \`${JSON.stringify(t.filters)}\`` : ''),
        inline: false
      });
    }

    if (data.conditions?.length) {
      const lines = data.conditions.map((c, i) =>
        `${i + 1}. \`${c.category}:${c.type}\`` +
        (Object.keys(c.params || {}).length ? ` — ${JSON.stringify(c.params)}` : '') +
        (c.negate ? ' *(negado)*' : '')
      ).join('\n');
      fields.push({ name: `🔍 Condições (${data.conditions.length})`, value: lines.slice(0, 1024), inline: false });
    }

    if (data.actions?.length) {
      const lines = data.actions
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a, i) =>
          `${i + 1}. \`${a.category}:${a.type}\`` +
          (Object.keys(a.params || {}).length ? ` — ${JSON.stringify(a.params)}` : '')
        ).join('\n');
      fields.push({ name: `⚡ Ações (${data.actions.length})`, value: lines.slice(0, 1024), inline: false });
    }

    if (data.variables?.length) {
      const lines = data.variables.map(v =>
        `• \`${v.name}\` (${v.type}/${v.scope || 'flow'}) = \`${JSON.stringify(v.defaultValue)}\`${v.persistent ? ' 💾' : ''}`
      ).join('\n');
      fields.push({ name: `📦 Variáveis (${data.variables.length})`, value: lines.slice(0, 1024), inline: false });
    }

    if (data.prefix && data.commandName) {
      fields.push({
        name:  '🔧 Comando',
        value: `Prefixo: \`${data.prefix}\`\nNome: \`${data.commandName}\`` +
               (data.aliases?.length ? `\nAliases: \`${data.aliases.join(', ')}\`` : '') +
               (data.cooldown ? `\nCooldown: \`${data.cooldown / 1000}s\`` : ''),
        inline: false
      });
    }

    if (data.flowId) fields.push({ name: '🔑 Flow ID', value: `\`${data.flowId}\``, inline: false });

    await DiscordRequest(`/channels/${AUDIT_LOG_CHANNEL}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title:     actionLabel,
          color:     action.includes('delete') ? 0xED4245 : action.includes('update') || action.includes('toggle') ? 0xFEE75C : 0x57F287,
          fields,
          timestamp: new Date().toISOString(),
          footer:    { text: `Logic Builder Audit Log` }
        }]
      }
    });
  } catch (err) {
    console.error('[AuditLog] Erro ao enviar log:', err);
  }
}


  async createCommand(data) {
    const { randomUUID } = require('crypto');
    const cmd = await CustomCommandModel.create({
      commandId:     randomUUID(),
      guildId:       data.guildId,
      name:          data.name,
      aliases:       data.aliases || [],
      description:   data.description || '',
      prefix:        data.prefix || '!',
      flowId:        data.flowId,
      cooldown:      data.cooldown || 0,
      permissions:   data.permissions || [],
      requiredRoles: data.requiredRoles || []
    });
    
    this._auditLog('cmd_create', data.guildId, {
  commandName: cmd.name,
  prefix:      cmd.prefix,
  aliases:     cmd.aliases,
  cooldown:    cmd.cooldown,
  flowId:      cmd.flowId
}).catch(() => {});

    this._flowCache.delete(`cmd:${data.guildId}`);
    return cmd;
  }

  async deleteCommand(commandId, guildId) {
    const cmd = await CustomCommandModel.findOne({ commandId, guildId });
    if (!cmd) return false;
    this._auditLog('cmd_delete', guildId, {
  commandName: cmd.name,
  prefix:      cmd.prefix,
  flowId:      cmd.flowId
}).catch(() => {});
    await cmd.deleteOne();
    this._flowCache.delete(`cmd:${guildId}`);
    return true;
  }
  
  async _loadGlobalVars(guildId) {
  const vars = await PersistentVarModel.find({ guildId });

  const map = {};
  for (const v of vars) {
    map[v.name] = v.value;
  }

  return map;
}
}

module.exports = LogicEngine;
module.exports.parseDuration  = parseDuration;
module.exports.formatDuration = formatDuration;
