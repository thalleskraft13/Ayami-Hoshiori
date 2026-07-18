'use strict';

/**
 * ============================================================
 *  ANÁLISE DE ATIVIDADE
 * ============================================================
 * Módulo independente (não faz mais parte de Segurança — a antiga
 * "Verificação de Atividade" do SecuritySystem foi removida de lá e
 * reescrita aqui do zero, com armazenamento próprio e mais métricas).
 *
 * Responsabilidade única: gerar estatísticas e insights sobre a
 * atividade do servidor. Não aplica punições nem modera nada — isso
 * continua em Segurança.
 *
 * Arquitetura pensada para crescer sem refatoração grande:
 *   - Tracking (handleMessage/handleReactionAdd/handleMemberAdd/
 *     handleMemberRemove) só grava contadores agregados (ver
 *     Mongodb/activity*.js) — nunca guarda conteúdo bruto de mensagem.
 *   - Cada métrica nova = um novo método de leitura em cima dessas
 *     mesmas coleções (ou, na pior hipótese, uma coleção nova seguindo
 *     o mesmo padrão). O menu (startSetup) só precisa ganhar mais uma
 *     opção no select.
 */

const { GuildDb }         = require("../../../Mongodb/guild.js");
const DiscordRequest      = require("../../DiscordRequest.js");
const TTLCache             = require("../../Utils/TTLCache.js");
const CommandLog           = require("../../../Mongodb/commandLog.js");
const ActivityDailyStat    = require("../../../Mongodb/activityDailyStat.js");
const ActivityDailyUser    = require("../../../Mongodb/activityDailyUser.js");
const ActivityUserStat     = require("../../../Mongodb/activityUserStat.js");
const ActivityChannelStat  = require("../../../Mongodb/activityChannelStat.js");
const ActivityTermStat     = require("../../../Mongodb/activityTermStat.js");
const { extractTerms }     = require("./TermExtractor.js");
const {
  dateKey, dateKeyDaysAgo, dateKeyRange, utcHour, weekdayOfDateKey
} = require("./dateKey.js");

const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

class ActivityAnalyticsSystem {

  constructor(client) {
    this.client = client;
    // Evita bater na API do Discord (with_counts) a cada mensagem —
    // 1 snapshot de contagem de membros por servidor a cada hora basta
    // pra alimentar o `memberCountEnd` do dia corrente.
    this._memberSnapshotCache = new TTLCache({ ttlMs: 60 * 60_000, sweepIntervalMs: 10 * 60_000 });
  }

  /* ================= UI / DB BOILERPLATE =================
     (mesmo padrão usado em SecuritySystem.js e no resto do bot —
     cada módulo carrega sua própria cópia, não há classe-base
     compartilhada nessa base de código.) */

  _toV2(data) {
    if (!data || !data.embeds) return data;
    const blocks = [];
    for (const embed of data.embeds) {
      let text = '';
      if (embed.title)       text += `# ${embed.title}\n`;
      if (embed.description) text += `${embed.description}\n`;
      if (embed.fields?.length) {
        text += embed.fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n');
      }
      if (embed.footer?.text) text += `\n-# ${embed.footer.text}`;
      blocks.push({ type: 10, content: text.trim() || '\u200b' });
    }
    const rows = (data.components || []).filter(c => c.type === 1);
    const accentColor = data.embeds.find(e => typeof e.color === 'number')?.color ?? 0x7C8FFF;
    return {
      flags: (data.flags ?? 0) | 32768,
      components: [{
        type: 17,
        accent_color: accentColor,
        components: [
          ...blocks,
          ...(rows.length ? [{ type: 14, divider: true, spacing: 1 }] : []),
          ...rows,
        ],
      }],
    };
  }

