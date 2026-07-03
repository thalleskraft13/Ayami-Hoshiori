'use strict';

const DiscordRequest = require('../../function/DiscordRequest.js');
const getPerm        = require('../../function/Utils/GetPerm.js');

/* ═══════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════ */

const CATEGORIES = [
  'Moderação','Economia','Automação','Logs','Tickets',
  'Recompensas','Eventos','RPG','Utilidade','Comunidade',
  'Diversão','Outros'
];

const CATEGORY_EMOJI = {
  'Moderação':   '🛡️',
  'Economia':    '💰',
  'Automação':   '⚙️',
  'Logs':        '📋',
  'Tickets':     '🎫',
  'Recompensas': '🎁',
  'Eventos':     '🎉',
  'RPG':         '⚔️',
  'Utilidade':   '🔧',
  'Comunidade':  '👥',
  'Diversão':    '🎮',
  'Outros':      '📦'
};

/* ─────────────────────────────────────────────
   CORES DA AYAMI (mesma paleta do Logic Builder)
   ───────────────────────────────────────────── */
const COLOR = {
  main:    0x7C8FFF,   // azul principal
  gold:    0xFFD966,   // dourado
  dark:    0x243B7A,   // azul escuro
  hair:    0xA9D6FF,   // azul cabelo
  pink:    0xFFB6C8,
  danger:  0xED4245,
  success: 0x57F287,
  library: 0x7C8FFF,
};

const SUPPORT_ANNOUNCE_CHANNEL = '1508910999753850910';
const GUIDE_URL = 'https://ayami-hoshiori.vercel.app/logic-builder';

/* ═══════════════════════════════════════════════════════════
   MAPA DE CAMPOS QUE PRECISAM SER CONFIGURADOS NA INSTALAÇÃO
   Chave: "category:type" → array de campos obrigatórios
   ═══════════════════════════════════════════════════════════ */

