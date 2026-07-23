'use strict';

const DiscordRequest = require('../../function/DiscordRequest.js');
const getPerm        = require('../../function/Utils/GetPerm.js');
const { localeCtx } = require('../../function/Utils/ctxLocale.js');


const CATEGORIES = [
  'Moderação','Economia','Automação','Logs','Tickets',
  'Recompensas','Eventos','RPG','Utilidade','Comunidade',
  'Diversão','Outros'
];

const CATEGORY_LOCALIZATIONS = {
  'Moderação':   { 'en-US': 'Moderation',   'en-GB': 'Moderation',   'es-ES': 'Moderacion' },
  'Economia':    { 'en-US': 'Economy',      'en-GB': 'Economy',      'es-ES': 'Economia' },
  'Automação':   { 'en-US': 'Automation',   'en-GB': 'Automation',   'es-ES': 'Automatizacion' },
  'Logs':        { 'en-US': 'Logs',         'en-GB': 'Logs',         'es-ES': 'Registros' },
  'Tickets':     { 'en-US': 'Tickets',      'en-GB': 'Tickets',      'es-ES': 'Tickets' },
  'Recompensas': { 'en-US': 'Rewards',      'en-GB': 'Rewards',      'es-ES': 'Recompensas' },
  'Eventos':     { 'en-US': 'Events',       'en-GB': 'Events',       'es-ES': 'Eventos' },
  'RPG':         { 'en-US': 'RPG',          'en-GB': 'RPG',          'es-ES': 'RPG' },
  'Utilidade':   { 'en-US': 'Utility',      'en-GB': 'Utility',      'es-ES': 'Utilidad' },
  'Comunidade':  { 'en-US': 'Community',    'en-GB': 'Community',    'es-ES': 'Comunidad' },
  'Diversão':    { 'en-US': 'Fun',          'en-GB': 'Fun',          'es-ES': 'Diversion' },
  'Outros':      { 'en-US': 'Other',        'en-GB': 'Other',        'es-ES': 'Otros' },
};

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
const GUIDE_URL = 'https://ayami-hoshiori.discloud.app/logic-builder';


