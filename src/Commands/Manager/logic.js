'use strict';

const getPerm         = require('../../function/Utils/GetPerm.js');
const DiscordRequest  = require('../../function/DiscordRequest.js');
const PremiumManager  = require('../../function/Utils/PremiumManager.js');
const { LogicScriptModel, LogicRunLogModel } = require('../../Mongodb/logicScript.js');
const { LogicScriptConfig } = require('../../Mongodb/logicScriptConfig.js');
const { LogicEndpointModel } = require('../../Mongodb/logicEndpoint.js');
const { localeCtx } = require('../../function/Utils/ctxLocale.js');
const crypto = require('crypto');

const DASHBOARD_BASE_URL = 'https://ayami-hoshiori.cpufael.com';

function cv2Text(content)          { return { type: 10, content }; }
function cv2Divider(spacing = 1)   { return { type: 14, divider: true, spacing }; }
function cv2Container(blocks, opts = {}) {
  return { type: 17, accent_color: opts.accentColor ?? 0x7C8FFF, spoiler: false, components: blocks };
}
function cv2Payload(blocks, opts = {}) {
  return { flags: (32768 | (opts.ephemeral === false ? 0 : 64)), components: [cv2Container(blocks, opts)] };
}
function row(...components) { return { type: 1, components }; }
function linkButton(label, url, emoji) {
  return { type: 2, style: 5, label, url, ...(emoji ? { emoji: { name: emoji } } : {}) };
}
function actionButton(label, customId, { style = 2, emoji, disabled = false } = {}) {
  return { type: 2, style, label, custom_id: customId, disabled, ...(emoji ? { emoji: { name: emoji } } : {}) };
}
function stringSelect(customId, placeholder, options) {
  return { type: 3, custom_id: customId, placeholder, options: options.slice(0, 25) };
}