const INSTALL_REQUIRED_FIELDS = {
  // Ações — mensagem
  'message:send_message':        [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal onde as mensagens serão enviadas.' }],
  'message:delete_bot_message':  [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal onde a mensagem do bot está.' }],
  // Ações — canal
  'channel:delete_channel':      [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal a ser deletado.' }],
  'channel:rename_channel':      [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal a ser renomeado.' }],
  'channel:lock_channel':        [
    { field: 'channelId', label: '📌 Canal', description: 'Mencione ou envie o ID do canal a ser trancado.' },
    { field: 'roleId',    label: '🏷️ Cargo', description: 'Mencione ou envie o ID do cargo que terá o acesso bloqueado (vazio = @everyone).' }
  ],
  'channel:unlock_channel':      [
    { field: 'channelId', label: '📌 Canal', description: 'Mencione ou envie o ID do canal a ser destrancado.' },
    { field: 'roleId',    label: '🏷️ Cargo', description: 'Mencione ou envie o ID do cargo (vazio = @everyone).' }
  ],
  // Ações — usuário
  'user:give_role':              [{ field: 'roleId',    label: '🏷️ Cargo',  description: 'Mencione ou envie o ID do cargo a ser dado.' }],
  'user:remove_role':            [{ field: 'roleId',    label: '🏷️ Cargo',  description: 'Mencione ou envie o ID do cargo a ser removido.' }],
  'user:give_temp_role':         [{ field: 'roleId',    label: '🏷️ Cargo',  description: 'Mencione ou envie o ID do cargo temporário.' }],
  'user:toggle_role':            [{ field: 'roleId',    label: '🏷️ Cargo',  description: 'Mencione ou envie o ID do cargo a ser alternado.' }],
  // Condições — usuário
  'user:has_role':               [{ field: 'roleId',    label: '🏷️ Cargo',  description: 'Mencione ou envie o ID do cargo a verificar.' }],
  'user:not_has_role':           [{ field: 'roleId',    label: '🏷️ Cargo',  description: 'Mencione ou envie o ID do cargo a verificar.' }],
  // Condições — canal
  'channel:is_channel':          [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal específico.' }],
  'channel:not_channel':         [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal a ignorar.' }],
  // Trigger filters
  'trigger:message':             [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal filtro do trigger (deixe em branco para qualquer canal).' }],
  'trigger:reaction':            [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal filtro do trigger.' }],
  'trigger:component':           [{ field: 'channelId', label: '📌 Canal',  description: 'Mencione ou envie o ID do canal filtro do trigger.' }],
};

/* ═══════════════════════════════════════════════════════════
   LABEL AMIGÁVEL PARA AÇÕES/CONDIÇÕES
   ═══════════════════════════════════════════════════════════ */

function _actionLabel(category, type) {
  const map = {
    'message:send_message':       '💬 Enviar mensagem',
    'message:send_dm':            '📩 Enviar DM',
    'message:reply_message':      '↩️ Responder mensagem',
    'message:delete_message':     '🗑️ Apagar mensagem',
    'message:delete_bot_message': '🗑️ Apagar mensagem do bot',
    'user:give_role':             '🏷️ Dar cargo',
    'user:remove_role':           '🏷️ Remover cargo',
    'user:give_temp_role':        '⏱️ Cargo temporário',
    'user:toggle_role':           '🔄 Alternar cargo',
    'user:has_role':              '👤 Possui cargo',
    'user:not_has_role':          '👤 Não possui cargo',
    'channel:lock_channel':       '🔒 Trancar canal',
    'channel:unlock_channel':     '🔓 Destrancar canal',
    'channel:delete_channel':     '❌ Apagar canal',
    'channel:rename_channel':     '✏️ Renomear canal',
    'channel:is_channel':         '📌 Canal específico',
    'channel:not_channel':        '📌 Não é canal',
  };
  return map[`${category}:${type}`] || `${category}/${type}`;
}

/* ═══════════════════════════════════════════════════════════
   CONSTRUÇÃO DAS PERGUNTAS DE INSTALAÇÃO
   — Varre CADA campo individualmente em ações, condições e
     trigger.filters de TODOS os fluxos.
   — SEMPRE pergunta, independente de ter valor hardcoded.
   — Deduplicação por (flowName + category:type + field):
     se dois fluxos diferentes têm a mesma ação, pergunta separado.
   ═══════════════════════════════════════════════════════════ */

function _buildInstallQuestions(entry) {
  const questions = [];
  const flows     = entry.flows || [];

  for (let fi = 0; fi < flows.length; fi++) {
    const flow     = flows[fi];
    const flowName = flow.name || `Fluxo ${fi + 1}`;

    // ── Ações ──────────────────────────────────────────────
    for (let ai = 0; ai < (flow.actions || []).length; ai++) {
      const action  = flow.actions[ai];
      const key     = `${action.category}:${action.type}`;
      const reqFields = INSTALL_REQUIRED_FIELDS[key];
      if (!reqFields) continue;

      for (const { field, label, description } of reqFields) {
        questions.push({
          storeKey:    `f${fi}_a${ai}_${field}`,
          flowIndex:   fi,
          flowName,
          location:    'action',
          itemIndex:   ai,
          category:    action.category,
          type:        action.type,
          field,
          label,
          description,
          actionLabel: `${_actionLabel(action.category, action.type)} (${flowName})`
        });
      }
    }

    // ── Condições ──────────────────────────────────────────
    for (let ci = 0; ci < (flow.conditions || []).length; ci++) {
      const cond    = flow.conditions[ci];
      const key     = `${cond.category}:${cond.type}`;
      const reqFields = INSTALL_REQUIRED_FIELDS[key];
      if (!reqFields) continue;

      for (const { field, label, description } of reqFields) {
        questions.push({
          storeKey:    `f${fi}_c${ci}_${field}`,
          flowIndex:   fi,
          flowName,
          location:    'condition',
          itemIndex:   ci,
          category:    cond.category,
          type:        cond.type,
          field,
          label,
          description,
          actionLabel: `${_actionLabel(cond.category, cond.type)} — condição (${flowName})`
        });
      }
    }

    // ── Trigger filters ────────────────────────────────────
    if (flow.trigger?.filters) {
      const triggerKey = `trigger:${flow.trigger.category}`;
      const reqFields  = INSTALL_REQUIRED_FIELDS[triggerKey];
      if (reqFields) {
        for (const { field, label, description } of reqFields) {
          questions.push({
            storeKey:    `f${fi}_t_${field}`,
            flowIndex:   fi,
            flowName,
            location:    'trigger',
            itemIndex:   -1,
            category:    flow.trigger.category,
            type:        flow.trigger.type,
            field,
            label,
            description: description + '\nEnvie `-` para não filtrar por canal.',
            actionLabel: `🎯 Trigger (${flowName})`
          });
        }
      }
    }
  }

  return questions;
}

/* ═══════════════════════════════════════════════════════════
   APLICAÇÃO DOS VALORES COLETADOS NOS FLUXOS
   — Substitui cada campo individualmente usando o storeKey,
     ao invés de uma substituição global por tipo.
   ═══════════════════════════════════════════════════════════ */

function _applyCollectedValues(flows, questions, collected) {
  const cloned = JSON.parse(JSON.stringify(flows));

  for (const q of questions) {
    const rawValue = (collected[q.storeKey] || '').replace(/[<#@&!>]/g, '').trim();
    const value = (rawValue === '' || rawValue === '-') ? '' : rawValue;

    const flow = cloned[q.flowIndex];
    if (!flow) continue;

    if (q.location === 'action') {
      const action = flow.actions?.[q.itemIndex];
      if (action) {
        action.params = action.params || {};
        action.params[q.field] = value;
      }
    } else if (q.location === 'condition') {
      const cond = flow.conditions?.[q.itemIndex];
      if (cond) {
        cond.params = cond.params || {};
        cond.params[q.field] = value;
      }
    } else if (q.location === 'trigger') {
      flow.trigger = flow.trigger || {};
      flow.trigger.filters = flow.trigger.filters || {};
      if (value === '') {
        delete flow.trigger.filters[q.field];
      } else {
        flow.trigger.filters[q.field] = value;
      }
    }
  }

  return cloned;
}

/* ═══════════════════════════════════════════════════════════
   HELPERS DE INTERACTION (REST)
   ═══════════════════════════════════════════════════════════ */

async function _defer(interaction) {
  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    { method: 'POST', body: { type: 5, data: { flags: 0 } } }
  );
}

async function _deferUpdate(interaction) {
  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    { method: 'POST', body: { type: 6 } }
  );
}

async function _reply(interaction, data) {
  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    { method: 'POST', body: { type: 4, data } }
  );
}

/**
 * Edita a "mensagem original" do painel. Normalmente relativo a
 * @original do token da interação atual — mas se a interação foi
 * marcada com `__rootOverride` (acontece depois de fluxos que rodam
 * em followUp com token próprio, como o wizard de instalação por
 * mensagens no canal), edita a mensagem raiz real via REST puro por
 * channelId+messageId. Mesma estratégia usada no Logic Builder.
 */
async function _edit(interaction, client, data) {
  if (interaction.__rootOverride) {
    const { channelId, messageId } = interaction.__rootOverride;
    return _editMessageById(client, channelId, messageId, data);
  }
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}/messages/@original`,
    { method: 'PATCH', body: data }
  );
}

/** Edita qualquer mensagem do bot via REST puro (canal + messageId), sem depender de token. */
async function _editMessageById(client, channelId, messageId, data) {
  return DiscordRequest(
    `/channels/${channelId}/messages/${messageId}`,
    { method: 'PATCH', body: data }
  );
}

async function _followUp(interaction, client, data) {
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}`,
    { method: 'POST', body: data }
  );
}

async function _followUpEphemeral(interaction, client, data) {
  return _followUp(interaction, client, { ...data, flags: (data.flags ?? 0) | 64 });
}

async function _deleteFollowUp(interaction, client, messageId) {
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}/messages/${messageId}`,
    { method: 'DELETE' }
  );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS COMPONENTS V2
   (mesmo padrão usado no Logic Builder)
   ═══════════════════════════════════════════════════════════ */

/** Text Display (type 10) */
function cv2Text(content) {
  return { type: 10, content };
}

/** Separator (type 14) */
function cv2Divider(spacing = 1) {
  return { type: 14, divider: true, spacing };
}

/** Section (type 9) — texto + botão acessório ao lado. */
function cv2Section(content, button) {
  return {
    type:      9,
    accessory: button,
    components: [cv2Text(content)]
  };
}

/** Media Gallery (type 12) — imagem decorativa. */
function cv2Gallery(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  return {
    type:  12,
    items: list.map(url => ({ media: { url }, description: null, spoiler: false }))
  };
}

/** Container raiz (type 17). */
function cv2Container(blocks, opts = {}) {
  return {
    type:         17,
    accent_color: opts.accentColor ?? COLOR.main,
    spoiler:      opts.spoiler ?? false,
    components:   blocks
  };
}

/** Flags para respostas CV2. IS_COMPONENTS_V2 = 1<<15 = 32768  EPHEMERAL = 1<<6 = 64 */
function cv2Flags(ephemeral = false) {
  return ephemeral ? 32768 | 64 : 32768;
}

/** Payload completo { flags, components: [container] } pronto para _edit/_followUp/_reply. */
function cv2Payload(blocks, opts = {}) {
  return {
    flags:      cv2Flags(opts.ephemeral ?? false),
    components: [cv2Container(blocks, opts)]
  };
}

function row(...components) {
  return { type: 1, components };
}

/** Botão simples — wrapper de client.interactions.createButton. */
function btn(client, user, label, style, func, opts = {}) {
  return client.interactions.createButton({
    user,
    data: { label, style, emoji: opts.emoji, disabled: opts.disabled },
    funcao: func
  });
}

function select(client, user, options, placeholder, func, opts = {}) {
  return client.interactions.createSelect({
    user,
    data: { placeholder, options, min_values: opts.minValues, max_values: opts.maxValues },
    funcao: func
  });
}

const GUIDE_BUTTON = { type: 2, style: 5, label: '📖 Guia', url: GUIDE_URL };

/* ── helper de paginação (mesmo padrão do Logic Builder) ── */
function _clampPage(page, total, perPage = 8) {
  const maxPage  = Math.max(0, Math.ceil(total / perPage) - 1);
  const safePage = Math.min(Math.max(0, page), maxPage);
  return { page: safePage, maxPage };
}

/* ═══════════════════════════════════════════════════════════
   WIZARD DE INSTALAÇÃO
   ═══════════════════════════════════════════════════════════ */

async function _startInstallWizard(interaction, client, lib, entry, userId, guildId, e) {
  guildId = guildId || interaction.guild_id;
  const channelId = interaction.channel_id;

  // Verifica permissão
  let perms = [];
  try {
    perms = await getPerm({ guildId, id: userId });
  } catch (err) {
    console.error('[instalar] getPerm error:', err);
  }

  if (!perms.includes('MANAGE_GUILD') && !perms.includes('ADMINISTRATOR')) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(`# ${e.brava} Sem permissão\nVocê precisa da permissão **Gerenciar Servidor** para instalar sistemas.`)
    ], { accentColor: COLOR.danger }));
  }

  const questions = _buildInstallQuestions(entry);

  // Sem perguntas — instala direto
  if (!questions.length) {
    return _executeInstall(interaction, client, lib, entry, userId, guildId, [], {}, null, e);
  }

  // Captura channelId + messageId REAIS da mensagem raiz, ANTES de
  // qualquer mensagem nova ser enviada no canal pelo wizard. Isso
  // permite editar a mensagem certa ao final, mesmo que o wizard
  // tenha rodado fora do ciclo de token da interação atual.
  const rootChannelId = interaction.channel_id || interaction.channel?.id;
  let rootMessageId   = interaction.message?.id;
  if (!rootMessageId) {
    // Quando vem de /instalar direto (sem clique de botão), busca o @original.
    const original = await DiscordRequest(
      `/webhooks/${client.clientId}/${interaction.token}/messages/@original`
    ).catch(() => null);
    rootMessageId = original?.id;
  }

  // Mostra resumo das perguntas antes de começar
  const summaryLines = questions.map((q, i) => `\`${i + 1}.\` **${q.label}** — _${q.actionLabel}_`).slice(0, 25).join('\n');

  await _edit(interaction, client, cv2Payload([
    cv2Text(
      `# ${e.pensando} Configurando — ${entry.name}\n` +
      `Esse sistema precisa de **${questions.length} configuração(ões)** antes de instalar.\n\n` +
      `Responda as próximas mensagens neste canal.\n` +
      `Você tem **2 minutos** para cada resposta.\n\n` +
      `> Envie \`-\` para pular (quando possível) ou \`cancelar\` para abortar.`
    ),
    cv2Divider(),
    cv2Text(summaryLines),
  ], { accentColor: COLOR.main }));

  const collected = {};

  for (let i = 0; i < questions.length; i++) {
    const q        = questions[i];
    const progress = `(${i + 1}/${questions.length})`;

    // Envia a pergunta no canal (mensagem normal, não-CV2, para não
    // conflitar com o painel raiz)
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title:       `${e.emduvida} ${progress} ${q.label}`,
          description: q.description,
          color:       COLOR.library,
          fields: [
            { name: 'Para', value: q.actionLabel, inline: true },
            { name: 'Fluxo', value: q.flowName,   inline: true }
          ],
          footer: { text: 'Envie `-` para pular • `cancelar` para abortar' }
        }]
      }
    });

    // Aguarda resposta
    let msg;
    try {
      msg = await client.NextMessageCollector.wait({ channelId, userId, time: 120_000 });
    } catch {
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: {
          embeds: [{
            title:       `${e.sonolenta} Tempo esgotado`,
            description: 'A instalação foi cancelada por inatividade. Pode tentar de novo quando quiser~',
            color:       COLOR.danger
          }]
        }
      });
      return;
    }

    const content = msg.content?.trim();

    if (!content || content.toLowerCase() === 'cancelar') {
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: {
          embeds: [{
            title:       `${e.emburrada} Instalação cancelada`,
            description: 'Tudo bem, pode instalar quando quiser~',
            color:       COLOR.main
          }]
        }
      });
      return;
    }

    collected[q.storeKey] = content;
  }

  // Marca a interação com o override de destino, para que o
  // resumo final (_executeInstall) edite a mensagem raiz de verdade.
  interaction.__rootOverride = { channelId: rootChannelId, messageId: rootMessageId };

  return _executeInstall(interaction, client, lib, entry, userId, guildId, questions, collected, channelId, e);
}

