'use strict';

const mongoose = require('mongoose');

const { FlowModel, CustomCommandModel, FlowRunLogModel, PersistentVarModel} = require('../../../Mongodb/flow.js');
const TriggerRegistry    = require('./TriggerRegistry.js');
const ConditionEvaluator = require('./ConditionEvaluator.js');
const ActionRunner       = require('./ActionRunner.js');
const ExecutionContext   = require('./ExecutionContext.js');
const DiscordRequest = require("../../DiscordRequest.js")
const { localeCtx }  = require('../../Utils/ctxLocale.js');


const AUDIT_LOG_CHANNEL = '1511462019545563237';
const MAX_CONCURRENT_FLOWS = 50; // por guild, evita flood

/**
 * Converte uma string de duração humana em milissegundos.
 * Aceita combinações como: "24h", "22h 10m", "1d 5h 30m", "90m", "2d".
 * Unidades: d (dias), h (horas), m (minutos), s (segundos).
 * Também aceita número puro (assume milissegundos, para compatibilidade
 * com cooldowns antigos salvos antes desta mudança).
 *
 * @param {string|number} input
 * @returns {number} duração em ms (0 se inválido/vazio)
 */
function parseDuration(input) {
  if (input === undefined || input === null || input === '') return 0;
  if (typeof input === 'number') return Math.max(0, input);

  const str = String(input).trim().toLowerCase();
  if (/^\d+$/.test(str)) return Number(str); // número puro = ms (legado)

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

/**
 * Formata uma duração em ms para texto legível em português.
 * Ex: 86400000 → "24 horas" | 80400000 → "22 horas e 20 minutos"
 *     45000 → "45 segundos" | 0 → "agora"
 */
const DURATION_WORDS = {
  'pt-BR': { day: ['dia', 'dias'], hour: ['hora', 'horas'], minute: ['minuto', 'minutos'], second: ['segundo', 'segundos'], and: 'e', now: 'agora', lessThanMinute: 'menos de 1 minuto' },
  'en-US': { day: ['day', 'days'], hour: ['hour', 'hours'], minute: ['minute', 'minutes'], second: ['second', 'seconds'], and: 'and', now: 'now', lessThanMinute: 'less than 1 minute' },
  'en-GB': { day: ['day', 'days'], hour: ['hour', 'hours'], minute: ['minute', 'minutes'], second: ['second', 'seconds'], and: 'and', now: 'now', lessThanMinute: 'less than 1 minute' },
  'es-ES': { day: ['día', 'días'], hour: ['hora', 'horas'], minute: ['minuto', 'minutos'], second: ['segundo', 'segundos'], and: 'y', now: 'ahora', lessThanMinute: 'menos de 1 minuto' },
};

function formatDuration(ms, locale = 'pt-BR') {
  const w = DURATION_WORDS[locale] || DURATION_WORDS['pt-BR'];
  if (ms <= 0) return w.now;

  const days    = Math.floor(ms / 86_400_000);
  const hours   = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);

  const parts = [];
  if (days)    parts.push(`${days} ${days > 1 ? w.day[1] : w.day[0]}`);
  if (hours)   parts.push(`${hours} ${hours > 1 ? w.hour[1] : w.hour[0]}`);
  if (minutes) parts.push(`${minutes} ${minutes > 1 ? w.minute[1] : w.minute[0]}`);
  // Só mostra segundos se for a única unidade (evita "1 hora, 2 minutos e 14 segundos" verboso)
  if (!days && !hours && !minutes && seconds) parts.push(`${seconds} ${seconds > 1 ? w.second[1] : w.second[0]}`);

  if (!parts.length) return w.lessThanMinute;
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ` ${w.and} ` + parts[parts.length - 1];
}

/**
 * LogicEngine
 *
 * Orquestra o pipeline completo:
 *   TriggerRegistry → FlowModel lookup → ConditionEvaluator → ActionRunner
 *
 * Integra com o TaskManager existente para triggers de tempo.
 * Integra com NextMessageCollector para comandos personalizados.
 *
 * Exposição no client:
 *   client.logicEngine = new LogicEngine(client);
 *   client.logicEngine.start();
 */
class LogicEngine {