const INSTALL_REQUIRED_FIELDS = {
  'message:send_message':        [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_send_message_channel' }],
  'message:delete_bot_message':  [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_delete_bot_message_channel' }],
  'channel:delete_channel':      [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_delete_channel' }],
  'channel:rename_channel':      [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_rename_channel' }],
  'channel:lock_channel':        [
    { field: 'channelId', labelKey: 'field_channel', descKey: 'desc_lock_channel' },
    { field: 'roleId',    labelKey: 'field_role',    descKey: 'desc_lock_role' }
  ],
  'channel:unlock_channel':      [
    { field: 'channelId', labelKey: 'field_channel', descKey: 'desc_unlock_channel' },
    { field: 'roleId',    labelKey: 'field_role',    descKey: 'desc_unlock_role' }
  ],
  'user:give_role':              [{ field: 'roleId',    labelKey: 'field_role', descKey: 'desc_give_role' }],
  'user:remove_role':            [{ field: 'roleId',    labelKey: 'field_role', descKey: 'desc_remove_role' }],
  'user:give_temp_role':         [{ field: 'roleId',    labelKey: 'field_role', descKey: 'desc_give_temp_role' }],
  'user:toggle_role':            [{ field: 'roleId',    labelKey: 'field_role', descKey: 'desc_toggle_role' }],
  'user:has_role':               [{ field: 'roleId',    labelKey: 'field_role', descKey: 'desc_check_role' }],
  'user:not_has_role':           [{ field: 'roleId',    labelKey: 'field_role', descKey: 'desc_check_role' }],
  'channel:is_channel':          [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_is_channel' }],
  'channel:not_channel':         [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_not_channel' }],
  'trigger:message':             [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_trigger_message' }],
  'trigger:reaction':            [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_trigger_generic' }],
  'trigger:component':           [{ field: 'channelId', labelKey: 'field_channel', descKey: 'desc_trigger_generic' }],
};


function _actionLabel(client, ctx, category, type) {
  const map = {
    'message:send_message':       'action_send_message',
    'message:send_dm':            'action_send_dm',
    'message:reply_message':      'action_reply_message',
    'message:delete_message':     'action_delete_message',
    'message:delete_bot_message': 'action_delete_bot_message',
    'user:give_role':             'action_give_role',
    'user:remove_role':           'action_remove_role',
    'user:give_temp_role':        'action_give_temp_role',
    'user:toggle_role':           'action_toggle_role',
    'user:has_role':              'action_has_role',
    'user:not_has_role':          'action_not_has_role',
    'channel:lock_channel':       'action_lock_channel',
    'channel:unlock_channel':     'action_unlock_channel',
    'channel:delete_channel':     'action_delete_channel',
    'channel:rename_channel':     'action_rename_channel',
    'channel:is_channel':         'action_is_channel',
    'channel:not_channel':        'action_not_channel',
  };
  const key = map[`${category}:${type}`];
  return key ? client.t(`biblioteca.${key}`, ctx) : `${category}/${type}`;
}


function _buildInstallQuestions(entry, client, ctx) {
  const questions = [];
  const flows     = entry.flows || [];

  for (let fi = 0; fi < flows.length; fi++) {
    const flow     = flows[fi];
    const flowName = flow.name || client.t('biblioteca.unnamed_flow', { ...ctx, n: fi + 1 });

    for (let ai = 0; ai < (flow.actions || []).length; ai++) {
      const action  = flow.actions[ai];
      const key     = `${action.category}:${action.type}`;
      const reqFields = INSTALL_REQUIRED_FIELDS[key];
      if (!reqFields) continue;

      for (const { field, labelKey, descKey } of reqFields) {
        questions.push({
          storeKey:    `f${fi}_a${ai}_${field}`,
          flowIndex:   fi,
          flowName,
          location:    'action',
          itemIndex:   ai,
          category:    action.category,
          type:        action.type,
          field,
          label:       client.t(`biblioteca.${labelKey}`, ctx),
          description: client.t(`biblioteca.${descKey}`, ctx),
          actionLabel: client.t('biblioteca.action_suffix', { ...ctx, label: _actionLabel(client, ctx, action.category, action.type), flowName })
        });
      }
    }

    for (let ci = 0; ci < (flow.conditions || []).length; ci++) {
      const cond    = flow.conditions[ci];
      const key     = `${cond.category}:${cond.type}`;
      const reqFields = INSTALL_REQUIRED_FIELDS[key];
      if (!reqFields) continue;

      for (const { field, labelKey, descKey } of reqFields) {
        questions.push({
          storeKey:    `f${fi}_c${ci}_${field}`,
          flowIndex:   fi,
          flowName,
          location:    'condition',
          itemIndex:   ci,
          category:    cond.category,
          type:        cond.type,
          field,
          label:       client.t(`biblioteca.${labelKey}`, ctx),
          description: client.t(`biblioteca.${descKey}`, ctx),
          actionLabel: client.t('biblioteca.condition_suffix', { ...ctx, label: _actionLabel(client, ctx, cond.category, cond.type), flowName })
        });
      }
    }

    if (flow.trigger?.filters) {
      const triggerKey = `trigger:${flow.trigger.category}`;
      const reqFields  = INSTALL_REQUIRED_FIELDS[triggerKey];
      if (reqFields) {
        for (const { field, labelKey, descKey } of reqFields) {
          questions.push({
            storeKey:    `f${fi}_t_${field}`,
            flowIndex:   fi,
            flowName,
            location:    'trigger',
            itemIndex:   -1,
            category:    flow.trigger.category,
            type:        flow.trigger.type,
            field,
            label:       client.t(`biblioteca.${labelKey}`, ctx),
            description: client.t(`biblioteca.${descKey}`, ctx) + client.t('biblioteca.trigger_skip_suffix', ctx),
            actionLabel: client.t('biblioteca.trigger_label_generic', { ...ctx, flowName })
          });
        }
      }
    }
  }

  return questions;
}


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


function cv2Text(content) {
  return { type: 10, content };
}

function cv2Divider(spacing = 1) {
  return { type: 14, divider: true, spacing };
}

function cv2Section(content, button) {
  return {
    type:      9,
    accessory: button,
    components: [cv2Text(content)]
  };
}

function cv2Gallery(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  return {
    type:  12,
    items: list.map(url => ({ media: { url }, description: null, spoiler: false }))
  };
}

function cv2Container(blocks, opts = {}) {
  return {
    type:         17,
    accent_color: opts.accentColor ?? COLOR.main,
    spoiler:      opts.spoiler ?? false,
    components:   blocks
  };
}

function cv2Flags(ephemeral = false) {
  return ephemeral ? 32768 | 64 : 32768;
}

function cv2Payload(blocks, opts = {}) {
  return {
    flags:      cv2Flags(opts.ephemeral ?? false),
    components: [cv2Container(blocks, opts)]
  };
}

function row(...components) {
  return { type: 1, components };
}

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

function _clampPage(page, total, perPage = 8) {
  const maxPage  = Math.max(0, Math.ceil(total / perPage) - 1);
  const safePage = Math.min(Math.max(0, page), maxPage);
  return { page: safePage, maxPage };
}


async function _startInstallWizard(interaction, client, lib, entry, userId, guildId, e) {
  guildId = guildId || interaction.guild_id;
  const channelId = interaction.channel_id;
  const ctx = localeCtx(interaction);

  let perms = [];
  try {
    perms = await getPerm({ guildId, id: userId, client });
  } catch (err) {
    console.error('[instalar] getPerm error:', err);
  }

  if (!perms.includes('MANAGE_GUILD') && !perms.includes('ADMINISTRATOR')) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(client.t('biblioteca.no_permission_install', { ...ctx, eBrava: e.brava }))
    ], { accentColor: COLOR.danger }));
  }

  const questions = _buildInstallQuestions(entry, client, ctx);

  if (!questions.length) {
    return _executeInstall(interaction, client, lib, entry, userId, guildId, [], {}, null, e);
  }

  const rootChannelId = interaction.channel_id || interaction.channel?.id;
  let rootMessageId   = interaction.message?.id;
  if (!rootMessageId) {
    const original = await DiscordRequest(
      `/webhooks/${client.clientId}/${interaction.token}/messages/@original`
    ).catch(() => null);
    rootMessageId = original?.id;
  }

  const summaryLines = questions.map((q, i) => `\`${i + 1}.\` **${q.label}** — _${q.actionLabel}_`).slice(0, 25).join('\n');

  await _edit(interaction, client, cv2Payload([
    cv2Text(client.t('biblioteca.install_configuring', { ...ctx, ePensando: e.pensando, entryName: entry.name, count: questions.length })),
    cv2Divider(),
    cv2Text(summaryLines),
  ], { accentColor: COLOR.main }));

  const collected = {};

  for (let i = 0; i < questions.length; i++) {
    const q        = questions[i];
    const progress = `(${i + 1}/${questions.length})`;

    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title:       `${e.emduvida} ${progress} ${q.label}`,
          description: q.description,
          color:       COLOR.library,
          fields: [
            { name: client.t('biblioteca.install_question_for', ctx),  value: q.actionLabel, inline: true },
            { name: client.t('biblioteca.install_question_flow', ctx), value: q.flowName,    inline: true }
          ],
          footer: { text: client.t('biblioteca.install_question_footer', ctx) }
        }]
      }
    });

    let msg;
    try {
      msg = await client.NextMessageCollector.wait({ channelId, userId, time: 120_000 });
    } catch {
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: {
          embeds: [{
            title:       client.t('biblioteca.install_timeout_title', { ...ctx, eSonolenta: e.sonolenta }),
            description: client.t('biblioteca.install_timeout_desc', ctx),
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
            title:       client.t('biblioteca.install_cancelled_title', { ...ctx, eEmburrada: e.emburrada }),
            description: client.t('biblioteca.install_cancelled_desc', ctx),
            color:       COLOR.main
          }]
        }
      });
      return;
    }

    collected[q.storeKey] = content;
  }

  interaction.__rootOverride = { channelId: rootChannelId, messageId: rootMessageId };

  return _executeInstall(interaction, client, lib, entry, userId, guildId, questions, collected, channelId, e);
}


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

    const ctx = localeCtx(interaction);

    const configLines = questions.length
      ? questions.map(q => {
          const raw   = collected[q.storeKey] || '-';
          const clean = raw.replace(/[<#@&!>]/g, '').trim();
          return `• **${q.actionLabel}** → \`${q.field}\` = ${clean || client.t('biblioteca.install_not_set', ctx)}`;
        }).join('\n')
      : client.t('biblioteca.install_no_config', ctx);

    const blocks = [
      cv2Text(client.t('biblioteca.install_success', { ...ctx, eFesta: e.festa, entryName: entry.name, count: flowIds.length })),
      cv2Divider(),
      cv2Text(client.t('biblioteca.install_config_applied', { ...ctx, lines: configLines })),
    ];
    const payload = cv2Payload(blocks, { accentColor: COLOR.success });

    if (channelId) {
      return DiscordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: payload });
    }
    return _edit(interaction, client, payload);

  } catch (err) {
    const ctx = localeCtx(interaction);
    const blocks = [cv2Text(client.t('biblioteca.install_error', { ...ctx, eAssustada: e.assustada, message: err.message }))];
    const payload = cv2Payload(blocks, { accentColor: COLOR.danger });

    if (channelId) {
      return DiscordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: payload });
    }
    return _edit(interaction, client, payload);
  }
}