/* ═══════════════════════════════════════════════════════════
   EXECUÇÃO DA INSTALAÇÃO
   ═══════════════════════════════════════════════════════════ */

async function _executeInstall(interaction, client, lib, entry, userId, guildId, questions, collected, channelId = null, e) {
  try {
    const preparedFlows = _applyCollectedValues(entry.flows || [], questions, collected);

    const flowIds = await lib.installPrepared({
      libId:   entry.libId,
      guildId,
      userId,
      flows:   preparedFlows,
      version: entry.version
    });

    const configLines = questions.length
      ? questions.map(q => {
          const raw   = collected[q.storeKey] || '-';
          const clean = raw.replace(/[<#@&!>]/g, '').trim();
          return `• **${q.actionLabel}** → \`${q.field}\` = ${clean || '_não definido_'}`;
        }).join('\n')
      : '_Nenhuma configuração necessária_';

    const blocks = [
      cv2Text(
        `# ${e.festa} ${entry.name} instalado!\n` +
        `**${flowIds.length}** fluxo(s) criado(s) neste servidor!`
      ),
      cv2Divider(),
      cv2Text(`**Configurações aplicadas:**\n${configLines}`),
    ];
    const payload = cv2Payload(blocks, { accentColor: COLOR.success });

    if (channelId) {
      return DiscordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: payload });
    }
    return _edit(interaction, client, payload);

  } catch (err) {
    const blocks = [cv2Text(`# ${e.assustada} Erro na instalação\n${err.message}`)];
    const payload = cv2Payload(blocks, { accentColor: COLOR.danger });

    if (channelId) {
      return DiscordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: payload });
    }
    return _edit(interaction, client, payload);
  }
}

/* ═══════════════════════════════════════════════════════════
   DEFINIÇÃO DO COMANDO
   ═══════════════════════════════════════════════════════════ */

