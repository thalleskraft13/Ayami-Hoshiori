'use strict';

const { GuildDb } = require("../../Mongodb/guild.js");
const DiscordRequest = require("../DiscordRequest.js");
const PremiumManager = require("../Utils/PremiumManager.js");
const getPerm = require("../Utils/Permission.js");
const TTLCache = require("../Utils/TTLCache.js");
const NativeAutoMod = require("./Security/NativeAutoMod.js");
const RaidIntelligence = require("./Security/RaidIntelligence.js");
const MemberVerification = require("./Security/MemberVerification.js");
const TrapChannel = require("./Security/TrapChannel.js");

const NATIVE_FILTER_MODULES = ["badwords", "antispam", "antilinks", "antimention"];

class SecuritySystem {

  constructor(client) {
    this.client = client;
    this._spamTracker   = {}; 
    this._botPermCache  = new TTLCache({ ttlMs: 60_000, sweepIntervalMs: 5 * 60_000 });
    this.nativeAutoMod  = new NativeAutoMod(client);
    this.raidIntelligence = new RaidIntelligence(this);
    this.memberVerification = new MemberVerification(this);
    this.trapChannel = new TrapChannel(this);
  }

  async _syncNativeModule(guild, module) {
    if (!NATIVE_FILTER_MODULES.includes(module)) return { ok: true };
    const sec = this.getSecurity(guild);
    const cfg = sec.automod.simple[module];
    if (!cfg) return { ok: true };

    const results = [];
    try {
      if (module === "badwords")    results.push(await this.nativeAutoMod.syncBadwords(guild.guildId, cfg));
      if (module === "antispam")    results.push(await this.nativeAutoMod.syncAntispam(guild.guildId, cfg));
      if (module === "antimention") results.push(await this.nativeAutoMod.syncAntimention(guild.guildId, cfg));
      if (module === "antilinks") {
        results.push(await this.nativeAutoMod.syncAntilinks(guild.guildId, cfg));
        results.push(await this.nativeAutoMod.syncInvites(guild.guildId, cfg));
      }
    } catch (err) {
      console.error(`[Security] Falha ao sincronizar AutoMod nativo (${module}):`, err);
      results.push({ ok: false, error: err.message });
    }

    guild.markModified("security");
    await this.save(guild);

    const failed = results.find(r => r && r.ok === false);
    if (failed) {
      await this.sendSecurityAlert(
        guild.guildId,
        `⚠️ **Falha ao sincronizar AutoMod nativo — ${module}**\n${failed.error}`,
        "automod"
      );
      return { ok: false, error: failed.error };
    }
    return { ok: true };
  }

  async _warnIfSyncFailed(interaction, result) {
    if (result?.ok === false) {
      await this.followUpEphemeral(interaction, {
        content:
          `⚠️ **A configuração foi salva, mas o AutoMod nativo do Discord não foi sincronizado.**\n` +
          `Isso significa que a regra **não vai executar de verdade** até isso ser corrigido.\n\n` +
          `**Motivo:** ${result.error}`
      });
    }
  }


  _toV2(data) {
    if (!data || !data.embeds) return data;

    const blocks = [];
    for (const embed of data.embeds) {
      let text = '';
      if (embed.title)       text += `# ${embed.title}\n`;
      if (embed.description) text += `${embed.description}\n`;
      if (embed.fields?.length) {
        text += embed.fields
          .map(f => `**${f.name}**\n${f.value}`)
          .join('\n\n');
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

  getSecurity(guild) {
    if (!guild.security) {
      guild.security = {
        automod:    { simple: {}, advanced: {} },
        roles:      { staff: [], immune: [] },
        logs:       { mode: "single", channels: {}, types: {} },
        raid:       {},
        monitoring: {},
        emergency:  { active: false, channelSnapshot: [] },
        backups:    []
      };
    }
    if (!guild.security.emergency)                 guild.security.emergency = { active: false, channelSnapshot: [] };
    if (!guild.security.emergency.channelSnapshot) guild.security.emergency.channelSnapshot = [];
    if (!guild.security.backups)                   guild.security.backups = [];
    if (!guild.security.automod.advanced.warns)    guild.security.automod.advanced.warns = [];
    if (!guild.security.raid.factors) {
      guild.security.raid.factors = {
        joinRate: {}, newAccounts: {}, duplicateMessages: {},
        coordinatedSpam: {}, massMentions: {}, massInvites: {}
      };
    }
    if (!guild.security.raid.state) {
      guild.security.raid.state = { emergencyActive: false, lastHighRiskAt: null, flaggedUserIds: [] };
    }
    if (!guild.security.verification) {
      guild.security.verification = { enabled: false, rules: { minAccountAge: {}, requireCustomAvatar: {} }, history: [] };
    }
    if (!guild.security.trapChannel) {
      guild.security.trapChannel = {
        enabled: false, channelId: null, punishment: "log", logChannelId: null,
        deleteRecentMessages: false, recentMessagesWindowMinutes: 5,
        ignoredRoles: [], ignoredUsers: [], ignoredBots: [], warningMessageSent: false, history: []
      };
    }
    return guild.security;
  }

  getSimpleCfg(sec, key) {
    if (!sec.automod.simple[key]) sec.automod.simple[key] = { enabled: false };
    return sec.automod.simple[key];
  }

  extractId(text) {
    return text?.match(/\d{17,19}/)?.[0];
  }

  async isPremium(guildId) {
    const p = await PremiumManager.getGuildPremium(guildId);
    return p.status;
  }

  async hasAdvancedSystemsAccess(guildId) {
    const p = await PremiumManager.getGuildPremium(guildId);
    return !!(p.status && p.plan?.advancedSystems);
  }


  _permLabel(perm) {
    const labels = {
      ADMINISTRATOR:        "Administrador",
      KICK_MEMBERS:         "Expulsar Membros",
      BAN_MEMBERS:          "Banir Membros",
      MODERATE_MEMBERS:     "Aplicar Timeout (Silenciar Membros)",
      MANAGE_MESSAGES:      "Gerenciar Mensagens",
      MANAGE_CHANNELS:      "Gerenciar Canais",
      MANAGE_ROLES:         "Gerenciar Cargos/Permissões",
      MANAGE_GUILD:         "Gerenciar Servidor",
      MANAGE_WEBHOOKS:      "Gerenciar Webhooks",
      SEND_MESSAGES:        "Enviar Mensagens",
      EMBED_LINKS:          "Inserir Links (Embeds)",
      VIEW_CHANNEL:         "Ver Canal",
      VIEW_AUDIT_LOG:       "Ver Registro de Auditoria",
      READ_MESSAGE_HISTORY: "Ver Histórico de Mensagens"
    };
    return labels[perm] || perm;
  }

  async _getBotPermissions(guildId, channelId = null) {
    const key = channelId ? `${guildId}:${channelId}` : guildId;

    const cached = this._botPermCache.get(key);
    if (cached) return cached;

    try {
      const perms = await getPerm({
        channel: !!channelId,
        id:      channelId || guildId,
        guildId,
        bot:     true,
        client:  this.client
      });
      this._botPermCache.set(key, perms); 
      return perms;
    } catch (err) {
      console.error("[Security] _getBotPermissions:", err);
      return [];
    }
  }

  _clearBotPermCache(guildId) {
    this._botPermCache.deleteWhere(key => key === guildId || key.startsWith(`${guildId}:`));
  }

  async _hasBotPerms(guildId, required, channelId = null) {
    const perms = await this._getBotPermissions(guildId, channelId);
    if (perms.includes("ADMINISTRATOR")) return true;
    return required.every(p => perms.includes(p));
  }

  async _missingBotPerms(guildId, required, channelId = null) {
    const perms = await this._getBotPermissions(guildId, channelId);
    if (perms.includes("ADMINISTRATOR")) return [];
    return required.filter(p => !perms.includes(p));
  }

  async _requirePerms(interaction, guild, user, required, channelId, backFn, actionLabel = "executar esta ação") {
    const missing = await this._missingBotPerms(interaction.guild_id, required, channelId);
    if (missing.length) {
      await this.followUpEphemeral(interaction, {
        content:
          `❌ **Não tenho permissão para ${actionLabel}.**\n\n` +
          `**Faltando:** ${missing.map(p => `\`${this._permLabel(p)}\``).join(", ")}\n\n` +
          `> Verifique o cargo do bot nas configurações do servidor e a posição dele na hierarquia de cargos.`
      });
      if (backFn) await backFn(interaction);
      return false;
    }
    return true;
  }

  async _ensurePerms(guildId, required, channelId, contextLabel) {
    const missing = await this._missingBotPerms(guildId, required, channelId);
    if (missing.length) {
      await this.sendSecurityAlert(guildId,
        `⚠️ **Permissão insuficiente** para ${contextLabel}.\n` +
        `Faltando: ${missing.map(p => `\`${this._permLabel(p)}\``).join(", ")}\n` +
        `> Ajuste o cargo do bot para que o sistema de segurança funcione corretamente.`,
        "security"
      ).catch(() => {});
      return false;
    }
    return true;
  }

  btn(user, label, style, func) {
    return this.client.interactions.createButton({
      user,
      data: { label, style },
      funcao: func
    });
  }

  select(user, options, placeholder, func) {
    return this.client.interactions.createSelect({
      user,
      data: { placeholder, options },
      funcao: func
    });
  }

  row(...c) {
    return { type: 1, components: c };
  }

  backBtn(user, targetFn) {
    return this.btn(user, "⬅️ Voltar", 2, async (i) => {
      await this.deferUpdate(i);
      return targetFn(i);
    });
  }


  async startSetup(interaction) {
    const guild   = await this.getGuild(interaction.guild_id);
    const user    = interaction.member.user.id;
    const premium = await this.isPremium(guild.guildId);

    const select = this.select(
      user,
      [
        { label: "🛡️ AutoMod Simples",            value: "automod_simple"    },
        { label: "⚙️ AutoMod Avançado",            value: "automod_advanced"  },
        { label: "👮 Cargos e Permissões",         value: "roles_permissions" },
        { label: "📜 Logs",                        value: "logs"              },
        { label: "🔍 Verificação de Permissões",   value: "permission_check"  },
        { label: "🧾 Verificação de Novos Membros",value: "member_verification" },
        { label: "🪤 Canal Armadilha",             value: "trap_channel"      },
        { label: "🚨 AntiRaid Inteligente",        value: "raid_detection"    },
        { label: "🔒 Modo Emergência",             value: "emergency_mode"    },
        { label: "🧬 Monitoramento de Alterações", value: "monitoring"        },
        { label: "🤖 Bots Suspeitos",              value: "bot_analysis"      },
        { label: "🧠 Verificação Completa",        value: "full_check"        },
        { label: "💾 Backup do Servidor",          value: "backup"            }
      ],
      "Selecionar categoria",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "automod_simple")    return this.automodSimpleMenu(i, guild, user);
        if (v === "automod_advanced")  return this.automodAdvancedMenu(i, guild, user);
        if (v === "roles_permissions") return this.rolesPermissionsMenu(i, guild, user);
        if (v === "logs")              return this.logsMenu(i, guild, user);
        if (v === "permission_check")  return this.permissionCheck(i, guild, user);
        if (v === "member_verification") return this.verificationMenu(i, guild, user);
        if (v === "trap_channel")      return this.trapChannelMenu(i, guild, user);
        if (v === "raid_detection")    return this.raidDetection(i, guild, user);
        if (v === "emergency_mode")    return this.emergencyMode(i, guild, user);
        if (v === "monitoring")        return this.monitoringSystem(i, guild, user);
        if (v === "bot_analysis")      return this.botAnalysis(i, guild, user);
        if (v === "full_check")        return this.fullSecurityCheck(i, guild, user);
        if (v === "backup")            return this.backupMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🛡️ Sistema de Segurança — Ayami",
        description:
          `Bem-vindo ao painel de segurança.\n\n` +
          `Selecione uma categoria abaixo para configurar.\n\n` +
          `${premium ? "✨ Premium ativo" : "🔒 Algumas funções requerem Premium"}`
      }],
      components: [this.row(select)]
    });
  }


  async automodSimpleMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const s   = sec.automod.simple;

    const modules = [
      { key: "badwords",    label: "Palavras Proibidas", desc: `${s.badwords?.list?.length || 0} palavras`, native: true },
      { key: "antispam",    label: "Anti-Spam",          desc: "heurística nativa do Discord", native: true },
      { key: "antilinks",   label: "Links / Convites",   desc: `${s.antilinks?.allowedDomains?.length || 0} permitidos / ${s.antilinks?.blockedDomains?.length || 0} bloqueados`, native: true },
      { key: "antimention", label: "Anti-Mass Mention",  desc: `max ${s.antimention?.maxMentions || 5} menções`, native: true },
      { key: "anticaps",    label: "Anti-Caps",          desc: `${s.anticaps?.percent || 70}% caps`, native: false },
      { key: "antiemoji",   label: "Anti-Emoji",         desc: `max ${s.antiemoji?.maxEmojis || 10} emojis/msg`, native: false },
      { key: "antifiles",   label: "Arquivos Proibidos", desc: `${s.antifiles?.blockedExtensions?.length || 0} extensões`, native: false }
    ];

    const select = this.select(
      user,
      modules.map(m => ({
        label:       `${s[m.key]?.enabled ? "🟢" : "🔴"} ${m.label}`,
        description: `${m.native ? "⚡ Nativo" : "🤖 Ayami"} — ${m.desc}`,
        value:       m.key
      })),
      "Selecionar módulo",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "badwords")    return this.badwordsMenu(i, guild, user);
        if (v === "antispam")    return this.antispamMenu(i, guild, user);
        if (v === "anticaps")    return this.anticapsMenu(i, guild, user);
        if (v === "antilinks")   return this.antilinksMenu(i, guild, user);
        if (v === "antimention") return this.antimentionMenu(i, guild, user);
        if (v === "antiemoji")   return this.antiemojiMenu(i, guild, user);
        if (v === "antifiles")   return this.antifilesMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🛡️ Filtros",
        description:
          "Clique em um módulo para configurar.\n" +
          "⚡ Nativo = detectado pelo AutoMod do próprio Discord (mais rápido, roda mesmo se a Ayami cair).\n" +
          "🤖 Ayami = sem equivalente na API do Discord, detecção própria do bot.\n\n" +
          modules.map(m => `${s[m.key]?.enabled ? "🟢" : "🔴"} **${m.label}** (${m.native ? "⚡" : "🤖"}) — ${m.desc}`).join("\n")
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }


  _defaultEscalation() {
    return [
      { warns: 1, action: "warn_message" },
      { warns: 2, action: "timeout_10m"  },
      { warns: 3, action: "timeout_1h"   },
      { warns: 5, action: "kick"         },
      { warns: 7, action: "ban"          }
    ];
  }

  async warnEscalationMenu(interaction, guild, user, module, backFn) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, module);
    if (!cfg.escalation || cfg.escalation.length === 0) cfg.escalation = this._defaultEscalation();
    if (!cfg.actions) cfg.actions = ["delete"];

    const escalation   = cfg.escalation;
    const warnEnabled  = cfg.actions.includes("warn");
    const actionLabel = {
      "warn_message": "💬 Aviso no chat",
      "timeout_10m":  "⏱️ Timeout 10min",
      "timeout_1h":   "⏱️ Timeout 1h",
      "timeout_24h":  "⏱️ Timeout 24h",
      "kick":         "👢 Kick",
      "ban":          "🔨 Ban"
    };

    const select = this.select(
      user,
      [
        { label: "➕ Adicionar nível de punição", value: "add"    },
        { label: "✏️ Editar nível existente",    value: "edit"   },
        { label: "➖ Remover nível",             value: "remove" },
        { label: "🔄 Restaurar padrão",          value: "reset"  },
        { label: warnEnabled ? "✅ Ação 'Warn' está ativa" : "⚠️ Ativar ação 'Warn' (necessário!)", value: "toggle_warn" }
      ],
      "Gerenciar Escalonamento",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "add")    return this._addEscalationLevel(i, guild, user, module, backFn);
        if (v === "edit")   return this._editEscalationLevel(i, guild, user, module, backFn);
        if (v === "remove") return this._removeEscalationLevel(i, guild, user, module, backFn);
        if (v === "toggle_warn") {
          if (!cfg.actions.includes("warn")) cfg.actions.push("warn");
          else cfg.actions = cfg.actions.filter(a => a !== "warn");
          guild.markModified("security");
          await this.save(guild);
          return this.warnEscalationMenu(i, guild, user, module, backFn);
        }
        if (v === "reset") {
          cfg.escalation = this._defaultEscalation();
          guild.markModified("security");
          await this.save(guild);
          await this.followUpEphemeral(i, { content: "✅ Escalonamento restaurado ao padrão." });
          return this.warnEscalationMenu(i, guild, user, module, backFn);
        }
      }
    );

    const tableLines = escalation
      .sort((a, b) => a.warns - b.warns)
      .map(e => `**${e.warns} warn(s)** → ${actionLabel[e.action] || e.action}`)
      .join("\n");

    return this.editOriginal(interaction, {
      embeds: [{
        title: `⚖️ Escalonamento de Punições — ${module}`,
        description:
          `Configure o que acontece a cada X warns acumulados.\n\n` +
          (warnEnabled
            ? ""
            : `⚠️ **Atenção:** a ação "Adicionar Warn" não está ativa para este módulo.\n` +
              `Sem ela, os warns não são contados e o escalonamento abaixo **não funcionará**.\n` +
              `Use o botão "Ativar ação 'Warn'" abaixo para corrigir.\n\n`) +
          (tableLines || "_Nenhum nível configurado._")
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, backFn))
      ]
    });
  }

  async _addEscalationLevel(interaction, guild, user, module, backFn) {
    await this.followUpEphemeral(interaction, {
      content: "Quantos warns para acionar? (ex: `3`)"
    });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const warns = parseInt(msg.content);
    if (isNaN(warns) || warns < 1) return this.followUpEphemeral(interaction, { content: "❌ Número inválido." });

    const sel = this.select(
      user,
      [
        { label: "💬 Aviso no chat",   value: "warn_message" },
        { label: "⏱️ Timeout 10min",  value: "timeout_10m"  },
        { label: "⏱️ Timeout 1h",     value: "timeout_1h"   },
        { label: "⏱️ Timeout 24h",    value: "timeout_24h"  },
        { label: "👢 Kick",           value: "kick"         },
        { label: "🔨 Ban",            value: "ban"          }
      ],
      "Selecionar ação",
      async (i) => {
        await this.deferUpdate(i);
        const sec = this.getSecurity(guild);
        const cfg = this.getSimpleCfg(sec, module);
        if (!cfg.escalation) cfg.escalation = [];
        cfg.escalation = cfg.escalation.filter(e => e.warns !== warns);
        cfg.escalation.push({ warns, action: i.data.values[0] });
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: `✅ Nível adicionado: ${warns} warn(s).` });
        return this.warnEscalationMenu(i, guild, user, module, backFn);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: `Ação para **${warns} warn(s)**:`,
      components: [this.row(sel)]
    });
  }

  async _editEscalationLevel(interaction, guild, user, module, backFn) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, module);
    const esc = cfg.escalation || [];
    if (!esc.length) return this.followUpEphemeral(interaction, { content: "Nenhum nível cadastrado." });

    const actionLabel = {
      "warn_message": "Aviso",
      "timeout_10m":  "Timeout 10min",
      "timeout_1h":   "Timeout 1h",
      "timeout_24h":  "Timeout 24h",
      "kick":         "Kick",
      "ban":          "Ban"
    };

    const sel = this.select(
      user,
      esc.sort((a, b) => a.warns - b.warns).map(e => ({
        label: `${e.warns} warn(s) → ${actionLabel[e.action] || e.action}`,
        value: String(e.warns)
      })),
      "Selecionar nível para editar",
      async (i) => {
        await this.deferUpdate(i);
        return this._addEscalationLevel(i, guild, user, module, backFn);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione o nível para editar (vai sobrescrever):",
      components: [this.row(sel)]
    });
  }

  async _removeEscalationLevel(interaction, guild, user, module, backFn) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, module);
    const esc = cfg.escalation || [];
    if (!esc.length) return this.followUpEphemeral(interaction, { content: "Nenhum nível cadastrado." });

    const actionLabel = {
      "warn_message": "Aviso",
      "timeout_10m":  "Timeout 10min",
      "timeout_1h":   "Timeout 1h",
      "timeout_24h":  "Timeout 24h",
      "kick":         "Kick",
      "ban":          "Ban"
    };

    const sel = this.select(
      user,
      esc.sort((a, b) => a.warns - b.warns).map(e => ({
        label: `${e.warns} warn(s) → ${actionLabel[e.action] || e.action}`,
        value: String(e.warns)
      })),
      "Selecionar nível para remover",
      async (i) => {
        await this.deferUpdate(i);
        cfg.escalation = cfg.escalation.filter(e => e.warns !== parseInt(i.data.values[0]));
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Nível removido." });
        return this.warnEscalationMenu(i, guild, user, module, backFn);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione o nível para remover:",
      components: [this.row(sel)]
    });
  }


  async multiActionMenu(interaction, guild, user, module, backFn, availableActions = null) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, module);
    if (!cfg.actions) cfg.actions = ["delete"];

    const ALL_ACTIONS = availableActions || ["delete", "warn", "timeout_10m", "timeout_1h", "kick", "ban"];
    const actionLabel = {
      delete:       "🗑️ Deletar mensagem",
      warn:         "⚠️ Adicionar Warn",
      timeout_10m:  "⏱️ Timeout 10min",
      timeout_1h:   "⏱️ Timeout 1h",
      timeout_24h:  "⏱️ Timeout 24h",
      kick:         "👢 Kick",
      ban:          "🔨 Ban"
    };

    const select = this.select(
      user,
      ALL_ACTIONS.map(a => ({
        label:       actionLabel[a] || a,
        description: cfg.actions.includes(a) ? "✅ Ativa" : "❌ Inativa",
        value:       a
      })),
      "Ativar/Desativar ações (toggle)",
      async (i) => {
        await this.deferUpdate(i);
        const chosen = i.data.values[0];
        const sec2   = this.getSecurity(guild);
        const cfg2   = this.getSimpleCfg(sec2, module);
        if (!cfg2.actions) cfg2.actions = [];
        if (cfg2.actions.includes(chosen)) {
          cfg2.actions = cfg2.actions.filter(a => a !== chosen);
        } else {
          cfg2.actions.push(chosen);
        }
        guild.markModified("security");
        await this.save(guild);
        await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, module));
        return this.multiActionMenu(i, guild, user, module, backFn, availableActions);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: `⚡ Ações do Módulo — ${module}`,
        description:
          `Selecione as ações que serão executadas quando o módulo detectar uma infração.\n` +
          `Múltiplas ações podem ser ativas ao mesmo tempo.\n\n` +
          `**Ativas agora:** ${cfg.actions.length ? cfg.actions.map(a => actionLabel[a] || a).join(", ") : "_Nenhuma_"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, backFn))
      ]
    });
  }