module.exports = {
  data: {
    name:        'biblioteca',
    description: 'Biblioteca de Fluxos — explore, publique e instale sistemas prontos',
    name_localizations: { 'en-US': 'library', 'en-GB': 'library', 'es-ES': 'biblioteca' },
    description_localizations: {
      'en-US': 'Flow Library — browse, publish, and install ready-made systems',
      'en-GB': 'Flow Library — browse, publish, and install ready-made systems',
      'es-ES': 'Biblioteca de Flujos — explora, publica e instala sistemas listos para usar',
    },
    options: [
      {
        type:        1,
        name:        'pesquisar',
        name_localizations: { 'en-US': "search", 'en-GB': "search", 'es-ES': "buscar" },
        description: 'Pesquisa fluxos disponíveis na biblioteca',
        description_localizations: { 'en-US': "Search available flows in the library", 'en-GB': "Search available flows in the library", 'es-ES': "Busca flujos disponibles en la biblioteca" },
        options: [
          { type: 3, name: 'nome',
          name_localizations: { 'en-US': "name", 'en-GB': "name", 'es-ES': "nombre" },      description: 'Filtrar por nome',
          description_localizations: { 'en-US': "Filter by name", 'en-GB': "Filter by name", 'es-ES': "Filtrar por nombre" },      required: false },
          { type: 3, name: 'categoria',
          name_localizations: { 'en-US': "category", 'en-GB': "category", 'es-ES': "categoria" }, description: 'Filtrar por categoria',
          description_localizations: { 'en-US': "Filter by category", 'en-GB': "Filter by category", 'es-ES': "Filtrar por categoria" }, required: false,
            choices: CATEGORIES.map(c => ({ name: c, name_localizations: CATEGORY_LOCALIZATIONS[c], value: c })) },
          { type: 3, name: 'tag',
          name_localizations: { 'en-US': "tag", 'en-GB': "tag", 'es-ES': "etiqueta" },       description: 'Filtrar por tag',
          description_localizations: { 'en-US': "Filter by tag", 'en-GB': "Filter by tag", 'es-ES': "Filtrar por etiqueta" },       required: false },
          { type: 3, name: 'autor',
          name_localizations: { 'en-US': "author", 'en-GB': "author", 'es-ES': "autor" },     description: 'ID do autor',
          description_localizations: { 'en-US': "Author's ID", 'en-GB': "Author's ID", 'es-ES': "ID del autor" },           required: false },
          { type: 3, name: 'ordenar',
          name_localizations: { 'en-US': "sort", 'en-GB': "sort", 'es-ES': "ordenar" },   description: 'Ordenação dos resultados',
          description_localizations: { 'en-US': "Sort order for the results", 'en-GB': "Sort order for the results", 'es-ES': "Orden de los resultados" }, required: false,
            choices: [
              { name: '📥 Mais instalados',
              name_localizations: { 'en-US': "📥 Most installed", 'en-GB': "📥 Most installed", 'es-ES': "📥 Mas instalados" }, value: 'installs' },
              { name: '⭐ Melhor avaliados',
              name_localizations: { 'en-US': "⭐ Top rated", 'en-GB': "⭐ Top rated", 'es-ES': "⭐ Mejor valorados" }, value: 'rating'   },
              { name: '🔥 Tendência',
              name_localizations: { 'en-US': "🔥 Trending", 'en-GB': "🔥 Trending", 'es-ES': "🔥 Tendencia" },        value: 'trending' },
              { name: '🕐 Mais recentes',
              name_localizations: { 'en-US': "🕐 Most recent", 'en-GB': "🕐 Most recent", 'es-ES': "🕐 Mas recientes" },    value: 'recent'   }
            ]
          }
        ]
      },
      {
        type:        1,
        name:        'ver',
        name_localizations: { 'en-US': "view", 'en-GB': "view", 'es-ES': "ver" },
        description: 'Exibe detalhes de uma entrada da biblioteca',
        description_localizations: { 'en-US': "Shows details of a library entry", 'en-GB': "Shows details of a library entry", 'es-ES': "Muestra los detalles de una entrada de la biblioteca" },
        options: [
          { type: 3, name: 'id',
          name_localizations: { 'en-US': "id", 'en-GB': "id", 'es-ES': "id" }, description: 'ID da entrada (libId)',
          description_localizations: { 'en-US': "Entry ID (libId)", 'en-GB': "Entry ID (libId)", 'es-ES': "ID de la entrada (libId)" }, required: true }
        ]
      },
      {
        type:        1,
        name:        'instalar',
        name_localizations: { 'en-US': "install", 'en-GB': "install", 'es-ES': "instalar" },
        description: 'Instala um sistema da biblioteca neste servidor',
        description_localizations: { 'en-US': "Installs a library system on this server", 'en-GB': "Installs a library system on this server", 'es-ES': "Instala un sistema de la biblioteca en este servidor" },
        options: [
          { type: 3, name: 'id',
          name_localizations: { 'en-US': "id", 'en-GB': "id", 'es-ES': "id" }, description: 'ID da entrada (libId)',
          description_localizations: { 'en-US': "Entry ID (libId)", 'en-GB': "Entry ID (libId)", 'es-ES': "ID de la entrada (libId)" }, required: true }
        ]
      },
      {
        type:        1,
        name:        'publicar',
        name_localizations: { 'en-US': "publish", 'en-GB': "publish", 'es-ES': "publicar" },
        description: 'Publica seus fluxos na biblioteca para a comunidade',
        description_localizations: { 'en-US': "Publishes your flows to the library for the community", 'en-GB': "Publishes your flows to the library for the community", 'es-ES': "Publica tus flujos en la biblioteca para la comunidad" }
      },
      {
        type:        1,
        name:        'atualizar',
        name_localizations: { 'en-US': "update", 'en-GB': "update", 'es-ES': "actualizar" },
        description: 'Publica uma nova versão de uma entrada sua',
        description_localizations: { 'en-US': "Publishes a new version of one of your entries", 'en-GB': "Publishes a new version of one of your entries", 'es-ES': "Publica una nueva version de una de tus entradas" },
        options: [
          { type: 3, name: 'id',
          name_localizations: { 'en-US': "id", 'en-GB': "id", 'es-ES': "id" }, description: 'ID da entrada (libId)',
          description_localizations: { 'en-US': "Entry ID (libId)", 'en-GB': "Entry ID (libId)", 'es-ES': "ID de la entrada (libId)" }, required: true }
        ]
      },
      {
        type:        1,
        name:        'editar',
        name_localizations: { 'en-US': "edit", 'en-GB': "edit", 'es-ES': "editar" },
        description: 'Edita os metadados de uma entrada sua (nome, descrição, tags...)',
        description_localizations: { 'en-US': "Edits the metadata of one of your entries (name, description, tags...)", 'en-GB': "Edits the metadata of one of your entries (name, description, tags...)", 'es-ES': "Edita los metadatos de una de tus entradas (nombre, descripcion, etiquetas...)" },
        options: [
          { type: 3, name: 'id',
          name_localizations: { 'en-US': "id", 'en-GB': "id", 'es-ES': "id" }, description: 'ID da entrada (libId)',
          description_localizations: { 'en-US': "Entry ID (libId)", 'en-GB': "Entry ID (libId)", 'es-ES': "ID de la entrada (libId)" }, required: true }
        ]
      },
      {
        type:        1,
        name:        'apagar',
        name_localizations: { 'en-US': "delete", 'en-GB': "delete", 'es-ES': "eliminar" },
        description: 'Remove uma entrada sua da biblioteca',
        description_localizations: { 'en-US': "Removes one of your entries from the library", 'en-GB': "Removes one of your entries from the library", 'es-ES': "Elimina una de tus entradas de la biblioteca" },
        options: [
          { type: 3, name: 'id',
          name_localizations: { 'en-US': "id", 'en-GB': "id", 'es-ES': "id" }, description: 'ID da entrada (libId)',
          description_localizations: { 'en-US': "Entry ID (libId)", 'en-GB': "Entry ID (libId)", 'es-ES': "ID de la entrada (libId)" }, required: true }
        ]
      },
      {
        type:        1,
        name:        'minhas',
        name_localizations: { 'en-US': "mine", 'en-GB': "mine", 'es-ES': "mias" },
        description: 'Lista todas as suas publicações na biblioteca',
        description_localizations: { 'en-US': "Lists all of your publications in the library", 'en-GB': "Lists all of your publications in the library", 'es-ES': "Lista todas tus publicaciones en la biblioteca" }
      },
      {
        type:        1,
        name:        'perfil',
        name_localizations: { 'en-US': "profile", 'en-GB': "profile", 'es-ES': "perfil" },
        description: 'Exibe o perfil de um criador',
        description_localizations: { 'en-US': "Shows a creator's profile", 'en-GB': "Shows a creator's profile", 'es-ES': "Muestra el perfil de un creador" },
        options: [
          { type: 6, name: 'usuario',
          name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" }, description: 'Usuário (vazio = você mesmo)',
          description_localizations: { 'en-US': "User (empty = yourself)", 'en-GB': "User (empty = yourself)", 'es-ES': "Usuario (vacio = tu mismo)" }, required: false }
        ]
      },
      {
        type:        1,
        name:        'destaques',
        name_localizations: { 'en-US': "featured", 'en-GB': "featured", 'es-ES': "destacados" },
        description: 'Exibe os destaques da semana na biblioteca',
        description_localizations: { 'en-US': "Shows this week's featured entries in the library", 'en-GB': "Shows this week's featured entries in the library", 'es-ES': "Muestra los destacados de la semana en la biblioteca" }
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
        default: {
          const ctx = localeCtx(interaction);
          return _edit(interaction, client, cv2Payload([
            cv2Text(client.t('biblioteca.unknown_subcommand', { ...ctx, eAssustada: e.assustada }))
          ], { accentColor: COLOR.danger }));
        }
      }
    } catch (err) {
      console.error(`[biblioteca/${sub}]`, err);
      const ctx = localeCtx(interaction);
      return _edit(interaction, client, cv2Payload([
        cv2Text(client.t('biblioteca.generic_error', { ...ctx, eAssustada: e.assustada, message: err.message || client.t('biblioteca.generic_error_fallback', ctx) }))
      ], { accentColor: COLOR.danger }));
    }
  }
};