module.exports = {
  data: {
    name:        'biblioteca',
    description: 'Biblioteca de Fluxos — explore, publique e instale sistemas prontos',
    options: [
      {
        type:        1,
        name:        'pesquisar',
        description: 'Pesquisa fluxos disponíveis na biblioteca',
        options: [
          { type: 3, name: 'nome',      description: 'Filtrar por nome',      required: false },
          { type: 3, name: 'categoria', description: 'Filtrar por categoria', required: false,
            choices: CATEGORIES.map(c => ({ name: c, value: c })) },
          { type: 3, name: 'tag',       description: 'Filtrar por tag',       required: false },
          { type: 3, name: 'autor',     description: 'ID do autor',           required: false },
          { type: 3, name: 'ordenar',   description: 'Ordenação dos resultados', required: false,
            choices: [
              { name: '📥 Mais instalados', value: 'installs' },
              { name: '⭐ Melhor avaliados', value: 'rating'   },
              { name: '🔥 Tendência',        value: 'trending' },
              { name: '🕐 Mais recentes',    value: 'recent'   }
            ]
          }
        ]
      },
      {
        type:        1,
        name:        'ver',
        description: 'Exibe detalhes de uma entrada da biblioteca',
        options: [
          { type: 3, name: 'id', description: 'ID da entrada (libId)', required: true }
        ]
      },
      {
        type:        1,
        name:        'instalar',
        description: 'Instala um sistema da biblioteca neste servidor',
        options: [
          { type: 3, name: 'id', description: 'ID da entrada (libId)', required: true }
        ]
      },
      {
        type:        1,
        name:        'publicar',
        description: 'Publica seus fluxos na biblioteca para a comunidade'
      },
      {
        type:        1,
        name:        'atualizar',
        description: 'Publica uma nova versão de uma entrada sua',
        options: [
          { type: 3, name: 'id', description: 'ID da entrada (libId)', required: true }
        ]
      },
      {
        type:        1,
        name:        'editar',
        description: 'Edita os metadados de uma entrada sua (nome, descrição, tags...)',
        options: [
          { type: 3, name: 'id', description: 'ID da entrada (libId)', required: true }
        ]
      },
      {
        type:        1,
        name:        'apagar',
        description: 'Remove uma entrada sua da biblioteca',
        options: [
          { type: 3, name: 'id', description: 'ID da entrada (libId)', required: true }
        ]
      },
      {
        type:        1,
        name:        'minhas',
        description: 'Lista todas as suas publicações na biblioteca'
      },
      {
        type:        1,
        name:        'perfil',
        description: 'Exibe o perfil de um criador',
        options: [
          { type: 6, name: 'usuario', description: 'Usuário (vazio = você mesmo)', required: false }
        ]
      },
      {
        type:        1,
        name:        'destaques',
        description: 'Exibe os destaques da semana na biblioteca'
      }
    ]
  },

  async execute(interaction, client) {
    const sub     = interaction.data.options?.[0]?.name;
    const opts    = _opts(interaction);
    const userId  = interaction.member?.user?.id || interaction.user?.id;
    const guildId = interaction.guild_id;
    const lib     = client.libraryManager;
    const e       = client.emoji;

    const MODAL_SUBS = ['publicar', 'atualizar', 'editar'];
    if (!MODAL_SUBS.includes(sub)) {
      await _defer(interaction);
    }

    try {
      switch (sub) {
        case 'pesquisar': return await _pesquisar(interaction, client, lib, opts, userId, e);
        case 'ver':       return await _ver(interaction, client, lib, opts, userId, e);
        case 'instalar':  return await _instalar(interaction, client, lib, opts, userId, guildId, e);
        case 'publicar':  return await _publicar(interaction, client, lib, userId, guildId, e);
        case 'atualizar': return await _atualizar(interaction, client, lib, opts, userId, guildId, e);
        case 'editar':    return await _editar(interaction, client, lib, opts, userId, e);
        case 'apagar':    return await _apagar(interaction, client, lib, opts, userId, e);
        case 'minhas':    return await _minhas(interaction, client, lib, userId, e);
        case 'perfil':    return await _perfil(interaction, client, lib, opts, userId, e);
        case 'destaques': return await _destaques(interaction, client, lib, e);
        default:
          return _edit(interaction, client, cv2Payload([
            cv2Text(`# ${e.assustada} Subcomando desconhecido\nNão reconheci esse comando. Tente novamente!`)
          ], { accentColor: COLOR.danger }));
      }
    } catch (err) {
      console.error(`[biblioteca/${sub}]`, err);
      return _edit(interaction, client, cv2Payload([
        cv2Text(`# ${e.assustada} Algo deu errado...\n${err.message || 'Ocorreu um erro inesperado. Me desculpe!'}`)
      ], { accentColor: COLOR.danger }));
    }
  }
};

/* ═══════════════════════════════════════════════════════════
   HELPER — resolve nome de autor
   ═══════════════════════════════════════════════════════════ */

async function _resolveAuthorName(lib, authorId, fallback = null) {
  if (fallback && fallback !== authorId) return fallback;

  try {
    const profile = await lib.getCreatorProfile(authorId);
    if (profile?.username && profile.username !== authorId) return profile.username;
  } catch {}

  try {
    const userData = await DiscordRequest(`/users/${authorId}`);
    return userData?.global_name || userData?.username || `Usuário ${authorId.slice(-4)}`;
  } catch {}

  return `Usuário ${authorId.slice(-4)}`;
}

function _opts(interaction) {
  const sub  = interaction.data.options?.[0];
  const opts = {};
  for (const o of sub?.options || []) opts[o.name] = o.value;
  return opts;
}

function _stars(avg, count) {
  if (!count) return '☆☆☆☆☆ _sem avaliações_';
  const full = Math.round(avg);
  return '⭐'.repeat(full) + '☆'.repeat(5 - full) + ` ${avg.toFixed(1)}`;
}

function _triggerLabel(trigger) {
  if (!trigger) return 'Não configurado';
  const labels = {
    'message:message_created':  '💬 Mensagem criada',
    'member:member_joined':     '👋 Membro entrou',
    'component:button_clicked': '🖱️ Botão clicado',
    'time:scheduled_trigger':   '🕐 Agendado'
  };
  return labels[`${trigger.category}:${trigger.type}`] || `${trigger.category}/${trigger.type}`;
}

/* ═══════════════════════════════════════════════════════════
   SUBCOMANDOS
   ═══════════════════════════════════════════════════════════ */

async function _pesquisar(interaction, client, lib, opts, userId, e) {
  const { results } = await lib.search({
    query:    opts.nome,
    category: opts.categoria,
    tag:      opts.tag,
    authorId: opts.autor,
    sort:     opts.ordenar || 'installs',
    page:     0,
    limit:    10
  });

  if (!results.length) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(
        `# ${e.emduvida} Nenhum resultado encontrado\n` +
        `Não encontrei nenhum fluxo com esses filtros.\nTente outros termos ou remova alguns filtros~`
      )
    ], { accentColor: COLOR.main }));
  }

  return _renderSearchPage(interaction, client, lib, {
    query:    opts.nome,
    category: opts.categoria,
    tag:      opts.tag,
    authorId: opts.autor,
    sort:     opts.ordenar || 'installs'
  }, 0, userId, e);
}

async function _renderSearchPage(interaction, client, lib, filters, page, userId, e) {
  const { results, total, pages } = await lib.search({ ...filters, page, limit: 8 });

  const authorNames = await Promise.all(
    results.map(entry => _resolveAuthorName(lib, entry.authorId, entry.authorName))
  );
  results.forEach((entry, i) => { entry._resolvedAuthor = authorNames[i]; });

  const filterDesc = [];
  if (filters.query)    filterDesc.push(`🔎 \`${filters.query}\``);
  if (filters.category) filterDesc.push(`${CATEGORY_EMOJI[filters.category] || '📦'} ${filters.category}`);
  if (filters.tag)      filterDesc.push(`🏷️ \`${filters.tag}\``);
  const filterLine = filterDesc.length ? `**Filtros:** ${filterDesc.join('  •  ')}\n` : '';

  const sortLabels = {
    installs: '📥 Mais instalados',
    rating:   '⭐ Melhor avaliados',
    trending: '🔥 Tendência',
    recent:   '🕐 Mais recentes'
  };
  const sortLine = `**Ordem:** ${sortLabels[filters.sort] || '📥 Mais instalados'}`;

  const lines = results.map((entry, i) => {
    const emoji = CATEGORY_EMOJI[entry.category] || '📦';
    const stars = _stars(entry.stats.avgRating, entry.stats.ratingCount);
    const num   = page * 8 + i + 1;
    return (
      `**${num}.** ${emoji} **${entry.name}** \`v${entry.version}\`\n` +
      `> 👤 ${entry._resolvedAuthor}  •  📥 ${entry.stats.installs.toLocaleString('pt-BR')} instalações  •  ${stars}\n` +
      `> _${entry.shortDesc || 'Sem descrição'}_`
    );
  }).join('\n\n');

  const selectOptions = results.map(entry => ({
    label:       entry.name.slice(0, 100),
    value:       entry.libId,
    description: (`v${entry.version} • ${entry._resolvedAuthor} • ${entry.stats.installs} instalações`).slice(0, 100),
    emoji:       { name: (CATEGORY_EMOJI[entry.category] || '📦').replace(/\uFE0F/g, '') }
  }));

  const sel = select(client, userId, selectOptions, '✨ Selecione para ver detalhes~', async (i) => {
    await _deferUpdate(i);
    return _renderDetail(i, client, lib, i.data.values[0], userId, e);
  });

  const blocks = [
    cv2Text(
      `# ${e.animada} Biblioteca de Fluxos\n` +
      (filterLine ? `${filterLine}` : '') +
      `${sortLine}`
    ),
    cv2Divider(),
    cv2Text(lines),
    cv2Divider(),
    row(sel),
  ];

  const navBtns = [];
  if (page > 0) {
    navBtns.push(btn(client, userId, '◀ Anterior', 2, async (i) => {
      await _deferUpdate(i);
      return _renderSearchPage(i, client, lib, filters, page - 1, userId, e);
    }));
  }
  navBtns.push(btn(client, userId, `${page + 1} / ${pages}`, 2, async (i) => { await _deferUpdate(i); }, { disabled: true }));
  if (page < pages - 1) {
    navBtns.push(btn(client, userId, 'Próxima ▶', 2, async (i) => {
      await _deferUpdate(i);
      return _renderSearchPage(i, client, lib, filters, page + 1, userId, e);
    }));
  }
  if (navBtns.length) blocks.push(row(...navBtns));

  blocks.push(cv2Divider());
  blocks.push(cv2Text(`-# ${total} resultado${total !== 1 ? 's' : ''} • Página ${page + 1} de ${pages}`));

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLOR.library }));
}