  async reply(interaction, data) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: "POST", body: { type: 4, data: this._toV2(data) } }
    );
  }

  async deferUpdate(interaction) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: "POST", body: { type: 6 } }
    );
  }

  async editOriginal(interaction, data) {
    let payload = this._toV2(data);
    if (payload && payload.content === undefined) {
      payload = { ...payload, flags: (payload.flags ?? 0) | 32768 };
    }
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: "PATCH", body: payload }
    );
  }

  async followUp(interaction, data) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}`,
      { method: "POST", body: this._toV2(data) }
    );
  }

  async followUpEphemeral(interaction, data) {
    return this.followUp(interaction, { ...data, flags: 64 });
  }

  async getGuild(guildId) {
    let g = await GuildDb.findOne({ guildId });
    if (!g) g = await GuildDb.create({ guildId });
    return g;
  }

  async save(guild) {
    await guild.save();
  }

  /** Config do módulo (habilitado/desabilitado + exceções), com defaults seguros. */
  getConfig(guild) {
    if (!guild.activityAnalytics) {
      guild.activityAnalytics = {
        enabled: true,
        ignoredChannels: [],
        ignoredRoles: [],
        ignoredUsers: [],
        ignoreBots: true,
      };
    }
    return guild.activityAnalytics;
  }

  btn(user, label, style, func) {
    return this.client.interactions.createButton({ user, data: { label, style }, funcao: func });
  }

  select(user, options, placeholder, func) {
    return this.client.interactions.createSelect({ user, data: { placeholder, options }, funcao: func });
  }

  channelSelect(user, placeholder, func, opts = {}) {
    return this.client.interactions.createChannelSelect({
      user, funcao: func,
      data: { placeholder, max_values: opts.max ?? 25, channel_types: opts.types }
    });
  }

  roleSelect(user, placeholder, func, opts = {}) {
    return this.client.interactions.createRoleSelect({
      user, funcao: func,
      data: { placeholder, max_values: opts.max ?? 25 }
    });
  }

  row(...c) { return { type: 1, components: c }; }

  backBtn(user, targetFn) {
    return this.btn(user, "⬅️ Voltar", 2, async (i) => {
      await this.deferUpdate(i);
      return targetFn(i);
    });
  }

  /* ================= TRACKING HOOKS (chamados pelo gateway) ================= */

  isIgnored(cfg, { channelId, roles, userId, isBot }) {
    if (isBot && cfg.ignoreBots !== false) return true;
    if (cfg.ignoredChannels?.includes(channelId)) return true;
    if (cfg.ignoredUsers?.includes(userId)) return true;
    if (cfg.ignoredRoles?.some(r => roles?.includes(r))) return true;
    return false;
  }

  /**
   * Snapshot preguiçoso (no máx. 1x/hora por servidor) da contagem de
   * membros, gravado no bucket diário atual. Não bloqueia o tracking
   * principal — é "melhor esforço", falhas são ignoradas.
   */
  async _maybeSnapshotMemberCount(guildId) {
    if (this._memberSnapshotCache.get(guildId)) return;
    this._memberSnapshotCache.set(guildId, true);
    try {
      const guildData = await DiscordRequest(`/guilds/${guildId}?with_counts=true`);
      const total = guildData?.approximate_member_count;
      if (typeof total === "number") {
        await ActivityDailyStat.updateOne(
          { guildId, date: dateKey() },
          { $set: { memberCountEnd: total } },
          { upsert: true }
        );
      }
    } catch { /* best-effort */ }
  }

  async handleMessage(data) {
    try {
      if (!data.guild_id || data.author?.bot) return;

      const guild = await this.getGuild(data.guild_id);
      const cfg   = this.getConfig(guild);
      if (!cfg.enabled) return;

      const guildId   = data.guild_id;
      const channelId = data.channel_id;
      const userId    = data.author.id;
      const roles     = data.member?.roles || [];

      if (this.isIgnored(cfg, { channelId, roles, userId, isBot: false })) return;

      const now  = new Date();
      const date = dateKey(now);
      const hour = utcHour(now);

      await Promise.all([
        ActivityDailyStat.updateOne(
          { guildId, date },
          { $inc: { messageCount: 1, [`messagesByHour.${hour}`]: 1 } },
          { upsert: true }
        ),
        ActivityDailyUser.updateOne(
          { guildId, date, userId },
          { $setOnInsert: { guildId, date, userId } },
          { upsert: true }
        ),
        ActivityUserStat.updateOne(
          { guildId, userId },
          {
            $inc: { totalMessages: 1 },
            $set: { lastMessageAt: now },
            $setOnInsert: { firstMessageAt: now }
          },
          { upsert: true }
        ),
        ActivityChannelStat.updateOne(
          { guildId, channelId },
          {
            $inc: { totalMessages: 1 },
            $set: { lastMessageAt: now },
            $setOnInsert: { firstMessageAt: now }
          },
          { upsert: true }
        ),
        this._maybeSnapshotMemberCount(guildId),
      ]);

      // Termos (palavras/emojis) — não guarda o texto bruto, só os
      // contadores agregados por dia.
      const { words, emojis } = extractTerms(data.content || "");
      const termOps = [];
      for (const w of words)   termOps.push({ kind: "word",  term: w });
      for (const e of emojis)  termOps.push({ kind: "emoji", term: e });
      if (termOps.length) {
        await ActivityTermStat.bulkWrite(
          termOps.map(({ kind, term }) => ({
            updateOne: {
              filter: { guildId, kind, term, date },
              update: { $inc: { count: 1 } },
              upsert: true
            }
          })),
          { ordered: false }
        );
      }
    } catch (err) { console.error("[ActivityAnalytics] handleMessage:", err); }
  }

  async handleReactionAdd(data) {
    try {
      if (!data.guild_id || !data.user_id || data.member?.user?.bot) return;

      const guild = await this.getGuild(data.guild_id);
      const cfg   = this.getConfig(guild);
      if (!cfg.enabled) return;

      const guildId = data.guild_id;
      const userId  = data.user_id;
      const roles   = data.member?.roles || [];
      if (this.isIgnored(cfg, { channelId: data.channel_id, roles, userId, isBot: false })) return;

      const term = data.emoji?.id ? data.emoji.name?.toLowerCase() : data.emoji?.name;
      if (!term) return;

      await Promise.all([
        ActivityUserStat.updateOne(
          { guildId, userId },
          { $inc: { totalReactionsGiven: 1 }, $setOnInsert: { firstMessageAt: null } },
          { upsert: true }
        ),
        ActivityTermStat.updateOne(
          { guildId, kind: "reaction", term, date: dateKey() },
          { $inc: { count: 1 } },
          { upsert: true }
        ),
      ]);
    } catch (err) { console.error("[ActivityAnalytics] handleReactionAdd:", err); }
  }

  async handleMemberAdd(data) {
    try {
      if (!data.guild_id) return;
      await ActivityDailyStat.updateOne(
        { guildId: data.guild_id, date: dateKey() },
        { $inc: { newMembers: 1 } },
        { upsert: true }
      );
    } catch (err) { console.error("[ActivityAnalytics] handleMemberAdd:", err); }
  }

  async handleMemberRemove(data) {
    try {
      if (!data.guild_id) return;
      await ActivityDailyStat.updateOne(
        { guildId: data.guild_id, date: dateKey() },
        { $inc: { leftMembers: 1 } },
        { upsert: true }
      );
    } catch (err) { console.error("[ActivityAnalytics] handleMemberRemove:", err); }
  }

  /* ================= AGREGAÇÕES (reaproveitadas pelas telas) ================= */

  async _dailyStatsRange(guildId, days) {
    const startKey = dateKeyDaysAgo(days - 1);
    const endKey   = dateKey();
    const docs = await ActivityDailyStat.find({ guildId, date: { $gte: startKey, $lte: endKey } }).lean();
    const byDate = new Map(docs.map(d => [d.date, d]));
    return dateKeyRange(startKey, endKey).map(k => byDate.get(k) || {
      date: k, messageCount: 0, messagesByHour: Array(24).fill(0), newMembers: 0, leftMembers: 0, memberCountEnd: null
    });
  }

  async _topTermsInWindow(guildId, kind, days, limit = 10) {
    const startKey = dateKeyDaysAgo(days - 1);
    const rows = await ActivityTermStat.aggregate([
      { $match: { guildId, kind, date: { $gte: startKey } } },
      { $group: { _id: "$term", total: { $sum: "$count" } } },
      { $sort: { total: -1 } },
      { $limit: limit }
    ]);
    return rows.map(r => ({ term: r._id, count: r.total }));
  }

  /** Compara janela recente vs janela anterior de mesmo tamanho — "tendência" real, não só volume. */
  async _trendingTerms(guildId, kind, windowDays = 3, limit = 10) {
    const recentStart   = dateKeyDaysAgo(windowDays - 1);
    const baselineStart = dateKeyDaysAgo(windowDays * 2 - 1);
    const baselineEnd   = dateKeyDaysAgo(windowDays);

    const [recentRows, baselineRows] = await Promise.all([
      ActivityTermStat.aggregate([
        { $match: { guildId, kind, date: { $gte: recentStart } } },
        { $group: { _id: "$term", total: { $sum: "$count" } } }
      ]),
      ActivityTermStat.aggregate([
        { $match: { guildId, kind, date: { $gte: baselineStart, $lte: baselineEnd } } },
        { $group: { _id: "$term", total: { $sum: "$count" } } }
      ]),
    ]);

    const baselineMap = new Map(baselineRows.map(r => [r._id, r.total]));
    const scored = recentRows
      .filter(r => r.total >= 3) // ignora ruído de 1-2 ocorrências
      .map(r => {
        const before = baselineMap.get(r._id) || 0;
        const growth = before === 0 ? r.total : (r.total - before) / before;
        return { term: r._id, count: r.total, before, growth };
      })
      .sort((a, b) => b.growth - a.growth || b.count - a.count)
      .slice(0, limit);

    return scored;
  }

  /* ================= MENU PRINCIPAL ================= */

  async startSetup(interaction) {
    const guild = await this.getGuild(interaction.guild_id);
    const user  = interaction.member.user.id;
    const cfg   = this.getConfig(guild);

    const select = this.select(
      user,
      [
        { label: "👥 Usuários Mais Ativos",      value: "top_users"        },
        { label: "🏆 Ranking de Mensagens",      value: "message_ranking"  },
        { label: "💬 Chats Mais Utilizados",     value: "top_channels"     },
        { label: "💤 Chats Menos Utilizados",    value: "bottom_channels"  },
        { label: "⏰ Horários de Pico",          value: "peak_hours"       },
        { label: "📅 Dias Mais Movimentados",    value: "busiest_weekdays" },
        { label: "📊 Média de Mensagens",        value: "average_messages" },
        { label: "📈 Crescimento",               value: "growth"           },
        { label: "🔥 Tópicos Mais Discutidos",   value: "top_topics"       },
        { label: "📈 Palavras em Tendência",     value: "trending_words"   },
        { label: "😀 Emojis Mais Utilizados",    value: "top_emojis"       },
        { label: "❤️ Reações Mais Utilizadas",   value: "top_reactions"    },
        { label: "⌨️ Comandos Mais Utilizados",  value: "top_commands"     },
        { label: "🧾 Resumo Geral",              value: "summary"          },
        { label: "⚙️ Configurações",             value: "settings"         },
      ],
      "Selecionar métrica",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        const map = {
          top_users:        () => this.topActiveUsers(i, guild, user),
          message_ranking:   () => this.messageRanking(i, guild, user),
          top_channels:      () => this.channelRanking(i, guild, user, true),
          bottom_channels:   () => this.channelRanking(i, guild, user, false),
          peak_hours:        () => this.peakHours(i, guild, user),
          busiest_weekdays:  () => this.busiestWeekdays(i, guild, user),
          average_messages:  () => this.averageMessages(i, guild, user),
          growth:            () => this.growthMenu(i, guild, user),
          top_topics:        () => this.discussedTopics(i, guild, user),
          trending_words:    () => this.trendingWords(i, guild, user),
          top_emojis:        () => this.topEmojis(i, guild, user),
          top_reactions:     () => this.topReactions(i, guild, user),
          top_commands:      () => this.topCommands(i, guild, user),
          summary:           () => this.generalSummary(i, guild, user),
          settings:          () => this.settingsMenu(i, guild, user),
        };
        return map[v]?.();
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📊 Análise de Atividade — Ayami",
        description:
          `Estatísticas e insights sobre a atividade do servidor.\n\n` +
          `${cfg.enabled ? "🟢 Rastreamento ativo" : "🔴 Rastreamento desativado (veja Configurações)"}`
      }],
      components: [this.row(select)]
    });
  }

  /* ================= 1. USUÁRIOS MAIS ATIVOS / RANKING DE MENSAGENS ================= */

  // "Mais ativos" = maior volume nos últimos 7 dias (recência importa).
  async topActiveUsers(interaction, guild, user) {
    const startKey = dateKeyDaysAgo(6);
    const rows = await ActivityDailyUser.aggregate([
      { $match: { guildId: interaction.guild_id, date: { $gte: startKey } } },
      { $group: { _id: "$userId", activeDays: { $sum: 1 } } },
      { $sort: { activeDays: -1 } },
      { $limit: 10 }
    ]);

    const desc = rows.length
      ? rows.map((r, i) => `**${i + 1}.** <@${r._id}> — ativo em ${r.activeDays}/7 dias`).join("\n")
      : "Sem dados suficientes ainda nos últimos 7 dias.";

    return this.editOriginal(interaction, {
      embeds: [{ title: "👥 Usuários Mais Ativos (últimos 7 dias)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  // "Ranking de mensagens" = total acumulado (all-time), sem decaimento por recência.
  async messageRanking(interaction, guild, user) {
    const rows = await ActivityUserStat
      .find({ guildId: interaction.guild_id })
      .sort({ totalMessages: -1 })
      .limit(10)
      .lean();

    const desc = rows.length
      ? rows.map((r, i) => `**${i + 1}.** <@${r.userId}> — ${r.totalMessages} mensagem(ns)`).join("\n")
      : "Ainda não há mensagens registradas neste servidor.";

    return this.editOriginal(interaction, {
      embeds: [{ title: "🏆 Ranking de Mensagens (total)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  /* ================= 2. CANAIS MAIS / MENOS UTILIZADOS ================= */

  async channelRanking(interaction, guild, user, top) {
    const rows = await ActivityChannelStat
      .find({ guildId: interaction.guild_id })
      .sort({ totalMessages: top ? -1 : 1 })
      .limit(10)
      .lean();

    const title = top ? "💬 Chats Mais Utilizados" : "💤 Chats Menos Utilizados";
    const desc = rows.length
      ? rows.map((r, i) => `**${i + 1}.** <#${r.channelId}> — ${r.totalMessages} mensagem(ns)`).join("\n")
      : "Nenhum canal com atividade registrada ainda.";

    return this.editOriginal(interaction, {
      embeds: [{ title, description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  /* ================= 3. HORÁRIOS DE PICO / DIAS MOVIMENTADOS ================= */

  async peakHours(interaction, guild, user) {
    const stats = await this._dailyStatsRange(interaction.guild_id, 30);
    const totals = Array(24).fill(0);
    for (const s of stats) {
      (s.messagesByHour || []).forEach((c, h) => { totals[h] += c; });
    }
    const max = Math.max(1, ...totals);
    const topHours = totals
      .map((c, h) => ({ h, c }))
      .sort((a, b) => b.c - a.c)
      .slice(0, 5)
      .filter(x => x.c > 0);

    const desc = topHours.length
      ? topHours.map(x => `**${String(x.h).padStart(2, "0")}h–${String((x.h + 1) % 24).padStart(2, "0")}h (UTC)** — ${x.c} mensagem(ns) ${"█".repeat(Math.max(1, Math.round((x.c / max) * 15)))}`).join("\n")
      : "Sem dados suficientes nos últimos 30 dias.";

    return this.editOriginal(interaction, {
      embeds: [{ title: "⏰ Horários de Pico (últimos 30 dias, UTC)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  async busiestWeekdays(interaction, guild, user) {
    const stats = await this._dailyStatsRange(interaction.guild_id, 30);
    const totals = Array(7).fill(0);
    for (const s of stats) {
      totals[weekdayOfDateKey(s.date)] += s.messageCount || 0;
    }
    const max = Math.max(1, ...totals);
    const desc = totals
      .map((c, w) => ({ w, c }))
      .sort((a, b) => b.c - a.c)
      .map(x => `**${WEEKDAY_LABELS[x.w]}** — ${x.c} mensagem(ns) ${"█".repeat(Math.max(1, Math.round((x.c / max) * 15)))}`)
      .join("\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📅 Dias Mais Movimentados (últimos 30 dias)", description: desc || "Sem dados suficientes ainda." }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  /* ================= 4. MÉDIA DE MENSAGENS ================= */

  async averageMessages(interaction, guild, user) {
    const stats = await this._dailyStatsRange(interaction.guild_id, 30);
    const daysWithData = stats.filter(s => s.messageCount > 0);
    const totalMsgs = stats.reduce((s, d) => s + (d.messageCount || 0), 0);
    const avgPerDay = daysWithData.length ? totalMsgs / daysWithData.length : 0;

    const activeUserDocs = await ActivityDailyUser.distinct("userId", {
      guildId: interaction.guild_id, date: { $gte: dateKeyDaysAgo(29) }
    });
    const totalUsers = await ActivityUserStat.countDocuments({ guildId: interaction.guild_id });
    const avgPerUser = totalUsers ? (await ActivityUserStat.aggregate([
      { $match: { guildId: interaction.guild_id } },
      { $group: { _id: null, total: { $sum: "$totalMessages" } } }
    ]))[0]?.total / totalUsers : 0;

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📊 Média de Mensagens",
        description:
          `**Média por dia (últimos 30 dias):** ${avgPerDay.toFixed(1)} mensagens\n` +
          `**Total no período:** ${totalMsgs} mensagens\n` +
          `**Usuários ativos únicos (30 dias):** ${activeUserDocs.length}\n` +
          `**Média por usuário (all-time, entre quem já mandou mensagem):** ${(avgPerUser || 0).toFixed(1)} mensagens`
      }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  /* ================= 5. CRESCIMENTO (diário/semanal/mensal) ================= */

  async growthMenu(interaction, guild, user) {
    const select = this.select(
      user,
      [
        { label: "📈 Crescimento Diário",  value: "daily"   },
        { label: "📈 Crescimento Semanal", value: "weekly"  },
        { label: "📈 Crescimento Mensal",  value: "monthly" },
      ],
      "Selecionar período",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "daily")   return this.growthReport(i, guild, user, 14, "dia",  1);
        if (v === "weekly")  return this.growthReport(i, guild, user, 8 * 7, "semana", 7);
        if (v === "monthly") return this.growthReport(i, guild, user, 6 * 30, "mês", 30);
      }
    );
    return this.editOriginal(interaction, {
      embeds: [{ title: "📈 Crescimento do Servidor", description: "Escolha a granularidade do período." }],
      components: [this.row(select), this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  async growthReport(interaction, guild, user, totalDays, unitLabel, bucketDays) {
    const stats = await this._dailyStatsRange(interaction.guild_id, totalDays);

    // Agrupa em buckets de `bucketDays` dias (1=diário, 7=semanal, 30=mensal aproximado)
    const buckets = [];
    for (let i = 0; i < stats.length; i += bucketDays) {
      const slice = stats.slice(i, i + bucketDays);
      const newMembers  = slice.reduce((s, d) => s + (d.newMembers  || 0), 0);
      const leftMembers = slice.reduce((s, d) => s + (d.leftMembers || 0), 0);
      const messages    = slice.reduce((s, d) => s + (d.messageCount || 0), 0);
      const lastSnapshot = [...slice].reverse().find(d => d.memberCountEnd != null)?.memberCountEnd ?? null;
      buckets.push({ label: slice[0]?.date, newMembers, leftMembers, net: newMembers - leftMembers, messages, memberCountEnd: lastSnapshot });
    }

    const lines = buckets.slice(-10).map(b =>
      `**${b.label}** — +${b.newMembers} / -${b.leftMembers} (líquido: ${b.net >= 0 ? "+" : ""}${b.net}) | 💬 ${b.messages}${b.memberCountEnd != null ? ` | 👥 ${b.memberCountEnd}` : ""}`
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: `📈 Crescimento por ${unitLabel}`,
        description: lines.length ? lines.join("\n") : "Sem dados suficientes ainda.",
        footer: { text: "👥 = contagem de membros no snapshot mais recente do bucket (atualizado ~1x/hora)" }
      }],
      components: [this.row(this.backBtn(user, (i) => this.growthMenu(i, guild, user)))]
    });
  }

  /* ================= 6. TÓPICOS / TENDÊNCIAS / EMOJIS / REAÇÕES ================= */

  async discussedTopics(interaction, guild, user) {
    const top = await this._topTermsInWindow(interaction.guild_id, "word", 7, 10);
    const desc = top.length
      ? top.map((t, i) => `**${i + 1}.** ${t.term} — ${t.count} menções`).join("\n")
      : "Sem dados suficientes ainda.";
    return this.editOriginal(interaction, {
      embeds: [{ title: "🔥 Tópicos Mais Discutidos (7 dias)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  async trendingWords(interaction, guild, user) {
    const trending = await this._trendingTerms(interaction.guild_id, "word", 3, 10);
    const desc = trending.length
      ? trending.map((t, i) => {
          const arrow = t.before === 0 ? "🆕" : t.growth > 0 ? "📈" : "📉";
          return `**${i + 1}.** ${t.term} ${arrow} — ${t.count} menções (era ${t.before})`;
        }).join("\n")
      : "Sem tendências detectáveis ainda (é preciso volume mínimo de mensagens).";
    return this.editOriginal(interaction, {
      embeds: [{ title: "📈 Palavras em Tendência (3 dias vs 3 dias anteriores)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  async topEmojis(interaction, guild, user) {
    const top = await this._topTermsInWindow(interaction.guild_id, "emoji", 30, 10);
    const desc = top.length
      ? top.map((t, i) => `**${i + 1}.** ${t.term} — usado ${t.count}x`).join("\n")
      : "Sem dados suficientes ainda.";
    return this.editOriginal(interaction, {
      embeds: [{ title: "😀 Emojis Mais Utilizados (30 dias)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  async topReactions(interaction, guild, user) {
    const top = await this._topTermsInWindow(interaction.guild_id, "reaction", 30, 10);
    const desc = top.length
      ? top.map((t, i) => `**${i + 1}.** ${t.term} — usada ${t.count}x`).join("\n")
      : "Sem dados suficientes ainda.";
    return this.editOriginal(interaction, {
      embeds: [{ title: "❤️ Reações Mais Utilizadas (30 dias)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  /* ================= 7. COMANDOS MAIS UTILIZADOS ================= */
  // Reaproveita o CommandLog já existente (não duplica tracking).

  async topCommands(interaction, guild, user) {
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await CommandLog.aggregate([
      { $match: { guildId: interaction.guild_id, createdAt: { $gte: since } } },
      { $group: { _id: "$commandName", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);
    const desc = rows.length
      ? rows.map((r, i) => `**${i + 1}.** /${r._id} — ${r.total} execuções`).join("\n")
      : "Sem comandos registrados nos últimos 30 dias.";
    return this.editOriginal(interaction, {
      embeds: [{ title: "⌨️ Comandos Mais Utilizados (30 dias)", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  /* ================= 8. RESUMO GERAL ================= */

  async generalSummary(interaction, guild, user) {
    const guildId = interaction.guild_id;
    const [todayStat, last7, topChannel, topUser, activeUsers7d] = await Promise.all([
      ActivityDailyStat.findOne({ guildId, date: dateKey() }).lean(),
      this._dailyStatsRange(guildId, 7),
      ActivityChannelStat.findOne({ guildId }).sort({ totalMessages: -1 }).lean(),
      ActivityUserStat.findOne({ guildId }).sort({ totalMessages: -1 }).lean(),
      ActivityDailyUser.distinct("userId", { guildId, date: { $gte: dateKeyDaysAgo(6) } }),
    ]);

    const msgs7d = last7.reduce((s, d) => s + (d.messageCount || 0), 0);
    const netGrowth7d = last7.reduce((s, d) => s + (d.newMembers || 0) - (d.leftMembers || 0), 0);

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🧾 Resumo Geral da Atividade",
        description:
          `**Mensagens hoje:** ${todayStat?.messageCount || 0}\n` +
          `**Mensagens (7 dias):** ${msgs7d}\n` +
          `**Usuários ativos únicos (7 dias):** ${activeUsers7d.length}\n` +
          `**Crescimento líquido (7 dias):** ${netGrowth7d >= 0 ? "+" : ""}${netGrowth7d} membro(s)\n` +
          (topChannel ? `**Canal mais ativo (all-time):** <#${topChannel.channelId}> (${topChannel.totalMessages} msgs)\n` : "") +
          (topUser ? `**Usuário mais ativo (all-time):** <@${topUser.userId}> (${topUser.totalMessages} msgs)\n` : "")
      }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  /* ================= 9. CONFIGURAÇÕES ================= */

  async settingsMenu(interaction, guild, user) {
    const cfg = this.getConfig(guild);

    const select = this.select(
      user,
      [
        { label: cfg.enabled ? "🔴 Desativar Rastreamento" : "🟢 Ativar Rastreamento", value: "toggle" },
        { label: "🚫 Ignorar Canais",  value: "ignore_channels" },
        { label: "🚫 Ignorar Cargos",  value: "ignore_roles"    },
        { label: cfg.ignoreBots === false ? "🤖 Passar a ignorar bots" : "🤖 Passar a contar bots", value: "toggle_bots" },
      ],
      "Selecionar ação",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("activityAnalytics");
          await this.save(guild);
          return this.settingsMenu(i, guild, user);
        }
        if (v === "toggle_bots") {
          cfg.ignoreBots = cfg.ignoreBots === false ? true : false;
          guild.markModified("activityAnalytics");
          await this.save(guild);
          return this.settingsMenu(i, guild, user);
        }
        if (v === "ignore_channels") return this.pickIgnoredChannels(i, guild, user);
        if (v === "ignore_roles")    return this.pickIgnoredRoles(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "⚙️ Configurações — Análise de Atividade",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Desativado"}\n` +
          `**Contar bots:** ${cfg.ignoreBots === false ? "sim" : "não"}\n` +
          `**Canais ignorados:** ${cfg.ignoredChannels.length}\n` +
          `**Cargos ignorados:** ${cfg.ignoredRoles.length}`
      }],
      components: [this.row(select), this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }

  async pickIgnoredChannels(interaction, guild, user) {
    const picker = this.channelSelect(user, "Selecione os canais a ignorar", async (i) => {
      await this.deferUpdate(i);
      const cfg = this.getConfig(guild);
      cfg.ignoredChannels = [...new Set([...cfg.ignoredChannels, ...i.data.values])];
      guild.markModified("activityAnalytics");
      await this.save(guild);
      return this.settingsMenu(i, guild, user);
    }, { types: [0, 5] });

    return this.editOriginal(interaction, {
      embeds: [{ title: "🚫 Ignorar Canais", description: "Mensagens nesses canais não entrarão nas estatísticas." }],
      components: [this.row(picker), this.row(this.backBtn(user, (i) => this.settingsMenu(i, guild, user)))]
    });
  }

  async pickIgnoredRoles(interaction, guild, user) {
    const picker = this.roleSelect(user, "Selecione os cargos a ignorar", async (i) => {
      await this.deferUpdate(i);
      const cfg = this.getConfig(guild);
      cfg.ignoredRoles = [...new Set([...cfg.ignoredRoles, ...i.data.values])];
      guild.markModified("activityAnalytics");
      await this.save(guild);
      return this.settingsMenu(i, guild, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{ title: "🚫 Ignorar Cargos", description: "Membros com esses cargos não entrarão nas estatísticas." }],
      components: [this.row(picker), this.row(this.backBtn(user, (i) => this.settingsMenu(i, guild, user)))]
    });
  }
}

module.exports = ActivityAnalyticsSystem;