async function _resolveAuthorName(lib, authorId, client, ctx, fallback = null) {
  if (fallback && fallback !== authorId) return fallback;

  try {
    const profile = await lib.getCreatorProfile(authorId);
    if (profile?.username && profile.username !== authorId) return profile.username;
  } catch {}

  try {
    const userData = await DiscordRequest(`/users/${authorId}`);
    return userData?.global_name || userData?.username || client.t('biblioteca.fallback_user', { ...ctx, suffix: authorId.slice(-4) });
  } catch {}

  return client.t('biblioteca.fallback_user', { ...ctx, suffix: authorId.slice(-4) });
}

function _opts(interaction) {
  const sub  = interaction.data.options?.[0];
  const opts = {};
  for (const o of sub?.options || []) opts[o.name] = o.value;
  return opts;
}

function _stars(client, ctx, avg, count) {
  if (!count) return client.t('biblioteca.no_ratings', ctx);
  const full = Math.round(avg);
  return '⭐'.repeat(full) + '☆'.repeat(5 - full) + ` ${avg.toFixed(1)}`;
}

function _triggerLabel(client, ctx, trigger) {
  if (!trigger) return client.t('biblioteca.not_configured', ctx);
  const labels = {
    'message:message_created':  'trigger_message_created',
    'member:member_joined':     'trigger_member_joined',
    'component:button_clicked': 'trigger_button_clicked',
    'time:scheduled_trigger':   'trigger_scheduled'
  };
  const key = labels[`${trigger.category}:${trigger.type}`];
  return key ? client.t(`biblioteca.${key}`, ctx) : `${trigger.category}/${trigger.type}`;
}


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
    const ctx = localeCtx(interaction);
    return _edit(interaction, client, cv2Payload([
      cv2Text(
        `# ${e.emduvida} ${client.t('biblioteca.no_results_title', ctx)}\n` +
        client.t('biblioteca.no_results_desc', ctx)
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
  const ctx = localeCtx(interaction);
  const numLocale = ctx.system?.locale || 'pt-BR';

  const authorNames = await Promise.all(
    results.map(entry => _resolveAuthorName(lib, entry.authorId, client, ctx, entry.authorName))
  );
  results.forEach((entry, i) => { entry._resolvedAuthor = authorNames[i]; });

  const filterDesc = [];
  if (filters.query)    filterDesc.push(`🔎 \`${filters.query}\``);
  if (filters.category) filterDesc.push(`${CATEGORY_EMOJI[filters.category] || '📦'} ${filters.category}`);
  if (filters.tag)      filterDesc.push(`🏷️ \`${filters.tag}\``);
  const filterLine = filterDesc.length ? `**${client.t('biblioteca.search_filters_label', ctx)}:** ${filterDesc.join('  •  ')}\n` : '';

  const sortLabels = {
    installs: client.t('biblioteca.sort_installs', ctx),
    rating:   client.t('biblioteca.sort_rating', ctx),
    trending: client.t('biblioteca.sort_trending', ctx),
    recent:   client.t('biblioteca.sort_recent', ctx)
  };
  const sortLine = `**${client.t('biblioteca.search_order_label', ctx)}:** ${sortLabels[filters.sort] || client.t('biblioteca.sort_installs', ctx)}`;

  const lines = results.map((entry, i) => {
    const emoji = CATEGORY_EMOJI[entry.category] || '📦';
    const stars = _stars(client, ctx, entry.stats.avgRating, entry.stats.ratingCount);
    const num   = page * 8 + i + 1;
    return (
      `**${num}.** ${emoji} **${entry.name}** \`v${entry.version}\`\n` +
      `> 👤 ${entry._resolvedAuthor}  •  ${client.t('biblioteca.search_installs_label', { ...ctx, count: entry.stats.installs.toLocaleString(numLocale) })}  •  ${stars}\n` +
      `> _${entry.shortDesc || client.t('biblioteca.search_no_desc', ctx)}_`
    );
  }).join('\n\n');

  const selectOptions = results.map(entry => ({
    label:       entry.name.slice(0, 100),
    value:       entry.libId,
    description: (`v${entry.version} • ${entry._resolvedAuthor} • ${client.t('biblioteca.search_installs_label', { ...ctx, count: entry.stats.installs })}`).slice(0, 100),
    emoji:       { name: (CATEGORY_EMOJI[entry.category] || '📦').replace(/\uFE0F/g, '') }
  }));

  const sel = select(client, userId, selectOptions, client.t('biblioteca.search_select_placeholder', ctx), async (i) => {
    await _deferUpdate(i);
    return _renderDetail(i, client, lib, i.data.values[0], userId, e);
  });

  const blocks = [
    cv2Text(client.t('biblioteca.search_title', { ...ctx, eAnimada: e.animada, filterLine, sortLine })),
    cv2Divider(),
    cv2Text(lines),
    cv2Divider(),
    row(sel),
  ];

  const navBtns = [];
  if (page > 0) {
    navBtns.push(btn(client, userId, client.t('biblioteca.search_prev', ctx), 2, async (i) => {
      await _deferUpdate(i);
      return _renderSearchPage(i, client, lib, filters, page - 1, userId, e);
    }));
  }
  navBtns.push(btn(client, userId, `${page + 1} / ${pages}`, 2, async (i) => { await _deferUpdate(i); }, { disabled: true }));
  if (page < pages - 1) {
    navBtns.push(btn(client, userId, client.t('biblioteca.search_next', ctx), 2, async (i) => {
      await _deferUpdate(i);
      return _renderSearchPage(i, client, lib, filters, page + 1, userId, e);
    }));
  }
  if (navBtns.length) blocks.push(row(...navBtns));

  blocks.push(cv2Divider());
  blocks.push(cv2Text(client.t('biblioteca.search_footer', { ...ctx, total, page: page + 1, pages })));

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLOR.library }));
}