function generateEndpointSecret() {
  return 'ayep_' + crypto.randomBytes(24).toString('base64url');
}
function hashEndpointSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function countFunctions(content) {
  return (String(content).match(/\bfunction\s+\w+\s*\(/g) || []).length;
}

function fmtLimit(n) {
  return n === Infinity ? '∞' : String(n);
}

function fmtRelativeTime(client, ctx, date) {
  if (!date) return client.t('logic.never', ctx);
  const diffMs = Date.now() - new Date(date).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return client.t('logic.just_now', ctx);
  if (min < 60) return client.t('logic.min_ago', { ...ctx, n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return client.t('logic.hours_ago', { ...ctx, n: h });
  const d = Math.floor(h / 24);
  return client.t('logic.days_ago', { ...ctx, n: d });
}

module.exports = {

  data: {
    name:        'logic',
    description: 'Sistema Logic — Logic Builder e Logic Script',
    name_localizations: { 'en-US': 'logic', 'en-GB': 'logic', 'es-ES': 'logic' },
    description_localizations: {
      'en-US': 'Logic System — Logic Builder and Logic Script',
      'en-GB': 'Logic System — Logic Builder and Logic Script',
      'es-ES': 'Sistema Logic — Logic Builder y Logic Script',
    },
    options: [
      {
        type: 1,
        name: 'builder',
        name_localizations: { 'en-US': "builder", 'en-GB': "builder", 'es-ES': "builder" },
        description: 'Abre o Logic Builder — crie fluxos e automações do servidor',
        description_localizations: { 'en-US': "Opens the Logic Builder — create server flows and automations", 'en-GB': "Opens the Logic Builder — create server flows and automations", 'es-ES': "Abre el Logic Builder — crea flujos y automatizaciones del servidor" },
      },
      {
        type: 1,
        name: 'script',
        name_localizations: { 'en-US': "script", 'en-GB': "script", 'es-ES': "script" },
        description: 'Painel informativo do Logic Script (arquivos, plano, execuções, erros)',
        description_localizations: { 'en-US': "Logic Script info panel (files, plan, executions, errors)", 'en-GB': "Logic Script info panel (files, plan, executions, errors)", 'es-ES': "Panel informativo de Logic Script (archivos, plan, ejecuciones, errores)" },
      },
    ],
  },

  info: {
    perm: ['MANAGE_GUILD'],
  },

  async execute(interaction, client) {
    const guildId = interaction.guild_id;
    const sub     = interaction.data.options?.[0]?.name;

    const perms = await getPerm({
      id:      interaction.member.user.id,
      guildId,
      client,
    });

    if (!perms || !perms.includes('MANAGE_GUILD')) {
      const permCtx = localeCtx(interaction);
      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        { method: 'POST', body: { type: 4, data: {
          content: client.t('common.no_permission', {
            ...permCtx,
            perm: client.t('common.perm_manage_guild', permCtx),
            action: client.t('common.action_use_command', permCtx),
          }),
          flags: 64
        } } }
      );
    }

    if (sub === 'builder') return this._builder(interaction, client);
    if (sub === 'script')  return this._script(interaction, client, guildId);
  },

  async _builder(interaction, client) {
    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 5 } }
    );
    return client.logicUI.open(interaction);
  },

  async _script(interaction, client, guildId) {
    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 5, data: { flags: 64 } } }
    );

    const editOriginal = (body) => DiscordRequest(
      `/webhooks/${client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body }
    );

    const ctx = localeCtx(interaction);

    let blocks;
    try {
      blocks = await this._buildScriptPanel(guildId, client, ctx);
    } catch (err) {
      blocks = [
        cv2Text(client.t('logic.script_load_error', ctx)),
      ];
      console.error('[logic script] erro ao montar painel:', err.message);
    }

    return editOriginal(cv2Payload(blocks, { ephemeral: true }));
  },

  async _buildScriptPanel(guildId, client, ctx) {
    const premium = await PremiumManager.getGuildPremium(guildId).catch(() => ({ status: false }));
    const plan    = premium.status ? premium.plan : require('../../function/Utils/PremiumPlans.js').getPlan(null);

    const scripts = await LogicScriptModel.find({ guildId, isFolder: false }).lean();
    const fileCount = scripts.length;
    const fileLimit = plan.logicScriptFileLimit;

    const functionCount = scripts.reduce((sum, s) => sum + countFunctions(s.content), 0);
    const perFileFnLimit = plan.logicScript?.maxFunctionsPerFile ?? Infinity;

    const cfg = await LogicScriptConfig.findOne({ guildId }).lean();
    const enabled = cfg ? cfg.enabled : true;
    const prefix  = cfg?.prefix ?? '!';

    const scriptsWithError = scripts.filter(s => s.hasError);

    const totalRuns = await LogicRunLogModel.countDocuments({ guildId });
    const lastRun    = await LogicRunLogModel.findOne({ guildId }).sort({ createdAt: -1 }).lean();
    const recentErrors = await LogicRunLogModel.find({ guildId, status: { $in: ['error', 'timeout'] } })
      .sort({ createdAt: -1 }).limit(3).lean();

    const featureLines = [
      `${plan.logicScript?.httpAccess    ? '✅' : '🔒'} ${client.t('logic.feature_http', ctx)}`,
      `${plan.logicScript?.webhookAccess  ? '✅' : '🔒'} ${client.t('logic.feature_webhooks', ctx)}`,
      `${plan.logicScript?.canRunFlowById ? '✅' : '🔒'} ${client.t('logic.feature_runflow', ctx)}`,
    ].join('\n');

    const errorsText = scriptsWithError.length
      ? scriptsWithError.map(s => `• \`${s.path}\` — ${s.lastError ?? client.t('logic.syntax_error_fallback', ctx)}`).slice(0, 5).join('\n')
      : client.t('logic.no_file_errors', ctx);

    const recentErrorsText = recentErrors.length
      ? recentErrors.map(e => `• \`${e.scriptPath}\` (${e.event ?? '—'}) — ${e.error ?? client.t('logic.error_fallback', ctx)} · ${fmtRelativeTime(client, ctx, e.createdAt)}`).join('\n')
      : client.t('logic.no_recent_errors', ctx);

    const guildUrl = `${DASHBOARD_BASE_URL}/dashboard/${guildId}`;
    const manageUrl = `${DASHBOARD_BASE_URL}/dashboard/${guildId}/logicscript`;

    const fileIds = scripts.map(s => s.fileId).filter(Boolean);
    const endpointCfgs = fileIds.length
      ? await LogicEndpointModel.find({ guildId, logicScriptId: { $in: fileIds } }).lean()
      : [];
    const endpointByFile = new Map(endpointCfgs.map(e => [e.logicScriptId, e]));

    const endpointsEnabled = !!plan.endpoints?.enabled;
    let endpointBlocks = [];

    if (endpointsEnabled && scripts.length) {
      const linesEndpoints = scripts.slice(0, 10).map(s => {
        const cfg = endpointByFile.get(s.fileId);
        const badge = !cfg ? '⚪ sem Endpoint' : cfg.enabled ? '🟢 ativo' : '🔴 inativo';
        return `• \`${s.path}\` — \`${s.fileId ?? '—'}\` — ${badge}`;
      }).join('\n');

      const selectOptions = scripts
        .filter(s => s.fileId)
        .slice(0, 25)
        .map(s => ({
          label: s.name.slice(0, 100),
          value: s.fileId,
          description: (s.path ?? '').slice(0, 100) || undefined,
        }));

      endpointBlocks = [
        cv2Divider(),
        cv2Text(
          `**📡 Endpoints** (Lua Crescente/Constellation) — até ${fmtLimit(plan.endpoints?.maxEndpoints ?? 0)} ativos, ` +
          `${fmtLimit(plan.endpoints?.rateLimitPerMinute ?? 0)} req/min, histórico de ${fmtLimit(plan.endpoints?.historyLimit ?? 0)}\n${linesEndpoints}`
        ),
        ...(selectOptions.length ? [row(stringSelect('ls_secret:select', 'Selecione um arquivo para gerenciar o Endpoint', selectOptions))] : []),
      ];
    } else if (scripts.length) {
      endpointBlocks = [
        cv2Divider(),
        cv2Text('**📡 Endpoints** — 🔒 disponível a partir do plano Lua Crescente. Veja `/premium`.'),
      ];
    }

    return [
      cv2Text(client.t('logic.panel_header', {
        ...ctx,
        statusIcon: enabled ? '🟢' : '🔴',
        statusText: enabled ? client.t('logic.status_active', ctx) : client.t('logic.status_disabled', ctx),
        prefix,
        planEmoji: plan.emoji,
        planName: plan.name,
      })),
      cv2Divider(),
      cv2Text(client.t('logic.files_line', {
        ...ctx,
        fileCount,
        fileLimit: fmtLimit(fileLimit),
        functionCount,
        perFileFnLimit: fmtLimit(perFileFnLimit),
      })),
      cv2Divider(),
      cv2Text(client.t('logic.features_label', { ...ctx, featureLines })),
      cv2Divider(),
      cv2Text(client.t('logic.runs_line', {
        ...ctx,
        totalRuns,
        lastRunText: lastRun ? `\`${lastRun.scriptPath}\` · ${fmtRelativeTime(client, ctx, lastRun.createdAt)}` : client.t('logic.no_run_yet', ctx),
      })),
      cv2Divider(),
      cv2Text(client.t('logic.warnings_label', { ...ctx, errorsText })),
      cv2Divider(),
      cv2Text(client.t('logic.recent_errors_label', { ...ctx, recentErrorsText })),
      ...endpointBlocks,
      cv2Divider(),
      row(
        linkButton(client.t('logic.btn_dashboard', ctx), guildUrl, '📊'),
        linkButton(client.t('logic.btn_manage', ctx), manageUrl, '⚙️'),
      ),
    ];
  },

  async handleSecretButton(interaction, client) {
    const guildId  = interaction.guild_id;
    const [, action, actionFileId] = (interaction.data.custom_id || '').split(':');
    const respond = (body, updateInPlace = false) => DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: updateInPlace ? 7 : 4, data: body } }
    );

    if (action === 'select') {
      const fileId = interaction.data.values?.[0];
      if (!fileId) return;
      const blocks = await module.exports._buildEndpointFilePanel(guildId, fileId, interaction, client);
      return respond({ flags: 32768 | 64, components: [cv2Container(blocks, {})] }, true);
    }

    if (action === 'toggle') {
      const fileId = actionFileId;

      const guild   = client.guilds?.get(guildId);
      const isOwner = !!guild && guild.ownerId === interaction.member?.user?.id;
      if (!isOwner) {
        return respond({ content: '🔒 Só o(a) dono(a) do servidor pode ativar ou desativar o Endpoint.', flags: 64 });
      }

      const script = await LogicScriptModel.findOne({ guildId, fileId, isFolder: false }).lean();
      if (!script) {
        return respond({ content: '⚠️ Arquivo não encontrado — ele pode ter sido excluído.', flags: 64 });
      }

      const cfg = await LogicEndpointModel.findOne({ guildId, logicScriptId: fileId }).lean();
      const wantEnabled = !cfg?.enabled;

      if (wantEnabled) {
        if (!cfg?.secretHash) {
          return respond({ content: '⚠️ Crie um Secret antes de ativar o Endpoint.', flags: 64 });
        }
        const plan = await module.exports._getGuildPlan(guildId);
        if (!plan.endpoints?.enabled) {
          return respond({ content: '🔒 O plano deste servidor não inclui Endpoints. Veja `/premium`.', flags: 64 });
        }
        const activeCount = await LogicEndpointModel.countDocuments({ guildId, enabled: true, logicScriptId: { $ne: fileId } });
        if (activeCount >= (plan.endpoints.maxEndpoints ?? 0)) {
          return respond({ content: `🔒 Seu plano permite no máximo ${plan.endpoints.maxEndpoints} Endpoint(s) ativo(s).`, flags: 64 });
        }
      }

      await LogicEndpointModel.updateOne(
        { guildId, logicScriptId: fileId },
        { $set: { enabled: wantEnabled, updatedAt: new Date() } }
      );

      const blocks = await module.exports._buildEndpointFilePanel(guildId, fileId, interaction, client);
      return respond({ flags: 32768 | 64, components: [cv2Container(blocks, {})] }, true);
    }

    if (action !== 'create' && action !== 'regen') return;
    const fileId = actionFileId;

    const guild   = client.guilds?.get(guildId);
    const isOwner = !!guild && guild.ownerId === interaction.member?.user?.id;
    if (!isOwner) {
      return respond({ content: '🔒 Só o(a) dono(a) do servidor pode criar ou regenerar o Secret do Endpoint.', flags: 64 });
    }

    const script = await LogicScriptModel.findOne({ guildId, fileId, isFolder: false }).lean();
    if (!script) {
      return respond({ content: '⚠️ Arquivo não encontrado — ele pode ter sido excluído.', flags: 64 });
    }

    if (action === 'create') {
      const existing = await LogicEndpointModel.findOne({ guildId, logicScriptId: fileId }).lean();
      if (existing?.secretHash) {
        return respond({ content: '⚠️ Esse arquivo já tem um Secret. Use **Regenerar Secret** para trocar por um novo.', flags: 64 });
      }
    }

    const secret = generateEndpointSecret();
    await LogicEndpointModel.findOneAndUpdate(
      { guildId, logicScriptId: fileId },
      {
        $set: {
          secretHash:      hashEndpointSecret(secret),
          secretCreatedAt: new Date(),
          secretCreatedBy: interaction.member.user.id,
          updatedAt:       new Date(),
        },
        $setOnInsert: { enabled: false, requestCount: 0, ipWhitelist: [] },
      },
      { upsert: true }
    );

    return respond({
      content:
        `🔑 **Secret ${action === 'create' ? 'criado' : 'regenerado'} com sucesso!**\n\n` +
        `\`\`\`\n${secret}\n\`\`\`\n` +
        `⚠️ **Guarde esse valor agora** — ele não será mostrado novamente. Envie-o em uma das duas formas:\n` +
        `• Header \`Authorization: Bearer ${secret}\`\n` +
        `• Header \`X-Ayami-Secret: ${secret}\`\n\n` +
        (action === 'regen' ? '⚠️ O Secret anterior parou de funcionar imediatamente.' : 'Ative o Endpoint pelo Dashboard depois de configurar o Secret.'),
      flags: 64,
    });
  },

  async _buildEndpointFilePanel(guildId, fileId, interaction, client) {
    const script = await LogicScriptModel.findOne({ guildId, fileId, isFolder: false }).lean();
    if (!script) return [cv2Text('⚠️ Arquivo não encontrado.')];

    const cfg = await LogicEndpointModel.findOne({ guildId, logicScriptId: fileId }).lean();
    const guild = client.guilds?.get(guildId);
    const isOwner = !!guild && guild.ownerId === interaction.member?.user?.id;

    const url = `https://ayami-hoshiori.cpufael.com/endpoints/${guildId}/${fileId}`;

    const lines = [
      `**📡 Endpoint de \`${script.path}\`**`,
      `ID do arquivo: \`${fileId}\``,
      `URL: \`${url}\``,
      `Status: ${cfg?.enabled ? '🟢 ativo' : '🔴 inativo'}`,
      `Secret: ${cfg?.secretHash ? '✅ configurado' : '❌ não criado'}`,
      `Requisições: ${cfg?.requestCount ?? 0}`,
    ];

    const buttons = isOwner
      ? row(
          actionButton(cfg?.secretHash ? 'Secret já criado' : 'Criar Secret', `ls_secret:create:${fileId}`, { style: 3, emoji: '🔑', disabled: !!cfg?.secretHash }),
          actionButton('Regenerar Secret', `ls_secret:regen:${fileId}`, { style: 4, emoji: '♻️', disabled: !cfg?.secretHash }),
        )
      : row(actionButton('Somente o(a) dono(a) pode gerenciar', 'ls_secret:noop', { style: 2, disabled: true }));

    const toggleRow = isOwner
      ? row(
          actionButton(
            cfg?.enabled ? '🔴 Desativar Endpoint' : '🟢 Ativar Endpoint',
            `ls_secret:toggle:${fileId}`,
            { style: cfg?.enabled ? 4 : 3, disabled: !cfg?.secretHash }
          ),
        )
      : null;

    return [cv2Text(lines.join('\n')), cv2Divider(), buttons, ...(toggleRow ? [toggleRow] : [])];
  },

  async _getGuildPlan(guildId) {
    const { getPlan } = require('../../function/Utils/PremiumPlans.js');
    try {
      const premium = await PremiumManager.getGuildPremium(guildId);
      return premium.status ? premium.plan : getPlan(null);
    } catch {
      return getPlan(null);
    }
  },
};
