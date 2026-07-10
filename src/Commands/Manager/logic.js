'use strict';

/* ═══════════════════════════════════════════════════════════
   /logic — comando unificado para o sistema Logic
   Substitui o antigo /logicbuilder (removido).

   /logic builder → abre o Logic Builder (mesma experiência de antes)
   /logic script  → painel informativo do Logic Script (sem código-fonte)
   ═══════════════════════════════════════════════════════════ */

const getPerm         = require('../../function/Utils/GetPerm.js');
const DiscordRequest  = require('../../function/DiscordRequest.js');
const PremiumManager  = require('../../function/Utils/PremiumManager.js');
const { LogicScriptModel, LogicRunLogModel } = require('../../Mongodb/logicScript.js');
const { LogicScriptConfig } = require('../../Mongodb/logicScriptConfig.js');

const DASHBOARD_BASE_URL = 'https://ayami-hoshiori.discloud.app';

/* ─────────────────────────────────────────────
   HELPERS COMPONENTS V2 (mesmo padrão do /premium)
   ───────────────────────────────────────────── */
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

/** Conta declarações de função num script (aproximação simples, sem AST — só pra exibição). */
function countFunctions(content) {
  return (String(content).match(/\bfunction\s+\w+\s*\(/g) || []).length;
}

function fmtLimit(n) {
  return n === Infinity ? '∞' : String(n);
}

function fmtRelativeTime(date) {
  if (!date) return 'nunca';
  const diffMs = Date.now() - new Date(date).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

module.exports = {

  data: {
    name:        'logic',
    description: 'Sistema Logic — Logic Builder e Logic Script',
    options: [
      {
        type: 1,
        name: 'builder',
        description: 'Abre o Logic Builder — crie fluxos e automações do servidor',
      },
      {
        type: 1,
        name: 'script',
        description: 'Painel informativo do Logic Script (arquivos, plano, execuções, erros)',
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
      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        { method: 'POST', body: { type: 4, data: { content: '❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.', flags: 64 } } }
      );
    }

    if (sub === 'builder') return this._builder(interaction, client);
    if (sub === 'script')  return this._script(interaction, client, guildId);
  },

  /* ═══════════════════════════════════════
     /logic builder
     ═══════════════════════════════════════ */
  async _builder(interaction, client) {
    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 5 } }
    );
    return client.logicUI.open(interaction);
  },

  /* ═══════════════════════════════════════
     /logic script — painel informativo
     (nunca mostra código-fonte; só estatísticas
     e mensagens amigáveis, sem stack traces)
     ═══════════════════════════════════════ */
  async _script(interaction, client, guildId) {
    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 5, data: { flags: 64 } } }
    );

    const editOriginal = (body) => DiscordRequest(
      `/webhooks/${client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body }
    );

    let blocks;
    try {
      blocks = await this._buildScriptPanel(guildId);
    } catch (err) {
      // Mensagem amigável — nunca stack trace nem detalhe interno
      blocks = [
        cv2Text(
          `# 📜 Logic Script\n` +
          `⚠️ Não foi possível carregar as informações agora. Tente novamente em instantes.`
        ),
      ];
      console.error('[logic script] erro ao montar painel:', err.message);
    }

    return editOriginal(cv2Payload(blocks, { ephemeral: true }));
  },

  async _buildScriptPanel(guildId) {
    // Plano premium da guild
    const premium = await PremiumManager.getGuildPremium(guildId).catch(() => ({ status: false }));
    const plan    = premium.status ? premium.plan : require('../../function/Utils/PremiumPlans.js').getPlan(null);

    // Arquivos
    const scripts = await LogicScriptModel.find({ guildId, isFolder: false }).lean();
    const fileCount = scripts.length;
    const fileLimit = plan.logicScriptFileLimit;

    // Funções (aproximação — soma de todos os arquivos)
    const functionCount = scripts.reduce((sum, s) => sum + countFunctions(s.content), 0);
    const perFileFnLimit = plan.logicScript?.maxFunctionsPerFile ?? Infinity;

    // Status do sistema (config por guild)
    const cfg = await LogicScriptConfig.findOne({ guildId }).lean();
    const enabled = cfg ? cfg.enabled : true;
    const prefix  = cfg?.prefix ?? '!';

    // Erros de sintaxe salvos nos próprios arquivos
    const scriptsWithError = scripts.filter(s => s.hasError);

    // Execuções (LogicRunLogModel tem TTL de 7 dias — a contagem é
    // naturalmente "últimos 7 dias")
    const totalRuns = await LogicRunLogModel.countDocuments({ guildId });
    const lastRun    = await LogicRunLogModel.findOne({ guildId }).sort({ createdAt: -1 }).lean();
    const recentErrors = await LogicRunLogModel.find({ guildId, status: { $in: ['error', 'timeout'] } })
      .sort({ createdAt: -1 }).limit(3).lean();

    // Recursos disponíveis / bloqueados pelo plano
    const featureLines = [
      `${plan.logicScript?.httpAccess    ? '✅' : '🔒'} Requisições HTTP`,
      `${plan.logicScript?.webhookAccess  ? '✅' : '🔒'} Webhooks`,
      `${plan.logicScript?.canRunFlowById ? '✅' : '🔒'} Executar Fluxo do Logic Builder (runFlow)`,
    ].join('\n');

    const errorsText = scriptsWithError.length
      ? scriptsWithError.map(s => `• \`${s.path}\` — ${s.lastError ?? 'erro de sintaxe'}`).slice(0, 5).join('\n')
      : '_Nenhum arquivo com erro no momento._';

    const recentErrorsText = recentErrors.length
      ? recentErrors.map(e => `• \`${e.scriptPath}\` (${e.event ?? '—'}) — ${e.error ?? 'erro'} · ${fmtRelativeTime(e.createdAt)}`).join('\n')
      : '_Nenhum erro de execução recente._';

    const guildUrl = `${DASHBOARD_BASE_URL}/dashboard/${guildId}`;
    const manageUrl = `${DASHBOARD_BASE_URL}/dashboard/${guildId}/logicscript`;

    return [
      cv2Text(
        `# 📜 Logic Script — Painel\n` +
        `Status: ${enabled ? '🟢 Ativo' : '🔴 Desativado'} · Prefixo: \`${prefix}\`\n` +
        `Plano atual: ${plan.emoji} **${plan.name}**`
      ),
      cv2Divider(),
      cv2Text(
        `**📁 Arquivos:** ${fileCount}/${fmtLimit(fileLimit)}\n` +
        `**🔧 Funções (total):** ${functionCount} _(até ${fmtLimit(perFileFnLimit)} por arquivo)_`
      ),
      cv2Divider(),
      cv2Text(`**✨ Recursos do plano:**\n${featureLines}`),
      cv2Divider(),
      cv2Text(
        `**📊 Execuções (últimos 7 dias):** ${totalRuns}\n` +
        `**🕐 Última execução:** ${lastRun ? `\`${lastRun.scriptPath}\` · ${fmtRelativeTime(lastRun.createdAt)}` : 'nenhuma ainda'}`
      ),
      cv2Divider(),
      cv2Text(`**⚠️ Avisos (arquivos com erro de sintaxe):**\n${errorsText}`),
      cv2Divider(),
      cv2Text(`**🐛 Erros recentes de execução:**\n${recentErrorsText}`),
      cv2Divider(),
      row(
        linkButton('Dashboard', guildUrl, '📊'),
        linkButton('Gerenciar', manageUrl, '⚙️'),
      ),
    ];
  },
};