async function _ver(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    const ctx = localeCtx(interaction);
    return _edit(interaction, client, cv2Payload([
      cv2Text(client.t('biblioteca.entry_not_found', { ...ctx, eEmduvida: e.emduvida }))
    ], { accentColor: COLOR.danger }));
  }
  return _renderDetail(interaction, client, lib, opts.id, userId, e, entry);
}

async function _renderDetail(interaction, client, lib, libId, userId, e, entry = null) {
  entry = entry || await lib.getById(libId);
  if (!entry) return;

  const ctx = localeCtx(interaction);
  const numLocale = ctx.system?.locale || 'pt-BR';

  const authorName   = await _resolveAuthorName(lib, entry.authorId, client, ctx, entry.authorName);
  const userRating   = await lib.getUserRating(libId, userId);
  const emoji        = CATEGORY_EMOJI[entry.category] || '📦';
  const stars        = _stars(client, ctx, entry.stats.avgRating, entry.stats.ratingCount);
  const tags         = entry.tags?.length ? entry.tags.map(t => `\`${t}\``).join(' ') : client.t('biblioteca.detail_no_tags', ctx);
  const likeStyle    = userRating?.vote === 'like'    ? 3 : 2;
  const dislikeStyle = userRating?.vote === 'dislike' ? 4 : 2;

  const questions     = _buildInstallQuestions(entry, client, ctx);
  const configsNeeded = questions.length;

  const btnInstall = btn(client, userId, client.t('biblioteca.btn_install', ctx), 3, async (i) => {
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

  const btnRate = btn(client, userId, client.t('biblioteca.btn_rate', ctx), 2, async (i) => _openRateModal(i, client, lib, libId, userId, e));

  const btnAuthor = btn(client, userId, client.t('biblioteca.btn_view_author', ctx), 2, async (i) => {
    await _deferUpdate(i);
    return _renderProfile(i, client, lib, entry.authorId, userId, e);
  });

  const blocks = [
    cv2Text(`# ${emoji} ${entry.name} \`v${entry.version}\`\n${entry.fullDesc || entry.shortDesc || client.t('biblioteca.detail_no_desc', ctx)}`),
    cv2Divider(),
    cv2Text(
      `> ${client.t('biblioteca.detail_author', ctx)} ${authorName}\n` +
      `> ${client.t('biblioteca.detail_category', ctx)} ${entry.category}\n` +
      `> ${client.t('biblioteca.detail_installs', ctx)} ${entry.stats.installs.toLocaleString(numLocale)}\n` +
      `> ${client.t('biblioteca.detail_rating', { ...ctx, stars, count: entry.stats.ratingCount })}\n` +
      `> ${client.t('biblioteca.detail_flows', ctx)} ${entry.flows?.length || 0}\n` +
      `> ${client.t('biblioteca.detail_config', ctx)} ${configsNeeded > 0 ? client.t('biblioteca.detail_config_fields', { ...ctx, count: configsNeeded }) : client.t('biblioteca.detail_config_none', ctx)}\n` +
      `> ${client.t('biblioteca.detail_tags', ctx)} ${tags}\n` +
      `> ${client.t('biblioteca.detail_id', ctx)} \`${entry.libId}\``
    ),
    cv2Divider(),
    row(btnInstall, btnLike, btnDislike, btnRate, btnAuthor),
  ];

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLOR.library }));
}

async function _instalar(interaction, client, lib, opts, userId, guildId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    const ctx = localeCtx(interaction);
    return _edit(interaction, client, cv2Payload([
      cv2Text(client.t('biblioteca.entry_not_found', { ...ctx, eEmduvida: e.emduvida }))
    ], { accentColor: COLOR.danger }));
  }
  return _startInstallWizard(interaction, client, lib, entry, userId, guildId, e);
}

async function _publicar(interaction, client, lib, userId, guildId, e) {
  const { FlowModel } = require('../../Mongodb/flow.js');
  const flows = await FlowModel.find({ guildId }).lean();
  const ctx = localeCtx(interaction);

  if (!flows.length) {
    return _reply(interaction, cv2Payload([
      cv2Text(`${client.t('biblioteca.no_flows_title', { ...ctx, eEmburrada: e.emburrada })}\n${client.t('biblioteca.no_flows_publish_desc', ctx)}`)
    ], { accentColor: COLOR.danger }));
  }

  let authorName = client.t('biblioteca.fallback_anon', ctx);
  try {
    const userData = await DiscordRequest(`/users/${userId}`);
    authorName = userData.global_name || userData.username || client.t('biblioteca.fallback_anon', ctx);
  } catch {}

  const state = { selectedFlowIds: [] };
  return _renderPublishPanel(interaction, client, lib, flows, userId, guildId, authorName, state, true, e);
}

