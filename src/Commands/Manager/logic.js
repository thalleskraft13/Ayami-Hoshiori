'use strict';


const getPerm         = require('../../function/Utils/GetPerm.js');
const DiscordRequest  = require('../../function/DiscordRequest.js');
const PremiumManager  = require('../../function/Utils/PremiumManager.js');
const { LogicScriptModel, LogicRunLogModel } = require('../../Mongodb/logicScript.js');
const { LogicScriptConfig } = require('../../Mongodb/logicScriptConfig.js');
const { localeCtx } = require('../../function/Utils/ctxLocale.js');

const DASHBOARD_BASE_URL = 'https://ayami-hoshiori.discloud.app';

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
      cv2Divider(),
      row(
        linkButton(client.t('logic.btn_dashboard', ctx), guildUrl, '📊'),
        linkButton(client.t('logic.btn_manage', ctx), manageUrl, '⚙️'),
      ),
    ];
  },
};
