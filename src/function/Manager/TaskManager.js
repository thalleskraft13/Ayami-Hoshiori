'use strict';

const TaskModel      = require("../../Mongodb/tarefas.js");
const { GuildDb }    = require("../../Mongodb/guild.js");
const { randomUUID } = require("crypto");
const DiscordRequest = require("../DiscordRequest.js");
const LogChannelManager = require("./LogChannelManager.js");

const LOG_CHANNEL_TAREFAS = '1523640821629583441';

const LOG_COLOR = {
  criada:     0x5865F2, // azul
  iniciada:   0xFEE75C, // amarelo
  sucesso:    0x57F287, // verde
  erro:       0xED4245, // vermelho
  finalizada: 0x95A5A6, // cinza
};

class TaskManager {

  constructor(client) {
    this.client    = client;
    this.interval  = null;
    this.batchSize = 10;
  }

  /* ═══════════════════════════════════════════
     LOG HELPER
     ═══════════════════════════════════════════ */

  /**
   * Envia um embed de log pro canal de tarefas. Fire-and-forget — nunca
   * lança erro, nunca atrasa quem chamou (LogChannelManager já cuida disso).
   * @param {string} stage  'criada' | 'iniciada' | 'sucesso' | 'erro' | 'finalizada'
   * @param {object} task   Documento da task (precisa de taskId e tipo)
   * @param {object} [extraFields]  Campos extras do embed (ex: erro, agendamento)
   */
  _logTask(stage, task, extraFields = []) {
    const titles = {
      criada:     '🆕 Task criada',
      iniciada:   '▶️ Task iniciada',
      sucesso:    '✅ Task executada com sucesso',
      erro:       '❌ Erro ao executar task',
      finalizada: '🏁 Task finalizada',
    };

    LogChannelManager.send(LOG_CHANNEL_TAREFAS, {
      embeds: [{
        title: titles[stage] ?? stage,
        color: LOG_COLOR[stage] ?? 0x95A5A6,
        fields: [
          { name: 'Tipo', value: `\`${task?.tipo ?? 'desconhecido'}\``, inline: true },
          { name: 'ID',   value: `\`${task?.taskId ?? '—'}\``, inline: true },
          ...extraFields,
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  }

  /* ═══════════════════════════════════════════
     START / STOP
     ═══════════════════════════════════════════ */

  async start() {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this._tick();
    }, 1_000);

    this._tick().catch(console.error);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /* ═══════════════════════════════════════════
     TICK
     ═══════════════════════════════════════════ */

  async _tick() {
    try {
      const now   = new Date();
      const tasks = [];

      for (let i = 0; i < this.batchSize; i++) {
        const task = await TaskModel.findOneAndUpdate(
          { status: 'pending', executeAt: { $lte: now } },
          { $set: { status: 'processing' } },
          { sort: { executeAt: 1 }, returnDocument: 'after' }
        );
        if (!task) break;
        tasks.push(task);
      }
      if (tasks.length > 0) {
      console.log(`[TaskManager] Tick — ${tasks.length} task(s):`, tasks.map(t => t.tipo));
    }
      for (const task of tasks) {
        await this.run(task);
      }
    } catch (err) {
      console.error('[TaskManager] Tick error:', err);
    }
  }

  /* ═══════════════════════════════════════════
     RUN
     ═══════════════════════════════════════════ */

  async run(task) {
    this._logTask('iniciada', task);

    try {
      await this.execute(task);

      this._logTask('sucesso', task);

      if (task.tipo === 'scheduled_trigger') {
        await task.save();
        return;
      }

      // guild_mission_reset se reagenda dentro do execute
      if (task.tipo === 'guild_mission_reset') {
        await task.save();
        return;
      }

      // birthday_check se reagenda dentro do execute
      if (task.tipo === 'birthday_check') {
        await task.save();
        return;
      }

      // schedule("HH:MM", ..., { recorrente: true }) do LogicScript —
      // já recalculou executeAt/status pra amanhã dentro do execute()
      // acima. "a cada X" (dailyAt ausente) continua caindo no repeat/
      // repeatDelay genérico logo abaixo, normalmente.
      if (task.tipo === 'logicscript_message' && task.dados?.dailyAt) {
        await task.save();
        return;
      }
      
      

      if (task.repeat && task.repeatDelay) {
        task.executeAt = new Date(Date.now() + task.repeatDelay);
        task.status    = 'pending';
      } else {
        task.status = 'executed';
        this._logTask('finalizada', task);
      }

      await task.save();

    } catch (err) {
      console.error('[TaskManager] Run error:', err);

      this._logTask('erro', task, [
        { name: 'Erro', value: `\`\`\`${(err?.message ?? String(err)).slice(0, 900)}\`\`\`` },
      ]);

      try {
        task.status = 'pending';
        await task.save();
      } catch {}
    }
  }

  /* ═══════════════════════════════════════════
     EXECUTE
     ═══════════════════════════════════════════ */

  async execute(task) {
    switch (task.tipo) {

      case 'lembrete':
        await this.handleLembrete(task.dados);
        break;

      case 'scheduled_trigger':
        await this.handleScheduledTrigger(task);
        break;

      // schedule()/scheduleDaily do LogicScript — ver Interpreter.js
      case 'logicscript_message': {
        const { channelId, texto, dailyAt } = task.dados;
        await DiscordRequest(`/channels/${channelId}/messages`, {
          method: 'POST',
          body:   { content: texto }
        }).catch(err => console.error('[TaskManager] logicscript_message error:', err));

        // "todo dia às HH:MM" — recalcula pra amanhã no mesmo horário
        // (mesmo padrão de birthday_check/scheduled_trigger). Recorrência
        // por intervalo simples ("a cada 2h") já é coberta pelo mecanismo
        // genérico repeat/repeatDelay logo abaixo, em run().
        if (dailyAt) {
          const next = new Date();
          next.setDate(next.getDate() + 1);
          next.setHours(dailyAt.hour, dailyAt.minute ?? 0, 0, 0);
          task.executeAt = next;
          task.status    = 'pending';
        }
        break;
      }

        case 'giveaway_end': {
  const { giveawayId } = task.dados;
  if (this.client.gScheduler) {
    await this.client.gScheduler._end(giveawayId)
      .catch(err => console.error('[TaskManager] giveaway_end error:', err));
  } else {
    console.error('[TaskManager] giveaway_end: client.gScheduler indisponível.');
  }
  break;
}

      // Roda todo dia no horário configurado pela guild:
      // varre os aniversariantes do dia e dispara um birthday_notify por membro
      case 'birthday_check': {
        const { guildId, hour, minute = 0 } = task.dados;
        if (this.client.birthdayManager) {
          await this.client.birthdayManager
            .checkAll(guildId)
            .catch(err => console.error('[TaskManager] birthday_check error:', err));
        }
        // Reagenda para amanhã no mesmo horário
        const nextCheck = new Date();
        nextCheck.setDate(nextCheck.getDate() + 1);
        nextCheck.setHours(hour, minute, 0, 0);
        task.executeAt = nextCheck;
        task.status    = 'pending';
        break;
      }

      // Enviado pelo checkAll — notifica um único aniversariante
      case 'birthday_notify': {
        const { guildId, userId } = task.dados;
        const guildDoc = await GuildDb.findOne({ guildId });
        if (guildDoc?.birthday?.enabled) {
          await this.client.birthdayManager
            ._sendBirthdayMessage(guildDoc, { userId, birthday: task.dados.birthday })
            .catch(err => console.error('[TaskManager] birthday_notify error:', err));
        }
        break;
      }

      case 'remove_role': {
        const { guildId, userId, roleId } = task.dados;
        await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
          method: 'DELETE'
        }).catch(() => {});
        break;
      }

      case 'run_flow':
      case 'time_trigger': {
        const { flowId, guildId, discordCtx } = task.dados;
        if (this.client.logicEngine) {
          await this.client.logicEngine.runById(
            flowId,
            discordCtx || { guildId, channelId: null, userId: null }
          );
        }
        break;
      }

      case 'guild_event_expire': {
        const { guildId } = task.dados;
        if (this.client.missionManager) {
          await this.client.missionManager.expireGuildEvent(guildId).catch(() => {});
        }
        break;
      }

      case 'guild_mission_reset': {
        const { guildId } = task.dados;
        if (this.client.missionManager) {
          await this.client.missionManager.weeklyReset(guildId).catch(() => {});
        }
        task.executeAt = this._nextMonday();
        task.status    = 'pending';
        break;
      }

      default:
        console.log('[TaskManager] Tipo desconhecido:', task.tipo);
    }
  }

  /* ═══════════════════════════════════════════
     SCHEDULED TRIGGER
     ═══════════════════════════════════════════ */

  async handleScheduledTrigger(task) {
    const { guildId, flowId, hour, minute = 0 } = task.dados;

    if (this.client.logicEngine) {
      await this.client.logicEngine.runById(flowId, {
        guildId,
        channelId: null,
        userId:    null
      }).catch(err => console.error('[TaskManager] scheduled_trigger error:', err));
    }

    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(hour, minute, 0, 0);
    task.executeAt = next;
    task.status    = 'pending';
  }

  /* ═══════════════════════════════════════════
     CREATE
     ═══════════════════════════════════════════ */

  async create({ tipo, delay, dados, repeat = false, repeatDelay = null }) {
    const task = await TaskModel.create({
      taskId:    randomUUID(),
      tipo,
      executeAt: new Date(Date.now() + delay),
      dados,
      repeat,
      repeatDelay
    });

    this._logTask('criada', task, [
      { name: 'Executa em', value: `<t:${Math.floor(task.executeAt.getTime() / 1000)}:R>` },
    ]);

    return task;
  }

  async createScheduled({ guildId, flowId, hour, minute = 0 }) {
    const delay = this._msAteHorario(hour, minute);

    const task = await TaskModel.create({
      taskId:      randomUUID(),
      tipo:        'scheduled_trigger',
      executeAt:   new Date(Date.now() + delay),
      dados:       { guildId, flowId, hour, minute },
      repeat:      false,
      repeatDelay: null
    });

    this._logTask('criada', task, [
      { name: 'Guild',      value: `\`${guildId}\``, inline: true },
      { name: 'Executa em', value: `<t:${Math.floor(task.executeAt.getTime() / 1000)}:R>` },
    ]);

    return task;
  }

  /**
   * Cria (ou recria) a task diária de birthday_check para uma guild.
   * Chame ao ativar o sistema ou mudar o horário.
   * Cancela qualquer task pendente anterior para evitar duplicata.
   */
  async createBirthdayCheck({ guildId, hour, minute = 0 }) {
  await TaskModel.updateMany(
    { tipo: 'birthday_check', 'dados.guildId': guildId, status: 'pending' },
    { $set: { status: 'cancelled' } }
  );

  const now       = new Date();
  const executeAt = new Date();
  executeAt.setHours(hour, minute, 0, 0);
  executeAt.setSeconds(0, 0);

  // Só manda pra amanhã se já passou mais de 1 minuto
  if (executeAt.getTime() < now.getTime() - 60_000) {
    executeAt.setDate(executeAt.getDate() + 1);
  }

  const task = await TaskModel.create({
    taskId:      randomUUID(),
    tipo:        'birthday_check',
    executeAt,
    dados:       { guildId, hour, minute },
    repeat:      false,
    repeatDelay: null
  });

  this._logTask('criada', task, [
    { name: 'Guild',      value: `\`${guildId}\``, inline: true },
    { name: 'Executa em', value: `<t:${Math.floor(task.executeAt.getTime() / 1000)}:R>` },
  ]);

  return task;
}
  /**
   * Agenda o reset semanal de missões de guilda.
   * Chame uma vez quando a guilda for registrada/configurada.
   * A task se reagenda automaticamente toda segunda-feira.
   */
  async scheduleGuildMissionReset(guildId) {
    await TaskModel.updateMany(
      { tipo: 'guild_mission_reset', 'dados.guildId': guildId, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );

    const task = await TaskModel.create({
      taskId:    randomUUID(),
      tipo:      'guild_mission_reset',
      executeAt: this._nextMonday(),
      dados:     { guildId },
      repeat:    false
    });

    this._logTask('criada', task, [
      { name: 'Guild',      value: `\`${guildId}\``, inline: true },
      { name: 'Executa em', value: `<t:${Math.floor(task.executeAt.getTime() / 1000)}:R>` },
    ]);

    return task;
  }

  /* ═══════════════════════════════════════════
     LEMBRETE
     ═══════════════════════════════════════════ */

  async handleLembrete(dados) {
    const { userId, channelId, mensagem } = dados;
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body:   { content: `⏰ <@${userId}> Lembre-se de:\n${mensagem}` }
    });
  }

  /* ═══════════════════════════════════════════
     CANCEL
     ═══════════════════════════════════════════ */

  async cancel(taskId) {
    const task = await TaskModel.findOne({ taskId });
    if (!task) return false;
    task.status = 'cancelled';
    await task.save();
    return true;
  }

  /* ═══════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════ */

  _msAteHorario(hour, minute = 0) {
    const now  = new Date();
    const alvo = new Date();
    alvo.setHours(hour, minute, 0, 0);
    if (alvo <= now) alvo.setDate(alvo.getDate() + 1);
    return alvo - now;
  }

  _nextMonday() {
    const d   = new Date();
    const day = d.getDay();
    const daysUntil = day === 1 ? 7 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + daysUntil);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

module.exports = TaskManager;