async function _renderPublishPanel(interaction, client, lib, flows, userId, guildId, authorName, state, isReply = true, e) {
  const ctx = localeCtx(interaction);
  const selectedNames = state.selectedFlowIds
    .map(id => flows.find(f => f.flowId === id)?.name || id)
    .map((n, i) => `\`${i + 1}.\` ${n}`)
    .join('\n') || client.t('biblioteca.no_flow_added', ctx);

  const available = flows.filter(f => !state.selectedFlowIds.includes(f.flowId));
  const blocks = [];

  blocks.push(cv2Text(client.t('biblioteca.publish_title', { ...ctx, eAnimada: e.animada, authorName })));
  blocks.push(cv2Divider());
  blocks.push(cv2Text(client.t('biblioteca.selected_flows_label', { ...ctx, count: state.selectedFlowIds.length, list: selectedNames })));
  blocks.push(cv2Divider());

  if (available.length) {
    const options = available.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${_triggerLabel(client, ctx, f.trigger)}`.slice(0, 100)
    }));

    const sel = select(client, userId, options, client.t('biblioteca.add_flow_publish_placeholder', ctx), async (i) => {
      await _deferUpdate(i);
      const newId = i.data.values[0];
      if (!state.selectedFlowIds.includes(newId)) state.selectedFlowIds.push(newId);
      return _renderPublishPanel(i, client, lib, flows, userId, guildId, authorName, state, false, e);
    });
    blocks.push(row(sel));
  }

  const btnRemove = btn(client, userId, client.t('biblioteca.btn_remove_last', ctx), 4, async (i) => {
    await _deferUpdate(i);
    state.selectedFlowIds.pop();
    return _renderPublishPanel(i, client, lib, flows, userId, guildId, authorName, state, false, e);
  });

  const btnPublish = btn(client, userId, client.t('biblioteca.btn_publish', ctx), 3, async (i) => {
    if (!state.selectedFlowIds.length) { await _deferUpdate(i); return; }
    return _publicarModal(i, client, lib, userId, guildId, authorName, state.selectedFlowIds, e);
  }, { disabled: state.selectedFlowIds.length === 0 });

  blocks.push(row(btnRemove, btnPublish));
  blocks.push(cv2Divider());
  blocks.push(cv2Text(client.t('biblioteca.publish_limit_footer', ctx)));

  const payload = cv2Payload(blocks, { accentColor: COLOR.library });
  if (isReply) return _reply(interaction, payload);
  return _edit(interaction, client, payload);
}

async function _publicarModal(interaction, client, lib, userId, guildId, authorName, flowIds, e) {
  const ctx = localeCtx(interaction);
  const modal = client.interactions.createModal({
    user:  userId,
    title: client.t('biblioteca.modal_publish_title', ctx),
    components: [
      { type: 1, components: [{ type: 4, custom_id: 'name',      label: client.t('biblioteca.modal_field_system_name', ctx),         style: 1, required: true,  max_length: 100,  placeholder: client.t('biblioteca.modal_field_system_name_ph', ctx) }] },
      { type: 1, components: [{ type: 4, custom_id: 'shortDesc', label: client.t('biblioteca.modal_field_short_desc', ctx),           style: 1, required: true,  max_length: 150,  placeholder: client.t('biblioteca.modal_field_short_desc_ph', ctx) }] },
      { type: 1, components: [{ type: 4, custom_id: 'fullDesc',  label: client.t('biblioteca.modal_field_full_desc', ctx),            style: 2, required: false, max_length: 2000, placeholder: client.t('biblioteca.modal_field_full_desc_ph', ctx) }] },
      { type: 1, components: [{ type: 4, custom_id: 'category',  label: client.t('biblioteca.modal_field_category', ctx),             style: 1, required: true,  max_length: 20,   placeholder: client.t('biblioteca.modal_field_category_ph', ctx) }] },
      { type: 1, components: [{ type: 4, custom_id: 'tags',      label: client.t('biblioteca.modal_field_tags', ctx),                 style: 1, required: false, max_length: 200,  placeholder: client.t('biblioteca.modal_field_tags_ph', ctx) }] }
    ],
    funcao: async (modalInteraction, _client, fields) => {
      const category = CATEGORIES.find(c => c.toLowerCase() === fields.category?.trim().toLowerCase());

      await DiscordRequest(
        `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
        { method: 'POST', body: { type: 6 } }
      );

      if (!category) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(client.t('biblioteca.invalid_category', { ...ctx, eEmduvida: e.emduvida, list: CATEGORIES.join(', ') }))
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
          cv2Text(client.t('biblioteca.publish_success', {
            ...ctx,
            eFesta: e.festa,
            entryName: entry.name,
            libId: entry.libId,
            flowCount: flowIds.length,
            fieldCount: _buildInstallQuestions(entry, client, ctx).length
          }))
        ], { accentColor: COLOR.success }));
      } catch (err) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(client.t('biblioteca.publish_error', { ...ctx, eAssustada: e.assustada, message: err.message }))
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
      cv2Text(client.t('biblioteca.announce_title', { emoji, entryName: entry.name, authorName, shortDesc: entry.shortDesc || '' })),
      cv2Divider(),
      cv2Text(
        `> 📂 **Categoria:** ${entry.category}\n` +
        `> 🔗 **Fluxos:** ${flowCount}\n` +
        `> 🔧 **Configurações:** ${_buildInstallQuestions(entry, client, {}).length}\n` +
        `> 🏷️ **Tags:** ${tags}\n` +
        `> 🆔 **ID:** \`${entry.libId}\``
      ),
    ], { accentColor: COLOR.library })
  });
}

async function _atualizar(interaction, client, lib, opts, userId, guildId, e) {
  const entry = await lib.getById(opts.id);
  const ctx = localeCtx(interaction);
  if (!entry) {
    return _reply(interaction, cv2Payload([
      cv2Text(client.t('biblioteca.entry_not_found_short', { ...ctx, eEmduvida: e.emduvida }))
    ], { accentColor: COLOR.danger }));
  }
  if (entry.authorId !== userId) {
    return _reply(interaction, cv2Payload([
      cv2Text(client.t('biblioteca.not_author', { ...ctx, eBrava: e.brava }))
    ], { accentColor: COLOR.danger }));
  }

  const { FlowModel } = require('../../Mongodb/flow.js');
  const flows = await FlowModel.find({ guildId }).lean();

  if (!flows.length) {
    return _reply(interaction, cv2Payload([
      cv2Text(`${client.t('biblioteca.no_flows_title', { ...ctx, eEmburrada: e.emburrada })}\n${client.t('biblioteca.no_flows_update_desc', ctx)}`)
    ], { accentColor: COLOR.danger }));
  }

  let authorName = entry.authorName || client.t('biblioteca.fallback_anon', ctx);
  try {
    const userData = await DiscordRequest(`/users/${userId}`);
    authorName = userData.global_name || userData.username || authorName;
  } catch {}

  const state = { selectedFlowIds: [] };
  return _renderUpdatePanel(interaction, client, lib, flows, userId, guildId, authorName, opts.id, entry, state, true, e);
}