async function _ver(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(`# ${e.emduvida} Entrada não encontrada\nNão encontrei nada com esse ID. Confere se digitou certinho~`)
    ], { accentColor: COLOR.danger }));
  }
  return _renderDetail(interaction, client, lib, opts.id, userId, e, entry);
}

async function _renderDetail(interaction, client, lib, libId, userId, e, entry = null) {
  entry = entry || await lib.getById(libId);
  if (!entry) return;

  const authorName   = await _resolveAuthorName(lib, entry.authorId, entry.authorName);
  const userRating   = await lib.getUserRating(libId, userId);
  const emoji        = CATEGORY_EMOJI[entry.category] || '📦';
  const stars        = _stars(entry.stats.avgRating, entry.stats.ratingCount);
  const tags         = entry.tags?.length ? entry.tags.map(t => `\`${t}\``).join(' ') : '_Sem tags_';
  const likeStyle    = userRating?.vote === 'like'    ? 3 : 2;
  const dislikeStyle = userRating?.vote === 'dislike' ? 4 : 2;

  const questions     = _buildInstallQuestions(entry);
  const configsNeeded = questions.length;

  const btnInstall = btn(client, userId, '📥 Instalar', 3, async (i) => {
    await _deferUpdate(i);
    return _startInstallWizard(i, client, lib, entry, userId, i.guild_id, e);
  });

  const btnLike = btn(client, userId, `👍 ${entry.stats.likes}`, likeStyle, async (i) => {
    await _deferUpdate(i);
    await lib.vote(libId, userId, 'like');
    const updated = await lib.getById(libId);
    return _renderDetail(i, client, lib, libId, userId, e, updated);
  });

  const btnDislike = btn(client, userId, `👎 ${entry.stats.dislikes}`, dislikeStyle, async (i) => {
    await _deferUpdate(i);
    await lib.vote(libId, userId, 'dislike');
    const updated = await lib.getById(libId);
    return _renderDetail(i, client, lib, libId, userId, e, updated);
  });

  const btnRate = btn(client, userId, '⭐ Avaliar', 2, async (i) => _openRateModal(i, client, lib, libId, userId, e));

  const btnAuthor = btn(client, userId, '👤 Ver Autor', 2, async (i) => {
    await _deferUpdate(i);
    return _renderProfile(i, client, lib, entry.authorId, userId, e);
  });

  const blocks = [
    cv2Text(`# ${emoji} ${entry.name} \`v${entry.version}\`\n${entry.fullDesc || entry.shortDesc || '_Sem descrição_'}`),
    cv2Divider(),
    cv2Text(
      `> 👤 **Autor:** ${authorName}\n` +
      `> 📂 **Categoria:** ${entry.category}\n` +
      `> 📥 **Instalações:** ${entry.stats.installs.toLocaleString('pt-BR')}\n` +
      `> ⭐ **Avaliação:** ${stars} (${entry.stats.ratingCount} avaliações)\n` +
      `> 🔗 **Fluxos:** ${entry.flows?.length || 0}\n` +
      `> 🔧 **Configurações:** ${configsNeeded > 0 ? `${configsNeeded} campo(s)` : '_Nenhuma necessária_'}\n` +
      `> 🏷️ **Tags:** ${tags}\n` +
      `> 🆔 **ID:** \`${entry.libId}\``
    ),
    cv2Divider(),
    row(btnInstall, btnLike, btnDislike, btnRate, btnAuthor),
  ];

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLOR.library }));
}

async function _instalar(interaction, client, lib, opts, userId, guildId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(`# ${e.emduvida} Entrada não encontrada\nNão encontrei nada com esse ID. Confere se digitou certinho~`)
    ], { accentColor: COLOR.danger }));
  }
  return _startInstallWizard(interaction, client, lib, entry, userId, guildId, e);
}

async function _publicar(interaction, client, lib, userId, guildId, e) {
  const { FlowModel } = require('../../Mongodb/flow.js');
  const flows = await FlowModel.find({ guildId }).lean();

  if (!flows.length) {
    return _reply(interaction, cv2Payload([
      cv2Text(`# ${e.emburrada} Sem fluxos\nCrie pelo menos um fluxo antes de publicar na biblioteca~`)
    ], { accentColor: COLOR.danger }));
  }

  let authorName = 'Anônimo';
  try {
    const userData = await DiscordRequest(`/users/${userId}`);
    authorName = userData.global_name || userData.username || 'Anônimo';
  } catch {}

  const state = { selectedFlowIds: [] };
  return _renderPublishPanel(interaction, client, lib, flows, userId, guildId, authorName, state, true, e);
}