  constructor(client) {
    this.client    = client;
    this._running  = false;

    // Sub-sistemas
    this.triggerRegistry = new TriggerRegistry(client);
    this.conditionEval   = new ConditionEvaluator(client);
    this.actionRunner    = new ActionRunner(client);

    // Rastreamento de execuções concorrentes por guild
    this._concurrentMap = new Map();  // guildId → count

    // Cache de fluxos em memória (TTL 30s para reduzir queries)
    this._flowCache    = new Map();   // `${guildId}:${category}:${type}` → { flows, expires }
    this._CACHE_TTL_MS = 30_000;
  }

  /* ════════════════════������══════════════════════
     INICIALIZAÇÃO
     ═══════════════════════════════════════════ */

  start() {
    if (this._running) return;
    this._running = true;

    // Escuta todos os eventos normalizados pelo TriggerRegistry
    this.triggerRegistry.on('trigger', ({ triggerCategory, triggerType, guildId, discordCtx }) => {
      this._onTrigger(triggerCategory, triggerType, guildId, discordCtx)
        .catch(err => console.error('[LogicEngine] Erro no pipeline de trigger:', err));
    });

    // Registra o handler de comandos personalizados no NextMessageCollector existente
    this._hookCustomCommands();

    // Registra tarefas de tempo no TaskManager existente
    this._hookTaskManager();

    console.log('[LogicEngine] Iniciado.');
  }

  stop() {
    this._running = false;
    this.triggerRegistry.removeAllListeners();
    console.log('[LogicEngine] Parado.');
  }

  /* ═══════════════════════════════════════════
     GATEWAY HANDLER
     Chamado pelo gateway handler do bot para cada evento
     ═══════════════════════════════════════════ */

  handleGateway(payload) {
    this.triggerRegistry.handle(payload);
  }

  /* ═══════════════════════════════════════════
     PIPELINE PRINCIPAL
     ═══════════════════════════════════════════ */