async function _renderUpdatePanel(interaction, client, lib, flows, userId, guildId, authorName, libId, entry, state, isReply = false, e) {
  const ctx = localeCtx(interaction);
  const selectedNames = state.selectedFlowIds
    .map(id => flows.find(f => f.flowId === id)?.name || id)
    .map((n, i) => `\`${i + 1}.\` ${n}`)
    .join('\n') || client.t('biblioteca.no_flow_added', ctx);

  const available = flows.filter(f => !state.selectedFlowIds.includes(f.flowId));
  const blocks = [];

  blocks.push(cv2Text(client.t('biblioteca.update_panel_title', { ...ctx, ePensando: e.pensando, entryName: entry.name, version: entry.version })));
  blocks.push(cv2Divider());
  blocks.push(cv2Text(client.t('biblioteca.selected_flows_label', { ...ctx, count: state.selectedFlowIds.length, list: selectedNames })));
  blocks.push(cv2Divider());

  if (available.length) {
    const options = available.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${_triggerLabel(client, ctx, f.trigger)}`.slice(0, 100)
    }));

    const sel = select(client, userId, options, client.t('biblioteca.add_flow_update_placeholder', ctx), async (i) => {
      await _deferUpdate(i);
      const newId = i.data.values[0];
      if (!state.selectedFlowIds.includes(newId)) state.selectedFlowIds.push(newId);
      return _renderUpdatePanel(i, client, lib, flows, userId, guildId, authorName, libId, entry, state, false, e);
    });
    blocks.push(row(sel));
  }

  const btnRemove = btn(client, userId, client.t('biblioteca.btn_remove_last', ctx), 4, async (i) => {
    await _deferUpdate(i);
    state.selectedFlowIds.pop();
    return _renderUpdatePanel(i, client, lib, flows, userId, guildId, authorName, libId, entry, state, false, e);
  });

  const btnConfirm = btn(client, userId, client.t('biblioteca.btn_confirm_update', ctx), 3, async (i) => {
    if (!state.selectedFlowIds.length) { await _deferUpdate(i); return; }
    return _atualizarModal(i, client, lib, libId, userId, guildId, authorName, state.selectedFlowIds, entry.version, e);
  }, { disabled: state.selectedFlowIds.length === 0 });

  blocks.push(row(btnRemove, btnConfirm));

  const payload = cv2Payload(blocks, { accentColor: COLOR.library });
  if (isReply) return _reply(interaction, payload);
  return _edit(interaction, client, payload);
}

async function _atualizarModal(interaction, client, lib, libId, userId, guildId, authorName, flowIds, currentVersion, e) {
  const ctx = localeCtx(interaction);
  const modal = client.interactions.createModal({
    user:  userId,
    title: client.t('biblioteca.modal_update_title', ctx),
    components: [
      { type: 1, components: [{ type: 4, custom_id: 'version',   label: client.t('biblioteca.modal_field_new_version', { ...ctx, current: currentVersion }), style: 1, required: true,  max_length: 20,  placeholder: client.t('biblioteca.modal_field_new_version_ph', ctx) }] },
      { type: 1, components: [{ type: 4, custom_id: 'changelog', label: client.t('biblioteca.modal_field_changelog', ctx),                                    style: 2, required: false, max_length: 500, placeholder: client.t('biblioteca.modal_field_changelog_ph', ctx) }] }
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
          cv2Text(client.t('biblioteca.update_success', { ...ctx, eFesta: e.festa, version: updated.version, entryName: updated.name, flowCount: flowIds.length }))
        ], { accentColor: COLOR.success }));
      } catch (err) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(client.t('biblioteca.update_error', { ...ctx, eAssustada: e.assustada, message: err.message }))
        ], { accentColor: COLOR.danger }));
      }
    }
  });

  return client.interactions.showModal(interaction, modal);
}

async function _editar(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  const ctx = localeCtx(interaction);
  if (!entry) {
    return _reply(interaction, cv2Payload([
      cv2Text(client.t('biblioteca.entry_not_found_short', { ...ctx, eEmduvida: e.emduvida }))
    ], { accentColor: COLOR.danger }));
  }
  if (entry.authorId !== userId) {
    return _reply(interaction, cv2Payload([
      cv2Text(client.t('biblioteca.not_author', { ...ctx, eBrava: e.brava }))
    ], { accentColor: COLOR.danger }));
  }

  const modal = client.interactions.createModal({
    user:  userId,
    title: client.t('biblioteca.modal_edit_title', { ...ctx, name: entry.name.slice(0, 30) }),
    components: [
      { type: 1, components: [{ type: 4, custom_id: 'name',      label: client.t('biblioteca.modal_field_name', ctx),            style: 1, required: true,  max_length: 100,  value: entry.name }] },
      { type: 1, components: [{ type: 4, custom_id: 'shortDesc', label: client.t('biblioteca.modal_field_short_desc_edit', ctx), style: 1, required: false, max_length: 150,  value: entry.shortDesc || '' }] },
      { type: 1, components: [{ type: 4, custom_id: 'fullDesc',  label: client.t('biblioteca.modal_field_full_desc_edit', ctx),  style: 2, required: false, max_length: 2000, value: entry.fullDesc  || '' }] },
      { type: 1, components: [{ type: 4, custom_id: 'category',  label: client.t('biblioteca.modal_field_category_edit', ctx),   style: 1, required: false, max_length: 20,   value: entry.category }] },
      { type: 1, components: [{ type: 4, custom_id: 'tags',      label: client.t('biblioteca.modal_field_tags_edit', ctx),       style: 1, required: false, max_length: 200,  value: entry.tags?.join(', ') || '' }] }
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
          cv2Text(client.t('biblioteca.edit_success', { ...ctx, eFeliz: e.feliz }))
        ], { accentColor: COLOR.success }));
      } catch (err) {
        return _followUpEphemeral(modalInteraction, client, cv2Payload([
          cv2Text(client.t('biblioteca.edit_error', { ...ctx, eAssustada: e.assustada, message: err.message }))
        ], { accentColor: COLOR.danger }));
      }
    }
  });

  return client.interactions.showModal(interaction, modal);
}

async function _apagar(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  const ctx = localeCtx(interaction);
  if (!entry) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(client.t('biblioteca.entry_not_found_short', { ...ctx, eEmduvida: e.emduvida }))
    ], { accentColor: COLOR.danger }));
  }
  if (entry.authorId !== userId) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(client.t('biblioteca.not_author', { ...ctx, eBrava: e.brava }))
    ], { accentColor: COLOR.danger }));
  }

  const btnConfirm = btn(client, userId, client.t('biblioteca.btn_confirm_delete', ctx), 4, async (i) => {
    await _deferUpdate(i);
    const iCtx = localeCtx(i);
    try {
      await lib.delete(opts.id, userId);
      return _edit(i, client, cv2Payload([
        cv2Text(client.t('biblioteca.delete_success', { ...iCtx, eEmburrada: e.emburrada, entryName: entry.name }))
      ], { accentColor: COLOR.danger }));
    } catch (err) {
      return _edit(i, client, cv2Payload([
        cv2Text(client.t('biblioteca.delete_error', { ...iCtx, eAssustada: e.assustada, message: err.message }))
      ], { accentColor: COLOR.danger }));
    }
  });

  const btnCancel = btn(client, userId, client.t('biblioteca.btn_cancel', ctx), 2, async (i) => {
    await _deferUpdate(i);
    return _edit(i, client, cv2Payload([
      cv2Text(client.t('biblioteca.delete_cancelled', { ...localeCtx(i), eFeliz: e.feliz }))
    ], { accentColor: COLOR.main }));
  });

  return _edit(interaction, client, cv2Payload([
    cv2Text(client.t('biblioteca.delete_confirm_title', { ...ctx, eAssustada: e.assustada, entryName: entry.name })),
    cv2Divider(),
    row(btnConfirm, btnCancel),
  ], { accentColor: COLOR.danger }));
}

async function _minhas(interaction, client, lib, userId, e) {
  const entries = await lib.getMyPublications(userId);
  const ctx = localeCtx(interaction);

  if (!entries.length) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(client.t('biblioteca.my_pubs_empty', { ...ctx, ePensando: e.pensando }))
    ], { accentColor: COLOR.library }));
  }

  const lines = entries.map((entry, i) => {
    const statusIcon = entry.status === 'approved' ? '🟢' : entry.status === 'pending' ? '🟡' : '🔴';
    const emoji      = CATEGORY_EMOJI[entry.category] || '📦';
    return (
      `**${i + 1}.** ${statusIcon} ${emoji} **${entry.name}** \`v${entry.version}\`\n` +
      `> ${client.t('biblioteca.my_pubs_installs', { ...ctx, count: entry.stats.installs })}  •  ${_stars(client, ctx, entry.stats.avgRating, 0)}`
    );
  }).join('\n\n');

  const selectOptions = entries.slice(0, 25).map(entry => ({
    label:       entry.name.slice(0, 100),
    value:       entry.libId,
    description: (`v${entry.version} • ${client.t('biblioteca.my_pubs_installs', { ...ctx, count: entry.stats.installs })}`).slice(0, 100)
  }));

  const sel = select(client, userId, selectOptions, client.t('biblioteca.manage_select_placeholder', ctx), async (i) => {
    await _deferUpdate(i);
    const selected = entries.find(entry => entry.libId === i.data.values[0]);
    return _renderManageEntry(i, client, lib, selected, userId, e);
  });

  return _edit(interaction, client, cv2Payload([
    cv2Text(client.t('biblioteca.my_pubs_title', { ...ctx, eCurtida: e.curtida, count: entries.length, lines })),
    cv2Divider(),
    row(sel),
    cv2Divider(),
    cv2Text(client.t('biblioteca.manage_select_footer', ctx)),
  ], { accentColor: COLOR.library }));
}