async function _renderPublishPanel(interaction, client, lib, flows, userId, guildId, authorName, state, isReply = true, e) {
  const selectedNames = state.selectedFlowIds
    .map(id => flows.find(f => f.flowId === id)?.name || id)
    .map((n, i) => `\`${i + 1}.\` ${n}`)
    .join('\n') || '_Nenhum fluxo adicionado ainda_';

  const available = flows.filter(f => !state.selectedFlowIds.includes(f.flowId));
  const blocks = [];

  blocks.push(cv2Text(
    `# ${e.animada} Publicar na Biblioteca\n` +
    `**Autor:** ${authorName}\n\n` +
    `Adicione os fluxos que farão parte deste sistema e clique em **Publicar** quando estiver pronto!`
  ));
  blocks.push(cv2Divider());
  blocks.push(cv2Text(`**📦 Fluxos selecionados (${state.selectedFlowIds.length}):**\n${selectedNames}`));
  blocks.push(cv2Divider());

  if (available.length) {
    const options = available.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${_triggerLabel(f.trigger)}`.slice(0, 100)
    }));

    const sel = select(client, userId, options, '✨ Adicionar fluxo ao sistema~', async (i) => {
      await _deferUpdate(i);
      const newId = i.data.values[0];
      if (!state.selectedFlowIds.includes(newId)) state.selectedFlowIds.push(newId);
      return _renderPublishPanel(i, client, lib, flows, userId, guildId, authorName, state, false, e);
    });
    blocks.push(row(sel));
  }

  const btnRemove = btn(client, userId, '➖ Remover último', 4, async (i) => {
    await _deferUpdate(i);
    state.selectedFlowIds.pop();
    return _renderPublishPanel(i, client, lib, flows, userId, guildId, authorName, state, false, e);
  });

  const btnPublish = btn(client, userId, '📤 Publicar', 3, async (i) => {
    if (!state.selectedFlowIds.length) { await _deferUpdate(i); return; }
    return _publicarModal(i, client, lib, userId, guildId, authorName, state.selectedFlowIds, e);
  }, { disabled: state.selectedFlowIds.length === 0 });

  blocks.push(row(btnRemove, btnPublish));
  blocks.push(cv2Divider());
  blocks.push(cv2Text('-# Você pode adicionar até 25 fluxos por publicação'));

  const payload = cv2Payload(blocks, { accentColor: COLOR.library });
  if (isReply) return _reply(interaction, payload);
  return _edit(interaction, client, payload);
}

async function _publicarModal(interaction, client, lib, userId, guildId, authorName, flowIds, e) {
  const modal = client.interactions.createModal({
    user:  userId,
    title: 'Publicar na Biblioteca',
    components: [
      { type: 1, components: [{ type: 4, custom_id: 'name',      label: 'Nome do sistema',              style: 1, required: true,  max_length: 100,  placeholder: 'Ex: Sistema de XP Avançado' }] },
      { type: 1, components: [{ type: 4, custom_id: 'shortDesc', label: 'Descrição curta',               style: 1, required: true,  max_length: 150,  placeholder: 'Sistema completo de XP com níveis...' }] },
      { type: 1, components: [{ type: 4, custom_id: 'fullDesc',  label: 'Descrição completa (opcional)', style: 2, required: false, max_length: 2000, placeholder: 'Explique o funcionamento detalhado...' }] },
      { type: 1, components: [{ type: 4, custom_id: 'category',  label: 'Categoria',                    style: 1, required: true,  max_length: 20,   placeholder: 'Moderação, Economia, RPG...' }] },
      { type: 1, components: [{ type: 4, custom_id: 'tags',      label: 'Tags (separadas por vírgula)',  style: 1, required: false, max_length: 200,  placeholder: 'xp, level, rank, recompensa' }] }
    ],
    funcao: async (modalInteraction, _client, fields) => {
      const category = CATEGORIES.find(c => c.toLowerCase() === fields.category?.trim().toLowerCase());

      await DiscordRequest(
        `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
        { method: 'POST', body: { type: 6 } }
      );

      if (!category) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(`# ${e.emduvida} Categoria inválida\nAs categorias disponíveis são:\n${CATEGORIES.join(', ')}`)
        ], { accentColor: COLOR.danger }));
      }

      try {
        const entry = await lib.publish({
          authorId:  userId,
          authorName,
          name:      fields.name.trim(),
          shortDesc: fields.shortDesc.trim(),
          fullDesc:  fields.fullDesc?.trim() || '',
          category,
          tags:      fields.tags ? fields.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          flowIds,
          guildId
        });

        _announcePublicLibrary(client, entry, authorName, flowIds.length, e).catch(() => {});

        return _followUp(modalInteraction, client, cv2Payload([
          cv2Text(
            `# ${e.festa} Publicado com sucesso!\n` +
            `**${entry.name}** já está disponível na biblioteca!\n\n` +
            `> 🆔 **ID:** \`${entry.libId}\`\n` +
            `> 📦 **Fluxos:** ${flowIds.length}\n` +
            `> 🔧 **Campos de configuração:** ${_buildInstallQuestions(entry).length}`
          )
        ], { accentColor: COLOR.success }));
      } catch (err) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(`# ${e.assustada} Erro ao publicar\n${err.message}`)
        ], { accentColor: COLOR.danger }));
      }
    }
  });

  return client.interactions.showModal(interaction, modal);
}

async function _announcePublicLibrary(client, entry, authorName, flowCount, e) {
  const emoji = CATEGORY_EMOJI[entry.category] || '📦';
  const tags  = entry.tags?.length ? entry.tags.map(t => `\`${t}\``).join(' ') : '_Sem tags_';

  await DiscordRequest(`/channels/${SUPPORT_ANNOUNCE_CHANNEL}/messages`, {
    method: 'POST',
    body: cv2Payload([
      cv2Text(
        `# ${emoji} Nova publicação na Biblioteca!\n` +
        `**${entry.name}** foi publicado por **${authorName}**.\n\n${entry.shortDesc || ''}`
      ),
      cv2Divider(),
      cv2Text(
        `> 📂 **Categoria:** ${entry.category}\n` +
        `> 🔗 **Fluxos:** ${flowCount}\n` +
        `> 🔧 **Configurações:** ${_buildInstallQuestions(entry).length}\n` +
        `> 🏷️ **Tags:** ${tags}\n` +
        `> 🆔 **ID:** \`${entry.libId}\``
      ),
    ], { accentColor: COLOR.library })
  });
}

async function _atualizar(interaction, client, lib, opts, userId, guildId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _reply(interaction, cv2Payload([
      cv2Text(`# ${e.emduvida} Entrada não encontrada\nNão encontrei nada com esse ID~`)
    ], { accentColor: COLOR.danger }));
  }
  if (entry.authorId !== userId) {
    return _reply(interaction, cv2Payload([
      cv2Text(`# ${e.brava} Sem permissão\nVocê não é o autor desta entrada.`)
    ], { accentColor: COLOR.danger }));
  }

  const { FlowModel } = require('../../Mongodb/flow.js');
  const flows = await FlowModel.find({ guildId }).lean();

  if (!flows.length) {
    return _reply(interaction, cv2Payload([
      cv2Text(`# ${e.emburrada} Sem fluxos\nCrie pelo menos um fluxo antes de atualizar~`)
    ], { accentColor: COLOR.danger }));
  }

  let authorName = entry.authorName || 'Anônimo';
  try {
    const userData = await DiscordRequest(`/users/${userId}`);
    authorName = userData.global_name || userData.username || authorName;
  } catch {}

  const state = { selectedFlowIds: [] };
  return _renderUpdatePanel(interaction, client, lib, flows, userId, guildId, authorName, opts.id, entry, state, true, e);
}