  async _onTrigger(triggerCategory, triggerType, guildId, discordCtx) {
    if (!guildId) return;

    // Limita concorrência por guild
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

  /* ═══════════════════════════════════════════
     EXECUÇÃO DE UM FLUXO
     ═══════════════════════════════════════════ */

  async _runFlow(flow, discordCtx) {
    const start = Date.now();
    let result  = 'success';
    let errorMsg = null;

    try {
      // ── Cooldown check ──
      if (flow.cooldown > 0 && discordCtx.userId) {
        const expires = flow.cooldownMap?.[discordCtx.userId] || 0;
        const remaining = expires - Date.now();
        if (remaining > 0) {
          result = 'cooldown_blocked';
          await this._sendCooldownWarning(discordCtx, remaining);
          return;
        }
      }

      // ── Contexto de execução ──
      const ctx = new ExecutionContext({ flow, discordCtx, client: this.client });
     ctx.runtimeVars = await this._loadGlobalVars(discordCtx.guildId); 
      await ctx.loadPersistent();
      

      // ── Avaliação de condições ──
      const condOk = await this.conditionEval.evaluate(flow.conditions, ctx);
      if (!condOk) {
        result = 'condition_blocked';
        return;
      }

      // ── Execução de ações ──
      await this.actionRunner.run(flow.actions, ctx, flow.executionMode);

      // ── Salva variáveis persistentes ──
      await ctx.savePersistent();

      // ── Atualiza cooldown ──
      if (flow.cooldown > 0 && discordCtx.userId) {
        const expiresAt = Date.now() + flow.cooldown;
        flow.cooldownMap = { ...(flow.cooldownMap || {}), [discordCtx.userId]: expiresAt };
        await FlowModel.updateOne(
          { flowId: flow.flowId },
          { $set: { [`cooldownMap.${discordCtx.userId}`]: expiresAt } }
        );
      }

      // ── Invalida cache deste fluxo (stats) ──
      this._invalidateCache(discordCtx.guildId, flow.trigger.category, flow.trigger.type);

    } catch (err) {
      result   = 'failed';
      errorMsg = err?.message || String(err);
      console.error(`[LogicEngine] Fluxo ${flow.flowId} falhou:`, err);
    } finally {
      const duration = Date.now() - start;

      // Atualiza stats no banco (fire-and-forget)
      const statsUpdate = { $inc: { 'stats.totalRuns': 1 }, $set: { 'stats.lastRunAt': new Date() } };
      if (result === 'success') statsUpdate.$inc['stats.successRuns'] = 1;
      if (result === 'failed')  statsUpdate.$inc['stats.failedRuns']  = 1;

      FlowModel.updateOne({ flowId: flow.flowId }, statsUpdate).catch(() => {});

      // Log de execução (apenas se falhou ou debug ativo)
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

  /**
   * Envia a mensagem de cooldown ativo. Usa reply na interação se disponível
   * (ephemeral, não enche o canal), senão envia no canal normalmente.
   */
  async _sendCooldownWarning(discordCtx, remainingMs) {
    const ctx      = localeCtx(discordCtx.interaction);
    const timeText = formatDuration(remainingMs, ctx.system?.locale);
    const content  = this.client.t('logicbuilder.cooldown_warning', { ...ctx, time: timeText });

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

  /* ═══════════════════════════════════════════
     EXECUÇÃO PÚBLICA (por ID)
     Usado por ações "run_flow" e TaskManager
     ═══════════════════════════════════════════ */

  async runById(flowId, discordCtx) {
    const flow = await FlowModel.findOne({ flowId, enabled: true }).lean();
    if (!flow) return;
    return this._runFlow(flow, discordCtx);
  }

  /**
   * Variante de `runById()` usada pela função Premium `runFlow()` do Logic
   * Script (ver Interpreter.js). Diferenças, pedidas no documento de
   * atualização ("Nova Função Premium — Executar Fluxo do Logic Builder"):
   *   - Escopada por guildId: nunca executa um fluxo de OUTRO servidor,
   *     mesmo que o autor do script descubra/adivinhe o ID.
   *   - Retorna erro claro (nunca falha em silêncio) quando o fluxo não
   *     existe, está desativado, ou pertence a outra guild.
   */
  async runFlowById(flowId, discordCtx = {}) {
    if (!flowId) return { ok: false, error: 'ID do fluxo não informado.' };
    if (!discordCtx.guildId) return { ok: false, error: 'Contexto sem guildId.' };

    const flow = await FlowModel.findOne({ flowId: String(flowId), guildId: discordCtx.guildId }).lean();

    if (!flow) {
      return { ok: false, error: `Fluxo '${flowId}' não encontrado neste servidor.` };
    }
    if (!flow.enabled) {
      return { ok: false, error: `Fluxo '${flow.name || flowId}' está desativado.` };
    }

    await this._runFlow(flow, discordCtx);
    return { ok: true };
  }

  /* ═══════════════════════════════════════════
     LOOKUP DE FLUXOS COM CACHE
     ═══════════════════════════════════════════ */

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

  /**
   * Invalida todo o cache de uma guild.
   * Chamado quando um fluxo é criado/editado/deletado.
   */
  invalidateGuildCache(guildId) {
    for (const key of this._flowCache.keys()) {
      if (key.startsWith(`${guildId}:`)) this._flowCache.delete(key);
    }
  }

  /* ═══════════════════════════════════════════
     HOOK: COMANDOS PERSONALIZADOS
     Integra com o NextMessageCollector existente
     ═══════════════════════════════════════════ */

  _hookCustomCommands() {
    // NextMessageCollector chama _runPipeline em cada mensagem.
    // Adicionamos nosso handler sem alterar o arquivo original —
    // basta que o gateway handler chame handleGateway() com MESSAGE_CREATE.
    // O LogicEngine processa triggers de comando via _handleCustomCommand.

    // Adiciona handler especial para comandos customizados
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

    // cooldown
    if (cmd.cooldown > 0) {
      const expires   = cmd.cooldownMap?.[discordCtx.userId] || 0;
      const remaining = expires - Date.now();
      if (remaining > 0) {
        await this._sendCooldownWarning(discordCtx, remaining);
        return;
      }
    }

    // executa apenas o fluxo vinculado a este comando
    await this.runById(cmd.flowId, {
      ...discordCtx,
      customData: {
        command: cmd,
        args: content.slice(prefix.length + matched.length).trim().split(/ +/)
      }
    });

    // atualiza cooldown
    if (cmd.cooldown > 0) {
      const expiresAt = Date.now() + cmd.cooldown;
      CustomCommandModel.updateOne(
        { commandId: cmd.commandId },
        { $set: { [`cooldownMap.${discordCtx.userId}`]: expiresAt } }
      ).catch(() => {});

      // Invalida o cache de comandos deste guild — sem isso, uma segunda
      // execução dentro da mesma janela de cache (60s) lê a cópia antiga
      // do comando, sem o cooldownMap atualizado, e o cooldown não bloqueia.
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

  /* ═══════════════════════════════════════════
     HOOK: TASK MANAGER (triggers de tempo)
     Registra novos tipos de task no TaskManager existente
     ═══════════════════════════════════════════ */

  _hookTaskManager() {
    const tm = this.client.taskManager;
    if (!tm) return;

    // Estende o execute() do TaskManager para reconhecer os novos tipos
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
          // Trigger de tempo: dispara um fluxo específico
          const { flowId, guildId } = task.dados;
          await this.runById(flowId, { guildId, channelId: null, userId: null });
          break;
        }

        default:
          // Repassa para os handlers originais do TaskManager
          await originalExecute(task);
      }
    };

    console.log('[LogicEngine] TaskManager hooked.');
  }

  /* ═══════════════════════════════════════════
     GERENCIAMENTO DE FLUXOS (CRUD)
     ═══════════════════════════════════════════ */

  /**
   * Cria um novo fluxo.
   * @param {{ guildId, name, trigger, conditions?, actions?, variables?, options? }} data
   */
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

  // ── Horário agendado ──
  if (flow.trigger?.type === 'scheduled_trigger') {
    if (flow.enabled) {
      // ativa — cria a task
      const { hour = 0, minute = 0 } = flow.trigger.filters || {};
      const task = await this.client.taskManager.createScheduled({
        guildId,
        flowId,
        hour:   Number(hour),
        minute: Number(minute)
      });
      // salva o taskId no fluxo para poder cancelar depois
      await FlowModel.updateOne(
  { flowId },
  { $set: { 'trigger.filters.taskId': task.taskId } }
);
    } else {
      // desativa — cancela a task
      const taskId = flow.trigger.filters?.taskId;
      if (taskId) await this.client.taskManager.cancel(taskId);
    }
  }

  this.invalidateGuildCache(guildId);
  return flow;
}


async _auditLog(action, guildId, data) {
  try {
    // busca nome do servidor
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

    // Trigger
    if (data.trigger) {
      const t = data.trigger;
      fields.push({
        name:  '🎯 Trigger',
        value: `Categoria: \`${t.category}\`\nTipo: \`${t.type}\`` +
               (Object.keys(t.filters || {}).length ? `\nFiltros: \`${JSON.stringify(t.filters)}\`` : ''),
        inline: false
      });
    }

    // Condições
    if (data.conditions?.length) {
      const lines = data.conditions.map((c, i) =>
        `${i + 1}. \`${c.category}:${c.type}\`` +
        (Object.keys(c.params || {}).length ? ` — ${JSON.stringify(c.params)}` : '') +
        (c.negate ? ' *(negado)*' : '')
      ).join('\n');
      fields.push({ name: `🔍 Condições (${data.conditions.length})`, value: lines.slice(0, 1024), inline: false });
    }

    // Ações
    if (data.actions?.length) {
      const lines = data.actions
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a, i) =>
          `${i + 1}. \`${a.category}:${a.type}\`` +
          (Object.keys(a.params || {}).length ? ` — ${JSON.stringify(a.params)}` : '')
        ).join('\n');
      fields.push({ name: `⚡ Ações (${data.actions.length})`, value: lines.slice(0, 1024), inline: false });
    }

    // Variáveis
    if (data.variables?.length) {
      const lines = data.variables.map(v =>
        `• \`${v.name}\` (${v.type}/${v.scope || 'flow'}) = \`${JSON.stringify(v.defaultValue)}\`${v.persistent ? ' 💾' : ''}`
      ).join('\n');
      fields.push({ name: `📦 Variáveis (${data.variables.length})`, value: lines.slice(0, 1024), inline: false });
    }

    // Comando
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

  /* ═══════════════════════════════════════════
     GERENCIAMENTO DE COMANDOS PERSONALIZADOS
     ═══════════════════════════════════════════ */

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
