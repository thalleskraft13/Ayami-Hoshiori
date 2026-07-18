'use strict';

const { GuildDb } = require("../../Mongodb/guild.js");
const DiscordRequest = require("../DiscordRequest.js");
const PremiumManager = require("../Utils/PremiumManager.js");
const getPerm = require("../Utils/Permission.js");
const TTLCache = require("../Utils/TTLCache.js");
const NativeAutoMod = require("./Security/NativeAutoMod.js");

// Módulos de Filtro cuja detecção acontece via Discord AutoMod nativo
// (ver Security/NativeAutoMod.js) — o restante (anticaps, antiemoji,
// antifiles) não tem equivalente na API do Discord e continua sendo
// detecção própria da Ayami em handleMessage().
const NATIVE_FILTER_MODULES = ["badwords", "antispam", "antilinks", "antimention"];

class SecuritySystem {

  constructor(client) {
    this.client = client;
    this._joinTracker   = {};
    this._spamTracker   = {};
    this._botPermCache  = new TTLCache({ ttlMs: 60_000, sweepIntervalMs: 5 * 60_000 });
    this.nativeAutoMod  = new NativeAutoMod(client);
  }

  /**
   * Sincroniza a regra nativa de AutoMod do Discord para um módulo de
   * Filtro (badwords/antispam/antilinks/antimention), a partir da config
   * atual salva em `sec.automod.simple[module]`, e persiste o
   * `nativeRuleId` retornado. Chame sempre depois de alterar toggle,
   * ações, listas ou limites de um desses módulos.
   */
  async _syncNativeModule(guild, module) {
    if (!NATIVE_FILTER_MODULES.includes(module)) return;
    const sec = this.getSecurity(guild);
    const cfg = sec.automod.simple[module];
    if (!cfg) return;

    try {
      if (module === "badwords")    await this.nativeAutoMod.syncBadwords(guild.guildId, cfg);
      if (module === "antispam")    await this.nativeAutoMod.syncAntispam(guild.guildId, cfg);
      if (module === "antimention") await this.nativeAutoMod.syncAntimention(guild.guildId, cfg);
      if (module === "antilinks") {
        await this.nativeAutoMod.syncAntilinks(guild.guildId, cfg);
        await this.nativeAutoMod.syncInvites(guild.guildId, cfg);
      }
    } catch (err) {
      console.error(`[Security] Falha ao sincronizar AutoMod nativo (${module}):`, err);
    }

    guild.markModified("security");
    await this.save(guild);
  }

  /* ================= INTERACTIONS ================= */

  /**
   * Converte um payload legado ({embeds, components}) para o formato
   * Components V2 ({flags: 32768, components: [Container]}).
   *
   * ⚠️ Bug raiz do "menu de segurança não abre": a mensagem inicial do
   * /configurar já é enviada com a flag IS_COMPONENTS_V2 (32768) — e essa
   * flag, uma vez definida, NUNCA pode ser removida da mensagem (é
   * permanente, por design da API do Discord). Todo o resto do bot
   * (Tickets, UID, Logic Builder) já usa Components V2 consistentemente;
   * só o SecuritySystem.js ainda montava `embeds:` — e a API rejeita
   * silenciosamente qualquer PATCH com `embeds` numa mensagem já
   * flagada como V2, então o `editOriginal` falhava e o menu nunca
   * era atualizado (parecia "não abrir").
   *
   * Em vez de reescrever as ~60 telas deste arquivo uma por uma, a
   * conversão acontece aqui, uma única vez, no ponto de saída — todas
   * as telas continuam definindo `embeds`/`components` normalmente.
   */
  _toV2(data) {
    if (!data) return data;
    if (!data.embeds) {
      // Já não usa embeds — só garante que a flag V2 está presente.
      return { ...data, flags: (data.flags ?? 0) | 32768 };
    }

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
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: "PATCH", body: this._toV2(data) }
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