async function _renderUpdatePanel(interaction, client, lib, flows, userId, guildId, authorName, libId, entry, state, isReply = false, e) {
  const selectedNames = state.selectedFlowIds
    .map(id => flows.find(f => f.flowId === id)?.name || id)
    .map((n, i) => `\`${i + 1}.\` ${n}`)
    .join('\n') || '_Nenhum fluxo adicionado ainda_';

  const available = flows.filter(f => !state.selectedFlowIds.includes(f.flowId));
  const blocks = [];

  blocks.push(cv2Text(
    `# ${e.pensando} Atualizar — ${entry.name}\n` +
    `Versão atual: \`${entry.version}\`\n\n` +
    `Selecione os fluxos da nova versão e clique em **Confirmar atualização**~`
  ));
  blocks.push(cv2Divider());
  blocks.push(cv2Text(`**📦 Fluxos selecionados (${state.selectedFlowIds.length}):**\n${selectedNames}`));
  blocks.push(cv2Divider());

  if (available.length) {
    const options = available.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${_triggerLabel(f.trigger)}`.slice(0, 100)
    }));

    const sel = select(client, userId, options, '✨ Adicionar fluxo à nova versão~', async (i) => {
      await _deferUpdate(i);
      const newId = i.data.values[0];
      if (!state.selectedFlowIds.includes(newId)) state.selectedFlowIds.push(newId);
      return _renderUpdatePanel(i, client, lib, flows, userId, guildId, authorName, libId, entry, state, false, e);
    });
    blocks.push(row(sel));
  }

  const btnRemove = btn(client, userId, '➖ Remover último', 4, async (i) => {
    await _deferUpdate(i);
    state.selectedFlowIds.pop();
    return _renderUpdatePanel(i, client, lib, flows, userId, guildId, authorName, libId, entry, state, false, e);
  });

  const btnConfirm = btn(client, userId, '🔄 Confirmar atualização', 3, async (i) => {
    if (!state.selectedFlowIds.length) { await _deferUpdate(i); return; }
    return _atualizarModal(i, client, lib, libId, userId, guildId, authorName, state.selectedFlowIds, entry.version, e);
  }, { disabled: state.selectedFlowIds.length === 0 });

  blocks.push(row(btnRemove, btnConfirm));

  const payload = cv2Payload(blocks, { accentColor: COLOR.library });
  if (isReply) return _reply(interaction, payload);
  return _edit(interaction, client, payload);
}

async function _atualizarModal(interaction, client, lib, libId, userId, guildId, authorName, flowIds, currentVersion, e) {
  const modal = client.interactions.createModal({
    user:  userId,
    title: 'Nova Versão',
    components: [
      { type: 1, components: [{ type: 4, custom_id: 'version',   label: `Nova versão (atual: ${currentVersion})`, style: 1, required: true,  max_length: 20,  placeholder: '2.0.0' }] },
      { type: 1, components: [{ type: 4, custom_id: 'changelog', label: 'O que mudou?',                           style: 2, required: false, max_length: 500, placeholder: 'Novos recursos, correções...' }] }
    ],
    funcao: async (modalInteraction, _client, fields) => {
      await DiscordRequest(
        `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
        { method: 'POST', body: { type: 6 } }
      );

      try {
        const updated = await lib.publishUpdate({
          libId, authorId: userId, authorName, flowIds, guildId,
          newVersion: fields.version.trim(),
          changelog:  fields.changelog?.trim() || ''
        });

        return _followUp(modalInteraction, client, cv2Payload([
          cv2Text(
            `# ${e.festa} Atualizado para v${updated.version}!\n` +
            `**${updated.name}** foi atualizado com **${flowIds.length}** fluxo(s).\n` +
            `Os instaladores serão notificados via DM~`
          )
        ], { accentColor: COLOR.success }));
      } catch (err) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(`# ${e.assustada} Erro ao atualizar\n${err.message}`)
        ], { accentColor: COLOR.danger }));
      }
    }
  });

  return client.interactions.showModal(interaction, modal);
}

async function _editar(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _reply(interaction, cv2Payload([
      cv2Text(`# ${e.emduvida} Entrada não encontrada\nNão encontrei nada com esse ID~`)
    ], { accentColor: COLOR.danger }));
  }
  if (entry.authorId !== userId) {
    return _reply(interaction, cv2Payload([
      cv2Text(`# ${e.brava} Sem permissão\nVocê não é o autor desta entrada.`)
    ], { accentColor: COLOR.danger }));
  }

  const modal = client.interactions.createModal({
    user:  userId,
    title: `Editar — ${entry.name.slice(0, 30)}`,
    components: [
      { type: 1, components: [{ type: 4, custom_id: 'name',      label: 'Nome',               style: 1, required: true,  max_length: 100,  value: entry.name }] },
      { type: 1, components: [{ type: 4, custom_id: 'shortDesc', label: 'Descrição curta',    style: 1, required: false, max_length: 150,  value: entry.shortDesc || '' }] },
      { type: 1, components: [{ type: 4, custom_id: 'fullDesc',  label: 'Descrição completa', style: 2, required: false, max_length: 2000, value: entry.fullDesc  || '' }] },
      { type: 1, components: [{ type: 4, custom_id: 'category',  label: 'Categoria',          style: 1, required: false, max_length: 20,   value: entry.category }] },
      { type: 1, components: [{ type: 4, custom_id: 'tags',      label: 'Tags (vírgula)',     style: 1, required: false, max_length: 200,  value: entry.tags?.join(', ') || '' }] }
    ],
    funcao: async (modalInteraction, _client, fields) => {
      await DiscordRequest(
        `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
        { method: 'POST', body: { type: 6 } }
      );

      try {
        const category = fields.category
          ? CATEGORIES.find(c => c.toLowerCase() === fields.category.trim().toLowerCase())
          : entry.category;

        await lib.editMetadata(opts.id, userId, {
          name:      fields.name?.trim(),
          shortDesc: fields.shortDesc?.trim(),
          fullDesc:  fields.fullDesc?.trim(),
          category:  category || entry.category,
          tags:      fields.tags ? fields.tags.split(',').map(t => t.trim()).filter(Boolean) : entry.tags
        });

        return _followUp(modalInteraction, client, cv2Payload([
          cv2Text(`# ${e.feliz} Entrada atualizada!\nAs informações foram salvas com sucesso~`)
        ], { accentColor: COLOR.success }));
      } catch (err) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(`# ${e.assustada} Erro ao editar\n${err.message}`)
        ], { accentColor: COLOR.danger }));
      }
    }
  });

  return client.interactions.showModal(interaction, modal);
}

async function _apagar(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(`# ${e.emduvida} Entrada não encontrada\nNão encontrei nada com esse ID~`)
    ], { accentColor: COLOR.danger }));
  }
  if (entry.authorId !== userId) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(`# ${e.brava} Sem permissão\nVocê não é o autor desta entrada.`)
    ], { accentColor: COLOR.danger }));
  }

  const btnConfirm = btn(client, userId, '✅ Confirmar exclusão', 4, async (i) => {
    await _deferUpdate(i);
    try {
      await lib.delete(opts.id, userId);
      return _edit(i, client, cv2Payload([
        cv2Text(`# ${e.emburrada} Entrada removida\n**${entry.name}** foi removida da biblioteca.`)
      ], { accentColor: COLOR.danger }));
    } catch (err) {
      return _edit(i, client, cv2Payload([
        cv2Text(`# ${e.assustada} Erro ao apagar\n${err.message}`)
      ], { accentColor: COLOR.danger }));
    }
  });

  const btnCancel = btn(client, userId, '❌ Cancelar', 2, async (i) => {
    await _deferUpdate(i);
    return _edit(i, client, cv2Payload([
      cv2Text(`# ${e.feliz} Cancelado!\nA entrada continua na biblioteca~`)
    ], { accentColor: COLOR.main }));
  });

  return _edit(interaction, client, cv2Payload([
    cv2Text(
      `# ${e.assustada} Confirmar exclusão\n` +
      `Tem certeza que quer remover **${entry.name}** da biblioteca?\n\n` +
      `**Essa ação não pode ser desfeita.**\n` +
      `Instalações existentes nos servidores não serão afetadas.`
    ),
    cv2Divider(),
    row(btnConfirm, btnCancel),
  ], { accentColor: COLOR.danger }));
}

async function _minhas(interaction, client, lib, userId, e) {
  const entries = await lib.getMyPublications(userId);

  if (!entries.length) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(
        `# ${e.pensando} Minhas Publicações\n` +
        `Você ainda não publicou nada na biblioteca.\nUse \`/biblioteca publicar\` para começar~!`
      )
    ], { accentColor: COLOR.library }));
  }

  const lines = entries.map((entry, i) => {
    const statusIcon = entry.status === 'approved' ? '🟢' : entry.status === 'pending' ? '🟡' : '🔴';
    const emoji      = CATEGORY_EMOJI[entry.category] || '📦';
    return (
      `**${i + 1}.** ${statusIcon} ${emoji} **${entry.name}** \`v${entry.version}\`\n` +
      `> 📥 ${entry.stats.installs} instalações  •  ${_stars(entry.stats.avgRating, 0)}`
    );
  }).join('\n\n');

  const selectOptions = entries.slice(0, 25).map(entry => ({
    label:       entry.name.slice(0, 100),
    value:       entry.libId,
    description: (`v${entry.version} • ${entry.stats.installs} instalações`).slice(0, 100)
  }));

  const sel = select(client, userId, selectOptions, '✨ Selecione para gerenciar~', async (i) => {
    await _deferUpdate(i);
    const selected = entries.find(entry => entry.libId === i.data.values[0]);
    return _renderManageEntry(i, client, lib, selected, userId, e);
  });

  return _edit(interaction, client, cv2Payload([
    cv2Text(`# ${e.curtida} Minhas Publicações (${entries.length})\n${lines}`),
    cv2Divider(),
    row(sel),
    cv2Divider(),
    cv2Text('-# Selecione uma entrada para gerenciá-la'),
  ], { accentColor: COLOR.library }));
}