  async badwordsMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "badwords");
    if (!cfg.list)       cfg.list       = [];
    if (!cfg.actions)    cfg.actions    = ["delete"];
    if (!cfg.escalation) cfg.escalation = this._defaultEscalation();

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢 Desativar" : "🔴 Ativar"}`,     value: "toggle"      },
        { label: "➕ Adicionar palavra(s)",                             value: "add"         },
        { label: "➖ Remover palavra",                                  value: "remove"      },
        { label: "📋 Ver lista completa",                               value: "view"        },
        { label: "🗑️ Limpar lista",                                    value: "clear"       },
        { label: `⚡ Ações (${cfg.actions?.length || 1} ativa(s))`,    value: "set_action"  },
        { label: "⚖️ Escalonamento de Warns",                          value: "escalation"  },
        { label: `🚫 Canais Ignorados (${cfg.ignoredChannels?.length || 0})`, value: "ig_ch" },
        { label: `👤 Cargos Ignorados (${cfg.ignoredRoles?.length || 0})`,    value: "ig_role" }
      ],
      "Configurar Palavras Proibidas",
      async (i) => {
        const v = i.data.values[0];

        if (v === "add") return this.addBadword(i, guild, user);

        await this.deferUpdate(i);
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "badwords"));
          return this.badwordsMenu(i, guild, user);
        }
        if (v === "remove")     return this.removeBadword(i, guild, user);
        if (v === "view")       return this.viewSimpleList(i, guild, user, "badwords", "list", "📋 Palavras Proibidas");
        if (v === "clear") {
          cfg.list = [];
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "badwords"));
          await this.followUpEphemeral(i, { content: "✅ Lista limpa." });
          return this.badwordsMenu(i, guild, user);
        }
        if (v === "set_action") return this.multiActionMenu(i, guild, user, "badwords", (x) => this.badwordsMenu(x, guild, user));
        if (v === "escalation") return this.warnEscalationMenu(i, guild, user, "badwords", (x) => this.badwordsMenu(x, guild, user));
        if (v === "ig_ch")      return this.manageIgnoredList(i, guild, user, "badwords", "ignoredChannels", "canal");
        if (v === "ig_role")    return this.manageIgnoredList(i, guild, user, "badwords", "ignoredRoles",    "cargo");
      }
    );

    const actionLabel = {
      delete: "Deletar", warn: "Warn", timeout_10m: "Timeout 10m",
      timeout_1h: "Timeout 1h", timeout_24h: "Timeout 24h", kick: "Kick", ban: "Ban"
    };

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📝 Palavras Proibidas",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Total:** ${cfg.list.length} palavra(s)\n` +
          `**Ações:** ${(cfg.actions || ["delete"]).map(a => actionLabel[a] || a).join(", ")}\n\n` +
          (cfg.list.length
            ? cfg.list.slice(0, 20).map(w => `\`${w}\``).join(", ") +
              (cfg.list.length > 20 ? `\n...e mais ${cfg.list.length - 20}` : "")
            : "_Nenhuma palavra cadastrada._")
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))
      ]
    });
  }

  async addBadword(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "badwords");
    if (!cfg.list) cfg.list = [];

    const modal = this.client.interactions.createModal({
      user,
      title: "Adicionar Palavra Proibida",
      components: [{
        type: 1,
        components: [{
          type: 4,
          custom_id: "words",
          label: "Palavra(s) — separadas por vírgula",
          style: 2,
          required: true,
          max_length: 1000,
          placeholder: "termo1, frase ruim, xingamento"
        }]
      }],
      funcao: async (mi, _client, fields) => {
        await this.client.interactions._callback(mi, { type: 6 });

        const raw = (fields.words || "");
        const candidates = raw
          .split(",")
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length > 0);

        if (!candidates.length) {
          await this.followUpEphemeral(mi, { content: "⚠️ Nenhuma palavra válida foi informada." });
          return this.badwordsMenu(mi, guild, user);
        }

        const sec2 = this.getSecurity(guild);
        const cfg2 = this.getSimpleCfg(sec2, "badwords");
        if (!cfg2.list) cfg2.list = [];

        const MAX_WORDS = 100; 
        const novas = candidates.filter(w => !cfg2.list.includes(w));
        const espacoDisponivel = Math.max(0, MAX_WORDS - cfg2.list.length);
        const aceitas    = novas.slice(0, espacoDisponivel);
        const descartadas = novas.slice(espacoDisponivel);

        let syncResult = { ok: true };
        if (aceitas.length) {
          cfg2.list.push(...aceitas);
          guild.markModified("security");
          await this.save(guild);
          syncResult = await this._syncNativeModule(guild, "badwords");

          await this.sendSecurityAlert(
            guild.guildId,
            `📝 **Palavras proibidas adicionadas** por <@${user}>: ${aceitas.map(w => `\`${w}\``).join(", ")}`,
            "automod"
          );
        }

        const partes = [];
        if (aceitas.length)     partes.push(`✅ ${aceitas.length} palavra(s) adicionada(s).`);
        if (descartadas.length) partes.push(`⚠️ ${descartadas.length} descartada(s) — limite de ${MAX_WORDS} palavras atingido.`);
        if (!aceitas.length && !descartadas.length) partes.push("ℹ️ Todas as palavras informadas já estavam na lista.");

        await this.followUpEphemeral(mi, { content: partes.join(" ") });
        await this._warnIfSyncFailed(mi, syncResult);
        return this.badwordsMenu(mi, guild, user);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async removeBadword(interaction, guild, user) {
    const sec  = this.getSecurity(guild);
    const cfg  = this.getSimpleCfg(sec, "badwords");
    const list = cfg.list || [];
    if (!list.length) return this.followUpEphemeral(interaction, { content: "Nenhuma palavra cadastrada." });

    const select = this.select(
      user,
      list.slice(0, 25).map(w => ({ label: w, value: w })),
      "Selecionar palavra",
      async (i) => {
        await this.deferUpdate(i);
        cfg.list = cfg.list.filter(w => w !== i.data.values[0]);
        guild.markModified("security");
        await this.save(guild);
        await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "badwords"));
        await this.followUpEphemeral(i, { content: `✅ \`${i.data.values[0]}\` removida.` });
        return this.badwordsMenu(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione a palavra para remover:",
      components: [this.row(select)]
    });
  }


  async antispamMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antispam");
    if (!cfg.maxMessages)     cfg.maxMessages     = 5;
    if (!cfg.intervalSeconds) cfg.intervalSeconds = 5;
    if (!cfg.actions)         cfg.actions         = ["delete"];
    if (!cfg.ignoredChannels) cfg.ignoredChannels = [];
    if (!cfg.ignoredRoles)    cfg.ignoredRoles    = [];
    if (!cfg.escalation)      cfg.escalation      = this._defaultEscalation();

    const actionLabel = {
      delete: "Deletar", warn: "Warn", timeout_10m: "Timeout 10m",
      timeout_1h: "Timeout 1h", timeout_24h: "Timeout 24h", kick: "Kick", ban: "Ban"
    };

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢 Desativar" : "🔴 Ativar"}`,                         value: "toggle"    },
        { label: `⚙️ Sugestão de limite: ${cfg.maxMessages} msgs em ${cfg.intervalSeconds}s`, value: "set_limit" },
        { label: `⚡ Ações (${cfg.actions?.length || 1} ativa(s))`,                        value: "set_action"},
        { label: "⚖️ Escalonamento de Warns",                                              value: "escalation"},
        { label: `🚫 Canais Ignorados (${cfg.ignoredChannels.length})`,                    value: "ig_ch"     },
        { label: `👤 Cargos Ignorados (${cfg.ignoredRoles.length})`,                       value: "ig_role"   }
      ],
      "Configurar Anti-Spam",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "antispam"));
          return this.antispamMenu(i, guild, user);
        }
        if (v === "set_limit")  return this.setSpamLimit(i, guild, user);
        if (v === "set_action") return this.multiActionMenu(i, guild, user, "antispam", (x) => this.antispamMenu(x, guild, user));
        if (v === "escalation") return this.warnEscalationMenu(i, guild, user, "antispam", (x) => this.antispamMenu(x, guild, user));
        if (v === "ig_ch")      return this.manageIgnoredList(i, guild, user, "antispam", "ignoredChannels", "canal");
        if (v === "ig_role")    return this.manageIgnoredList(i, guild, user, "antispam", "ignoredRoles",    "cargo");
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🔁 Anti-Spam",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo (AutoMod nativo do Discord)" : "🔴 Inativo"}\n` +
          `-# A detecção usa a heurística de spam nativa do Discord — não é mais um contador próprio da Ayami. O campo de limite abaixo fica só como referência.\n` +
          `**Ações:** ${(cfg.actions || ["delete"]).map(a => actionLabel[a] || a).join(", ")}\n` +
          `**Canais ignorados:** ${cfg.ignoredChannels.map(c => `<#${c}>`).join(", ") || "Nenhum"}\n` +
          `**Cargos ignorados:** ${cfg.ignoredRoles.map(r => `<@&${r}>`).join(", ")   || "Nenhum"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))
      ]
    });
  }

  async setSpamLimit(interaction, guild, user) {
    await this.followUpEphemeral(interaction, {
      content: "Envie o limite no formato `mensagens/segundos`\nEx: `5/5` = 5 mensagens em 5 segundos"
    });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const [m, s] = msg.content.split("/").map(Number);
    if (!m || !s || m < 1 || s < 1)
      return this.followUpEphemeral(interaction, { content: "❌ Formato inválido. Use `msgs/segundos`." });

    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antispam");
    cfg.maxMessages     = m;
    cfg.intervalSeconds = s;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ Limite: ${m} msgs em ${s}s.` });
    return this.antispamMenu(interaction, guild, user);
  }


  async anticapsMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "anticaps");
    if (!cfg.percent)         cfg.percent         = 70;
    if (!cfg.minLength)       cfg.minLength       = 10;
    if (!cfg.actions)         cfg.actions         = ["delete"];
    if (!cfg.ignoredChannels) cfg.ignoredChannels = [];
    if (!cfg.ignoredRoles)    cfg.ignoredRoles    = [];
    if (!cfg.escalation)      cfg.escalation      = this._defaultEscalation();

    const actionLabel = {
      delete: "Deletar", warn: "Warn", timeout_10m: "Timeout 10m",
      timeout_1h: "Timeout 1h", timeout_24h: "Timeout 24h", kick: "Kick", ban: "Ban"
    };

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢 Desativar" : "🔴 Ativar"}`,                          value: "toggle"    },
        { label: `⚙️ Limite: ${cfg.percent}% caps / mín. ${cfg.minLength} chars`,           value: "set_limit" },
        { label: `⚡ Ações (${cfg.actions?.length || 1} ativa(s))`,                         value: "set_action"},
        { label: "⚖️ Escalonamento de Warns",                                               value: "escalation"},
        { label: `🚫 Canais Ignorados (${cfg.ignoredChannels.length})`,                     value: "ig_ch"     },
        { label: `👤 Cargos Ignorados (${cfg.ignoredRoles.length})`,                        value: "ig_role"   }
      ],
      "Configurar Anti-Caps",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          return this.anticapsMenu(i, guild, user);
        }
        if (v === "set_limit")  return this.setCapsLimit(i, guild, user);
        if (v === "set_action") return this.multiActionMenu(i, guild, user, "anticaps", (x) => this.anticapsMenu(x, guild, user));
        if (v === "escalation") return this.warnEscalationMenu(i, guild, user, "anticaps", (x) => this.anticapsMenu(x, guild, user));
        if (v === "ig_ch")      return this.manageIgnoredList(i, guild, user, "anticaps", "ignoredChannels", "canal");
        if (v === "ig_role")    return this.manageIgnoredList(i, guild, user, "anticaps", "ignoredRoles",    "cargo");
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🔠 Anti-Caps",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Limite de Caps:** ${cfg.percent}%\n` +
          `**Mínimo de chars:** ${cfg.minLength}\n` +
          `**Ações:** ${(cfg.actions || ["delete"]).map(a => actionLabel[a] || a).join(", ")}\n` +
          `**Canais ignorados:** ${cfg.ignoredChannels.map(c => `<#${c}>`).join(", ") || "Nenhum"}\n` +
          `**Cargos ignorados:** ${cfg.ignoredRoles.map(r => `<@&${r}>`).join(", ")   || "Nenhum"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))
      ]
    });
  }

  async setCapsLimit(interaction, guild, user) {
    await this.followUpEphemeral(interaction, {
      content: "Envie no formato `porcentagem/minChars`\nEx: `70/10` = block se >70% caps e msg >10 chars"
    });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const [p, l] = msg.content.split("/").map(Number);
    if (!p || !l || p < 1 || p > 100 || l < 1)
      return this.followUpEphemeral(interaction, { content: "❌ Formato inválido. Use `porcentagem/minChars`." });

    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "anticaps");
    cfg.percent   = p;
    cfg.minLength = l;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ ${p}% caps / mín. ${l} chars.` });
    return this.anticapsMenu(interaction, guild, user);
  }


  async antiemojiMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antiemoji");
    if (!cfg.maxEmojis)       cfg.maxEmojis       = 10;
    if (!cfg.actions)         cfg.actions         = ["delete"];
    if (!cfg.ignoredChannels) cfg.ignoredChannels = [];
    if (!cfg.ignoredRoles)    cfg.ignoredRoles    = [];
    if (!cfg.escalation)      cfg.escalation      = this._defaultEscalation();

    const actionLabel = {
      delete: "Deletar", warn: "Warn", timeout_10m: "Timeout 10m",
      timeout_1h: "Timeout 1h", timeout_24h: "Timeout 24h", kick: "Kick", ban: "Ban"
    };

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢 Desativar" : "🔴 Ativar"}`,                          value: "toggle"    },
        { label: `⚙️ Limite: ${cfg.maxEmojis} emojis por mensagem`,                        value: "set_limit" },
        { label: `⚡ Ações (${cfg.actions?.length || 1} ativa(s))`,                        value: "set_action"},
        { label: "⚖️ Escalonamento de Warns",                                              value: "escalation"},
        { label: `🚫 Canais Ignorados (${cfg.ignoredChannels.length})`,                    value: "ig_ch"     },
        { label: `👤 Cargos Ignorados (${cfg.ignoredRoles.length})`,                       value: "ig_role"   }
      ],
      "Configurar Anti-Emoji",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          return this.antiemojiMenu(i, guild, user);
        }
        if (v === "set_limit")  return this.setEmojiLimit(i, guild, user);
        if (v === "set_action") return this.multiActionMenu(i, guild, user, "antiemoji", (x) => this.antiemojiMenu(x, guild, user));
        if (v === "escalation") return this.warnEscalationMenu(i, guild, user, "antiemoji", (x) => this.antiemojiMenu(x, guild, user));
        if (v === "ig_ch")      return this.manageIgnoredList(i, guild, user, "antiemoji", "ignoredChannels", "canal");
        if (v === "ig_role")    return this.manageIgnoredList(i, guild, user, "antiemoji", "ignoredRoles",    "cargo");
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "😀 Anti-Emoji (excesso)",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"} _(detecção própria da Ayami — sem equivalente no AutoMod nativo)_\n` +
          `**Limite:** ${cfg.maxEmojis} emojis/msg\n` +
          `**Ações:** ${(cfg.actions || ["delete"]).map(a => actionLabel[a] || a).join(", ")}\n` +
          `**Canais ignorados:** ${cfg.ignoredChannels.map(c => `<#${c}>`).join(", ") || "Nenhum"}\n` +
          `**Cargos ignorados:** ${cfg.ignoredRoles.map(r => `<@&${r}>`).join(", ")   || "Nenhum"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))
      ]
    });
  }

  async setEmojiLimit(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Envie o número máximo de emojis por mensagem (ex: `10`):" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const limit = parseInt(msg.content);
    if (isNaN(limit) || limit < 1) return this.followUpEphemeral(interaction, { content: "❌ Número inválido." });

    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antiemoji");
    cfg.maxEmojis = limit;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ Limite: ${limit} emojis.` });
    return this.antiemojiMenu(interaction, guild, user);
  }


  async antifilesMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antifiles");
    if (!cfg.blockedExtensions) cfg.blockedExtensions = ["exe", "bat", "scr", "cmd", "msi", "vbs", "jar"];
    if (!cfg.actions)           cfg.actions           = ["delete"];
    if (!cfg.ignoredChannels)   cfg.ignoredChannels   = [];
    if (!cfg.ignoredRoles)      cfg.ignoredRoles      = [];
    if (!cfg.escalation)        cfg.escalation        = this._defaultEscalation();

    const actionLabel = {
      delete: "Deletar", warn: "Warn", timeout_10m: "Timeout 10m",
      timeout_1h: "Timeout 1h", timeout_24h: "Timeout 24h", kick: "Kick", ban: "Ban"
    };

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢 Desativar" : "🔴 Ativar"}`,                          value: "toggle"     },
        { label: `➕ Adicionar extensão(ões)`,                                             value: "add"        },
        { label: `➖ Remover extensão`,                                                    value: "remove"     },
        { label: `⚡ Ações (${cfg.actions?.length || 1} ativa(s))`,                        value: "set_action" },
        { label: "⚖️ Escalonamento de Warns",                                              value: "escalation" },
        { label: `🚫 Canais Ignorados (${cfg.ignoredChannels.length})`,                    value: "ig_ch"      },
        { label: `👤 Cargos Ignorados (${cfg.ignoredRoles.length})`,                       value: "ig_role"    }
      ],
      "Configurar Arquivos Proibidos",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          return this.antifilesMenu(i, guild, user);
        }
        if (v === "add")        return this.addBlockedExtension(i, guild, user);
        if (v === "remove")     return this.removeBlockedExtension(i, guild, user);
        if (v === "set_action") return this.multiActionMenu(i, guild, user, "antifiles", (x) => this.antifilesMenu(x, guild, user));
        if (v === "escalation") return this.warnEscalationMenu(i, guild, user, "antifiles", (x) => this.antifilesMenu(x, guild, user));
        if (v === "ig_ch")      return this.manageIgnoredList(i, guild, user, "antifiles", "ignoredChannels", "canal");
        if (v === "ig_role")    return this.manageIgnoredList(i, guild, user, "antifiles", "ignoredRoles",    "cargo");
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📎 Arquivos Proibidos",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"} _(detecção própria da Ayami — sem equivalente no AutoMod nativo)_\n` +
          `**Extensões bloqueadas:** ${cfg.blockedExtensions.map(e => `\`.${e}\``).join(", ") || "Nenhuma"}\n` +
          `**Ações:** ${(cfg.actions || ["delete"]).map(a => actionLabel[a] || a).join(", ")}\n` +
          `**Canais ignorados:** ${cfg.ignoredChannels.map(c => `<#${c}>`).join(", ") || "Nenhum"}\n` +
          `**Cargos ignorados:** ${cfg.ignoredRoles.map(r => `<@&${r}>`).join(", ")   || "Nenhum"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))
      ]
    });
  }

  async addBlockedExtension(interaction, guild, user) {
    await this.followUpEphemeral(interaction, {
      content: "Envie a(s) extensão(ões), sem o ponto:\n> Ex: `exe, bat, apk`"
    });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antifiles");
    if (!cfg.blockedExtensions) cfg.blockedExtensions = [];

    const exts = msg.content
      .split(",")
      .map(e => e.trim().toLowerCase().replace(/^\./, ""))
      .filter(e => e.length > 0 && !cfg.blockedExtensions.includes(e));

    cfg.blockedExtensions.push(...exts);
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, {
      content: `✅ ${exts.length} extensão(ões): ${exts.map(e => `\`.${e}\``).join(", ")}`
    });
    return this.antifilesMenu(interaction, guild, user);
  }

  async removeBlockedExtension(interaction, guild, user) {
    const sec  = this.getSecurity(guild);
    const cfg  = this.getSimpleCfg(sec, "antifiles");
    const list = cfg.blockedExtensions || [];
    if (!list.length) return this.followUpEphemeral(interaction, { content: "Nenhuma extensão cadastrada." });

    const select = this.select(
      user,
      list.slice(0, 25).map(e => ({ label: `.${e}`, value: e })),
      "Selecionar extensão",
      async (i) => {
        await this.deferUpdate(i);
        cfg.blockedExtensions = cfg.blockedExtensions.filter(e => e !== i.data.values[0]);
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: `✅ \`.${i.data.values[0]}\` removida.` });
        return this.antifilesMenu(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione a extensão para remover:",
      components: [this.row(select)]
    });
  }


  async antilinksMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antilinks");
    if (!cfg.allowedDomains)  cfg.allowedDomains  = [];
    if (!cfg.blockedDomains)  cfg.blockedDomains  = [];
    if (!cfg.actions)         cfg.actions         = ["delete"];
    if (!cfg.ignoredChannels) cfg.ignoredChannels = [];
    if (!cfg.ignoredRoles)    cfg.ignoredRoles    = [];
    if (!cfg.escalation)      cfg.escalation      = this._defaultEscalation();

    const actionLabel = {
      delete: "Deletar", warn: "Warn", timeout_10m: "Timeout 10m",
      timeout_1h: "Timeout 1h", timeout_24h: "Timeout 24h", kick: "Kick", ban: "Ban"
    };

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢 Desativar" : "🔴 Ativar"}`,                          value: "toggle"   },
        { label: `${cfg.blockInvites ? "🟢" : "🔴"} Bloquear Convites (discord.gg)`,        value: "toggle_invites" },
        { label: `✅ Domínios Permitidos (${cfg.allowedDomains.length})`,                   value: "allowed"  },
        { label: `🚫 Domínios Bloqueados (${cfg.blockedDomains.length})`,                   value: "blocked"  },
        { label: `⚡ Ações (${cfg.actions?.length || 1} ativa(s))`,                         value: "set_action"},
        { label: "⚖️ Escalonamento de Warns",                                               value: "escalation"},
        { label: `🔕 Canais Ignorados (${cfg.ignoredChannels.length})`,                     value: "ig_ch"    },
        { label: `👤 Cargos Ignorados (${cfg.ignoredRoles.length})`,                        value: "ig_role"  }
      ],
      "Configurar Anti-Links",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "antilinks"));
          return this.antilinksMenu(i, guild, user);
        }
        if (v === "toggle_invites") {
          cfg.blockInvites = !cfg.blockInvites;
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "antilinks"));
          return this.antilinksMenu(i, guild, user);
        }
        if (v === "allowed")    return this.manageDomainList(i, guild, user, "allowedDomains", "✅ Domínios Permitidos");
        if (v === "blocked")    return this.manageDomainList(i, guild, user, "blockedDomains", "🚫 Domínios Bloqueados");
        if (v === "set_action") return this.multiActionMenu(i, guild, user, "antilinks", (x) => this.antilinksMenu(x, guild, user));
        if (v === "escalation") return this.warnEscalationMenu(i, guild, user, "antilinks", (x) => this.antilinksMenu(x, guild, user));
        if (v === "ig_ch")      return this.manageIgnoredList(i, guild, user, "antilinks", "ignoredChannels", "canal");
        if (v === "ig_role")    return this.manageIgnoredList(i, guild, user, "antilinks", "ignoredRoles",    "cargo");
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🔗 Anti-Links",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo (AutoMod nativo do Discord)" : "🔴 Inativo"}\n` +
          `**Bloquear convites:** ${cfg.blockInvites ? "🟢 Sim" : "🔴 Não"}\n` +
          `**Permitidos:** ${cfg.allowedDomains.length} domínio(s)\n` +
          `**Bloqueados:** ${cfg.blockedDomains.length} domínio(s)\n` +
          `**Ações:** ${(cfg.actions || ["delete"]).map(a => actionLabel[a] || a).join(", ")}\n\n` +
          `> Se houver permitidos, apenas eles passam.\n` +
          `> Bloqueados são sempre negados.`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))
      ]
    });
  }

  async manageDomainList(interaction, guild, user, listKey, title) {
    const sec  = this.getSecurity(guild);
    const cfg  = this.getSimpleCfg(sec, "antilinks");
    if (!cfg[listKey]) cfg[listKey] = [];
    const list = cfg[listKey];

    const select = this.select(
      user,
      [
        { label: "➕ Adicionar domínio(s)", value: "add"    },
        { label: "➖ Remover domínio",      value: "remove" },
        { label: "🗑️ Limpar lista",        value: "clear"  }
      ],
      `Gerenciar ${title}`,
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "add")    return this.addDomain(i, guild, user, listKey, title);
        if (v === "remove") return this.removeDomain(i, guild, user, listKey, title);
        if (v === "clear") {
          cfg[listKey] = [];
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "antilinks"));
          await this.followUpEphemeral(i, { content: "✅ Lista limpa." });
          return this.manageDomainList(i, guild, user, listKey, title);
        }
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title,
        description:
          `**Total:** ${list.length}\n\n` +
          (list.length ? list.map(d => `\`${d}\``).join(", ") : "Nenhum domínio.")
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.antilinksMenu(i, guild, user)))
      ]
    });
  }

  async addDomain(interaction, guild, user, listKey, title) {
    await this.followUpEphemeral(interaction, {
      content: "Envie o(s) domínio(s):\n> Ex: `youtube.com, twitch.tv, discord.gg`"
    });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const sec     = this.getSecurity(guild);
    const cfg     = this.getSimpleCfg(sec, "antilinks");
    if (!cfg[listKey]) cfg[listKey] = [];

    const domains = msg.content
      .split(",")
      .map(d => d.trim().toLowerCase().replace(/https?:\/\//g, "").replace(/\/$/, ""))
      .filter(d => d.length > 0 && !cfg[listKey].includes(d));

    cfg[listKey].push(...domains);
    guild.markModified("security");
    await this.save(guild);
    await this._warnIfSyncFailed(interaction, await this._syncNativeModule(guild, "antilinks"));
    await this.followUpEphemeral(interaction, {
      content: `✅ ${domains.length} domínio(s): ${domains.map(d => `\`${d}\``).join(", ")}`
    });
    return this.manageDomainList(interaction, guild, user, listKey, title);
  }

  async removeDomain(interaction, guild, user, listKey, title) {
    const sec  = this.getSecurity(guild);
    const cfg  = this.getSimpleCfg(sec, "antilinks");
    const list = cfg[listKey] || [];
    if (!list.length) return this.followUpEphemeral(interaction, { content: "Nenhum domínio." });

    const select = this.select(
      user,
      list.slice(0, 25).map(d => ({ label: d, value: d })),
      "Selecionar domínio",
      async (i) => {
        await this.deferUpdate(i);
        cfg[listKey] = cfg[listKey].filter(d => d !== i.data.values[0]);
        guild.markModified("security");
        await this.save(guild);
        await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "antilinks"));
        await this.followUpEphemeral(i, { content: `✅ \`${i.data.values[0]}\` removido.` });
        return this.manageDomainList(i, guild, user, listKey, title);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione o domínio:",
      components: [this.row(select)]
    });
  }


  async antimentionMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antimention");
    if (!cfg.maxMentions)     cfg.maxMentions     = 5;
    if (!cfg.actions)         cfg.actions         = ["delete"];
    if (!cfg.ignoredChannels) cfg.ignoredChannels = [];
    if (!cfg.ignoredRoles)    cfg.ignoredRoles    = [];
    if (!cfg.escalation)      cfg.escalation      = this._defaultEscalation();

    const actionLabel = {
      delete: "Deletar", warn: "Warn", timeout_10m: "Timeout 10m",
      timeout_1h: "Timeout 1h", timeout_24h: "Timeout 24h", kick: "Kick", ban: "Ban"
    };

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢 Desativar" : "🔴 Ativar"}`,                          value: "toggle"    },
        { label: `⚙️ Limite: ${cfg.maxMentions} menções por mensagem`,                      value: "set_limit" },
        { label: `⚡ Ações (${cfg.actions?.length || 1} ativa(s))`,                         value: "set_action"},
        { label: "⚖️ Escalonamento de Warns",                                               value: "escalation"},
        { label: `🚫 Canais Ignorados (${cfg.ignoredChannels.length})`,                     value: "ig_ch"     },
        { label: `👤 Cargos Ignorados (${cfg.ignoredRoles.length})`,                        value: "ig_role"   }
      ],
      "Configurar Anti-Mention",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, "antimention"));
          return this.antimentionMenu(i, guild, user);
        }
        if (v === "set_limit")  return this.setMentionLimit(i, guild, user);
        if (v === "set_action") return this.multiActionMenu(i, guild, user, "antimention", (x) => this.antimentionMenu(x, guild, user));
        if (v === "escalation") return this.warnEscalationMenu(i, guild, user, "antimention", (x) => this.antimentionMenu(x, guild, user));
        if (v === "ig_ch")      return this.manageIgnoredList(i, guild, user, "antimention", "ignoredChannels", "canal");
        if (v === "ig_role")    return this.manageIgnoredList(i, guild, user, "antimention", "ignoredRoles",    "cargo");
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📢 Anti-Mass Mention",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Limite:** ${cfg.maxMentions} menções/msg\n` +
          `**Ações:** ${(cfg.actions || ["delete"]).map(a => actionLabel[a] || a).join(", ")}\n` +
          `**Canais ignorados:** ${cfg.ignoredChannels.map(c => `<#${c}>`).join(", ") || "Nenhum"}\n` +
          `**Cargos ignorados:** ${cfg.ignoredRoles.map(r => `<@&${r}>`).join(", ")   || "Nenhum"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))
      ]
    });
  }

  async setMentionLimit(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Envie o número máximo de menções por mensagem (ex: `5`):" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const limit = parseInt(msg.content);
    if (isNaN(limit) || limit < 1) return this.followUpEphemeral(interaction, { content: "❌ Número inválido." });

    const sec = this.getSecurity(guild);
    const cfg = this.getSimpleCfg(sec, "antimention");
    cfg.maxMentions = limit;
    guild.markModified("security");
    await this.save(guild);
    await this._warnIfSyncFailed(interaction, await this._syncNativeModule(guild, "antimention"));
    await this.followUpEphemeral(interaction, { content: `✅ Limite: ${limit} menções.` });
    return this.antimentionMenu(interaction, guild, user);
  }


  async manageIgnoredList(interaction, guild, user, module, listKey, type) {
    const sec   = this.getSecurity(guild);
    const cfg   = this.getSimpleCfg(sec, module);
    if (!cfg[listKey]) cfg[listKey] = [];
    const list  = cfg[listKey];
    const isCh  = type === "canal";
    const title = isCh ? "🚫 Canais Ignorados" : "👤 Cargos Ignorados";

    const backMap = {
      badwords:    (i) => this.badwordsMenu(i, guild, user),
      antispam:    (i) => this.antispamMenu(i, guild, user),
      anticaps:    (i) => this.anticapsMenu(i, guild, user),
      antilinks:   (i) => this.antilinksMenu(i, guild, user),
      antimention: (i) => this.antimentionMenu(i, guild, user),
      antiemoji:   (i) => this.antiemojiMenu(i, guild, user),
      antifiles:   (i) => this.antifilesMenu(i, guild, user)
    };
    const backFn = backMap[module] || ((i) => this.automodSimpleMenu(i, guild, user));

    const select = this.select(
      user,
      [
        { label: `➕ Adicionar ${type}`, value: "add"    },
        { label: `➖ Remover ${type}`,   value: "remove" },
        { label: "🗑️ Limpar lista",      value: "clear"  }
      ],
      `Gerenciar ${type}s ignorados`,
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "add") {
          await this.followUpEphemeral(i, { content: `Mencione o ${type} ou envie o ID:` });
          let msg;
          try { msg = await this.client.NextMessageCollector.wait({ channelId: i.channel_id, userId: user }); } catch { return; }
          const id = this.extractId(msg.content);
          if (!id) return;
          if (!cfg[listKey].includes(id)) cfg[listKey].push(id);
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, module));
          await this.followUpEphemeral(i, { content: `✅ ${type} adicionado!` });
          return this.manageIgnoredList(i, guild, user, module, listKey, type);
        }
        if (v === "remove") {
          if (!list.length) return this.followUpEphemeral(i, { content: "Lista vazia." });
          const sel = this.select(
            user,
            list.slice(0, 25).map(id => ({ label: id, value: id })),
            `Selecionar ${type}`,
            async (i2) => {
              await this.deferUpdate(i2);
              cfg[listKey] = cfg[listKey].filter(id => id !== i2.data.values[0]);
              guild.markModified("security");
              await this.save(guild);
              await this._warnIfSyncFailed(i2, await this._syncNativeModule(guild, module));
              await this.followUpEphemeral(i2, { content: "✅ Removido." });
              return this.manageIgnoredList(i2, guild, user, module, listKey, type);
            }
          );
          return this.followUpEphemeral(i, { content: `Selecione o ${type}:`, components: [this.row(sel)] });
        }
        if (v === "clear") {
          cfg[listKey] = [];
          guild.markModified("security");
          await this.save(guild);
          await this._warnIfSyncFailed(i, await this._syncNativeModule(guild, module));
          await this.followUpEphemeral(i, { content: "✅ Lista limpa." });
          return this.manageIgnoredList(i, guild, user, module, listKey, type);
        }
      }
    );

    const formatted = list.map(id => isCh ? `<#${id}>` : `<@&${id}>`).join(", ");

    return this.editOriginal(interaction, {
      embeds: [{
        title,
        description: `**Total:** ${list.length}\n\n` + (list.length ? formatted : `Nenhum ${type} ignorado.`)
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, backFn))
      ]
    });
  }

  async viewSimpleList(interaction, guild, user, module, listKey, title) {
    const sec  = this.getSecurity(guild);
    const cfg  = this.getSimpleCfg(sec, module);
    const list = cfg[listKey] || [];
    return this.editOriginal(interaction, {
      embeds: [{
        title,
        description: list.length ? list.map(w => `\`${w}\``).join(", ") : "Lista vazia."
      }],
      components: [this.row(this.backBtn(user, (i) => this.automodSimpleMenu(i, guild, user)))]
    });
  }


  async automodAdvancedMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.automod.advanced;

    const select = this.select(
      user,
      [
        { label: `${cfg.logNewAccounts ? "🟢" : "🔴"} Log de Contas Recentes`, value: "log_new_accounts" },
        { label: `${cfg.suspectUsers   ? "🟢" : "🔴"} Detecção de Suspeitos`,  value: "suspect_users"    },
        { label: "📋 Ver Warns de um Usuário",                                   value: "view_warns"       },
        { label: "📊 Histórico Completo de Warns",                               value: "view_all_warns"   },
        { label: "🗑️ Limpar Warns",                                              value: "clear_warns"      },
        { label: "⚡ Auto-Punições por Acúmulo",                                 value: "auto_punish"      }
      ],
      "Configurar AutoMod Avançado",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "log_new_accounts") return this.toggleAdvanced(i, guild, user, "logNewAccounts");
        if (v === "suspect_users")    return this.toggleAdvanced(i, guild, user, "suspectUsers");
        if (v === "view_warns")       return this.viewWarns(i, guild, user);
        if (v === "view_all_warns")   return this.viewAllWarns(i, guild, user);
        if (v === "clear_warns")      return this.clearWarns(i, guild, user);
        if (v === "auto_punish")      return this.autoPunishMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "⚙️ AutoMod Avançado",
        description:
          `🔍 Log de Contas Recentes: ${cfg.logNewAccounts ? "🟢" : "🔴"}\n` +
          `🕵️ Detecção de Suspeitos: ${cfg.suspectUsers   ? "🟢" : "🔴"}\n` +
          `⚡ Auto-Punições: ${cfg.autoPunish ? "🟢" : "🔴"}\n` +
          `📋 Total de Warns: ${(cfg.warns || []).length}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async toggleAdvanced(interaction, guild, user, key) {
    const sec = this.getSecurity(guild);
    sec.automod.advanced[key] = !sec.automod.advanced[key];
    guild.markModified("security");
    await this.save(guild);
    return this.automodAdvancedMenu(interaction, guild, user);
  }

  _actionLabel(action) {
    const labels = {
      "warn_message": "💬 Aviso no chat",
      "timeout_10m":  "⏱️ Timeout 10min",
      "timeout_1h":   "⏱️ Timeout 1h",
      "timeout_24h":  "⏱️ Timeout 24h",
      "kick":         "👢 Kick",
      "ban":          "🔨 Ban"
    };
    return labels[action] || action;
  }

  async addWarn(guildId, targetUserId, reason, moderatorId, channelId = null) {
    const guild = await this.getGuild(guildId);
    const sec   = this.getSecurity(guild);
    if (!sec.automod.advanced.warns) sec.automod.advanced.warns = [];

    const moduleName = reason.includes(":") ? reason.split(":")[0].trim() : "manual";

    sec.automod.advanced.warns.push({
      userId:    targetUserId,
      reason,
      moderator: moderatorId,
      date:      new Date().toISOString(),
      module:    moduleName
    });

    const warnCount = sec.automod.advanced.warns.filter(w => w.userId === targetUserId).length;

    await this.sendSecurityAlert(guildId,
      `📋 **Warn registrado** — <@${targetUserId}> (${warnCount}º) por <@${moderatorId}>\n` +
      `> ${reason}`,
      "warns"
    );

    if (!sec.automod.advanced.escalationState) sec.automod.advanced.escalationState = {};
    if (!sec.automod.advanced.escalationState[targetUserId]) sec.automod.advanced.escalationState[targetUserId] = {};
    const state = sec.automod.advanced.escalationState[targetUserId];

    if (sec.automod.simple[moduleName]) {
      const cfg   = this.getSimpleCfg(sec, moduleName);
      const table = (cfg.escalation || []).map(e => ({ warns: Number(e.warns), action: e.action }));

      const tier = table
        .filter(e => e.warns <= warnCount)
        .sort((a, b) => b.warns - a.warns)[0];

      const last = state[moduleName] || 0;

      if (tier && tier.warns > last) {
        state[moduleName] = tier.warns;
        await this._applyEscalationAction(guildId, targetUserId, tier.action, channelId, guildId);
        await this.sendSecurityAlert(guildId,
          `⚖️ **Escalonamento (${moduleName})** — <@${targetUserId}> atingiu ${warnCount} warn(s) → ${this._actionLabel(tier.action)}`,
          "punishments"
        );
      }
    }

    if (sec.automod.advanced.autoPunish) {
      const table = (sec.automod.advanced.globalEscalation || []).map(e => ({ warns: Number(e.warns), action: e.action }));

      const tier = table
        .filter(e => e.warns <= warnCount)
        .sort((a, b) => b.warns - a.warns)[0];

      const last = state.global || 0;

      if (tier && tier.warns > last) {
        state.global = tier.warns;
        await this._applyEscalationAction(guildId, targetUserId, tier.action, channelId, guildId);
        await this.sendSecurityAlert(guildId,
          `⚖️ **Escalonamento Global** — <@${targetUserId}> atingiu ${warnCount} warn(s) (total) → ${this._actionLabel(tier.action)}`,
          "punishments"
        );
      }
    }

    guild.markModified("security");
    await this.save(guild);
    return warnCount;
  }

  async viewWarns(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Mencione o usuário ou envie o ID:" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const targetId = this.extractId(msg.content);
    if (!targetId) return this.followUpEphemeral(interaction, { content: "❌ ID inválido." });

    const sec   = this.getSecurity(guild);
    const warns = (sec.automod.advanced.warns || []).filter(w => w.userId === targetId);

    const desc = warns.length
      ? warns.map((w, i) =>
          `**${i + 1}.** ${w.reason}\n` +
          `└ Por <@${w.moderator}> em ${w.date.slice(0, 10)}`
        ).join("\n\n")
      : "Nenhum warn para este usuário.";

    return this.editOriginal(interaction, {
      embeds: [{
        title: `📋 Warns de <@${targetId}>`,
        description: `**Total:** ${warns.length}\n\n${desc}`
      }],
      components: [this.row(this.backBtn(user, (i) => this.automodAdvancedMenu(i, guild, user)))]
    });
  }

  async viewAllWarns(interaction, guild, user) {
    const sec  = this.getSecurity(guild);
    const all  = sec.automod.advanced.warns || [];

    if (!all.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📊 Histórico de Warns", description: "Nenhum warn registrado." }],
        components: [this.row(this.backBtn(user, (i) => this.automodAdvancedMenu(i, guild, user)))]
      });
    }

    const grouped = {};
    for (const w of all) {
      if (!grouped[w.userId]) grouped[w.userId] = [];
      grouped[w.userId].push(w);
    }

    const sortedUsers = Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length);

    const userLines = sortedUsers
      .slice(0, 15)
      .map(([uid, ws]) => {
        const last = ws[ws.length - 1];
        return `<@${uid}> — **${ws.length} warn(s)**\n└ Último: ${last.reason} (${last.date.slice(0, 10)})`;
      })
      .join("\n\n");

    const recentLines = all
      .slice(-10)
      .reverse()
      .map(w => `<@${w.userId}> — ${w.reason} (${w.date.slice(0, 10)})`)
      .join("\n");

    const select = this.select(
      user,
      [
        { label: "👥 Ver por Usuário",      value: "by_user"   },
        { label: "🕐 Ver Recentes (10)",    value: "recent"    },
        { label: "🗑️ Limpar warns de alguém", value: "clear_one" }
      ],
      "Visualizar Warns",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "by_user") {
          return this.editOriginal(i, {
            embeds: [{
              title: "📊 Warns por Usuário",
              description: userLines + (sortedUsers.length > 15 ? `\n\n...e mais ${sortedUsers.length - 15} usuário(s).` : "")
            }],
            components: [this.row(this.backBtn(user, (x) => this.viewAllWarns(x, guild, user)))]
          });
        }
        if (v === "recent") {
          return this.editOriginal(i, {
            embeds: [{
              title: "🕐 Warns Recentes",
              description: recentLines
            }],
            components: [this.row(this.backBtn(user, (x) => this.viewAllWarns(x, guild, user)))]
          });
        }
        if (v === "clear_one") return this.clearWarnsUser(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📊 Histórico Completo de Warns",
        description:
          `**Total de warns:** ${all.length}\n` +
          `**Usuários com warns:** ${sortedUsers.length}\n\n` +
          `Use o menu abaixo para filtrar.`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodAdvancedMenu(i, guild, user)))
      ]
    });
  }

  async clearWarnsUser(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Mencione o usuário ou envie o ID para limpar os warns:" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const targetId = this.extractId(msg.content);
    if (!targetId) return this.followUpEphemeral(interaction, { content: "❌ ID inválido." });

    const sec = this.getSecurity(guild);
    const before = (sec.automod.advanced.warns || []).filter(w => w.userId === targetId).length;
    sec.automod.advanced.warns = (sec.automod.advanced.warns || []).filter(w => w.userId !== targetId);
    if (sec.automod.advanced.escalationState) delete sec.automod.advanced.escalationState[targetId];
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ ${before} warn(s) de <@${targetId}> removidos. Escalonamento resetado.` });
    return this.viewAllWarns(interaction, guild, user);
  }

  async clearWarns(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.automod.advanced.warns = [];
    sec.automod.advanced.escalationState = {};
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: "✅ Todos os warns foram limpos! Escalonamento resetado." });
    return this.automodAdvancedMenu(interaction, guild, user);
  }

  async autoPunishMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.automod.advanced;
    if (!cfg.globalEscalation || cfg.globalEscalation.length === 0) cfg.globalEscalation = this._defaultEscalation();

    const actionLabel = {
      "warn_message": "💬 Aviso no chat",
      "timeout_10m":  "⏱️ Timeout 10min",
      "timeout_1h":   "⏱️ Timeout 1h",
      "timeout_24h":  "⏱️ Timeout 24h",
      "kick":         "👢 Kick",
      "ban":          "🔨 Ban"
    };

    const tableLines = cfg.globalEscalation
      .sort((a, b) => a.warns - b.warns)
      .map(e => `**${e.warns} warn(s)** → ${actionLabel[e.action] || e.action}`)
      .join("\n");

    const select = this.select(
      user,
      [
        { label: cfg.autoPunish ? "🔴 Desativar Auto-Punições" : "🟢 Ativar Auto-Punições", value: "toggle"    },
        { label: "➕ Adicionar nível de punição",                                             value: "add_level" },
        { label: "➖ Remover nível",                                                          value: "rem_level" },
        { label: "🔄 Restaurar padrão",                                                      value: "reset"     }
      ],
      "Auto-Punições Globais",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.autoPunish = !cfg.autoPunish;
          guild.markModified("security");
          await this.save(guild);
          return this.autoPunishMenu(i, guild, user);
        }
        if (v === "add_level") return this._addGlobalEscalation(i, guild, user);
        if (v === "rem_level") return this._removeGlobalEscalation(i, guild, user);
        if (v === "reset") {
          cfg.globalEscalation = this._defaultEscalation();
          guild.markModified("security");
          await this.save(guild);
          await this.followUpEphemeral(i, { content: "✅ Restaurado ao padrão." });
          return this.autoPunishMenu(i, guild, user);
        }
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "⚡ Auto-Punições Globais",
        description:
          `**Status:** ${cfg.autoPunish ? "🟢 Ativo" : "🔴 Inativo"}\n\n` +
          `Esta tabela se aplica ao total de warns acumulados do usuário, independente do módulo.\n\n` +
          `**Tabela atual:**\n${tableLines || "_Nenhum nível configurado._"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.automodAdvancedMenu(i, guild, user)))
      ]
    });
  }

  async _addGlobalEscalation(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Quantos warns para acionar? (ex: `3`)" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const warns = parseInt(msg.content);
    if (isNaN(warns) || warns < 1) return this.followUpEphemeral(interaction, { content: "❌ Número inválido." });

    const sel = this.select(
      user,
      [
        { label: "💬 Aviso no chat",   value: "warn_message" },
        { label: "⏱️ Timeout 10min",  value: "timeout_10m"  },
        { label: "⏱️ Timeout 1h",     value: "timeout_1h"   },
        { label: "⏱️ Timeout 24h",    value: "timeout_24h"  },
        { label: "👢 Kick",           value: "kick"         },
        { label: "🔨 Ban",            value: "ban"          }
      ],
      "Selecionar ação",
      async (i) => {
        await this.deferUpdate(i);
        const sec = this.getSecurity(guild);
        if (!sec.automod.advanced.globalEscalation) sec.automod.advanced.globalEscalation = [];
        sec.automod.advanced.globalEscalation = sec.automod.advanced.globalEscalation.filter(e => e.warns !== warns);
        sec.automod.advanced.globalEscalation.push({ warns, action: i.data.values[0] });
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: `✅ Nível adicionado: ${warns} warn(s).` });
        return this.autoPunishMenu(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: `Ação para **${warns} warn(s)**:`,
      components: [this.row(sel)]
    });
  }

  async _removeGlobalEscalation(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const esc = sec.automod.advanced.globalEscalation || [];
    if (!esc.length) return this.followUpEphemeral(interaction, { content: "Nenhum nível cadastrado." });

    const actionLabel = {
      "warn_message": "Aviso", "timeout_10m": "Timeout 10min",
      "timeout_1h": "Timeout 1h", "timeout_24h": "Timeout 24h",
      "kick": "Kick", "ban": "Ban"
    };

    const sel = this.select(
      user,
      esc.sort((a, b) => a.warns - b.warns).map(e => ({
        label: `${e.warns} warn(s) → ${actionLabel[e.action] || e.action}`,
        value: String(e.warns)
      })),
      "Selecionar nível",
      async (i) => {
        await this.deferUpdate(i);
        sec.automod.advanced.globalEscalation = esc.filter(e => e.warns !== parseInt(i.data.values[0]));
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Nível removido." });
        return this.autoPunishMenu(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione o nível para remover:",
      components: [this.row(sel)]
    });
  }


  async rolesPermissionsMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);

    const select = this.select(
      user,
      [
        { label: "➕ Adicionar Cargo Staff",       value: "add_staff"        },
        { label: "➖ Remover Cargo Staff",         value: "remove_staff"     },
        { label: "➕ Adicionar Cargo Imune",       value: "add_immune"       },
        { label: "➖ Remover Cargo Imune",         value: "remove_immune"    },
        { label: "🔍 Hierarquia Insegura",         value: "unsafe_hierarchy" },
        { label: "⚠️ Alertas de Permissões",       value: "perm_alerts"      }
      ],
      "Configurar Cargos",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "add_staff")        return this.addRole(i, guild, user, "staff");
        if (v === "remove_staff")     return this.removeRole(i, guild, user, "staff");
        if (v === "add_immune")       return this.addRole(i, guild, user, "immune");
        if (v === "remove_immune")    return this.removeRole(i, guild, user, "immune");
        if (v === "unsafe_hierarchy") return this.unsafeHierarchy(i, guild, user);
        if (v === "perm_alerts")      return this.permAlerts(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "👮 Cargos e Permissões",
        description:
          `**Staff:** ${sec.roles.staff.map(r => `<@&${r}>`).join(", ")   || "Nenhum"}\n` +
          `**Imunes:** ${sec.roles.immune.map(r => `<@&${r}>`).join(", ") || "Nenhum"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async addRole(interaction, guild, user, type) {
    await this.followUpEphemeral(interaction, { content: "Mencione ou envie o ID do cargo:" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const id = this.extractId(msg.content);
    if (!id) return;
    const sec = this.getSecurity(guild);
    if (!sec.roles[type].includes(id)) sec.roles[type].push(id);
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: "✅ Cargo adicionado!" });
    return this.rolesPermissionsMenu(interaction, guild, user);
  }

  async removeRole(interaction, guild, user, type) {
    const sec  = this.getSecurity(guild);
    const list = sec.roles[type];
    if (!list.length) return this.followUpEphemeral(interaction, { content: "Nenhum cargo." });

    const select = this.select(
      user,
      list.map(r => ({ label: r, value: r })),
      "Selecionar cargo",
      async (i) => {
        await this.deferUpdate(i);
        sec.roles[type] = list.filter(r => r !== i.data.values[0]);
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Cargo removido!" });
        return this.rolesPermissionsMenu(i, guild, user);
      }
    );
    return this.followUpEphemeral(interaction, { content: "Selecione:", components: [this.row(select)] });
  }

  async unsafeHierarchy(interaction, guild, user) {
    const roles = await DiscordRequest(`/guilds/${interaction.guild_id}/roles`);
    const flags = { ADMIN: 1n << 3n, MANAGE_GUILD: 1n << 5n, MANAGE_ROLES: 1n << 28n, BAN: 1n << 2n, KICK: 1n << 1n };
    const risks = roles.filter(r => !r.managed && Object.values(flags).some(f => (BigInt(r.permissions) & f) === f));
    return this.editOriginal(interaction, {
      embeds: [{
        title: "🔍 Hierarquia Insegura",
        description: risks.length ? risks.map(r => `<@&${r.id}> — pos. ${r.position}`).join("\n") : "✅ Nenhum risco."
      }],
      components: [this.row(this.backBtn(user, (i) => this.rolesPermissionsMenu(i, guild, user)))]
    });
  }

  async permAlerts(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.roles.permAlertsEnabled = !sec.roles.permAlertsEnabled;
    guild.markModified("security");
    await this.save(guild);
    return this.followUpEphemeral(interaction, {
      content: `✅ Alertas de permissão ${sec.roles.permAlertsEnabled ? "ativados" : "desativados"}.`
    });
  }


  async logsMenu(interaction, guild, user) {
    const sec    = this.getSecurity(guild);
    const logCfg = sec.logs;
    const CATS = [
      { key: "main",        label: "📋 Canal Principal (fallback)" },
      { key: "moderation",  label: "🛠️ Moderação"   },
      { key: "automod",     label: "🤖 AutoMod"      },
      { key: "warns",       label: "📋 Warns"        },
      { key: "punishments", label: "⚖️ Punições"     },
      { key: "security",    label: "🛡️ Segurança"    },
    ];

    const select = this.select(
      user,
      [
        ...CATS.map(c => ({
          label: `${c.label} → ${logCfg.channels[c.key] ? "canal definido" : "não definido"}`,
          value: `set_${c.key}`
        })),
        ...CATS.filter(c => c.key !== "main" && logCfg.channels[c.key]).map(c => ({
          label: `↪️ Limpar canal — ${c.label} (volta a usar o Principal)`,
          value: `clear_${c.key}`
        })),
        { label: "⚙️ Ativar/Desativar Categorias", value: "log_types" },
        { label: "🧩 Canais por Módulo do AutoMod (assinatura)", value: "automod_modules" },
        { label: "📅 Histórico de Warns (Discord)", value: "log_history" },
        { label: "📤 Exportar Warns (JSON)",        value: "export"      }
      ],
      "Configurar Logs",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v.startsWith("set_"))   return this.setLogChannel(i, guild, user, v.replace("set_", ""));
        if (v.startsWith("clear_")) {
          const key = v.replace("clear_", "");
          delete sec.logs.channels[key];
          guild.markModified("security");
          await this.save(guild);
          return this.logsMenu(i, guild, user);
        }
        if (v === "log_types")       return this.logTypesMenu(i, guild, user);
        if (v === "automod_modules") return this.automodModuleLogsMenu(i, guild, user);
        if (v === "log_history")     return this.logHistory(i, guild, user);
        if (v === "export")          return this.exportLogs(i, guild, user);
      }
    );

    const statusLines = CATS.map(c =>
      `**${c.label}:** ${logCfg.channels[c.key] ? `<#${logCfg.channels[c.key]}>` : (c.key === "main" ? "Não definido" : "usa o Canal Principal")}`
    ).join("\n");

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📜 Sistema de Logs",
        description:
          `Cada categoria pode ter seu próprio canal. Categorias sem canal específico caem no **Canal Principal**.\n\n${statusLines}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  static AUTOMOD_MODULES = [
    { key: "badwords",    label: "Badwords"    },
    { key: "antispam",    label: "Antispam"    },
    { key: "anticaps",    label: "Anticaps"    },
    { key: "antilinks",   label: "Antilinks"   },
    { key: "antimention", label: "Antimention" },
    { key: "antiemoji",   label: "Antiemoji"   },
    { key: "antifiles",   label: "Antifiles"   },
  ];

  async automodModuleLogsMenu(interaction, guild, user) {
    const hasAccess = await this.hasAdvancedSystemsAccess(interaction.guild_id);

    if (!hasAccess) {
      return this.editOriginal(interaction, {
        embeds: [{
          title: "🔒 Canais por Módulo do AutoMod",
          description:
            "Esse recurso é liberado a partir da primeira assinatura ativa (Nova Estrela).\n\n" +
            "Sem ele, todos os módulos do AutoMod continuam caindo juntos no canal da categoria **AutoMod**."
        }],
        components: [this.row(this.backBtn(user, (i) => this.logsMenu(i, guild, user)))]
      });
    }

    const sec = this.getSecurity(guild);
    const mods = SecuritySystem.AUTOMOD_MODULES;

    const select = this.select(
      user,
      [
        ...mods.map(m => ({
          label: `${m.label} → ${sec.logs.channels[`automod_${m.key}`] ? "canal definido" : "usa a categoria"}`,
          value: `set_automod_${m.key}`
        })),
        ...mods.filter(m => sec.logs.channels[`automod_${m.key}`]).map(m => ({
          label: `↪️ Limpar — ${m.label}`,
          value: `clear_automod_${m.key}`
        })),
      ],
      "Selecionar módulo",
      async (i) => {
        const v = i.data.values[0];
        if (v.startsWith("set_")) return this.setLogChannel(i, guild, user, v.replace("set_", ""));
        await this.deferUpdate(i);
        const key = v.replace("clear_", "");
        delete sec.logs.channels[key];
        guild.markModified("security");
        await this.save(guild);
        return this.automodModuleLogsMenu(i, guild, user);
      }
    );

    const statusLines = mods.map(m =>
      `**${m.label}:** ${sec.logs.channels[`automod_${m.key}`] ? `<#${sec.logs.channels[`automod_${m.key}`]}>` : "usa a categoria AutoMod"}`
    ).join("\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "🧩 Canais por Módulo do AutoMod", description: statusLines }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.logsMenu(i, guild, user)))
      ]
    });
  }

  async setLogChannel(interaction, guild, user, type) {
    await this.followUpEphemeral(interaction, { content: "Envie o canal de log:" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const id = this.extractId(msg.content);
    if (!id) return;
    const sec = this.getSecurity(guild);
    sec.logs.channels[type] = id;
    guild.markModified("security");
    await this.save(guild);

    const missing = await this._missingBotPerms(interaction.guild_id, ["SEND_MESSAGES", "EMBED_LINKS"], id);
    if (missing.length) {
      await this.followUpEphemeral(interaction, {
        content:
          `⚠️ Canal configurado, mas não tenho permissão para enviar mensagens/embeds nele.\n` +
          `**Faltando:** ${missing.map(p => `\`${this._permLabel(p)}\``).join(", ")}\n` +
          `Os alertas de segurança não funcionarão até isso ser corrigido.`
      });
    } else {
      await this.followUpEphemeral(interaction, { content: "✅ Canal configurado!" });
    }

    return this.logsMenu(interaction, guild, user);
  }

  async logTypesMenu(interaction, guild, user) {
    const sec      = this.getSecurity(guild);
    const types    = sec.logs.types || {};
    const logTypes = [
      { key: "moderation",  label: "Moderação" },
      { key: "automod",     label: "AutoMod"   },
      { key: "warns",       label: "Warns"     },
      { key: "punishments", label: "Punições"  },
      { key: "security",    label: "Segurança" }
    ];

    const select = this.select(
      user,
      logTypes.map(t => ({ label: `${types[t.key] !== false ? "🟢" : "🔴"} ${t.label}`, value: t.key })),
      "Ativar/Desativar",
      async (i) => {
        await this.deferUpdate(i);
        if (!sec.logs.types) sec.logs.types = {};
        sec.logs.types[i.data.values[0]] = types[i.data.values[0]] === false; 
        guild.markModified("security");
        await this.save(guild);
        return this.logTypesMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "⚙️ Tipos de Log",
        description: logTypes.map(t => `${types[t.key] !== false ? "🟢" : "🔴"} **${t.label}**`).join("\n")
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.logsMenu(i, guild, user)))
      ]
    });
  }

  async exportLogs(interaction, guild, user) {
    const sec   = this.getSecurity(guild);
    const warns = sec.automod.advanced.warns || [];
    if (!warns.length) return this.followUpEphemeral(interaction, { content: "Nenhum warn para exportar." });
    const json = JSON.stringify(warns, null, 2);
    const chunks = [];
    for (let i = 0; i < json.length; i += 1800) {
      chunks.push(json.slice(i, i + 1800));
    }
    for (const chunk of chunks) {
      await this.followUpEphemeral(interaction, { content: `\`\`\`json\n${chunk}\n\`\`\`` });
    }
  }

  async logHistory(interaction, guild, user) {
    const sec   = this.getSecurity(guild);
    const warns = sec.automod.advanced.warns || [];

    if (!warns.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📅 Histórico de Logs", description: "Nenhum evento registrado." }],
        components: [this.row(this.backBtn(user, (i) => this.logsMenu(i, guild, user)))]
      });
    }

    const byDate = {};
    for (const w of warns) {
      const day = w.date.slice(0, 10);
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(w);
    }

    const lines = Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, items]) =>
        `**${date}** — ${items.length} evento(s)\n` +
        items.slice(0, 3).map(w => `└ <@${w.userId}> — ${w.reason}`).join("\n") +
        (items.length > 3 ? `\n└ ...e mais ${items.length - 3}` : "")
      )
      .join("\n\n");

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📅 Histórico de Logs",
        description: lines
      }],
      components: [this.row(this.backBtn(user, (i) => this.logsMenu(i, guild, user)))]
    });
  }


  async permissionCheck(interaction, guild, user) {
    const guildId    = interaction.guild_id;
    const sec        = this.getSecurity(guild);
    const staffRoles = sec.roles.staff;

    const [channels, roles] = await Promise.all([
      DiscordRequest(`/guilds/${guildId}/channels`),
      DiscordRequest(`/guilds/${guildId}/roles`)
    ]);

    const everyoneRole = roles.find(r => r.id === guildId);
    const everyoneBits = BigInt(everyoneRole?.permissions || 0);

    const VIEW          = 1n << 10n;
    const MENTION_ALL   = 1n << 17n;
    const MANAGE_CH     = 1n << 4n;
    const MANAGE_ROLES  = 1n << 28n; 
    const ADMIN         = 1n << 3n;
    const MANAGE_GUILD  = 1n << 5n;
    const BAN           = 1n << 2n;
    const KICK          = 1n << 1n;
    const THREADS       = 1n << 35n;
    const MANAGE_WEBHOOKS = 1n << 29n;
    const MANAGE_MSG    = 1n << 13n;

    const risks      = [];
    const immuneRoles = sec.roles.immune || [];

    const roleMap = {};
    for (const r of roles) roleMap[r.id] = r.name;

    const DANGEROUS = [
      { flag: ADMIN,          label: "Administrador"        },
      { flag: MANAGE_GUILD,   label: "Gerenciar Servidor"   },
      { flag: MANAGE_ROLES,   label: "Gerenciar Cargos"     },
      { flag: MANAGE_CH,      label: "Gerenciar Canais"     },
      { flag: MENTION_ALL,    label: "Mencionar @everyone"  },
      { flag: BAN,            label: "Banir Membros"        },
      { flag: KICK,           label: "Expulsar Membros"     }
    ];

    const CHANNEL_DANGEROUS = [
      { flag: ADMIN,          label: "Administrador"            },
      { flag: MANAGE_CH,      label: "Gerenciar Canal"           },
      { flag: MANAGE_ROLES,   label: "Gerenciar Permissões"      },
      { flag: MENTION_ALL,    label: "Mencionar @everyone"       },
      { flag: MANAGE_WEBHOOKS,label: "Gerenciar Webhooks"        },
      { flag: MANAGE_MSG,     label: "Gerenciar Mensagens"       }
    ];

    for (const ch of channels) {
      if (ch.type !== 0 && ch.type !== 5) continue;
      const ow   = (ch.permission_overwrites || []).find(o => o.id === guildId);
      let   bits = everyoneBits;
      bits &= ~BigInt(ow?.deny  || 0);
      bits |=  BigInt(ow?.allow || 0);
      if ((bits & VIEW) !== VIEW) continue;
      if ((bits & THREADS) === THREADS) risks.push(`⚠️ <#${ch.id}> — Todos podem criar tópicos`);
    }

    for (const role of roles) {
      if (role.id === guildId) continue;
      if (role.managed)        continue;
      if (staffRoles.includes(role.id))  continue;
      if (immuneRoles.includes(role.id)) continue;
      const bits  = BigInt(role.permissions);
      const found = DANGEROUS.filter(d => (bits & d.flag) === d.flag).map(d => d.label);
      if (found.length) risks.push(`⚠️ <@&${role.id}> (${roleMap[role.id] || role.id}) — ${found.join(", ")}`);
    }

    for (const ch of channels) {
      if (![0, 2, 4, 5, 13, 15].includes(ch.type)) continue;

      for (const ow of (ch.permission_overwrites || [])) {
        if (ow.type !== 0) continue;          
        if (ow.id === guildId) continue;      
        if (staffRoles.includes(ow.id))  continue;
        if (immuneRoles.includes(ow.id)) continue;

        const role = roles.find(r => r.id === ow.id);
        if (role?.managed) continue;          

        const allow = BigInt(ow.allow || 0);
        const found = CHANNEL_DANGEROUS.filter(d => (allow & d.flag) === d.flag).map(d => d.label);

        if (found.length) {
          risks.push(`⚠️ <#${ch.id}> → <@&${ow.id}> (${roleMap[ow.id] || ow.id}): ${found.join(", ")}`);
        }
      }
    }

    const score = Math.max(0, 100 - risks.length * 10);

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🔍 Verificação de Permissões",
        description:
          (risks.length ? risks.slice(0, 15).join("\n") : "✅ Nenhum risco encontrado.") +
          `\n\n**Score de Risco:** ${score}/100`,
        color: score > 70 ? 0x57F287 : score > 40 ? 0xFEE75C : 0xED4245
      }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }


  _verificationActionLabels() {
    return {
      none:       "Nenhuma",
      log:        "Apenas log",
      timeout:    "Timeout (1h)",
      kick:       "Kick",
      ban:        "Ban",
      quarantine: "Cargo de quarentena"
    };
  }

  async verificationMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.verification;
    const actionLabels = this._verificationActionLabels();

    const rulesActive = Object.values(cfg.rules || {}).filter(r => r?.enabled).length;

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢" : "🔴"} Verificação de Novos Membros`,          value: "toggle"        },
        { label: `📋 Regras (${rulesActive}/2 ativas)`,                                 value: "rules"         },
        { label: `⚙️ Modo: ${cfg.mode === "auto_punish" ? "Aplicar punições automáticas" : "Apenas registrar"}`, value: "mode" },
        { label: `📝 Registrar atividades suspeitas: ${cfg.logSuspicious !== false ? "🟢" : "🔴"}`, value: "log_suspicious" },
        { label: `⚡ Punição: ${actionLabels[cfg.punishment || "none"]}`,                value: "punishment"    },
        { label: `🚧 Cargo de Quarentena: ${cfg.quarantineRoleId ? `<@&${cfg.quarantineRoleId}>` : "Não definido"}`, value: "quarantine_role" },
        { label: "📊 Ver Histórico",                                                    value: "history"       }
      ],
      "Configurar Verificação",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle")           return this.toggleVerification(i, guild, user);
        if (v === "rules")            return this.verificationRulesMenu(i, guild, user);
        if (v === "mode")             return this.setVerificationMode(i, guild, user);
        if (v === "log_suspicious")   return this.toggleVerificationLogSuspicious(i, guild, user);
        if (v === "punishment")       return this.setVerificationPunishment(i, guild, user);
        if (v === "quarantine_role")  return this.setVerificationQuarantineRole(i, guild, user);
        if (v === "history")          return this.verificationHistory(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🧾 Verificação de Novos Membros",
        description:
          `Analisa cada novo membro no momento em que entra e sempre informa exatamente qual regra foi violada.\n\n` +
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Regras ativas:** ${rulesActive}/2\n` +
          `**Modo:** ${cfg.mode === "auto_punish" ? "Aplicar punições automáticas" : "Apenas registrar"}\n` +
          `**Punição:** ${actionLabels[cfg.punishment || "none"]}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async toggleVerification(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.verification.enabled = !sec.verification.enabled;
    guild.markModified("security");
    await this.save(guild);
    return this.verificationMenu(interaction, guild, user);
  }

  async verificationRulesMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const r   = sec.verification.rules || {};

    const select = this.select(
      user,
      [
        { label: `${r.minAccountAge?.enabled ? "🟢" : "🔴"} ⏳ Idade mínima da conta — ${r.minAccountAge?.hours ?? 48}h`, value: "minAccountAge" },
        { label: `${r.requireCustomAvatar?.enabled ? "🟢" : "🔴"} 🖼️ Exigir avatar personalizado`,                        value: "requireCustomAvatar" }
      ],
      "Selecionar regra",
      async (i) => {
        const key = i.data.values[0];
        if (key === "requireCustomAvatar") {
          await this.deferUpdate(i);
          const sec2 = this.getSecurity(guild);
          sec2.verification.rules.requireCustomAvatar.enabled = !sec2.verification.rules.requireCustomAvatar.enabled;
          guild.markModified("security");
          await this.save(guild);
          return this.verificationRulesMenu(i, guild, user);
        }
        return this.verificationMinAgeDetail(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{ title: "📋 Regras de Verificação", description: "Cada regra pode ser ligada/desligada independentemente." }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.verificationMenu(i, guild, user)))
      ]
    });
  }

  async verificationMinAgeDetail(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const r   = sec.verification.rules.minAccountAge ||= {};

    const select = this.select(
      user,
      [
        { label: `${r.enabled ? "🟢 Desativar" : "🔴 Ativar"} esta regra`, value: "toggle" },
        { label: `⚙️ Horas mínimas: ${r.hours ?? 48}`,                     value: "set_hours" }
      ],
      "Editar regra",
      async (i) => {
        const v = i.data.values[0];
        if (v === "toggle") {
          await this.deferUpdate(i);
          const sec2 = this.getSecurity(guild);
          sec2.verification.rules.minAccountAge.enabled = !sec2.verification.rules.minAccountAge.enabled;
          guild.markModified("security");
          await this.save(guild);
          return this.verificationMinAgeDetail(i, guild, user);
        }
        await this.followUpEphemeral(i, { content: "Idade mínima da conta em horas (ex: `48`):" });
        let msg;
        try { msg = await this.client.NextMessageCollector.wait({ channelId: i.channel_id, userId: user }); } catch { return; }
        const val = parseInt(msg.content);
        if (isNaN(val) || val < 0) return this.followUpEphemeral(i, { content: "❌ Inválido." });
        const sec2 = this.getSecurity(guild);
        sec2.verification.rules.minAccountAge.hours = val;
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: `✅ Idade mínima: ${val}h.` });
        return this.verificationMinAgeDetail(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{ title: "⏳ Idade Mínima da Conta", description: `Status: ${r.enabled ? "🟢 Ativo" : "🔴 Inativo"}` }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.verificationRulesMenu(i, guild, user)))
      ]
    });
  }

  async setVerificationMode(interaction, guild, user) {
    const select = this.select(
      user,
      [
        { label: "📋 Apenas registrar",                value: "log_only"    },
        { label: "⚡ Aplicar punições automáticas",     value: "auto_punish" }
      ],
      "Selecionar modo",
      async (i) => {
        await this.deferUpdate(i);
        const sec = this.getSecurity(guild);
        sec.verification.mode = i.data.values[0];
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Modo definido." });
        return this.verificationMenu(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "No modo **apenas registrar**, violações só ficam no histórico e no log — nenhuma punição é aplicada.",
      components: [this.row(select)]
    });
  }

  async toggleVerificationLogSuspicious(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.verification.logSuspicious = sec.verification.logSuspicious === false ? true : false;
    guild.markModified("security");
    await this.save(guild);
    return this.verificationMenu(interaction, guild, user);
  }

  async setVerificationPunishment(interaction, guild, user) {
    const labels = this._verificationActionLabels();
    const select = this.select(
      user,
      [
        { label: `🚫 ${labels.none}`,        value: "none"       },
        { label: `📝 ${labels.log}`,         value: "log"        },
        { label: `⏱️ ${labels.timeout}`,     value: "timeout"    },
        { label: `👢 ${labels.kick}`,        value: "kick"       },
        { label: `🔨 ${labels.ban}`,         value: "ban"        },
        { label: `🚧 ${labels.quarantine}`,  value: "quarantine" }
      ],
      "Selecionar punição",
      async (i) => {
        await this.deferUpdate(i);
        const sec = this.getSecurity(guild);
        sec.verification.punishment = i.data.values[0];
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Punição definida." });
        return this.verificationMenu(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Só é aplicada no modo **Aplicar punições automáticas**. Cargo de quarentena precisa estar configurado.",
      components: [this.row(select)]
    });
  }

  async setVerificationQuarantineRole(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Mencione ou envie o ID do cargo de quarentena:" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const id = this.extractId(msg.content);
    if (!id) return this.followUpEphemeral(interaction, { content: "❌ Não consegui identificar um cargo." });
    const sec = this.getSecurity(guild);
    sec.verification.quarantineRoleId = id;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: "✅ Cargo de quarentena definido." });
    return this.verificationMenu(interaction, guild, user);
  }

  async verificationHistory(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.verification.history || [];

    if (!history.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📊 Histórico de Verificação", description: "Nenhuma violação registrada até agora." }],
        components: [this.row(this.backBtn(user, (i) => this.verificationMenu(i, guild, user)))]
      });
    }

    const lines = history
      .slice(-10)
      .reverse()
      .map(h => {
        const rulesTxt = (h.violations || []).map(v => `└ ${v.label}`).join("\n") || "└ —";
        return `👤 **${h.username}** (<@${h.userId}>) — ${new Date(h.timestamp).toLocaleString("pt-BR")}\n${rulesTxt}\n└ Ação: ${h.action}`;
      })
      .join("\n\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📊 Histórico de Verificação (últimos 10)", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.verificationMenu(i, guild, user)))]
    });
  }


  _trapPunishmentLabels() {
    return {
      log:     "📝 Apenas registrar em logs",
      timeout: "⏱️ Timeout (1h)",
      kick:    "👢 Kick",
      ban:     "🔨 Ban"
    };
  }

  async trapChannelMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.trapChannel;
    const labels = this._trapPunishmentLabels();

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢" : "🔴"} Canal Armadilha`,                              value: "toggle"       },
        { label: `📌 Canal: ${cfg.channelId ? `#${cfg.channelId}` : "Não definido"}`,          value: "set_channel"  },
        { label: `⚡ Punição: ${labels[cfg.punishment || "log"]}`,                             value: "punishment"   },
        { label: `🧹 Apagar mensagens recentes em outros canais: ${cfg.deleteRecentMessages ? "🟢" : "🔴"}`, value: "toggle_delete_recent" },
        { label: `⏳ Janela de mensagens recentes: ${cfg.recentMessagesWindowMinutes ?? 5}min`, value: "set_window"  },
        { label: "🚫 Exceções (cargos, usuários, bots)",                                       value: "exceptions"  },
        { label: `📋 Canal de logs: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : "Usa o principal (Logs)"}`, value: "set_log_channel" },
        { label: "📊 Ver Histórico",                                                            value: "history"     }
      ],
      "Configurar Canal Armadilha",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle")               return this.toggleTrapChannel(i, guild, user);
        if (v === "set_channel")          return this.setTrapChannel(i, guild, user);
        if (v === "punishment")           return this.setTrapPunishment(i, guild, user);
        if (v === "toggle_delete_recent") return this.toggleTrapDeleteRecent(i, guild, user);
        if (v === "set_window")           return this.setTrapWindow(i, guild, user);
        if (v === "exceptions")           return this.trapExceptionsMenu(i, guild, user);
        if (v === "set_log_channel")      return this.setTrapLogChannel(i, guild, user);
        if (v === "history")              return this.trapHistory(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🪤 Canal Armadilha",
        description:
          `Escolha um canal onde nenhum humano deve enviar mensagens. A Ayami fixa um aviso lá.\n` +
          `Qualquer mensagem enviada nesse canal é tratada como sinal de self-bot/script: é apagada, ` +
          `registrada e punida conforme configurado abaixo.\n\n` +
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Canal:** ${cfg.channelId ? `<#${cfg.channelId}>` : "Não definido"}\n` +
          `**Punição:** ${labels[cfg.punishment || "log"]}\n` +
          `**Exceções:** ${(sec.roles.staff.length + sec.roles.immune.length + cfg.ignoredRoles.length + cfg.ignoredUsers.length + cfg.ignoredBots.length)} configurada(s) (inclui Staff/Imunes do módulo de Segurança)`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async toggleTrapChannel(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.trapChannel;

    if (!cfg.enabled && !cfg.channelId) {
      await this.followUpEphemeral(interaction, { content: "❌ Defina um canal armadilha antes de ativar." });
      return this.trapChannelMenu(interaction, guild, user);
    }

    cfg.enabled = !cfg.enabled;
    guild.markModified("security");
    await this.save(guild);

    if (cfg.enabled && !cfg.warningMessageSent) {
      const res = await this.trapChannel.postWarningMessage(guild.guildId, cfg.channelId);
      if (res.ok) {
        cfg.warningMessageSent = true;
        guild.markModified("security");
        await this.save(guild);
      } else {
        await this.followUpEphemeral(interaction, {
          content: `⚠️ Ativado, mas não consegui postar o aviso no canal — falta permissão \`${res.missing}\`.`
        });
      }
    }

    return this.trapChannelMenu(interaction, guild, user);
  }

  async setTrapChannel(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Envie o canal armadilha (menção ou ID):" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const id = this.extractId(msg.content);
    if (!id) return this.followUpEphemeral(interaction, { content: "❌ Não consegui identificar um canal." });

    const sec = this.getSecurity(guild);
    sec.trapChannel.channelId = id;
    sec.trapChannel.warningMessageSent = false;
    guild.markModified("security");
    await this.save(guild);

    const res = await this.trapChannel.postWarningMessage(guild.guildId, id);
    if (res.ok) {
      sec.trapChannel.warningMessageSent = true;
      guild.markModified("security");
      await this.save(guild);
      await this.followUpEphemeral(interaction, { content: "✅ Canal armadilha definido e aviso publicado!" });
    } else {
      await this.followUpEphemeral(interaction, {
        content: `✅ Canal definido, mas não consegui publicar o aviso — falta permissão \`${res.missing}\`.`
      });
    }

    return this.trapChannelMenu(interaction, guild, user);
  }

  async setTrapPunishment(interaction, guild, user) {
    const labels = this._trapPunishmentLabels();
    const select = this.select(
      user,
      Object.entries(labels).map(([value, label]) => ({ label, value })),
      "Selecionar punição",
      async (i) => {
        await this.deferUpdate(i);
        const sec = this.getSecurity(guild);
        sec.trapChannel.punishment = i.data.values[0];
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Punição definida." });
        return this.trapChannelMenu(i, guild, user);
      }
    );
    return this.followUpEphemeral(interaction, { content: "Selecione a punição aplicada a quem cair na armadilha:", components: [this.row(select)] });
  }

  async toggleTrapDeleteRecent(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.trapChannel.deleteRecentMessages = !sec.trapChannel.deleteRecentMessages;
    guild.markModified("security");
    await this.save(guild);
    return this.trapChannelMenu(interaction, guild, user);
  }

  async setTrapWindow(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Janela em minutos para apagar mensagens recentes em outros canais (ex: `5`, máx. 30):" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const val = parseInt(msg.content);
    if (isNaN(val) || val < 1) return this.followUpEphemeral(interaction, { content: "❌ Inválido." });

    const sec = this.getSecurity(guild);
    sec.trapChannel.recentMessagesWindowMinutes = Math.min(val, 30);
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ Janela definida em ${Math.min(val, 30)} minuto(s).` });
    return this.trapChannelMenu(interaction, guild, user);
  }

  async setTrapLogChannel(interaction, guild, user) {
    await this.followUpEphemeral(interaction, {
      content: "Envie o canal de logs do Canal Armadilha (menção ou ID). Envie `remover` para voltar a usar o canal de logs principal:"
    });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const sec = this.getSecurity(guild);
    if (msg.content.trim().toLowerCase() === "remover") {
      sec.trapChannel.logChannelId = null;
      guild.markModified("security");
      await this.save(guild);
      await this.followUpEphemeral(interaction, { content: "✅ Voltou a usar o canal de logs principal." });
      return this.trapChannelMenu(interaction, guild, user);
    }

    const id = this.extractId(msg.content);
    if (!id) return this.followUpEphemeral(interaction, { content: "❌ Não consegui identificar um canal." });
    sec.trapChannel.logChannelId = id;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: "✅ Canal de logs definido." });
    return this.trapChannelMenu(interaction, guild, user);
  }

  async trapExceptionsMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.trapChannel;

    const select = this.select(
      user,
      [
        { label: `➕ Adicionar cargo (${cfg.ignoredRoles.length})`,  value: "add_role"  },
        { label: "➖ Remover cargo",                                  value: "remove_role" },
        { label: `➕ Adicionar usuário (${cfg.ignoredUsers.length})`, value: "add_user"  },
        { label: "➖ Remover usuário",                                value: "remove_user" },
        { label: `➕ Adicionar bot autorizado (${cfg.ignoredBots.length})`, value: "add_bot" },
        { label: "➖ Remover bot autorizado",                         value: "remove_bot" }
      ],
      "Gerenciar exceções",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "add_role")     return this._trapAddException(i, guild, user, "ignoredRoles", "cargo");
        if (v === "remove_role")  return this._trapRemoveException(i, guild, user, "ignoredRoles");
        if (v === "add_user")     return this._trapAddException(i, guild, user, "ignoredUsers", "usuário");
        if (v === "remove_user")  return this._trapRemoveException(i, guild, user, "ignoredUsers");
        if (v === "add_bot")      return this._trapAddException(i, guild, user, "ignoredBots", "bot");
        if (v === "remove_bot")   return this._trapRemoveException(i, guild, user, "ignoredBots");
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🚫 Exceções — Canal Armadilha",
        description:
          `Além destas, Staff e Cargos Imunes do módulo de Segurança já são ignorados automaticamente.\n\n` +
          `**Cargos:** ${cfg.ignoredRoles.map(r => `<@&${r}>`).join(", ") || "Nenhum"}\n` +
          `**Usuários:** ${cfg.ignoredUsers.map(u => `<@${u}>`).join(", ") || "Nenhum"}\n` +
          `**Bots autorizados:** ${cfg.ignoredBots.map(b => `<@${b}>`).join(", ") || "Nenhum"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.trapChannelMenu(i, guild, user)))
      ]
    });
  }

  async _trapAddException(interaction, guild, user, field, label) {
    await this.followUpEphemeral(interaction, { content: `Mencione ou envie o ID do ${label}:` });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const id = this.extractId(msg.content);
    if (!id) return this.followUpEphemeral(interaction, { content: "❌ Não consegui identificar um ID." });

    const sec = this.getSecurity(guild);
    if (!sec.trapChannel[field].includes(id)) sec.trapChannel[field].push(id);
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: "✅ Adicionado!" });
    return this.trapExceptionsMenu(interaction, guild, user);
  }

  async _trapRemoveException(interaction, guild, user, field) {
    const sec  = this.getSecurity(guild);
    const list = sec.trapChannel[field];
    if (!list.length) return this.followUpEphemeral(interaction, { content: "Lista vazia." });

    const select = this.select(
      user,
      list.map(v => ({ label: v, value: v })),
      "Selecionar para remover",
      async (i) => {
        await this.deferUpdate(i);
        sec.trapChannel[field] = list.filter(v => v !== i.data.values[0]);
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Removido!" });
        return this.trapExceptionsMenu(i, guild, user);
      }
    );
    return this.followUpEphemeral(interaction, { content: "Selecione:", components: [this.row(select)] });
  }

  async trapHistory(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.trapChannel.history || [];

    if (!history.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📊 Histórico — Canal Armadilha", description: "Nenhum acionamento registrado até agora." }],
        components: [this.row(this.backBtn(user, (i) => this.trapChannelMenu(i, guild, user)))]
      });
    }

    const labels = this._trapPunishmentLabels();
    const lines = history
      .slice(-10)
      .reverse()
      .map(h =>
        `👤 **${h.username}** (<@${h.userId}>) — ${new Date(h.timestamp).toLocaleString("pt-BR")}\n` +
        `└ Ação: ${labels[h.action] || h.action}` +
        (h.deletedElsewhere ? ` | 🧹 ${h.deletedElsewhere} msg(ns) apagada(s) em outros canais` : "")
      )
      .join("\n\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📊 Histórico — Canal Armadilha (últimos 10)", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.trapChannelMenu(i, guild, user)))]
    });
  }


  _raidActionLabels() {
    return {
      nothing:     "Apenas alertar",
      timeout:     "Timeout (1h)",
      kick:        "Kick",
      ban:         "Ban",
      lockdown:    "Lockdown do servidor",
      quarantine:  "Cargo de quarentena"
    };
  }

  async raidDetection(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.raid;
    const f   = cfg.factors || {};
    const actionLabels = this._raidActionLabels();

    const activeFactors = Object.entries(f).filter(([, v]) => v?.enabled).length;

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢" : "🔴"} AntiRaid Inteligente`,                     value: "toggle"          },
        { label: `🧠 Fatores de Detecção (${activeFactors}/6 ativos)`,                     value: "factors"         },
        { label: `📈 Limite de Risco: ${cfg.riskThreshold ?? 60}/100`,                     value: "set_threshold"   },
        { label: `⚡ Ação: ${actionLabels[cfg.action || "nothing"]}`,                      value: "set_action"      },
        { label: `🔒 Lockdown Automático: ${cfg.autoLockdown ? "🟢" : "🔴"}`,             value: "auto_lockdown"   },
        { label: `♻️ Auto-Restauração: ${cfg.autoRestore ? "🟢" : "🔴"} (${cfg.restoreAfterMinutes ?? 10}min de calmaria)`, value: "auto_restore" },
        { label: `🚨 Alertas Antecipados: ${cfg.earlyAlerts  ? "🟢" : "🔴"}`,             value: "early_alerts"    },
        { label: "📊 Ver Histórico de Detecções",                                          value: "raid_history"    }
      ],
      "Configurar AntiRaid",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle")         return this.toggleRaid(i, guild, user);
        if (v === "factors")        return this.raidFactorsMenu(i, guild, user);
        if (v === "set_threshold")  return this.setRaidThreshold(i, guild, user);
        if (v === "set_action")     return this.setRaidAction(i, guild, user);
        if (v === "auto_lockdown")  return this.autoLockdown(i, guild, user);
        if (v === "auto_restore")   return this.raidAutoRestoreMenu(i, guild, user);
        if (v === "early_alerts")   return this.earlyAlerts(i, guild, user);
        if (v === "raid_history")   return this.raidHistory(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🚨 AntiRaid Inteligente",
        description:
          `Combina vários sinais ao mesmo tempo (joins em massa, contas novas, mensagens repetidas, spam coordenado, menções e convites em massa) — nunca age com base em um único evento isolado.\n\n` +
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Fatores ativos:** ${activeFactors}/6\n` +
          `**Limite de risco:** ${cfg.riskThreshold ?? 60}/100\n` +
          `**Ação:** ${actionLabels[cfg.action || "nothing"]}\n` +
          `**Lockdown Auto:** ${cfg.autoLockdown ? "🟢" : "🔴"}\n` +
          `**Auto-Restauração:** ${cfg.autoRestore ? "🟢" : "🔴"}\n` +
          `**Alertas Antecipados:** ${cfg.earlyAlerts ? "🟢" : "🔴"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async raidFactorsMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const f   = sec.raid.factors || {};

    const rows = [
      { key: "joinRate",          icon: "📈", label: "Muitas contas entrando",   detail: `${f.joinRate?.joinLimit ?? 10} joins/min` },
      { key: "newAccounts",       icon: "🆕", label: "Contas recém-criadas",     detail: `<${f.newAccounts?.maxAgeHours ?? 24}h, ${f.newAccounts?.ratioPercent ?? 50}% dos joins` },
      { key: "duplicateMessages", icon: "📋", label: "Mensagens repetidas",      detail: `${f.duplicateMessages?.minCount ?? 5} usuários com a mesma msg` },
      { key: "coordinatedSpam",   icon: "🌀", label: "Spam coordenado",          detail: `${f.coordinatedSpam?.minUsers ?? 6} usuários em ${f.coordinatedSpam?.windowSec ?? 10}s` },
      { key: "massMentions",      icon: "📣", label: "Menções em massa",         detail: `${f.massMentions?.minCount ?? 15} menções na janela` },
      { key: "massInvites",       icon: "🔗", label: "Convites em massa",        detail: `${f.massInvites?.minCount ?? 4} usuários postando convites` }
    ];

    const select = this.select(
      user,
      rows.map(r => ({
        label: `${f[r.key]?.enabled ? "🟢" : "🔴"} ${r.icon} ${r.label} — ${r.detail}`,
        value: r.key
      })),
      "Selecionar fator para configurar",
      async (i) => {
        await this.deferUpdate(i);
        return this.raidFactorDetail(i, guild, user, i.data.values[0]);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🧠 Fatores de Detecção",
        description: "Cada fator soma pontos ao score de risco (0-100) com peso próprio. Um ataque real precisa acender pelo menos **2 fatores diferentes** — a Ayami nunca reage a um sinal isolado."
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.raidDetection(i, guild, user)))
      ]
    });
  }

  async raidFactorDetail(interaction, guild, user, key) {
    const sec = this.getSecurity(guild);
    const f   = sec.raid.factors[key] ||= {};

    const fieldsByKey = {
      joinRate:          [{ prop: "joinLimit",     label: "Joins/min",                    min: 1 }],
      newAccounts:       [{ prop: "maxAgeHours",   label: "Idade máx. da conta (horas)",  min: 1 }, { prop: "ratioPercent", label: "% de contas novas p/ acender", min: 1 }],
      duplicateMessages: [{ prop: "minCount",      label: "Usuários repetindo a msg",     min: 2 }],
      coordinatedSpam:   [{ prop: "minUsers",      label: "Usuários no burst",            min: 2 }, { prop: "windowSec",    label: "Janela do burst (segundos)",   min: 2 }],
      massMentions:      [{ prop: "minCount",      label: "Total de menções na janela",   min: 2 }],
      massInvites:       [{ prop: "minCount",      label: "Usuários postando convites",   min: 2 }]
    };
    const fields = fieldsByKey[key] || [];

    const options = [
      { label: `${f.enabled ? "🟢 Desativar" : "🔴 Ativar"} este fator`, value: "toggle" },
      ...fields.map(fl => ({ label: `⚙️ ${fl.label}: ${f[fl.prop] ?? "—"}`, value: `set_${fl.prop}` }))
    ];

    const select = this.select(
      user,
      options,
      "Editar fator",
      async (i) => {
        const v = i.data.values[0];
        if (v === "toggle") {
          await this.deferUpdate(i);
          const sec2 = this.getSecurity(guild);
          sec2.raid.factors[key].enabled = !sec2.raid.factors[key].enabled;
          guild.markModified("security");
          await this.save(guild);
          return this.raidFactorDetail(i, guild, user, key);
        }
        const fieldDef = fields.find(fl => `set_${fl.prop}` === v);
        if (!fieldDef) return this.deferUpdate(i);
        await this.followUpEphemeral(i, { content: `Novo valor para **${fieldDef.label}** (número, mín. ${fieldDef.min}):` });
        let msg;
        try { msg = await this.client.NextMessageCollector.wait({ channelId: i.channel_id, userId: user }); } catch { return; }
        const val = parseInt(msg.content);
        if (isNaN(val) || val < fieldDef.min) return this.followUpEphemeral(i, { content: "❌ Valor inválido." });
        const sec2 = this.getSecurity(guild);
        sec2.raid.factors[key][fieldDef.prop] = val;
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: `✅ ${fieldDef.label} definido para ${val}.` });
        return this.raidFactorDetail(i, guild, user, key);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{ title: `🧠 Fator: ${key}`, description: `Status: ${f.enabled ? "🟢 Ativo" : "🔴 Inativo"}` }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.raidFactorsMenu(i, guild, user)))
      ]
    });
  }

  async raidHistory(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.raid.history || [];

    if (!history.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📊 Histórico de Detecções", description: "Nenhum raid detectado até agora." }],
        components: [this.row(this.backBtn(user, (i) => this.raidDetection(i, guild, user)))]
      });
    }

    const lines = history
      .slice(-10)
      .reverse()
      .map(r => {
        const factorsTxt = (r.factors || []).map(f => `${f.key} (${f.score})`).join(", ") || "—";
        const restoredTxt = r.restored ? " · ♻️ restaurado" : "";
        return `🚨 **${new Date(r.timestamp).toLocaleString("pt-BR")}** — score ${r.score}/100${restoredTxt}\n` +
               `└ Fatores: ${factorsTxt}\n` +
               `└ Ação: ${r.action}`;
      })
      .join("\n\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📊 Histórico de Detecções (últimos 10)", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.raidDetection(i, guild, user)))]
    });
  }

  async setRaidAction(interaction, guild, user) {
    const labels = this._raidActionLabels();
    const select = this.select(
      user,
      [
        { label: `🔔 ${labels.nothing}`,    value: "nothing"    },
        { label: `⏱️ ${labels.timeout}`,    value: "timeout"    },
        { label: `👢 ${labels.kick}`,       value: "kick"       },
        { label: `🔨 ${labels.ban}`,        value: "ban"        },
        { label: `🔒 ${labels.lockdown}`,   value: "lockdown"   },
        { label: `🚧 ${labels.quarantine}`, value: "quarantine" }
      ],
      "Selecionar ação",
      async (i) => {
        await this.deferUpdate(i);
        const sec = this.getSecurity(guild);
        sec.raid.action = i.data.values[0];
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: "✅ Ação definida." });
        return this.raidDetection(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione o que acontece com os usuários sinalizados quando um raid for detectado (cargo de quarentena precisa estar configurado em Cargos/Permissões):",
      components: [this.row(select)]
    });
  }

  async toggleRaid(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.raid.enabled = !sec.raid.enabled;
    guild.markModified("security");
    await this.save(guild);
    return this.raidDetection(interaction, guild, user);
  }

  async setRaidThreshold(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Score de risco (0-100) para acionar a resposta automática (padrão: `60`):" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const val = parseInt(msg.content);
    if (isNaN(val) || val < 1 || val > 100) return this.followUpEphemeral(interaction, { content: "❌ Inválido, use um número entre 1 e 100." });
    const sec = this.getSecurity(guild);
    sec.raid.riskThreshold = val;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ Limite de risco: ${val}/100.` });
    return this.raidDetection(interaction, guild, user);
  }

  async raidAutoRestoreMenu(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.raid;

    const select = this.select(
      user,
      [
        { label: `${cfg.autoRestore ? "🟢" : "🔴"} Auto-Restauração`,                        value: "toggle" },
        { label: `⏱️ Minutos de calmaria: ${cfg.restoreAfterMinutes ?? 10}`,                 value: "set_minutes" }
      ],
      "Auto-Restauração",
      async (i) => {
        const v = i.data.values[0];
        if (v === "toggle") {
          await this.deferUpdate(i);
          const sec2 = this.getSecurity(guild);
          sec2.raid.autoRestore = !sec2.raid.autoRestore;
          guild.markModified("security");
          await this.save(guild);
          return this.raidAutoRestoreMenu(i, guild, user);
        }
        await this.followUpEphemeral(i, { content: "Minutos de calmaria exigidos antes de restaurar automaticamente (ex: `10`):" });
        let msg;
        try { msg = await this.client.NextMessageCollector.wait({ channelId: i.channel_id, userId: user }); } catch { return; }
        const val = parseInt(msg.content);
        if (isNaN(val) || val < 1) return this.followUpEphemeral(i, { content: "❌ Inválido." });
        const sec2 = this.getSecurity(guild);
        sec2.raid.restoreAfterMinutes = val;
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: `✅ Calmaria necessária: ${val}min.` });
        return this.raidAutoRestoreMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "♻️ Auto-Restauração",
        description:
          "Quando o AntiRaid ativa o Lockdown automático, a Ayami pode desativá-lo sozinha assim que o servidor ficar calmo pelo tempo configurado — sem precisar de um admin online.\n\n" +
          `**Status:** ${cfg.autoRestore ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Calmaria exigida:** ${cfg.restoreAfterMinutes ?? 10} minutos`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.raidDetection(i, guild, user)))
      ]
    });
  }

  async autoLockdown(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.raid.autoLockdown = !sec.raid.autoLockdown;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ Lockdown auto ${sec.raid.autoLockdown ? "ativado" : "desativado"}.` });
    return this.raidDetection(interaction, guild, user);
  }

  async earlyAlerts(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.raid.earlyAlerts = !sec.raid.earlyAlerts;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ Alertas antecipados ${sec.raid.earlyAlerts ? "ativados" : "desativados"}.` });
    return this.raidDetection(interaction, guild, user);
  }


  async emergencyMode(interaction, guild, user) {
    const sec    = this.getSecurity(guild);
    const active = sec.emergency?.active || false;
    const snap   = sec.emergency?.channelSnapshot?.length || 0;

    const select = this.select(
      user,
      [
        { label: active ? "🔓 Desativar e Restaurar Canais" : "🔒 Ativar Emergência",        value: "toggle_emergency" },
        { label: `🚫 Bloquear Mensagens: ${sec.emergency?.blockMessages ? "✅" : "❌"}`,      value: "block_messages"   },
        { label: `🔗 Bloquear Convites: ${sec.emergency?.blockInvites   ? "✅" : "❌"}`,      value: "block_invites"    },
        { label: "⏱️ Timer de Segurança",                                                    value: "timer"            },
        { label: "📋 Logs de Emergência",                                                    value: "emergency_logs"   }
      ],
      "Modo de Emergência",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle_emergency") return this.toggleEmergency(i, guild, user);
        if (v === "block_messages")   return this.blockMessages(i, guild, user);
        if (v === "block_invites")    return this.blockInvites(i, guild, user);
        if (v === "timer")            return this.emergencyTimer(i, guild, user);
        if (v === "emergency_logs")   return this.emergencyLogs(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🔒 Modo Emergência",
        description:
          `**Status:** ${active ? "🚨 ATIVO" : "✅ Normal"}\n` +
          `**Msgs Bloqueadas:** ${sec.emergency?.blockMessages ? "Sim" : "Não"}\n` +
          `**Convites Bloqueados:** ${sec.emergency?.blockInvites ? "Sim" : "Não"}\n` +
          `**Snapshot de canais:** ${snap > 0 ? `${snap} canal(ais) salvo(s)` : "Nenhum"}\n\n` +
          (active
            ? "⚠️ Ao desativar, os canais serão restaurados ao estado anterior."
            : "ℹ️ Ao ativar, o estado dos canais será salvo antes de bloquear."),
        color: active ? 0xED4245 : 0x57F287
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async toggleEmergency(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    if (!sec.emergency) sec.emergency = {};

    const ok = await this._requirePerms(
      interaction, guild, user,
      ["MANAGE_ROLES", "MANAGE_CHANNELS"],
      null,
      (i) => this.emergencyMode(i, guild, user),
      "ativar/desativar o Modo Emergência (preciso poder gerenciar permissões de canais)"
    );
    if (!ok) return;

    if (!sec.emergency.active) {
      await this.followUpEphemeral(interaction, { content: "⏳ Salvando estado dos canais e ativando emergência..." });
      const success = await this._emergencyLockdown(guild, interaction.guild_id);
      if (!success) {
        await this.followUpEphemeral(interaction, { content: "❌ Falha ao ativar o modo emergência. Verifique as permissões do bot." });
        return this.emergencyMode(interaction, guild, user);
      }
      sec.emergency.active = true;
      guild.markModified("security");
      await this.save(guild);
      await this.followUpEphemeral(interaction, { content: "🚨 **Modo emergência ATIVADO.** Canais bloqueados e estado salvo." });
    } else {
      await this.followUpEphemeral(interaction, { content: "⏳ Restaurando canais..." });
      await this._emergencyRestore(guild, interaction.guild_id);
      sec.emergency.active = false;
      guild.markModified("security");
      await this.save(guild);
      await this.followUpEphemeral(interaction, { content: "✅ **Modo emergência desativado.** Canais restaurados ao estado anterior." });
    }

    return this.emergencyMode(interaction, guild, user);
  }

  async _emergencyLockdown(guild, guildId) {
    try {
      const allowed = await this._ensurePerms(
        guildId,
        ["MANAGE_ROLES", "MANAGE_CHANNELS"],
        null,
        "ativar o Modo Emergência (bloquear canais)"
      );
      if (!allowed) return false;

      const sec      = this.getSecurity(guild);
      const channels = await DiscordRequest(`/guilds/${guildId}/channels`);
      const SEND     = 1n << 11n;
      const VIEW     = 1n << 10n;
      const snapshot = [];

      for (const ch of channels) {
        if (ch.type !== 0 && ch.type !== 5) continue;
        const ow    = (ch.permission_overwrites || []).find(o => o.id === guildId);
        const deny  = BigInt(ow?.deny  || 0);
        const allow = BigInt(ow?.allow || 0);

        snapshot.push({
          channelId:     ch.id,
          originalAllow: (ow?.allow || "0").toString(),
          originalDeny:  (ow?.deny  || "0").toString()
        });

        await DiscordRequest(`/channels/${ch.id}/permissions/${guildId}`, {
          method: "PUT",
          body: { id: guildId, type: 0, deny: (deny | SEND).toString(), allow: (allow & ~SEND).toString() }
        }).catch(() => {});
      }

      sec.emergency.channelSnapshot = snapshot;
      guild.markModified("security");
      return true;

    } catch (err) { console.error("[Security] _emergencyLockdown:", err); return false; }
  }

  async _emergencyRestore(guild, guildId) {
    try {
      const allowed = await this._ensurePerms(
        guildId,
        ["MANAGE_ROLES", "MANAGE_CHANNELS"],
        null,
        "desativar o Modo Emergência (restaurar canais)"
      );
      if (!allowed) return false;

      const sec      = this.getSecurity(guild);
      const snapshot = sec.emergency?.channelSnapshot || [];
      for (const entry of snapshot) {
        await DiscordRequest(`/channels/${entry.channelId}/permissions/${guildId}`, {
          method: "PUT",
          body: { id: guildId, type: 0, allow: entry.originalAllow, deny: entry.originalDeny }
        }).catch(() => {});
      }
      sec.emergency.channelSnapshot = [];
      guild.markModified("security");
      return true;
    } catch (err) { console.error("[Security] _emergencyRestore:", err); return false; }
  }

  async blockMessages(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    if (!sec.emergency) sec.emergency = {};
    sec.emergency.blockMessages = !sec.emergency.blockMessages;
    guild.markModified("security");
    await this.save(guild);
    return this.emergencyMode(interaction, guild, user);
  }

  async blockInvites(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    if (!sec.emergency) sec.emergency = {};
    sec.emergency.blockInvites = !sec.emergency.blockInvites;
    guild.markModified("security");
    await this.save(guild);
    return this.emergencyMode(interaction, guild, user);
  }

  async emergencyTimer(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Tempo em minutos para desativar automaticamente (ex: `30`):" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const minutes = parseInt(msg.content);
    if (isNaN(minutes) || minutes < 1) return this.followUpEphemeral(interaction, { content: "❌ Inválido." });
    const sec = this.getSecurity(guild);
    if (!sec.emergency) sec.emergency = {};
    sec.emergency.timerMinutes = minutes;
    guild.markModified("security");
    await this.save(guild);

    setTimeout(async () => {
      try {
        const g = await this.getGuild(guild.guildId);
        const s = this.getSecurity(g);
        if (!s.emergency?.active) return;
        await this._emergencyRestore(g, guild.guildId);
        s.emergency.active = false;
        g.markModified("security");
        await this.save(g);
        await this.sendSecurityAlert(guild.guildId, `✅ **Modo emergência desativado automaticamente** após ${minutes} minutos.`, "security");
      } catch (err) { console.error("[Security] emergencyTimer auto-off:", err); }
    }, minutes * 60000);

    await this.followUpEphemeral(interaction, { content: `✅ Timer: ${minutes} min. O modo emergência será desativado automaticamente.` });
    return this.emergencyMode(interaction, guild, user);
  }

  async emergencyLogs(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    if (!sec.emergency) sec.emergency = {};
    const logs = sec.emergency.logs || [];

    if (!logs.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📋 Logs de Emergência", description: "Nenhum evento de emergência registrado." }],
        components: [this.row(this.backBtn(user, (i) => this.emergencyMode(i, guild, user)))]
      });
    }

    const lines = logs
      .slice(-15)
      .reverse()
      .map(e => `**${new Date(e.timestamp).toLocaleString("pt-BR")}** — ${e.event}`)
      .join("\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📋 Logs de Emergência (últimos 15)", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.emergencyMode(i, guild, user)))]
    });
  }

  _logEmergencyEvent(guild, event) {
    const sec = this.getSecurity(guild);
    if (!sec.emergency) sec.emergency = {};
    if (!sec.emergency.logs) sec.emergency.logs = [];
    sec.emergency.logs.push({ timestamp: Date.now(), event });
    if (sec.emergency.logs.length > 50) sec.emergency.logs = sec.emergency.logs.slice(-50);
  }


  async monitoringSystem(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.monitoring;

    const toggles = [
      { key: "permChanges",     label: "Permissões Alteradas" },
      { key: "adminRoleCreate", label: "Cargo Admin Criado"   },
      { key: "botAdded",        label: "Bot Adicionado"       },
      { key: "webhookCreated",  label: "Webhook Criado"       },
      { key: "channelChanges",  label: "Canais Alterados"     }
    ];

    const select = this.select(
      user,
      [
        ...toggles.map(t => ({ label: `${cfg[t.key] ? "🟢" : "🔴"} ${t.label}`, value: t.key })),
        { label: "🔄 Rollback Sugerido", value: "rollback"    },
        { label: "📅 Histórico",         value: "mon_history" }
      ],
      "Configurar Monitoramento",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "rollback")    return this.monRollback(i, guild, user);
        if (v === "mon_history") return this.monHistory(i, guild, user);
        sec.monitoring[v] = !sec.monitoring[v];
        guild.markModified("security");
        await this.save(guild);
        return this.monitoringSystem(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🧬 Monitoramento de Alterações",
        description: toggles.map(t => `${cfg[t.key] ? "🟢" : "🔴"} **${t.label}**`).join("\n")
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async monRollback(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.monitoring.changeHistory || [];

    if (!history.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "🔄 Rollback", description: "Nenhuma alteração monitorada disponível para rollback." }],
        components: [this.row(this.backBtn(user, (i) => this.monitoringSystem(i, guild, user)))]
      });
    }

    const lines = history
      .slice(-10)
      .reverse()
      .map((e, i) =>
        `**${i + 1}.** ${new Date(e.timestamp).toLocaleString("pt-BR")}\n└ ${e.type}: ${e.description}`
      )
      .join("\n\n");

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🔄 Rollback — Histórico de Alterações",
        description: lines + "\n\n> Para reverter manualmente, use o menu de Backup do Servidor."
      }],
      components: [this.row(this.backBtn(user, (i) => this.monitoringSystem(i, guild, user)))]
    });
  }

  async monHistory(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.monitoring.changeHistory || [];

    if (!history.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📅 Histórico de Monitoramento", description: "Nenhuma alteração registrada." }],
        components: [this.row(this.backBtn(user, (i) => this.monitoringSystem(i, guild, user)))]
      });
    }

    const byDay = {};
    for (const e of history) {
      const day = new Date(e.timestamp).toLocaleDateString("pt-BR");
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(e);
    }

    const lines = Object.entries(byDay)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([day, events]) =>
        `**${day}** — ${events.length} evento(s)\n` +
        events.slice(0, 3).map(e => `└ ${e.type}: ${e.description}`).join("\n") +
        (events.length > 3 ? `\n└ ...e mais ${events.length - 3}` : "")
      )
      .join("\n\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📅 Histórico de Monitoramento", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.monitoringSystem(i, guild, user)))]
    });
  }

  async _logMonitoringEvent(guildId, type, description) {
    try {
      const guild = await this.getGuild(guildId);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.changeHistory) sec.monitoring.changeHistory = [];
      sec.monitoring.changeHistory.push({ timestamp: Date.now(), type, description });
      if (sec.monitoring.changeHistory.length > 100) {
        sec.monitoring.changeHistory = sec.monitoring.changeHistory.slice(-100);
      }
      guild.markModified("security");
      await this.save(guild);
    } catch (err) { console.error("[Security] _logMonitoringEvent:", err); }
  }


  async botAnalysis(interaction, guild, user) {
    const guildId          = interaction.guild_id;
    const [members, roles] = await Promise.all([
      DiscordRequest(`/guilds/${guildId}/members?limit=1000`),
      DiscordRequest(`/guilds/${guildId}/roles`)
    ]);
    const ADMIN   = 1n << 3n;
    const bots    = members.filter(m => m.user?.bot);
    const results = bots.map(bot => {
      const flags = [];
      for (const rId of bot.roles) {
        const r = roles.find(x => x.id === rId);
        if (r && (BigInt(r.permissions) & ADMIN) === ADMIN) { flags.push("🔴 Admin"); break; }
      }
      if (Math.floor((Date.now() - new Date(bot.joined_at).getTime()) / 86400000) < 7)
        flags.push("⚠️ Recém adicionado");
      return { id: bot.user.id, username: bot.user.username, flags };
    });
    const risky = results.filter(b => b.flags.length > 0);
    const safe  = results.filter(b => b.flags.length === 0);

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🤖 Análise de Bots",
        description:
          `**Total:** ${bots.length} | **Suspeitos:** ${risky.length} | **OK:** ${safe.length}\n\n` +
          (risky.length
            ? risky.slice(0, 8).map(b => `🤖 **${b.username}** (<@${b.id}>)\n└ ${b.flags.join(", ")}`).join("\n\n")
            : "✅ Nenhum bot suspeito.\n\n") +
          (safe.length && safe.length <= 10
            ? `\n**Bots seguros:**\n` + safe.map(b => `✅ ${b.username}`).join(", ")
            : safe.length > 10 ? `\n**Bots seguros:** ${safe.length} bots verificados ✅` : ""),
        color: risky.length ? 0xFEE75C : 0x57F287
      }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }



  async backupMenu(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const backups = sec.backups || [];
    const last    = backups.length ? new Date(backups[backups.length - 1].createdAt).toLocaleString("pt-BR") : "Nenhum";

    const select = this.select(
      user,
      [
        { label: "📦 Criar Backup Completo",    description: "Canais, categorias, cargos e permissões",    value: "full_backup"    },
        { label: "🔄 Backup Incremental",       description: "Apenas o que mudou desde o último",          value: "inc_backup"     },
        { label: "📋 Ver Backups Salvos",       description: `${backups.length} backup(s) disponível(is)`, value: "list_backups"   },
        { label: "♻️ Restaurar Backup",         description: "Aplica um backup salvo",                     value: "restore_backup" },
        { label: "🗑️ Deletar Backup",          description: "Remove um backup salvo",                     value: "delete_backup"  }
      ],
      "Gerenciar Backups",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "full_backup")    return this.createBackup(i, guild, user, false);
        if (v === "inc_backup")     return this.createBackup(i, guild, user, true);
        if (v === "list_backups")   return this.listBackups(i, guild, user);
        if (v === "restore_backup") return this.restoreBackupMenu(i, guild, user);
        if (v === "delete_backup")  return this.deleteBackupMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "💾 Backup do Servidor",
        description:
          `**Backups salvos:** ${backups.length}/5\n` +
          `**Último backup:** ${last}\n\n` +
          `> Backups salvam: canais, categorias, cargos e todas as permissões.\n` +
          `> A restauração recria itens que não existem mais e atualiza os que existem.`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async createBackup(interaction, guild, user, incremental = false) {
    await this.editOriginal(interaction, {
      embeds: [{ title: "💾 Backup", description: "⏳ Coletando dados do servidor..." }],
      components: []
    });

    try {
      const guildId = interaction.guild_id;
      const [channels, roles, guildData] = await Promise.all([
        DiscordRequest(`/guilds/${guildId}/channels`),
        DiscordRequest(`/guilds/${guildId}/roles`),
        DiscordRequest(`/guilds/${guildId}`)
      ]);

      const sec = this.getSecurity(guild);
      if (!sec.backups) sec.backups = [];

      const now    = Date.now();
      const backup = {
        id:          `bk_${now}`,
        createdAt:   now,
        incremental,
        guildName:   guildData.name,
        channels:    [],
        categories:  [],
        roles:       []
      };

      const lastBackup = incremental && sec.backups.length
        ? sec.backups[sec.backups.length - 1]
        : null;

      for (const role of roles) {
        if (role.managed) continue; 

        const roleData = {
          id:          role.id,
          name:        role.name,
          color:       role.color,
          hoist:       role.hoist,
          position:    role.position,
          permissions: role.permissions,
          mentionable: role.mentionable
        };

        if (incremental && lastBackup) {
          const prev = lastBackup.roles.find(r => r.id === role.id);
          if (prev && JSON.stringify(prev) === JSON.stringify(roleData)) continue;
        }

        backup.roles.push(roleData);
      }

      const cats = channels.filter(c => c.type === 4);
      for (const cat of cats) {
        const catData = {
          id:       cat.id,
          name:     cat.name,
          position: cat.position,
          permission_overwrites: (cat.permission_overwrites || []).map(ow => ({
            id: ow.id, type: ow.type, allow: ow.allow, deny: ow.deny
          }))
        };

        if (incremental && lastBackup) {
          const prev = lastBackup.categories?.find(c => c.id === cat.id);
          if (prev && JSON.stringify(prev) === JSON.stringify(catData)) continue;
        }

        backup.categories.push(catData);
      }

      for (const ch of channels) {
        if (ch.type === 4) continue; 

        const chData = {
          id:        ch.id,
          name:      ch.name,
          type:      ch.type,
          position:  ch.position,
          parent_id: ch.parent_id || null,
          category:  cats.find(c => c.id === ch.parent_id)?.name || null,
          topic:     ch.topic || null,
          nsfw:      ch.nsfw  || false,
          slowmode_delay: ch.rate_limit_per_user || 0,
          permission_overwrites: (ch.permission_overwrites || []).map(ow => ({
            id:    ow.id,
            type:  ow.type,
            allow: ow.allow,
            deny:  ow.deny
          }))
        };

        if (incremental && lastBackup) {
          const prev = lastBackup.channels.find(c => c.id === ch.id);
          if (prev && JSON.stringify(prev) === JSON.stringify(chData)) continue;
        }

        backup.channels.push(chData);
      }

      if (sec.backups.length >= 5) sec.backups.shift();
      sec.backups.push(backup);
      guild.markModified("security");
      await this.save(guild);

      const tipo = incremental ? "Incremental" : "Completo";
      return this.editOriginal(interaction, {
        embeds: [{
          title: "✅ Backup Criado",
          description:
            `**Tipo:** ${tipo}\n` +
            `**ID:** \`${backup.id}\`\n` +
            `**Cargos salvos:** ${backup.roles.length}\n` +
            `**Categorias salvas:** ${backup.categories.length}\n` +
            `**Canais salvos:** ${backup.channels.length}\n` +
            `**Data:** ${new Date(now).toLocaleString("pt-BR")}`,
          color: 0x57F287
        }],
        components: [this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))]
      });

    } catch (err) {
      console.error("[Security] createBackup:", err);
      return this.editOriginal(interaction, {
        embeds: [{ title: "❌ Erro ao criar backup", description: err.message, color: 0xED4245 }],
        components: [this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))]
      });
    }
  }

  async listBackups(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const backups = sec.backups || [];

    const desc = backups.length
      ? backups.map((b, i) =>
          `**${i + 1}.** \`${b.id}\`\n` +
          `└ ${b.incremental ? "Incremental" : "Completo"} — ${new Date(b.createdAt).toLocaleString("pt-BR")}\n` +
          `└ ${b.channels.length} canais / ${b.categories?.length || 0} categorias / ${b.roles.length} cargos`
        ).join("\n\n")
      : "Nenhum backup salvo.";

    return this.editOriginal(interaction, {
      embeds: [{ title: "📋 Backups Salvos", description: desc }],
      components: [this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))]
    });
  }

  async restoreBackupMenu(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const backups = sec.backups || [];
    if (!backups.length) return this.followUpEphemeral(interaction, { content: "Nenhum backup disponível." });

    const select = this.select(
      user,
      backups.map((b, i) => ({
        label:       `${i + 1}. ${b.incremental ? "Inc" : "Completo"} — ${new Date(b.createdAt).toLocaleDateString("pt-BR")}`,
        description: `${b.channels.length} canais / ${b.roles.length} cargos`,
        value:       b.id
      })),
      "Selecionar backup para restaurar",
      async (i) => {
        await this.deferUpdate(i);
        return this.restoreBackup(i, guild, user, i.data.values[0]);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "♻️ Restaurar Backup",
        description:
          "⚠️ **Atenção:** restaurar irá:\n" +
          "— Atualizar permissões de canais e cargos existentes\n" +
          "— **Recriar** canais, categorias e cargos que foram deletados\n\n" +
          "Selecione o backup:"
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))
      ]
    });
  }

  async restoreBackup(interaction, guild, user, backupId) {
    const missing = await this._missingBotPerms(interaction.guild_id, ["MANAGE_ROLES", "MANAGE_CHANNELS"]);
    if (missing.length) {
      return this.editOriginal(interaction, {
        embeds: [{
          title: "❌ Permissão insuficiente",
          description:
            `Não tenho permissão para restaurar o backup (cargos e canais).\n\n` +
            `**Faltando:** ${missing.map(p => `\`${this._permLabel(p)}\``).join(", ")}\n\n` +
            `> Ajuste o cargo do bot e tente novamente.`,
          color: 0xED4245
        }],
        components: [this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))]
      });
    }

    await this.editOriginal(interaction, {
      embeds: [{ title: "♻️ Restaurando backup...", description: "⏳ Aplicando configurações..." }],
      components: []
    });

    try {
      const sec     = this.getSecurity(guild);
      const backup  = (sec.backups || []).find(b => b.id === backupId);
      const guildId = interaction.guild_id;

      if (!backup) {
        return this.editOriginal(interaction, {
          embeds: [{ title: "❌ Backup não encontrado", color: 0xED4245 }],
          components: [this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))]
        });
      }

      const [currentChannels, currentRoles] = await Promise.all([
        DiscordRequest(`/guilds/${guildId}/channels`),
        DiscordRequest(`/guilds/${guildId}/roles`)
      ]);

      let restored = 0;
      let created  = 0;
      let errors   = 0;

      const roleIdMap = { [guildId]: guildId }; 
      for (const role of backup.roles) {
        if (role.id === guildId) continue; 

        const existing = currentRoles.find(r => r.id === role.id)
          || currentRoles.find(r => !r.managed && r.name === role.name);

        if (existing) {
          try {
            await DiscordRequest(`/guilds/${guildId}/roles/${existing.id}`, {
              method: "PATCH",
              body: {
                name:        role.name,
                color:       role.color,
                hoist:       role.hoist,
                permissions: role.permissions,
                mentionable: role.mentionable
              }
            });
            roleIdMap[role.id] = existing.id;
            restored++;
          } catch { errors++; roleIdMap[role.id] = role.id; }
        } else {
          try {
            const createdRole = await DiscordRequest(`/guilds/${guildId}/roles`, {
              method: "POST",
              body: {
                name:        role.name,
                color:       role.color,
                hoist:       role.hoist,
                permissions: role.permissions,
                mentionable: role.mentionable
              }
            });
            roleIdMap[role.id] = createdRole.id;
            created++;
          } catch { errors++; roleIdMap[role.id] = role.id; }
        }
      }

      const remapOverwrites = (list) => (list || []).map(ow => ({
        id:    ow.type === 0 ? (roleIdMap[ow.id] || ow.id) : ow.id,
        type:  ow.type,
        allow: ow.allow,
        deny:  ow.deny
      }));

      const categoryIdMap = {};
      const sortedCats = [...(backup.categories || [])].sort((a, b) => a.position - b.position);
      for (const cat of sortedCats) {
        const existing = currentChannels.find(c => c.id === cat.id && c.type === 4)
          || currentChannels.find(c => c.type === 4 && c.name === cat.name); 
        const overwrites = remapOverwrites(cat.permission_overwrites);

        if (existing) {
          try {
            await DiscordRequest(`/channels/${existing.id}`, {
              method: "PATCH",
              body: { name: cat.name, position: cat.position }
            });
            for (const ow of overwrites) {
              await DiscordRequest(`/channels/${existing.id}/permissions/${ow.id}`, {
                method: "PUT", body: ow
              }).catch(() => {});
            }
            categoryIdMap[cat.id] = existing.id;
            restored++;
          } catch { errors++; }
        } else {
          try {
            const createdCat = await DiscordRequest(`/guilds/${guildId}/channels`, {
              method: "POST",
              body: { name: cat.name, type: 4, position: cat.position, permission_overwrites: overwrites }
            });
            categoryIdMap[cat.id] = createdCat.id;
            created++;
          } catch { errors++; }
        }
      }

      const sortedChannels = [...(backup.channels || [])].sort((a, b) => a.position - b.position);
      const positionUpdates = [];

      for (const ch of sortedChannels) {
        const targetParentId = ch.parent_id
          ? (categoryIdMap[ch.parent_id]
              || currentChannels.find(c => c.type === 4 && c.name === ch.category)?.id
              || null)
          : null;

        const overwrites = remapOverwrites(ch.permission_overwrites);

        const existing = currentChannels.find(c => c.id === ch.id && c.type === ch.type)
          || currentChannels.find(c => c.type === ch.type && c.name === ch.name && (c.parent_id || null) === targetParentId);

        if (existing) {
          try {
            await DiscordRequest(`/channels/${existing.id}`, {
              method: "PATCH",
              body: {
                name:                ch.name,
                topic:               ch.topic,
                nsfw:                ch.nsfw,
                rate_limit_per_user: ch.slowmode_delay,
                parent_id:           targetParentId
              }
            });
            for (const ow of overwrites) {
              await DiscordRequest(`/channels/${existing.id}/permissions/${ow.id}`, {
                method: "PUT", body: ow
              }).catch(() => {});
            }
            positionUpdates.push({ id: existing.id, position: ch.position });
            restored++;
          } catch { errors++; }
        } else {
          try {
            const body = {
              name:                ch.name,
              type:                ch.type,
              position:            ch.position,
              nsfw:                ch.nsfw,
              rate_limit_per_user: ch.slowmode_delay,
              permission_overwrites: overwrites,
              parent_id:           targetParentId
            };
            if (ch.topic) body.topic = ch.topic;
            const createdCh = await DiscordRequest(`/guilds/${guildId}/channels`, { method: "POST", body });
            positionUpdates.push({ id: createdCh.id, position: ch.position });
            created++;
          } catch { errors++; }
        }
      }

      try {
        const catPositions = sortedCats
          .map(cat => ({ id: categoryIdMap[cat.id], position: cat.position }))
          .filter(p => p.id);
        const bulk = [...catPositions, ...positionUpdates];
        if (bulk.length) {
          await DiscordRequest(`/guilds/${guildId}/channels`, { method: "PATCH", body: bulk });
        }
      } catch (err) {
        console.error("[Security] restoreBackup: ajuste de ordem falhou (não crítico):", err);
      }

      this._clearBotPermCache(guildId);

      await this.sendSecurityAlert(guildId,
        `♻️ **Backup restaurado!**\n` +
        `ID: \`${backupId}\`\n` +
        `✅ ${restored} atualizado(s) | 🆕 ${created} recriado(s) | ❌ ${errors} erro(s)`,
        "security"
      );

      return this.editOriginal(interaction, {
        embeds: [{
          title: "✅ Backup Restaurado",
          description:
            `**Atualizados:** ${restored}\n` +
            `**Recriados:** ${created}\n` +
            `**Erros:** ${errors}\n\n` +
            (errors > 0 ? "⚠️ Alguns itens tiveram erro. Verifique as permissões do bot." : ""),
          color: errors > 0 ? 0xFEE75C : 0x57F287
        }],
        components: [this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))]
      });

    } catch (err) {
      console.error("[Security] restoreBackup:", err);
      return this.editOriginal(interaction, {
        embeds: [{ title: "❌ Erro ao restaurar", description: err.message, color: 0xED4245 }],
        components: [this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))]
      });
    }
  }

  async deleteBackupMenu(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const backups = sec.backups || [];
    if (!backups.length) return this.followUpEphemeral(interaction, { content: "Nenhum backup para deletar." });

    const select = this.select(
      user,
      backups.map((b, i) => ({
        label:       `${i + 1}. ${b.incremental ? "Inc" : "Completo"} — ${new Date(b.createdAt).toLocaleDateString("pt-BR")}`,
        description: `${b.channels.length} canais / ${b.roles.length} cargos`,
        value:       b.id
      })),
      "Selecionar backup para deletar",
      async (i) => {
        await this.deferUpdate(i);
        const id = i.data.values[0];
        sec.backups = sec.backups.filter(b => b.id !== id);
        guild.markModified("security");
        await this.save(guild);
        await this.followUpEphemeral(i, { content: `✅ Backup \`${id}\` deletado.` });
        return this.backupMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{ title: "🗑️ Deletar Backup", description: "Selecione o backup para remover:" }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.backupMenu(i, guild, user)))
      ]
    });
  }


  async fullSecurityCheck(interaction, guild, user) {
    const guildId = interaction.guild_id;
    await this.editOriginal(interaction, {
      embeds: [{ title: "🧠 Verificação Completa", description: "⏳ Analisando..." }],
      components: []
    });

    const risks = [];
    let   score = 100;
    const sec   = this.getSecurity(guild);

    const simpleKeys = ["badwords", "antispam", "anticaps", "antilinks", "antimention"];
    const inactive   = simpleKeys.filter(k => !sec.automod.simple[k]?.enabled);
    if (inactive.length) { risks.push(`⚠️ AutoMod: ${inactive.length} módulo(s) inativo(s): ${inactive.join(", ")}`); score -= inactive.length * 3; }

    const [members, roles] = await Promise.all([
      DiscordRequest(`/guilds/${guildId}/members?limit=1000`),
      DiscordRequest(`/guilds/${guildId}/roles`)
    ]);
    const ADMIN = 1n << 3n;
    let rBots = 0;
    for (const m of members.filter(m => m.user?.bot)) {
      for (const rId of m.roles) {
        const r = roles.find(x => x.id === rId);
        if (r && (BigInt(r.permissions) & ADMIN) === ADMIN) { rBots++; break; }
      }
    }
    if (rBots) { risks.push(`🤖 ${rBots} bot(s) com permissão de Administrador`); score -= rBots * 10; }

    const MENTION = 1n << 17n;
    let mRoles = 0;
    for (const r of roles) {
      if (r.id === guildId) continue;
      if ((BigInt(r.permissions) & MENTION) === MENTION) mRoles++;
    }
    if (mRoles) { risks.push(`👮 ${mRoles} cargo(s) com permissão de mencionar @everyone`); score -= mRoles * 5; }
    if (!sec.logs.channels.main)    { risks.push("📜 Sem canal de log configurado"); score -= 10; }
    if (!sec.raid.enabled)          { risks.push("🚨 Detecção de raid desativada"); score -= 10; }
    if (!sec.backups?.length)       { risks.push("💾 Nenhum backup criado"); score -= 5;  }
    if (!sec.roles.staff?.length)   { risks.push("👮 Nenhum cargo Staff configurado"); score -= 5; }

    score = Math.max(0, Math.min(100, score));
    const label = score >= 80 ? "🟢 Seguro" : score >= 50 ? "🟡 Atenção" : "🔴 Vulnerável";

    const riskLines = risks.length
      ? risks.map((r, i) => `${i + 1}. ${r}`).join("\n") +
        (risks.length > 8 ? `\n...e mais ${risks.length - 8} item(s).` : "")
      : "✅ Servidor bem configurado!";

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🧠 Verificação Completa de Segurança",
        description:
          `**Security Score: ${score}/100** — ${label}\n\n` +
          `**Riscos encontrados:**\n${riskLines}`,
        color: score >= 80 ? 0x57F287 : score >= 50 ? 0xFEE75C : 0xED4245
      }],
      components: [this.row(this.backBtn(user, (i) => this.startSetup(i)))]
    });
  }


  async handleMemberJoin(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);

      const userId = data.user?.id;
      if (!userId) return;

      if (sec.verification?.enabled) {
        await this.memberVerification.check(guild, data.guild_id, sec, data.user)
          .catch(err => console.error("[Security] memberVerification.check:", err));
      }

      if (!sec.raid?.enabled) return;

      await this.raidIntelligence.registerJoin(guild, data.guild_id, sec, userId);

    } catch (err) { console.error("[Security] handleMemberJoin:", err); }
  }

  async handleRoleCreate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.adminRoleCreate) return;
      if ((BigInt(data.role?.permissions || 0) & (1n << 3n)) === (1n << 3n)) {
        await this._logMonitoringEvent(data.guild_id, "Cargo", `Cargo com Admin criado: ${data.role.name}`);
        await this.sendSecurityAlert(data.guild_id, `⚠️ **Cargo com Admin criado!**\n<@&${data.role.id}> — \`${data.role.name}\``, "security");
      }
    } catch (err) { console.error("[Security] handleRoleCreate:", err); }
  }

  async handleChannelCreate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.channelChanges) return;
      await this._logMonitoringEvent(data.guild_id, "Canal", `Canal criado: #${data.name}`);
      await this.sendSecurityAlert(data.guild_id, `🧬 **Canal criado:** <#${data.id}> (\`${data.name}\`)`, "security");
    } catch (err) { console.error("[Security] handleChannelCreate:", err); }
  }

  async handleMemberUpdate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.botAdded || !data.user?.bot) return;
      await this._logMonitoringEvent(data.guild_id, "Bot", `Bot adicionado: ${data.user.username}`);
      await this.sendSecurityAlert(data.guild_id, `🤖 **Bot adicionado:** ${data.user.username} (<@${data.user.id}>)`, "security");
    } catch (err) { console.error("[Security] handleMemberUpdate:", err); }
  }

  async handleWebhookCreate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.webhookCreated) return;
      await this._logMonitoringEvent(data.guild_id, "Webhook", `Webhook criado em #${data.channel_id}`);
      await this.sendSecurityAlert(data.guild_id, `🔗 **Webhook criado/alterado** em <#${data.channel_id}>`, "security");
    } catch (err) { console.error("[Security] handleWebhookCreate:", err); }
  }


  async handleMessage(data) {
    try {
      if (!data.guild_id || data.author?.bot) return;

      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      const s     = sec.automod.simple;

      const userId    = data.author.id;
      const channelId = data.channel_id;
      const content   = data.content || "";
      const guildId   = data.guild_id;

      const memberRoles = data.member?.roles || [];

      this.trapChannel.trackMessage(guildId, userId, channelId, data.id);
      if (sec.trapChannel?.enabled && sec.trapChannel.channelId && sec.trapChannel.channelId === channelId) {
        return await this.trapChannel.handle(guild, guildId, sec, data, memberRoles);
      }

      if (sec.raid?.enabled) {
        const mentionCount = (data.mentions?.length || 0) + (data.mention_roles?.length || 0) + (data.mention_everyone ? 1 : 0);
        this.raidIntelligence
          .registerMessage(guild, guildId, sec, { userId, content, mentionCount })
          .catch(err => console.error("[Security] raidIntelligence.registerMessage:", err));
      }

      const immuneRoles = sec.roles?.immune || [];
      if (immuneRoles.some(r => memberRoles.includes(r))) return;

      const isIgnored = (cfg) => {
        if (!cfg) return false;
        if (cfg.ignoredChannels?.includes(channelId)) return true;
        if (cfg.ignoredRoles?.some(r => memberRoles.includes(r))) return true;
        return false;
      };

      const doActions = async (actions, reason, module) => {
        const acts    = actions || ["delete"];
        const skipped = [];

        if (acts.includes("delete")) {
          if (await this._hasBotPerms(guildId, ["MANAGE_MESSAGES"], channelId)) {
            await DiscordRequest(`/channels/${channelId}/messages/${data.id}`, {
              method: "DELETE"
            }).catch(() => {});
          } else {
            skipped.push("delete (Gerenciar Mensagens)");
          }
        }

        let warnCount = 0;

        if (acts.includes("warn")) {
          warnCount = await this.addWarn(guildId, userId, `${module}: ${reason}`, this.client.clientId, channelId);
        }

        if (acts.includes("timeout_10m") || acts.includes("timeout_1h") || acts.includes("timeout_24h")) {
          if (await this._hasBotPerms(guildId, ["MODERATE_MEMBERS"])) {
            let ms = 600000;
            if (acts.includes("timeout_1h"))  ms = 3600000;
            if (acts.includes("timeout_24h")) ms = 86400000;
            const until = new Date(Date.now() + ms).toISOString();
            await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
              method: "PATCH", body: { communication_disabled_until: until }
            }).catch(() => {});
          } else {
            skipped.push("timeout (Aplicar Timeout)");
          }
        }
        if (acts.includes("kick")) {
          if (await this._hasBotPerms(guildId, ["KICK_MEMBERS"])) {
            await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: "DELETE" }).catch(() => {});
          } else {
            skipped.push("kick (Expulsar Membros)");
          }
        }
        if (acts.includes("ban")) {
          if (await this._hasBotPerms(guildId, ["BAN_MEMBERS"])) {
            await DiscordRequest(`/guilds/${guildId}/bans/${userId}`, {
              method: "PUT", body: { delete_message_seconds: 0 }
            }).catch(() => {});
          } else {
            skipped.push("ban (Banir Membros)");
          }
        }

        await this.sendSecurityAlert(guildId,
          `🛡️ **AutoMod — ${module}** — ${reason}\n` +
          `👤 <@${userId}> em <#${channelId}>\n` +
          `⚡ Ações: ${acts.join(", ")}${warnCount ? ` | Warns acumulados: ${warnCount}` : ""}` +
          (skipped.length ? `\n⚠️ Ação(ões) não executada(s) por falta de permissão: ${skipped.join(", ")}` : ""),
          "automod", module
        );
      };


      const capsCfg = s.anticaps;
      if (capsCfg?.enabled && !isIgnored(capsCfg)) {
        const min     = capsCfg.minLength || 10;
        const percent = capsCfg.percent   || 70;
        if (content.length >= min) {
          const letters   = content.replace(/[^a-zA-Z]/g, "");
          const upper     = content.replace(/[^A-Z]/g, "");
          const capsRatio = letters.length > 0 ? (upper.length / letters.length) * 100 : 0;
          if (capsRatio >= percent) {
            return await doActions(capsCfg.actions, `Abuso de CAPS (${Math.round(capsRatio)}%)`, "anticaps");
          }
        }
      }

      const emojiCfg = s.antiemoji;
      if (emojiCfg?.enabled && !isIgnored(emojiCfg)) {
        const max = emojiCfg.maxEmojis || 10;
        const unicodeMatches = content.match(/\p{Extended_Pictographic}/gu) || [];
        const customMatches  = content.match(/<a?:\w+:\d+>/g) || [];
        const total = unicodeMatches.length + customMatches.length;
        if (total > max) {
          return await doActions(emojiCfg.actions, `Excesso de emojis (${total}/${max})`, "antiemoji");
        }
      }

      const filesCfg = s.antifiles;
      if (filesCfg?.enabled && !isIgnored(filesCfg) && data.attachments?.length) {
        const blocked = (filesCfg.blockedExtensions || []).map(e => e.toLowerCase());
        const bad = data.attachments.find(att => {
          const ext = (att.filename || "").split(".").pop()?.toLowerCase();
          return ext && blocked.includes(ext);
        });
        if (bad) {
          const ext = bad.filename.split(".").pop().toLowerCase();
          return await doActions(filesCfg.actions, `Arquivo proibido: \`.${ext}\` (${bad.filename})`, "antifiles");
        }
      }

    } catch (err) { console.error("[Security] handleMessage:", err); }
  }

  async handleAutoModExecution(data) {
    try {
      const guildId = data.guild_id;
      const userId  = data.user_id;
      const ruleId  = data.rule_id;
      if (!guildId || !userId || !ruleId) return;

      const guild = await this.getGuild(guildId);
      const sec   = this.getSecurity(guild);
      const s     = sec.automod.simple;

      const moduleMap = [
        { key: "badwords",    cfg: s.badwords,    label: "Palavras Proibidas" },
        { key: "antispam",    cfg: s.antispam,    label: "Anti-Spam" },
        { key: "antimention", cfg: s.antimention, label: "Anti-Mass Mention" },
        { key: "antilinks",   cfg: s.antilinks,   label: s.antilinks?.invitesRuleId === ruleId ? "Convites" : "Links" },
      ];
      const match = moduleMap.find(m => m.cfg?.nativeRuleId === ruleId || m.cfg?.invitesRuleId === ruleId);
      if (!match) return; 

      const cfg = match.cfg;
      const acts = cfg.actions || [];
      const channelId = data.channel_id || null;

      let warnCount = 0;
      if (acts.includes("warn")) {
        warnCount = await this.addWarn(guildId, userId, `${match.label} (AutoMod nativo)`, this.client.clientId, channelId);
      }
      if (acts.includes("kick") && await this._hasBotPerms(guildId, ["KICK_MEMBERS"])) {
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: "DELETE" }).catch(() => {});
      }
      if (acts.includes("ban") && await this._hasBotPerms(guildId, ["BAN_MEMBERS"])) {
        await DiscordRequest(`/guilds/${guildId}/bans/${userId}`, {
          method: "PUT", body: { delete_message_seconds: 0 }
        }).catch(() => {});
      }

      await this.sendSecurityAlert(guildId,
        `🛡️ **AutoMod Nativo — ${match.label}** — regra do Discord acionada\n` +
        `👤 <@${userId}>${channelId ? ` em <#${channelId}>` : ""}\n` +
        `⚡ Ações extras aplicadas: ${acts.filter(a => ["warn", "kick", "ban"].includes(a)).join(", ") || "nenhuma (bloqueio já feito pelo Discord)"}` +
        (warnCount ? ` | Warns acumulados: ${warnCount}` : ""),
        "automod", match.key
      );
    } catch (err) {
      console.error("[Security] handleAutoModExecution:", err);
    }
  }

  async _applyEscalationAction(guildId, userId, action, channelId, gId) {
    try {
      if (action === "warn_message") {
        if (channelId) {
          if (await this._hasBotPerms(gId, ["SEND_MESSAGES"], channelId)) {
            await DiscordRequest(`/channels/${channelId}/messages`, {
              method: "POST",
              body: { content: `⚠️ <@${userId}>, atenção ao comportamento no servidor.`, flags: 0 }
            }).catch(() => {});
          } else {
            await this._ensurePerms(gId, ["SEND_MESSAGES"], channelId, "enviar o aviso de escalonamento no canal");
          }
        }
        return;
      }

      if (action === "timeout_10m" || action === "timeout_1h" || action === "timeout_24h") {
        if (await this._hasBotPerms(gId, ["MODERATE_MEMBERS"])) {
          let ms = 600000;
          if (action === "timeout_1h")  ms = 3600000;
          if (action === "timeout_24h") ms = 86400000;
          const until = new Date(Date.now() + ms).toISOString();
          await DiscordRequest(`/guilds/${gId}/members/${userId}`, {
            method: "PATCH", body: { communication_disabled_until: until }
          }).catch(() => {});
        } else {
          await this._ensurePerms(gId, ["MODERATE_MEMBERS"], null, "aplicar timeout via escalonamento de warns");
        }
        return;
      }

      if (action === "kick") {
        if (await this._hasBotPerms(gId, ["KICK_MEMBERS"])) {
          await DiscordRequest(`/guilds/${gId}/members/${userId}`, { method: "DELETE" }).catch(() => {});
        } else {
          await this._ensurePerms(gId, ["KICK_MEMBERS"], null, "expulsar o membro via escalonamento de warns");
        }
        return;
      }

      if (action === "ban") {
        if (await this._hasBotPerms(gId, ["BAN_MEMBERS"])) {
          await DiscordRequest(`/guilds/${gId}/bans/${userId}`, {
            method: "PUT", body: { delete_message_seconds: 0 }
          }).catch(() => {});
        } else {
          await this._ensurePerms(gId, ["BAN_MEMBERS"], null, "banir o membro via escalonamento de warns");
        }
        return;
      }
    } catch (err) { console.error("[Security] _applyEscalationAction:", err); }
  }

  async sendSecurityAlert(guildId, message, category = "security", subKey = null) {
    try {
      const guild = await this.getGuild(guildId);
      const sec   = this.getSecurity(guild);

      if (sec.logs.types[category] === false) return;

      let channelId = null;
      if (subKey && await this.hasAdvancedSystemsAccess(guildId)) {
        channelId = sec.logs.channels[`${category}_${subKey}`] || null;
      }
      channelId = channelId || sec.logs.channels[category] || sec.logs.channels.main;
      if (!channelId) return;

      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: "POST",
        body: { embeds: [{ description: message, color: 0xED4245, timestamp: new Date().toISOString() }] }
      });
    } catch (err) { console.error("[Security] sendSecurityAlert:", err); }
  }

}

module.exports = SecuritySystem;