  /* ================= DATABASE ================= */

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
        activity:   {},
        backups:    []
      };
    }
    if (!guild.security.emergency)                 guild.security.emergency = { active: false, channelSnapshot: [] };
    if (!guild.security.emergency.channelSnapshot) guild.security.emergency.channelSnapshot = [];
    if (!guild.security.backups)                   guild.security.backups = [];
    if (!guild.security.automod.advanced.warns)    guild.security.automod.advanced.warns = [];
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

  /* ================= PERMISSÕES DO BOT ================= */

  // Tradução amigável dos nomes de permissão (PT-BR)
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

  // Busca (com cache de 60s) as permissões do bot no servidor ou em um canal específico
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
      this._botPermCache.set(key, perms); // TTL padrão de 60s
      return perms;
    } catch (err) {
      console.error("[Security] _getBotPermissions:", err);
      return [];
    }
  }

  // Limpa o cache de permissões (útil após criar canais/cargos via backup, por ex.)
  _clearBotPermCache(guildId) {
    this._botPermCache.deleteWhere(key => key === guildId || key.startsWith(`${guildId}:`));
  }

  // Retorna true se o bot tem TODAS as permissões necessárias
  async _hasBotPerms(guildId, required, channelId = null) {
    const perms = await this._getBotPermissions(guildId, channelId);
    if (perms.includes("ADMINISTRATOR")) return true;
    return required.every(p => perms.includes(p));
  }

  // Retorna a lista de permissões faltando
  async _missingBotPerms(guildId, required, channelId = null) {
    const perms = await this._getBotPermissions(guildId, channelId);
    if (perms.includes("ADMINISTRATOR")) return [];
    return required.filter(p => !perms.includes(p));
  }

  // Para fluxos de UI: verifica permissão e, se faltar, avisa o usuário e volta ao menu.
  // Retorna true se OK, false se faltou (e já tratou a resposta).
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

  // Para fluxos automáticos (gateway/automod): se faltar permissão, envia alerta no log e retorna false.
  async _ensurePerms(guildId, required, channelId, contextLabel) {
    const missing = await this._missingBotPerms(guildId, required, channelId);
    if (missing.length) {
      await this.sendSecurityAlert(guildId,
        `⚠️ **Permissão insuficiente** para ${contextLabel}.\n` +
        `Faltando: ${missing.map(p => `\`${this._permLabel(p)}\``).join(", ")}\n` +
        `> Ajuste o cargo do bot para que o sistema de segurança funcione corretamente.`
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

  /* ================= MAIN PANEL ================= */

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
        { label: "🚨 Detecção de Raid",            value: "raid_detection"    },
        { label: "🔒 Modo Emergência",             value: "emergency_mode"    },
        { label: "🧬 Monitoramento de Alterações", value: "monitoring"        },
        { label: "🤖 Bots Suspeitos",              value: "bot_analysis"      },
        { label: "📊 Atividade do Servidor",       value: "activity"          },
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
        if (v === "raid_detection")    return this.raidDetection(i, guild, user);
        if (v === "emergency_mode")    return this.emergencyMode(i, guild, user);
        if (v === "monitoring")        return this.monitoringSystem(i, guild, user);
        if (v === "bot_analysis")      return this.botAnalysis(i, guild, user);
        if (v === "activity")          return this.activitySystem(i, guild, user);
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

  /* ================= 1. AUTOMOD SIMPLES ================= */

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

  /* ─── HELPER: WARN ESCALATION CONFIG ─── */

  // Returns default escalation ladder
  _defaultEscalation() {
    return [
      { warns: 1, action: "warn_message" },
      { warns: 2, action: "timeout_10m"  },
      { warns: 3, action: "timeout_1h"   },
      { warns: 5, action: "kick"         },
      { warns: 7, action: "ban"          }
    ];
  }

  // Shows and lets user configure the warn escalation table for a module
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
        // Replace if level already exists
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

  /* ─── HELPER: MULTI-ACTION CONFIG ─── */

  // Shows current actions and lets user pick multiple
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
        await this._syncNativeModule(guild, module);
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

  /* ─── PALAVRAS PROIBIDAS ─── */

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
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle") {
          cfg.enabled = !cfg.enabled;
          guild.markModified("security");
          await this.save(guild);
          await this._syncNativeModule(guild, "badwords");
          return this.badwordsMenu(i, guild, user);
        }
        if (v === "add")        return this.addBadword(i, guild, user);
        if (v === "remove")     return this.removeBadword(i, guild, user);
        if (v === "view")       return this.viewSimpleList(i, guild, user, "badwords", "list", "📋 Palavras Proibidas");
        if (v === "clear") {
          cfg.list = [];
          guild.markModified("security");
          await this.save(guild);
          await this._syncNativeModule(guild, "badwords");
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
    await this.followUpEphemeral(interaction, {
      content: "Envie as palavras proibidas:\n> Separe por vírgula. Ex: `termo1, frase ruim, xingamento`"
    });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }

    const sec  = this.getSecurity(guild);
    const cfg  = this.getSimpleCfg(sec, "badwords");
    if (!cfg.list) cfg.list = [];

    const words = msg.content
      .split(",")
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0 && !cfg.list.includes(w));

    cfg.list.push(...words);
    guild.markModified("security");
    await this.save(guild);
    await this._syncNativeModule(guild, "badwords");

    await this.followUpEphemeral(interaction, {
      content: `✅ ${words.length} palavra(s) adicionada(s): ${words.map(w => `\`${w}\``).join(", ")}`
    });
    return this.badwordsMenu(interaction, guild, user);
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
        await this._syncNativeModule(guild, "badwords");
        await this.followUpEphemeral(i, { content: `✅ \`${i.data.values[0]}\` removida.` });
        return this.badwordsMenu(i, guild, user);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione a palavra para remover:",
      components: [this.row(select)]
    });
  }

  /* ─── ANTI-SPAM ─── */

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
          await this._syncNativeModule(guild, "antispam");
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

  /* ─── ANTI-CAPS ─── */

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

  /* ─── ANTI-EMOJI (sem equivalente nativo — detecção própria da Ayami) ─── */

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

  /* ─── ANTI-FILES (arquivos proibidos — sem equivalente nativo) ─── */

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

  /* ─── ANTI-LINKS ─── */

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
          await this._syncNativeModule(guild, "antilinks");
          return this.antilinksMenu(i, guild, user);
        }
        if (v === "toggle_invites") {
          cfg.blockInvites = !cfg.blockInvites;
          guild.markModified("security");
          await this.save(guild);
          await this._syncNativeModule(guild, "antilinks");
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
          await this._syncNativeModule(guild, "antilinks");
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
    await this._syncNativeModule(guild, "antilinks");
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
        await this._syncNativeModule(guild, "antilinks");
        await this.followUpEphemeral(i, { content: `✅ \`${i.data.values[0]}\` removido.` });
        return this.manageDomainList(i, guild, user, listKey, title);
      }
    );

    return this.followUpEphemeral(interaction, {
      content: "Selecione o domínio:",
      components: [this.row(select)]
    });
  }

  /* ─── ANTI-MASS MENTION ─── */

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
          await this._syncNativeModule(guild, "antimention");
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
    await this._syncNativeModule(guild, "antimention");
    await this.followUpEphemeral(interaction, { content: `✅ Limite: ${limit} menções.` });
    return this.antimentionMenu(interaction, guild, user);
  }

  /* ─── IGNORED LISTS ─── */

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
          await this._syncNativeModule(guild, module);
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
              await this._syncNativeModule(guild, module);
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
          await this._syncNativeModule(guild, module);
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

  /* ================= 2. AUTOMOD AVANÇADO ================= */

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

  // Retorna o rótulo amigável de uma ação de escalonamento
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

    // Identifica o módulo a partir do prefixo "modulo: motivo"
    const moduleName = reason.includes(":") ? reason.split(":")[0].trim() : "manual";

    sec.automod.advanced.warns.push({
      userId:    targetUserId,
      reason,
      moderator: moderatorId,
      date:      new Date().toISOString(),
      module:    moduleName
    });

    const warnCount = sec.automod.advanced.warns.filter(w => w.userId === targetUserId).length;

    // Estado de escalonamento já aplicado (evita repetir a mesma punição)
    if (!sec.automod.advanced.escalationState) sec.automod.advanced.escalationState = {};
    if (!sec.automod.advanced.escalationState[targetUserId]) sec.automod.advanced.escalationState[targetUserId] = {};
    const state = sec.automod.advanced.escalationState[targetUserId];

    // ── Escalonamento por módulo ──
    if (sec.automod.simple[moduleName]) {
      const cfg   = this.getSimpleCfg(sec, moduleName);
      const table = (cfg.escalation || []).map(e => ({ warns: Number(e.warns), action: e.action }));

      // Pega o maior nível cujo requisito já foi atingido (warns <= warnCount)
      const tier = table
        .filter(e => e.warns <= warnCount)
        .sort((a, b) => b.warns - a.warns)[0];

      const last = state[moduleName] || 0;

      if (tier && tier.warns > last) {
        state[moduleName] = tier.warns;
        await this._applyEscalationAction(guildId, targetUserId, tier.action, channelId, guildId);
        await this.sendSecurityAlert(guildId,
          `⚖️ **Escalonamento (${moduleName})** — <@${targetUserId}> atingiu ${warnCount} warn(s) → ${this._actionLabel(tier.action)}`
        );
      }
    }

    // ── Escalonamento global (acumulado entre todos os módulos) ──
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
          `⚖️ **Escalonamento Global** — <@${targetUserId}> atingiu ${warnCount} warn(s) (total) → ${this._actionLabel(tier.action)}`
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

    // Group by user
    const grouped = {};
    for (const w of all) {
      if (!grouped[w.userId]) grouped[w.userId] = [];
      grouped[w.userId].push(w);
    }

    // Sort by warn count descending, show last 20 warns overall
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

    // Paginate: show page 1 by default (users overview)
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

  /* ================= 3. CARGOS E PERMISSÕES ================= */

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

  /* ================= 4. LOGS ================= */

  async logsMenu(interaction, guild, user) {
    const sec    = this.getSecurity(guild);
    const logCfg = sec.logs;

    const select = this.select(
      user,
      [
        { label: `Modo: ${logCfg.mode === "single" ? "Canal Único" : "Múltiplos Canais"}`, value: "toggle_mode"      },
        { label: "📋 Definir Canal Principal",                                              value: "set_main_channel" },
        { label: "⚙️ Configurar Tipos de Log",                                             value: "log_types"        },
        { label: "📅 Histórico de Warns (Discord)",                                        value: "log_history"      },
        { label: "📤 Exportar Warns (JSON)",                                               value: "export"           }
      ],
      "Configurar Logs",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle_mode")      return this.toggleLogMode(i, guild, user);
        if (v === "set_main_channel") return this.setLogChannel(i, guild, user, "main");
        if (v === "log_types")        return this.logTypesMenu(i, guild, user);
        if (v === "log_history")      return this.logHistory(i, guild, user);
        if (v === "export")           return this.exportLogs(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📜 Sistema de Logs",
        description:
          `**Modo:** ${logCfg.mode === "single" ? "Canal Único" : "Múltiplos Canais"}\n` +
          `**Canal Principal:** ${logCfg.channels.main ? `<#${logCfg.channels.main}>` : "Não definido"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async toggleLogMode(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    sec.logs.mode = sec.logs.mode === "single" ? "multi" : "single";
    guild.markModified("security");
    await this.save(guild);
    return this.logsMenu(interaction, guild, user);
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

    // Verifica se o bot consegue enviar mensagens/embeds nesse canal
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
      logTypes.map(t => ({ label: `${types[t.key] ? "🟢" : "🔴"} ${t.label}`, value: t.key })),
      "Ativar/Desativar",
      async (i) => {
        await this.deferUpdate(i);
        if (!sec.logs.types) sec.logs.types = {};
        sec.logs.types[i.data.values[0]] = !sec.logs.types[i.data.values[0]];
        guild.markModified("security");
        await this.save(guild);
        return this.logTypesMenu(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "⚙️ Tipos de Log",
        description: logTypes.map(t => `${types[t.key] ? "🟢" : "🔴"} **${t.label}**`).join("\n")
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
    // Discord message limit: 2000 chars. Split if needed.
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

    // Show last 20 events grouped by date
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

  /* ================= 5. VERIFICAÇÃO DE PERMISSÕES ================= */

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
    const MANAGE_ROLES  = 1n << 28n; // também = "Gerenciar Permissões" no contexto de canal
    const ADMIN         = 1n << 3n;
    const MANAGE_GUILD  = 1n << 5n;
    const BAN           = 1n << 2n;
    const KICK          = 1n << 1n;
    const THREADS       = 1n << 35n;
    const MANAGE_WEBHOOKS = 1n << 29n;
    const MANAGE_MSG    = 1n << 13n;

    const risks      = [];
    const immuneRoles = sec.roles.immune || [];

    // ── Mapa de nomes de cargos (para exibir nomes em vez de só menções) ──
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

    // Permissões perigosas relevantes a nível de CANAL (via overwrite de cargo)
    const CHANNEL_DANGEROUS = [
      { flag: ADMIN,          label: "Administrador"            },
      { flag: MANAGE_CH,      label: "Gerenciar Canal"           },
      { flag: MANAGE_ROLES,   label: "Gerenciar Permissões"      },
      { flag: MENTION_ALL,    label: "Mencionar @everyone"       },
      { flag: MANAGE_WEBHOOKS,label: "Gerenciar Webhooks"        },
      { flag: MANAGE_MSG,     label: "Gerenciar Mensagens"       }
    ];

    // ── 1. Verificação de canais (acesso geral do @everyone) ──
    for (const ch of channels) {
      if (ch.type !== 0 && ch.type !== 5) continue;
      const ow   = (ch.permission_overwrites || []).find(o => o.id === guildId);
      let   bits = everyoneBits;
      bits &= ~BigInt(ow?.deny  || 0);
      bits |=  BigInt(ow?.allow || 0);
      if ((bits & VIEW) !== VIEW) continue;
      if ((bits & THREADS) === THREADS) risks.push(`⚠️ <#${ch.id}> — Todos podem criar tópicos`);
    }

    // ── 2. Verificação de permissões globais por cargo ──
    for (const role of roles) {
      if (role.id === guildId) continue;
      if (role.managed)        continue;
      if (staffRoles.includes(role.id))  continue;
      if (immuneRoles.includes(role.id)) continue;
      const bits  = BigInt(role.permissions);
      const found = DANGEROUS.filter(d => (bits & d.flag) === d.flag).map(d => d.label);
      if (found.length) risks.push(`⚠️ <@&${role.id}> (${roleMap[role.id] || role.id}) — ${found.join(", ")}`);
    }

    // ── 3. Verificação de overwrites de cargos por canal (permissões concedidas localmente) ──
    for (const ch of channels) {
      // categorias (4), texto (0), voz (2), anúncios (5), fórum (15) — todos relevantes
      if (![0, 2, 4, 5, 13, 15].includes(ch.type)) continue;

      for (const ow of (ch.permission_overwrites || [])) {
        if (ow.type !== 0) continue;          // somente overwrites de CARGO
        if (ow.id === guildId) continue;      // @everyone já tratado acima
        if (staffRoles.includes(ow.id))  continue;
        if (immuneRoles.includes(ow.id)) continue;

        const role = roles.find(r => r.id === ow.id);
        if (role?.managed) continue;          // cargos de bots gerenciados

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

  /* ================= 6. DETECÇÃO DE RAID ================= */

  async raidDetection(interaction, guild, user) {
    const sec = this.getSecurity(guild);
    const cfg = sec.raid;

    const actionLabels = {
      nothing:  "Apenas alertar",
      timeout:  "Timeout (1h)",
      kick:     "Kick",
      ban:      "Ban",
      lockdown: "Lockdown do servidor"
    };

    const select = this.select(
      user,
      [
        { label: `${cfg.enabled ? "🟢" : "🔴"} Detecção de Raid`,                      value: "toggle"           },
        { label: `⚙️ Limite: ${cfg.joinLimit || 10} joins/min`,                          value: "set_join_limit"   },
        { label: `⚡ Ação: ${actionLabels[cfg.action || "nothing"]}`,                    value: "set_action"       },
        { label: `🔒 Lockdown Automático: ${cfg.autoLockdown ? "🟢" : "🔴"}`,           value: "auto_lockdown"    },
        { label: `🚨 Alertas Antecipados: ${cfg.earlyAlerts  ? "🟢" : "🔴"}`,           value: "early_alerts"     },
        { label: "📊 Ver Histórico de Raids",                                            value: "raid_history"     }
      ],
      "Configurar Raid",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "toggle")         return this.toggleRaid(i, guild, user);
        if (v === "set_join_limit") return this.setRaidJoinLimit(i, guild, user);
        if (v === "set_action")     return this.setRaidAction(i, guild, user);
        if (v === "auto_lockdown")  return this.autoLockdown(i, guild, user);
        if (v === "early_alerts")   return this.earlyAlerts(i, guild, user);
        if (v === "raid_history")   return this.raidHistory(i, guild, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: "🚨 Detecção de Raid",
        description:
          `**Status:** ${cfg.enabled ? "🟢 Ativo" : "🔴 Inativo"}\n` +
          `**Limite:** ${cfg.joinLimit || 10} joins/min\n` +
          `**Ação:** ${actionLabels[cfg.action || "nothing"]}\n` +
          `**Lockdown Auto:** ${cfg.autoLockdown ? "🟢" : "🔴"}\n` +
          `**Alertas Antecipados:** ${cfg.earlyAlerts ? "🟢" : "🔴"}`
      }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async raidHistory(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.raid.history || [];

    if (!history.length) {
      return this.editOriginal(interaction, {
        embeds: [{ title: "📊 Histórico de Raids", description: "Nenhum raid detectado até agora." }],
        components: [this.row(this.backBtn(user, (i) => this.raidDetection(i, guild, user)))]
      });
    }

    const lines = history
      .slice(-10)
      .reverse()
      .map(r =>
        `🚨 **${new Date(r.timestamp).toLocaleString("pt-BR")}**\n` +
        `└ ${r.count} joins/min | Ação: ${r.action}`
      )
      .join("\n\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📊 Histórico de Raids (últimos 10)", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.raidDetection(i, guild, user)))]
    });
  }

  async setRaidAction(interaction, guild, user) {
    const select = this.select(
      user,
      [
        { label: "🔔 Apenas alertar",       value: "nothing"  },
        { label: "⏱️ Timeout (1h)",         value: "timeout"  },
        { label: "👢 Kick",                 value: "kick"     },
        { label: "🔨 Ban",                  value: "ban"      },
        { label: "🔒 Lockdown do servidor", value: "lockdown" }
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
      content: "Selecione o que acontece quando um raid for detectado:",
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

  async setRaidJoinLimit(interaction, guild, user) {
    await this.followUpEphemeral(interaction, { content: "Limite de joins por minuto (ex: `10`):" });
    let msg;
    try { msg = await this.client.NextMessageCollector.wait({ channelId: interaction.channel_id, userId: user }); } catch { return; }
    const limit = parseInt(msg.content);
    if (isNaN(limit) || limit < 1) return this.followUpEphemeral(interaction, { content: "❌ Inválido." });
    const sec = this.getSecurity(guild);
    sec.raid.joinLimit = limit;
    guild.markModified("security");
    await this.save(guild);
    await this.followUpEphemeral(interaction, { content: `✅ Limite: ${limit}/min.` });
    return this.raidDetection(interaction, guild, user);
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

  /* ================= 7. MODO EMERGÊNCIA ================= */

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
      // Verifica permissão antes de tentar alterar overwrites de canais
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
        await this.sendSecurityAlert(guild.guildId, `✅ **Modo emergência desativado automaticamente** após ${minutes} minutos.`);
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

  // Helper to log emergency events
  _logEmergencyEvent(guild, event) {
    const sec = this.getSecurity(guild);
    if (!sec.emergency) sec.emergency = {};
    if (!sec.emergency.logs) sec.emergency.logs = [];
    sec.emergency.logs.push({ timestamp: Date.now(), event });
    // Keep last 50 events
    if (sec.emergency.logs.length > 50) sec.emergency.logs = sec.emergency.logs.slice(-50);
  }

  /* ================= 8. MONITORAMENTO ================= */

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

    // Group by day
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

  // Helper to log monitoring events
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

  /* ================= 9. BOTS SUSPEITOS ================= */

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

  /* ================= 10. ATIVIDADE ================= */

  async activitySystem(interaction, guild, user) {
    const select = this.select(
      user,
      [
        { label: "📊 Ver Score de Atividade",    value: "activity_score"    },
        { label: "📅 Histórico de Atividade",    value: "activity_history"  },
        { label: "📈 Previsão de Atividade",     value: "activity_forecast" },
        { label: "🏆 Ranking de Usuários",       value: "user_ranking"      },
        { label: "💀 Canais Mortos",             value: "dead_channels"     }
      ],
      "Atividade",
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === "activity_score")    return this.activityScore(i, guild, user);
        if (v === "activity_history")  return this.activityHistory(i, guild, user);
        if (v === "activity_forecast") return this.activityForecast(i, guild, user);
        if (v === "user_ranking")      return this.userRanking(i, guild, user);
        if (v === "dead_channels")     return this.deadChannels(i, guild, user);
      }
    );
    return this.editOriginal(interaction, {
      embeds: [{ title: "📊 Atividade do Servidor", description: "Analise o engajamento dos membros." }],
      components: [
        this.row(select),
        this.row(this.backBtn(user, (i) => this.startSetup(i)))
      ]
    });
  }

  async activityScore(interaction, guild, user) {
    const guildData = await DiscordRequest(`/guilds/${interaction.guild_id}?with_counts=true`);
    const total     = guildData.approximate_member_count   || 0;
    const online    = guildData.approximate_presence_count || 0;
    const score     = Math.max(0, Math.min(100, Math.round(total > 0 ? (online / total) * 100 : 0)));
    const label     = score < 30 ? "💀 Morto" : score < 60 ? "😐 Fraco" : score < 80 ? "✅ Saudável" : "🔥 Muito Ativo";
    return this.editOriginal(interaction, {
      embeds: [{
        title: "📊 Score de Atividade",
        description:
          `**Score:** ${score}/100 — ${label}\n\n` +
          `**Online agora:** ${online}\n` +
          `**Total de membros:** ${total}\n` +
          `**Taxa de presença:** ${total > 0 ? ((online / total) * 100).toFixed(1) : 0}%`,
        color: score < 30 ? 0xED4245 : score < 60 ? 0xFEE75C : score < 80 ? 0x57F287 : 0x00FF88
      }],
      components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
    });
  }

  async activityHistory(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.activity.history || [];

    if (!history.length) {
      return this.editOriginal(interaction, {
        embeds: [{
          title: "📅 Histórico de Atividade",
          description:
            "Nenhum dado histórico disponível ainda.\n\n" +
            "> O bot registra snapshots de atividade automaticamente a cada 24h quando membros interagem."
        }],
        components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
      });
    }

    const lines = history
      .slice(-14)
      .map(h => `**${h.date}** — Online: ${h.online}/${h.total} (${h.score}%)`)
      .join("\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "📅 Histórico de Atividade (14 dias)", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
    });
  }

  async activityForecast(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const history = sec.activity.history || [];

    if (history.length < 3) {
      return this.editOriginal(interaction, {
        embeds: [{
          title: "📈 Previsão de Atividade",
          description: "Dados insuficientes. É necessário ao menos 3 dias de histórico para gerar previsão."
        }],
        components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
      });
    }

    // Simple linear trend
    const recent = history.slice(-7);
    const avg    = recent.reduce((s, h) => s + h.score, 0) / recent.length;
    const trend  = recent[recent.length - 1].score - recent[0].score;
    const next   = Math.max(0, Math.min(100, avg + (trend / recent.length)));
    const label  = trend > 5 ? "📈 Crescendo" : trend < -5 ? "📉 Caindo" : "➡️ Estável";

    return this.editOriginal(interaction, {
      embeds: [{
        title: "📈 Previsão de Atividade",
        description:
          `**Tendência:** ${label}\n` +
          `**Média recente:** ${avg.toFixed(1)}%\n` +
          `**Variação nos últimos ${recent.length} dias:** ${trend > 0 ? "+" : ""}${trend.toFixed(1)}%\n` +
          `**Previsão próximos dias:** ~${next.toFixed(1)}%`
      }],
      components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
    });
  }

  async userRanking(interaction, guild, user) {
    const sec     = this.getSecurity(guild);
    const ranking = sec.activity.ranking || [];

    if (!ranking.length) {
      return this.editOriginal(interaction, {
        embeds: [{
          title: "🏆 Ranking de Usuários",
          description:
            "Nenhum dado de ranking disponível ainda.\n\n" +
            "> O ranking é atualizado conforme os membros interagem no servidor."
        }],
        components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
      });
    }

    const lines = ranking
      .slice(0, 10)
      .map((r, i) => `**${i + 1}.** <@${r.userId}> — ${r.messages} msg(s) | ${r.lastSeen ? `Último: ${r.lastSeen}` : ""}`)
      .join("\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "🏆 Top 10 Usuários Ativos", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
    });
  }

  async deadChannels(interaction, guild, user) {
    const sec      = this.getSecurity(guild);
    const dead     = sec.activity.deadChannels || [];
    const channels = await DiscordRequest(`/guilds/${interaction.guild_id}/channels`);
    const textChs  = channels.filter(c => c.type === 0);

    // Use stored data if available, otherwise show all text channels sorted by name
    if (!dead.length) {
      return this.editOriginal(interaction, {
        embeds: [{
          title: "💀 Canais Mortos",
          description:
            `**Total de canais de texto:** ${textChs.length}\n\n` +
            "> Nenhum dado de atividade por canal registrado ainda.\n" +
            "> O bot rastreia atividade por canal conforme mensagens são enviadas."
        }],
        components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
      });
    }

    const lines = dead
      .slice(0, 10)
      .map(c => `💀 <#${c.channelId}> — Último: ${c.lastMessage ? new Date(c.lastMessage).toLocaleDateString("pt-BR") : "nunca"}`)
      .join("\n");

    return this.editOriginal(interaction, {
      embeds: [{ title: "💀 Canais Sem Atividade", description: lines }],
      components: [this.row(this.backBtn(user, (i) => this.activitySystem(i, guild, user)))]
    });
  }

  // Helper: track message activity per channel and user
  async _trackActivity(guildId, channelId, userId) {
    try {
      const guild = await this.getGuild(guildId);
      const sec   = this.getSecurity(guild);
      if (!sec.activity.channelActivity) sec.activity.channelActivity = {};
      if (!sec.activity.userActivity)    sec.activity.userActivity    = {};
      if (!sec.activity.ranking)         sec.activity.ranking         = [];

      sec.activity.channelActivity[channelId] = Date.now();

      // Update user ranking
      const existing = sec.activity.ranking.find(r => r.userId === userId);
      if (existing) {
        existing.messages++;
        existing.lastSeen = new Date().toLocaleDateString("pt-BR");
      } else {
        sec.activity.ranking.push({ userId, messages: 1, lastSeen: new Date().toLocaleDateString("pt-BR") });
      }
      sec.activity.ranking.sort((a, b) => b.messages - a.messages);
      if (sec.activity.ranking.length > 100) sec.activity.ranking = sec.activity.ranking.slice(0, 100);

      guild.markModified("security");
      await this.save(guild);
    } catch (err) { /* non-critical */ }
  }

  /* ================= 11. BACKUP DO SERVIDOR ================= */

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

      // ── ROLES ──
      for (const role of roles) {
        if (role.managed) continue; // skip bot-managed roles

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

      // ── CATEGORIES ──
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

      // ── CHANNELS ──
      for (const ch of channels) {
        if (ch.type === 4) continue; // categories handled separately

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
    // Verifica permissão ANTES de qualquer alteração visível
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

      // Fetch current state
      const [currentChannels, currentRoles] = await Promise.all([
        DiscordRequest(`/guilds/${guildId}/channels`),
        DiscordRequest(`/guilds/${guildId}/roles`)
      ]);

      let restored = 0;
      let created  = 0;
      let errors   = 0;

      // ── RESTORE ROLES ──
      for (const role of backup.roles) {
        if (role.id === guildId) continue; // skip @everyone

        const existing = currentRoles.find(r => r.id === role.id);

        if (existing) {
          // Update existing role
          try {
            await DiscordRequest(`/guilds/${guildId}/roles/${role.id}`, {
              method: "PATCH",
              body: {
                name:        role.name,
                color:       role.color,
                hoist:       role.hoist,
                permissions: role.permissions,
                mentionable: role.mentionable
              }
            });
            restored++;
          } catch { errors++; }
        } else {
          // Recreate the role
          try {
            await DiscordRequest(`/guilds/${guildId}/roles`, {
              method: "POST",
              body: {
                name:        role.name,
                color:       role.color,
                hoist:       role.hoist,
                permissions: role.permissions,
                mentionable: role.mentionable
              }
            });
            created++;
          } catch { errors++; }
        }
      }

      // ── RESTORE CATEGORIES ──
      for (const cat of (backup.categories || [])) {
        const existing = currentChannels.find(c => c.id === cat.id);

        if (existing) {
          try {
            await DiscordRequest(`/channels/${cat.id}`, {
              method: "PATCH",
              body: { name: cat.name, position: cat.position }
            });
            // Restore category permission overwrites
            for (const ow of cat.permission_overwrites) {
              await DiscordRequest(`/channels/${cat.id}/permissions/${ow.id}`, {
                method: "PUT",
                body: { id: ow.id, type: ow.type, allow: ow.allow, deny: ow.deny }
              }).catch(() => {});
            }
            restored++;
          } catch { errors++; }
        } else {
          // Recreate the category
          try {
            await DiscordRequest(`/guilds/${guildId}/channels`, {
              method: "POST",
              body: {
                name:     cat.name,
                type:     4,
                position: cat.position,
                permission_overwrites: cat.permission_overwrites
              }
            });
            created++;
          } catch { errors++; }
        }
      }

      // ── RESTORE CHANNELS ──
      for (const ch of backup.channels) {
        const existing = currentChannels.find(c => c.id === ch.id);

        if (existing) {
          // Update existing channel permissions
          try {
            await DiscordRequest(`/channels/${ch.id}`, {
              method: "PATCH",
              body: {
                name:                ch.name,
                topic:               ch.topic,
                nsfw:                ch.nsfw,
                rate_limit_per_user: ch.slowmode_delay
              }
            });
            for (const ow of ch.permission_overwrites) {
              await DiscordRequest(`/channels/${ch.id}/permissions/${ow.id}`, {
                method: "PUT",
                body: { id: ow.id, type: ow.type, allow: ow.allow, deny: ow.deny }
              }).catch(() => {});
            }
            restored++;
          } catch { errors++; }
        } else {
          // Recreate the channel
          try {
            const body = {
              name:                ch.name,
              type:                ch.type,
              position:            ch.position,
              nsfw:                ch.nsfw,
              rate_limit_per_user: ch.slowmode_delay,
              permission_overwrites: ch.permission_overwrites
            };
            if (ch.topic) body.topic = ch.topic;
            await DiscordRequest(`/guilds/${guildId}/channels`, { method: "POST", body });
            created++;
          } catch { errors++; }
        }
      }

      // Limpa o cache de permissões: canais/cargos podem ter sido criados/alterados
      this._clearBotPermCache(guildId);

      await this.sendSecurityAlert(guildId,
        `♻️ **Backup restaurado!**\n` +
        `ID: \`${backupId}\`\n` +
        `✅ ${restored} atualizado(s) | 🆕 ${created} recriado(s) | ❌ ${errors} erro(s)`
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

  /* ================= 12. VERIFICAÇÃO COMPLETA ================= */

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

  /* ================= GATEWAY HANDLERS ================= */

  async handleMemberJoin(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.raid.enabled) return;

      const gId = data.guild_id;
      const now = Date.now();
      if (!this._joinTracker[gId]) this._joinTracker[gId] = [];
      this._joinTracker[gId] = this._joinTracker[gId].filter(t => now - t < 60000);
      this._joinTracker[gId].push(now);

      const count = this._joinTracker[gId].length;
      const limit = sec.raid.joinLimit || 10;

      // Early alert at 70% threshold
      if (sec.raid.earlyAlerts && count === Math.floor(limit * 0.7)) {
        await this.sendSecurityAlert(gId,
          `⚠️ **Alerta Antecipado:** ${count} joins no último minuto (limite: ${limit}).\nVelocidade de entrada suspeita.`
        );
      }

      if (count < limit) return;

      // Log to raid history
      if (!sec.raid.history) sec.raid.history = [];
      sec.raid.history.push({ timestamp: now, count, action: sec.raid.action || "nothing" });
      if (sec.raid.history.length > 20) sec.raid.history = sec.raid.history.slice(-20);
      guild.markModified("security");
      await this.save(guild);

      await this.sendSecurityAlert(gId,
        `🚨 **Raid detectado!** ${count} joins no último minuto.\n` +
        `Ação automática: **${sec.raid.action || "nothing"}**`
      );

      const action = sec.raid.action || "nothing";
      if (action === "nothing") return;

      const userId = data.user?.id;
      if (!userId) return;

      if (action === "kick") {
        if (await this._hasBotPerms(gId, ["KICK_MEMBERS"])) {
          await DiscordRequest(`/guilds/${gId}/members/${userId}`, { method: "DELETE" }).catch(() => {});
        } else {
          await this._ensurePerms(gId, ["KICK_MEMBERS"], null, "expulsar o membro durante o raid");
        }
      }
      if (action === "ban") {
        if (await this._hasBotPerms(gId, ["BAN_MEMBERS"])) {
          await DiscordRequest(`/guilds/${gId}/bans/${userId}`, {
            method: "PUT", body: { delete_message_seconds: 0 }
          }).catch(() => {});
        } else {
          await this._ensurePerms(gId, ["BAN_MEMBERS"], null, "banir o membro durante o raid");
        }
      }
      if (action === "timeout") {
        if (await this._hasBotPerms(gId, ["MODERATE_MEMBERS"])) {
          const until = new Date(Date.now() + 3600000).toISOString();
          await DiscordRequest(`/guilds/${gId}/members/${userId}`, {
            method: "PATCH", body: { communication_disabled_until: until }
          }).catch(() => {});
        } else {
          await this._ensurePerms(gId, ["MODERATE_MEMBERS"], null, "aplicar timeout durante o raid");
        }
      }
      if (action === "lockdown") {
        const g = await this.getGuild(gId);
        const success = await this._emergencyLockdown(g, gId);
        if (success) {
          const sec2 = this.getSecurity(g);
          sec2.emergency.active = true;
          this._logEmergencyEvent(g, "Lockdown automático por raid");
          g.markModified("security");
          await this.save(g);
          await this.sendSecurityAlert(gId,
            `🔒 **Lockdown ativado automaticamente** por detecção de raid.\nUse o painel de Emergência para desativar.`
          );
        }
      }

    } catch (err) { console.error("[Security] handleMemberJoin:", err); }
  }

  async handleRoleCreate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.adminRoleCreate) return;
      if ((BigInt(data.role?.permissions || 0) & (1n << 3n)) === (1n << 3n)) {
        await this._logMonitoringEvent(data.guild_id, "Cargo", `Cargo com Admin criado: ${data.role.name}`);
        await this.sendSecurityAlert(data.guild_id, `⚠️ **Cargo com Admin criado!**\n<@&${data.role.id}> — \`${data.role.name}\``);
      }
    } catch (err) { console.error("[Security] handleRoleCreate:", err); }
  }

  async handleChannelCreate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.channelChanges) return;
      await this._logMonitoringEvent(data.guild_id, "Canal", `Canal criado: #${data.name}`);
      await this.sendSecurityAlert(data.guild_id, `🧬 **Canal criado:** <#${data.id}> (\`${data.name}\`)`);
    } catch (err) { console.error("[Security] handleChannelCreate:", err); }
  }

  async handleMemberUpdate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.botAdded || !data.user?.bot) return;
      await this._logMonitoringEvent(data.guild_id, "Bot", `Bot adicionado: ${data.user.username}`);
      await this.sendSecurityAlert(data.guild_id, `🤖 **Bot adicionado:** ${data.user.username} (<@${data.user.id}>)`);
    } catch (err) { console.error("[Security] handleMemberUpdate:", err); }
  }

  async handleWebhookCreate(data) {
    try {
      const guild = await this.getGuild(data.guild_id);
      const sec   = this.getSecurity(guild);
      if (!sec.monitoring.webhookCreated) return;
      await this._logMonitoringEvent(data.guild_id, "Webhook", `Webhook criado em #${data.channel_id}`);
      await this.sendSecurityAlert(data.guild_id, `🔗 **Webhook criado/alterado** em <#${data.channel_id}>`);
    } catch (err) { console.error("[Security] handleWebhookCreate:", err); }
  }

  /* ================= AUTOMOD — MESSAGE HANDLER ================= */

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

      // Track activity
      await this._trackActivity(guildId, channelId, userId);

      const memberRoles = data.member?.roles || [];

      // Immune roles bypass automod entirely
      const immuneRoles = sec.roles?.immune || [];
      if (immuneRoles.some(r => memberRoles.includes(r))) return;

      const isIgnored = (cfg) => {
        if (!cfg) return false;
        if (cfg.ignoredChannels?.includes(channelId)) return true;
        if (cfg.ignoredRoles?.some(r => memberRoles.includes(r))) return true;
        return false;
      };

      // Execute all configured actions for a module
      const doActions = async (actions, reason, module) => {
        const acts    = actions || ["delete"];
        const skipped = [];

        // Always try to delete the message first
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
          // addWarn não chama API de moderação diretamente (a não ser via escalonamento,
          // que já verifica permissão internamente)
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
          (skipped.length ? `\n⚠️ Ação(ões) não executada(s) por falta de permissão: ${skipped.join(", ")}` : "")
        );
      };

      // ── Palavras proibidas, Anti-Spam, Links/Convites e Anti-Mass-Mention ──
      // Não são mais detectados aqui: essas 4 categorias têm equivalente
      // nativo no Discord AutoMod e a detecção acontece no servidor do
      // Discord (ver Security/NativeAutoMod.js). Quando a ação configurada
      // pede algo além de deletar/timeout (warn/kick/ban), isso é aplicado
      // reativamente em handleAutoModExecution(), disparado pelo gateway.

      // ── ANTI-CAPS (sem equivalente nativo) ──
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

      // ── ANTI-EMOJI (sem equivalente nativo) ──
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

      // ── ARQUIVOS PROIBIDOS (sem equivalente nativo) ──
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

  /**
   * Disparado pelo gateway em AUTO_MODERATION_ACTION_EXECUTION — toda vez
   * que uma regra nativa de AutoMod (badwords/antispam/antilinks/
   * antimention) é acionada. A regra nativa já cuida de bloquear a
   * mensagem e aplicar timeout quando configurado; aqui a Ayami só
   * completa o que o Discord não pode fazer nativamente: registrar warn
   * e aplicar kick/ban, além de mandar o alerta no canal de logs
   * configurado (mesmo formato usado pelos outros módulos).
   */
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
      if (!match) return; // regra criada manualmente no Discord, fora do escopo da Ayami

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
        (warnCount ? ` | Warns acumulados: ${warnCount}` : "")
      );
    } catch (err) {
      console.error("[Security] handleAutoModExecution:", err);
    }
  }

  // Apply a single escalation action
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

  async sendSecurityAlert(guildId, message) {
    try {
      const guild     = await this.getGuild(guildId);
      const channelId = this.getSecurity(guild).logs.channels.main;
      if (!channelId) return;
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: "POST",
        body: { embeds: [{ description: message, color: 0xED4245, timestamp: new Date().toISOString() }] }
      });
    } catch (err) { console.error("[Security] sendSecurityAlert:", err); }
  }

}

module.exports = SecuritySystem;