async function _renderManageEntry(interaction, client, lib, entry, userId, e) {
  const changelog = entry.lastChangelog ? `\n**Último changelog:** ${entry.lastChangelog}` : '';

  const history = entry.versionHistory?.length
    ? entry.versionHistory.slice(-3).reverse()
        .map(v => `• \`v${v.version}\` — ${v.changelog || 'sem changelog'}`)
        .join('\n')
    : '_Nenhum histórico_';

  const btnEditar = btn(client, userId, '✏️ Editar', 2, async (i) => _editar(i, client, lib, { id: entry.libId }, userId, e));

  const btnAtualizar = btn(client, userId, '🔄 Atualizar versão', 1, async (i) => _atualizar(i, client, lib, { id: entry.libId }, userId, i.guild_id, e));

  const btnApagar = btn(client, userId, '🗑️ Apagar', 4, async (i) => {
    await _deferUpdate(i);
    return _apagar(i, client, lib, { id: entry.libId }, userId, e);
  });

  const btnVoltar = btn(client, userId, '⬅️ Voltar', 2, async (i) => {
    await _deferUpdate(i);
    return _minhas(i, client, lib, userId, e);
  });

  return _edit(interaction, client, cv2Payload([
    cv2Text(`# ${CATEGORY_EMOJI[entry.category] || '📦'} ${entry.name} \`v${entry.version}\`\n${entry.shortDesc}${changelog}`),
    cv2Divider(),
    cv2Text(
      `> 📊 **Stats:** 📥 ${entry.stats.installs} instalações  •  👍 ${entry.stats.likes}  •  ⭐ ${entry.stats.avgRating}\n` +
      `> 🆔 **ID:** \`${entry.libId}\``
    ),
    cv2Divider(),
    cv2Text(`**📜 Histórico:**\n${history}`),
    cv2Divider(),
    row(btnEditar, btnAtualizar, btnApagar, btnVoltar),
  ], { accentColor: COLOR.library }));
}

async function _perfil(interaction, client, lib, opts, userId, e) {
  const targetId = opts.usuario || userId;
  return _renderProfile(interaction, client, lib, targetId, userId, e);
}

async function _renderProfile(interaction, client, lib, targetId, userId, e) {
  const profile = await lib.getCreatorProfile(targetId);

  let displayName = profile.username;
  if (!displayName || displayName === targetId) {
    try {
      const userData = await DiscordRequest(`/users/${targetId}`);
      displayName = userData?.global_name || userData?.username || `Usuário ${targetId.slice(-4)}`;
    } catch {
      displayName = `Usuário ${targetId.slice(-4)}`;
    }
  }

  const topEntries = profile.entries
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 5)
    .map((entry, i) => `${i + 1}. **${entry.name}** \`v${entry.version}\` — 📥 ${entry.installs}`)
    .join('\n') || '_Nenhuma publicação_';

  const isFollowing = (await lib.getFollowers(targetId)).includes(userId);
  const isSelf      = targetId === userId;

  const blocks = [
    cv2Text(`# ${e.carinho} ${displayName}\n${profile.bio || '_Sem bio_'}`),
    cv2Divider(),
    cv2Text(
      `> 📦 **Publicações:** ${profile.stats.totalFlows}\n` +
      `> 📥 **Instalações:** ${profile.stats.totalInstalls.toLocaleString('pt-BR')}\n` +
      `> 👍 **Likes:** ${profile.stats.totalLikes}\n` +
      `> ⭐ **Avaliação:** ${profile.stats.avgRating.toFixed(1)} ⭐\n` +
      `> 👥 **Seguidores:** ${profile.followers}`
    ),
    cv2Divider(),
    cv2Text(`**🏆 Top Fluxos:**\n${topEntries}`),
  ];

  if (!isSelf) {
    const btnFollow = btn(client, userId, isFollowing ? '➖ Deixar de seguir' : '➕ Seguir', isFollowing ? 4 : 3, async (i) => {
      await _deferUpdate(i);
      await lib.toggleFollow(userId, targetId);
      return _renderProfile(i, client, lib, targetId, userId, e);
    });
    blocks.push(cv2Divider());
    blocks.push(row(btnFollow));
  }

  blocks.push(cv2Divider());
  blocks.push(cv2Text(`-# ID: ${targetId}`));

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLOR.library }));
}

async function _destaques(interaction, client, lib, e) {
  const { trending, topInstalls, topRated, recent } = await lib.getHighlights();

  const fmt = async (list) => {
    if (!list.length) return '_Nenhum_';
    const names = await Promise.all(list.map(entry => _resolveAuthorName(lib, entry.authorId, entry.authorName)));
    return list.map((entry, i) =>
      `${i + 1}. **${entry.name}** por ${names[i]} — 📥 ${entry.stats.installs} • ⭐ ${entry.stats.avgRating}`
    ).join('\n');
  };

  const [fTrending, fInstalls, fRated, fRecent] = await Promise.all([
    fmt(trending), fmt(topInstalls), fmt(topRated), fmt(recent)
  ]);

  return _edit(interaction, client, cv2Payload([
    cv2Text(`# ${e.festa} Destaques da Semana`),
    cv2Divider(),
    cv2Text(`**📈 Tendência**\n${fTrending}`),
    cv2Divider(),
    cv2Text(`**📥 Mais instalados**\n${fInstalls}`),
    cv2Divider(),
    cv2Text(`**⭐ Melhor avaliados**\n${fRated}`),
    cv2Divider(),
    cv2Text(`**🕐 Mais recentes**\n${fRecent}`),
  ], { accentColor: COLOR.library }));
}

async function _openRateModal(interaction, client, lib, libId, userId, e) {
  const modal = client.interactions.createModal({
    user:  userId,
    title: 'Avaliar fluxo',
    components: [{
      type: 1,
      components: [{
        type:        4,
        custom_id:   'rating',
        label:       'Nota de 1 a 5',
        style:       1,
        required:    true,
        max_length:  1,
        placeholder: '5'
      }]
    }],
    funcao: async (modalInteraction, _client, fields) => {
      const rating = Number(fields.rating);

      await DiscordRequest(
        `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
        { method: 'POST', body: { type: 6 } }
      );

      if (!rating || rating < 1 || rating > 5) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(`# ${e.emduvida} Nota inválida\nInforme um número entre 1 e 5~`)
        ], { accentColor: COLOR.danger }));
      }

      const result = await lib.rate(libId, userId, rating);
      return _followUp(modalInteraction, client, cv2Payload([
        cv2Text(
          `# ${e.corao} Avaliação registrada!\n` +
          `Você deu **${rating} ⭐** para este fluxo.\n` +
          `Nova média: **${result.avg} ⭐** (${result.count} avaliações)`
        )
      ], { accentColor: COLOR.success }));
    }
  });

  return client.interactions.showModal(interaction, modal);
}