async function _renderManageEntry(interaction, client, lib, entry, userId, e) {
  const ctx = localeCtx(interaction);
  const changelog = entry.lastChangelog ? client.t('biblioteca.manage_last_changelog', { ...ctx, changelog: entry.lastChangelog }) : '';

  const history = entry.versionHistory?.length
    ? entry.versionHistory.slice(-3).reverse()
        .map(v => `• \`v${v.version}\` — ${v.changelog || client.t('biblioteca.manage_no_changelog', ctx)}`)
        .join('\n')
    : client.t('biblioteca.manage_history_none', ctx);

  const btnEditar = btn(client, userId, client.t('biblioteca.btn_edit', ctx), 2, async (i) => _editar(i, client, lib, { id: entry.libId }, userId, e));

  const btnAtualizar = btn(client, userId, client.t('biblioteca.btn_update_version', ctx), 1, async (i) => _atualizar(i, client, lib, { id: entry.libId }, userId, i.guild_id, e));

  const btnApagar = btn(client, userId, client.t('biblioteca.btn_delete', ctx), 4, async (i) => {
    await _deferUpdate(i);
    return _apagar(i, client, lib, { id: entry.libId }, userId, e);
  });

  const btnVoltar = btn(client, userId, client.t('biblioteca.btn_back', ctx), 2, async (i) => {
    await _deferUpdate(i);
    return _minhas(i, client, lib, userId, e);
  });

  return _edit(interaction, client, cv2Payload([
    cv2Text(`# ${CATEGORY_EMOJI[entry.category] || '📦'} ${entry.name} \`v${entry.version}\`\n${entry.shortDesc}${changelog}`),
    cv2Divider(),
    cv2Text(client.t('biblioteca.manage_stats', { ...ctx, installs: entry.stats.installs, likes: entry.stats.likes, rating: entry.stats.avgRating, libId: entry.libId })),
    cv2Divider(),
    cv2Text(client.t('biblioteca.manage_history_label', { ...ctx, history })),
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
  const ctx = localeCtx(interaction);

  let displayName = profile.username;
  if (!displayName || displayName === targetId) {
    try {
      const userData = await DiscordRequest(`/users/${targetId}`);
      displayName = userData?.global_name || userData?.username || client.t('biblioteca.fallback_user', { ...ctx, suffix: targetId.slice(-4) });
    } catch {
      displayName = client.t('biblioteca.fallback_user', { ...ctx, suffix: targetId.slice(-4) });
    }
  }

  const topEntries = profile.entries
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 5)
    .map((entry, i) => `${i + 1}. **${entry.name}** \`v${entry.version}\` — 📥 ${entry.installs}`)
    .join('\n') || client.t('biblioteca.profile_no_pubs', ctx);

  const isFollowing = (await lib.getFollowers(targetId)).includes(userId);
  const isSelf      = targetId === userId;
  const numLocale    = ctx.system?.locale || 'pt-BR';

  const blocks = [
    cv2Text(`# ${e.carinho} ${displayName}\n${profile.bio || client.t('biblioteca.profile_no_bio', ctx)}`),
    cv2Divider(),
    cv2Text(
      `> ${client.t('biblioteca.profile_publications', ctx)} ${profile.stats.totalFlows}\n` +
      `> ${client.t('biblioteca.profile_installs', ctx)} ${profile.stats.totalInstalls.toLocaleString(numLocale)}\n` +
      `> ${client.t('biblioteca.profile_likes', ctx)} ${profile.stats.totalLikes}\n` +
      `> ${client.t('biblioteca.profile_rating', ctx)} ${profile.stats.avgRating.toFixed(1)} ⭐\n` +
      `> ${client.t('biblioteca.profile_followers', ctx)} ${profile.followers}`
    ),
    cv2Divider(),
    cv2Text(client.t('biblioteca.profile_top_flows', { ...ctx, list: topEntries })),
  ];

  if (!isSelf) {
    const btnFollow = btn(client, userId, isFollowing ? client.t('biblioteca.btn_unfollow', ctx) : client.t('biblioteca.btn_follow', ctx), isFollowing ? 4 : 3, async (i) => {
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
  const ctx = localeCtx(interaction);

  const fmt = async (list) => {
    if (!list.length) return client.t('biblioteca.highlights_none', ctx);
    const names = await Promise.all(list.map(entry => _resolveAuthorName(lib, entry.authorId, client, ctx, entry.authorName)));
    return list.map((entry, i) =>
      `${i + 1}. **${entry.name}** ${client.t('biblioteca.highlights_by', ctx)} ${names[i]} — 📥 ${entry.stats.installs} • ⭐ ${entry.stats.avgRating}`
    ).join('\n');
  };

  const [fTrending, fInstalls, fRated, fRecent] = await Promise.all([
    fmt(trending), fmt(topInstalls), fmt(topRated), fmt(recent)
  ]);

  return _edit(interaction, client, cv2Payload([
    cv2Text(`# ${e.festa} ${client.t('biblioteca.highlights_title', ctx)}`),
    cv2Divider(),
    cv2Text(client.t('biblioteca.highlights_trending', { ...ctx, list: fTrending })),
    cv2Divider(),
    cv2Text(client.t('biblioteca.highlights_installs', { ...ctx, list: fInstalls })),
    cv2Divider(),
    cv2Text(client.t('biblioteca.highlights_rated', { ...ctx, list: fRated })),
    cv2Divider(),
    cv2Text(client.t('biblioteca.highlights_recent', { ...ctx, list: fRecent })),
  ], { accentColor: COLOR.library }));
}

async function _openRateModal(interaction, client, lib, libId, userId, e) {
  const ctx = localeCtx(interaction);
  const modal = client.interactions.createModal({
    user:  userId,
    title: client.t('biblioteca.modal_rate_title', ctx),
    components: [{
      type: 1,
      components: [{
        type:        4,
        custom_id:   'rating',
        label:       client.t('biblioteca.modal_field_rating', ctx),
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
          cv2Text(client.t('biblioteca.invalid_rating', { ...ctx, eEmduvida: e.emduvida }))
        ], { accentColor: COLOR.danger }));
      }

      const result = await lib.rate(libId, userId, rating);
      return _followUp(modalInteraction, client, cv2Payload([
        cv2Text(client.t('biblioteca.rate_success', { ...ctx, eCorao: e.corao, rating, avg: result.avg, count: result.count }))
      ], { accentColor: COLOR.success }));
    }
  });

  return client.interactions.showModal(interaction, modal);
}
