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

const COLORS = {
  default:  0x7C8FFF,
  success:  0x57F287,
  warning:  0xFEE75C,
  danger:   0xED4245,
  library:  0x7C8FFF
};

const SUPPORT_ANNOUNCE_CHANNEL = '1508910999753850910';

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

/**
 * Retorna um array de perguntas, cada uma com:
 * {
 *   storeKey:    string único (ex: "flow0_act1_channelId") — chave no collected
 *   flowIndex:   number  — índice do fluxo no array entry.flows
 *   flowName:    string  — nome do fluxo
 *   location:    string  — 'action' | 'condition' | 'trigger'
 *   itemIndex:   number  — índice da ação/condição dentro do fluxo
 *   category:    string
 *   type:        string
 *   field:       string  — 'channelId' | 'roleId'
 *   label:       string  — label amigável do campo
 *   description: string  — instrução para o usuário
 *   actionLabel: string  — label amigável da ação/condição
 * }
 */
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
          // Só pergunta se o trigger realmente tem esse filtro OU se a categoria exige
          // (sempre pergunta para que o instalador possa definir ou deixar em branco)
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
  // Clona profundo para não mutar o original
  const cloned = JSON.parse(JSON.stringify(flows));

  for (const q of questions) {
    const rawValue = (collected[q.storeKey] || '').replace(/[<#@&!>]/g, '').trim();

    // Valor vazio ou "-" = não aplicar (mantém sem valor ou remove)
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
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.brava} Sem permissão`,
        description: 'Você precisa da permissão **Gerenciar Servidor** para instalar sistemas.',
        color:       COLORS.danger
      }]
    });
  }

  const questions = _buildInstallQuestions(entry);

  // Sem perguntas — instala direto
  if (!questions.length) {
    return _executeInstall(interaction, client, lib, entry, userId, guildId, [], {}, null, e);
  }

  // Mostra resumo das perguntas antes de começar
  await _edit(interaction, client, {
    embeds: [{
      title:       `${e.pensando} Configurando — ${entry.name}`,
      description: (
        `Esse sistema precisa de **${questions.length} configuração(ões)** antes de instalar.\n\n` +
        `Responda as próximas mensagens neste canal.\n` +
        `Você tem **2 minutos** para cada resposta.\n\n` +
        `> Envie \`-\` para pular (quando possível) ou \`cancelar\` para abortar.`
      ),
      color:  COLORS.library,
      fields: questions.map((q, i) => ({
        name:   `${i + 1}. ${q.label}`,
        value:  `_${q.actionLabel}_`,
        inline: true
      })).slice(0, 25), // Discord limita 25 fields
      footer: { text: `${entry.flows?.length || 0} fluxo(s) serão instalados • Ayami Hoshiori` }
    }],
    components: []
  });

  const collected = {};

  for (let i = 0; i < questions.length; i++) {
    const q        = questions[i];
    const progress = `(${i + 1}/${questions.length})`;

    // Envia a pergunta no canal
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title:       `${e.emduvida} ${progress} ${q.label}`,
          description: q.description,
          color:       COLORS.library,
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
            color:       COLORS.danger
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
            color:       COLORS.default
          }]
        }
      });
      return;
    }

    // Armazena o valor bruto — a limpeza de menções é feita em _applyCollectedValues
    collected[q.storeKey] = content;
  }

  return _executeInstall(interaction, client, lib, entry, userId, guildId, questions, collected, channelId, e);
}

/* ═══════════════════════════════════════════════════════════
   EXECUÇÃO DA INSTALAÇÃO
   ═══════════════════════════════════════════════════════════ */

async function _executeInstall(interaction, client, lib, entry, userId, guildId, questions, collected, channelId = null, e) {
  try {
    // Aplica os valores coletados diretamente nos fluxos (field a field)
    const preparedFlows = _applyCollectedValues(entry.flows || [], questions, collected);

    // Instala usando os fluxos já preparados (sem substituição de templateVars genérica)
    const flowIds = await lib.installPrepared({
      libId:   entry.libId,
      guildId,
      userId,
      flows:   preparedFlows,
      version: entry.version
    });

    // Monta resumo das configurações aplicadas
    const configLines = questions.length
      ? questions.map(q => {
          const raw   = collected[q.storeKey] || '-';
          const clean = raw.replace(/[<#@&!>]/g, '').trim();
          return `• **${q.actionLabel}** → \`${q.field}\` = ${clean || '_não definido_'}`;
        }).join('\n')
      : '_Nenhuma configuração necessária_';

    const embed = {
      title:       `${e.festa} ${entry.name} instalado!`,
      description: `**${flowIds.length}** fluxo(s) criado(s) neste servidor!\n\n**Configurações aplicadas:**\n${configLines}`,
      color:       COLORS.success,
      footer:      { text: 'Logic Builder • Ayami Hoshiori' }
    };

    if (channelId) {
      return DiscordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: { embeds: [embed] } });
    }
    return _edit(interaction, client, { embeds: [embed] });

  } catch (err) {
    const embed = {
      title:       `${e.assustada} Erro na instalação`,
      description: err.message,
      color:       COLORS.danger
    };

    if (channelId) {
      return DiscordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: { embeds: [embed] } });
    }
    return _edit(interaction, client, { embeds: [embed] });
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
          return _edit(interaction, client, {
            embeds: [{
              title:       `${e.assustada} Subcomando desconhecido`,
              description: 'Não reconheci esse comando. Tente novamente!',
              color:       COLORS.danger
            }]
          });
      }
    } catch (err) {
      console.error(`[biblioteca/${sub}]`, err);
      return _edit(interaction, client, {
        embeds: [{
          title:       `${e.assustada} Algo deu errado...`,
          description: err.message || 'Ocorreu um erro inesperado. Me desculpe!',
          color:       COLORS.danger
        }]
      });
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
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.emduvida} Nenhum resultado encontrado`,
        description: 'Não encontrei nenhum fluxo com esses filtros.\nTente outros termos ou remova alguns filtros~',
        color:       COLORS.library
      }]
    });
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
  const filterLine = filterDesc.length ? `**Filtros:** ${filterDesc.join('  •  ')}\n\n` : '';

  const sortLabels = {
    installs: '📥 Mais instalados',
    rating:   '⭐ Melhor avaliados',
    trending: '🔥 Tendência',
    recent:   '🕐 Mais recentes'
  };
  const sortLine = `**Ordem:** ${sortLabels[filters.sort] || '📥 Mais instalados'}\n`;

  const lines = results.map((entry, i) => {
    const emoji = CATEGORY_EMOJI[entry.category] || '📦';
    const stars = _stars(entry.stats.avgRating, entry.stats.ratingCount);
    const num   = page * 8 + i + 1;
    return (
      `**${num}.** ${emoji} **${entry.name}** \`v${entry.version}\`\n` +
      `👤 ${entry._resolvedAuthor}  •  📥 ${entry.stats.installs.toLocaleString('pt-BR')} instalações  •  ${stars}\n` +
      `_${entry.shortDesc || 'Sem descrição'}_`
    );
  }).join('\n\n');

  const selectOptions = results.map(entry => ({
    label:       entry.name.slice(0, 100),
    value:       entry.libId,
    description: (`v${entry.version} • ${entry._resolvedAuthor} • ${entry.stats.installs} instalações`).slice(0, 100),
    emoji:       { name: (CATEGORY_EMOJI[entry.category] || '📦').replace(/\uFE0F/g, '') }
  }));

  const components = [];

  const sel = client.interactions.createSelect({
    user: userId,
    data: { placeholder: '✨ Selecione para ver detalhes~', options: selectOptions },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _renderDetail(i, client, lib, i.data.values[0], userId, e);
    }
  });
  components.push({ type: 1, components: [sel] });

  const navBtns = [];
  if (page > 0) {
    navBtns.push(client.interactions.createButton({
      user: userId,
      data: { label: '◀ Anterior', style: 2 },
      funcao: async (i) => {
        await _deferUpdate(i);
        return _renderSearchPage(i, client, lib, filters, page - 1, userId, e);
      }
    }));
  }
  navBtns.push(client.interactions.createButton({
    user: userId,
    data: { label: `${page + 1} / ${pages}`, style: 2 },
    funcao: async (i) => { await _deferUpdate(i); }
  }));
  if (page < pages - 1) {
    navBtns.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Próxima ▶', style: 2 },
      funcao: async (i) => {
        await _deferUpdate(i);
        return _renderSearchPage(i, client, lib, filters, page + 1, userId, e);
      }
    }));
  }
  if (navBtns.length) components.push({ type: 1, components: navBtns });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.animada} Biblioteca de Fluxos`,
      description: `${filterLine}${sortLine}\n${lines}`,
      color:       COLORS.library,
      footer:      { text: `${total} resultado${total !== 1 ? 's' : ''} • Página ${page + 1} de ${pages} • Ayami Hoshiori` }
    }],
    components
  });
}

async function _ver(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.emduvida} Entrada não encontrada`,
        description: 'Não encontrei nada com esse ID. Confere se digitou certinho~',
        color:       COLORS.danger
      }]
    });
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

  // Calcula quantas perguntas de configuração serão feitas
  const questions      = _buildInstallQuestions(entry);
  const configsNeeded  = questions.length;

  const btnInstall = client.interactions.createButton({
    user: userId,
    data: { label: '📥 Instalar', style: 3 },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _startInstallWizard(i, client, lib, entry, userId, i.guild_id, e);
    }
  });

  const btnLike = client.interactions.createButton({
    user: userId,
    data: { label: `👍 ${entry.stats.likes}`, style: likeStyle },
    funcao: async (i) => {
      await _deferUpdate(i);
      await lib.vote(libId, userId, 'like');
      const updated = await lib.getById(libId);
      return _renderDetail(i, client, lib, libId, userId, e, updated);
    }
  });

  const btnDislike = client.interactions.createButton({
    user: userId,
    data: { label: `👎 ${entry.stats.dislikes}`, style: dislikeStyle },
    funcao: async (i) => {
      await _deferUpdate(i);
      await lib.vote(libId, userId, 'dislike');
      const updated = await lib.getById(libId);
      return _renderDetail(i, client, lib, libId, userId, e, updated);
    }
  });

  const btnRate = client.interactions.createButton({
    user: userId,
    data: { label: '⭐ Avaliar', style: 2 },
    funcao: async (i) => _openRateModal(i, client, lib, libId, userId, e)
  });

  const btnAuthor = client.interactions.createButton({
    user: userId,
    data: { label: '👤 Ver Autor', style: 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _renderProfile(i, client, lib, entry.authorId, userId, e);
    }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${emoji} ${entry.name} \`v${entry.version}\``,
      description: entry.fullDesc || entry.shortDesc || '_Sem descrição_',
      color:       COLORS.library,
      fields: [
        { name: '👤 Autor',          value: authorName,                                         inline: true },
        { name: '📂 Categoria',      value: entry.category,                                     inline: true },
        { name: '📥 Instalações',    value: entry.stats.installs.toLocaleString('pt-BR'),       inline: true },
        { name: '⭐ Avaliação',      value: `${stars} (${entry.stats.ratingCount} avaliações)`, inline: true },
        { name: '🔗 Fluxos',         value: String(entry.flows?.length || 0),                  inline: true },
        { name: '🔧 Configurações',  value: configsNeeded > 0 ? `${configsNeeded} campo(s)` : '_Nenhuma necessária_', inline: true },
        { name: '🏷️ Tags',           value: tags,                                               inline: false },
        { name: '🆔 ID',             value: `\`${entry.libId}\``,                              inline: false }
      ],
      footer:    { text: `Publicado por ${authorName} • Ayami Hoshiori` },
      timestamp: entry.updatedAt
    }],
    components: [
      { type: 1, components: [btnInstall, btnLike, btnDislike, btnRate, btnAuthor] }
    ]
  });
}

async function _instalar(interaction, client, lib, opts, userId, guildId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.emduvida} Entrada não encontrada`,
        description: 'Não encontrei nada com esse ID. Confere se digitou certinho~',
        color:       COLORS.danger
      }]
    });
  }
  return _startInstallWizard(interaction, client, lib, entry, userId, guildId, e);
}

async function _publicar(interaction, client, lib, userId, guildId, e) {
  const { FlowModel } = require('../../Mongodb/flow.js');
  const flows = await FlowModel.find({ guildId }).lean();

  if (!flows.length) {
    return _reply(interaction, {
      embeds: [{
        title:       `${e.emburrada} Sem fluxos`,
        description: 'Crie pelo menos um fluxo antes de publicar na biblioteca~',
        color:       COLORS.danger
      }]
    });
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
    .map((n, i) => `${i + 1}. **${n}**`)
    .join('\n') || '_Nenhum fluxo adicionado ainda_';

  const available = flows.filter(f => !state.selectedFlowIds.includes(f.flowId));
  const selectRows = [];

  if (available.length) {
    const options = available.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${_triggerLabel(f.trigger)}`.slice(0, 100)
    }));

    const sel = client.interactions.createSelect({
      user: userId,
      data: { placeholder: '✨ Adicionar fluxo ao sistema~', options },
      funcao: async (i) => {
        await _deferUpdate(i);
        const newId = i.data.values[0];
        if (!state.selectedFlowIds.includes(newId)) state.selectedFlowIds.push(newId);
        return _renderPublishPanel(i, client, lib, flows, userId, guildId, authorName, state, false, e);
      }
    });
    selectRows.push({ type: 1, components: [sel] });
  }

  const btnRemove = client.interactions.createButton({
    user: userId,
    data: { label: '➖ Remover último', style: 4 },
    funcao: async (i) => {
      await _deferUpdate(i);
      state.selectedFlowIds.pop();
      return _renderPublishPanel(i, client, lib, flows, userId, guildId, authorName, state, false, e);
    }
  });

  const btnPublish = client.interactions.createButton({
    user: userId,
    data: { label: '📤 Publicar', style: 3, disabled: state.selectedFlowIds.length === 0 },
    funcao: async (i) => {
      if (!state.selectedFlowIds.length) { await _deferUpdate(i); return; }
      return _publicarModal(i, client, lib, userId, guildId, authorName, state.selectedFlowIds, e);
    }
  });

  const embed = {
    title:       `${e.animada} Publicar na Biblioteca`,
    description: `**Autor:** ${authorName}\n\n**Fluxos selecionados (${state.selectedFlowIds.length}):**\n${selectedNames}\n\nAdicione os fluxos que farão parte deste sistema e clique em **Publicar** quando estiver pronto!`,
    color:       COLORS.library,
    footer:      { text: 'Você pode adicionar até 25 fluxos por publicação • Ayami Hoshiori' }
  };

  const actionRow  = { type: 1, components: [btnRemove, btnPublish] };
  const components = [...selectRows, actionRow];

  if (isReply) return _reply(interaction, { embeds: [embed], components });
  return _edit(interaction, client, { embeds: [embed], components });
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
        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.emduvida} Categoria inválida`,
            description: `As categorias disponíveis são:\n${CATEGORIES.join(', ')}`,
            color:       COLORS.danger
          }]
        });
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

        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.festa} Publicado com sucesso!`,
            description: (
              `**${entry.name}** já está disponível na biblioteca!\n\n` +
              `🆔 ID: \`${entry.libId}\`\n` +
              `📦 Fluxos: **${flowIds.length}**\n` +
              `🔧 Campos de configuração: **${_buildInstallQuestions(entry).length}**`
            ),
            color:  COLORS.success,
            footer: { text: 'Logic Builder • Ayami Hoshiori' }
          }]
        });
      } catch (err) {
        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.assustada} Erro ao publicar`,
            description: err.message,
            color:       COLORS.danger
          }]
        });
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
    body: {
      embeds: [{
        title:       `${emoji} Nova publicação na Biblioteca!`,
        description: `**${entry.name}** foi publicado por **${authorName}**.\n\n${entry.shortDesc || ''}`,
        color:       COLORS.library,
        fields: [
          { name: '📂 Categoria',      value: entry.category,                                    inline: true  },
          { name: '🔗 Fluxos',         value: String(flowCount),                                 inline: true  },
          { name: '🔧 Configurações',  value: String(_buildInstallQuestions(entry).length),      inline: true  },
          { name: '🏷️ Tags',           value: tags,                                              inline: false },
          { name: '🆔 ID',             value: `\`${entry.libId}\``,                             inline: false }
        ],
        footer:    { text: 'Logic Builder • Ayami Hoshiori' },
        timestamp: new Date().toISOString()
      }]
    }
  });
}

async function _atualizar(interaction, client, lib, opts, userId, guildId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _reply(interaction, {
      embeds: [{
        title:       `${e.emduvida} Entrada não encontrada`,
        description: 'Não encontrei nada com esse ID~',
        color:       COLORS.danger
      }]
    });
  }
  if (entry.authorId !== userId) {
    return _reply(interaction, {
      embeds: [{
        title:       `${e.brava} Sem permissão`,
        description: 'Você não é o autor desta entrada.',
        color:       COLORS.danger
      }]
    });
  }

  const { FlowModel } = require('../../Mongodb/flow.js');
  const flows = await FlowModel.find({ guildId }).lean();

  if (!flows.length) {
    return _reply(interaction, {
      embeds: [{
        title:       `${e.emburrada} Sem fluxos`,
        description: 'Crie pelo menos um fluxo antes de atualizar~',
        color:       COLORS.danger
      }]
    });
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
    .map((n, i) => `${i + 1}. **${n}**`)
    .join('\n') || '_Nenhum fluxo adicionado ainda_';

  const available = flows.filter(f => !state.selectedFlowIds.includes(f.flowId));
  const selectRows = [];

  if (available.length) {
    const options = available.slice(0, 25).map(f => ({
      label:       f.name.slice(0, 100),
      value:       f.flowId,
      description: `${f.enabled ? '🟢' : '🔴'} ${_triggerLabel(f.trigger)}`.slice(0, 100)
    }));

    const sel = client.interactions.createSelect({
      user: userId,
      data: { placeholder: '✨ Adicionar fluxo à nova versão~', options },
      funcao: async (i) => {
        await _deferUpdate(i);
        const newId = i.data.values[0];
        if (!state.selectedFlowIds.includes(newId)) state.selectedFlowIds.push(newId);
        return _renderUpdatePanel(i, client, lib, flows, userId, guildId, authorName, libId, entry, state, false, e);
      }
    });
    selectRows.push({ type: 1, components: [sel] });
  }

  const btnRemove = client.interactions.createButton({
    user: userId,
    data: { label: '➖ Remover último', style: 4 },
    funcao: async (i) => {
      await _deferUpdate(i);
      state.selectedFlowIds.pop();
      return _renderUpdatePanel(i, client, lib, flows, userId, guildId, authorName, libId, entry, state, false, e);
    }
  });

  const btnConfirm = client.interactions.createButton({
    user: userId,
    data: { label: '🔄 Confirmar atualização', style: 3, disabled: state.selectedFlowIds.length === 0 },
    funcao: async (i) => {
      if (!state.selectedFlowIds.length) { await _deferUpdate(i); return; }
      return _atualizarModal(i, client, lib, libId, userId, guildId, authorName, state.selectedFlowIds, entry.version, e);
    }
  });

  const embed = {
    title:       `${e.pensando} Atualizar — ${entry.name}`,
    description: `Versão atual: \`${entry.version}\`\n\n**Fluxos selecionados (${state.selectedFlowIds.length}):**\n${selectedNames}\n\nSelecione os fluxos da nova versão e clique em **Confirmar atualização**~`,
    color:       COLORS.library
  };

  const actionRow  = { type: 1, components: [btnRemove, btnConfirm] };
  const components = [...selectRows, actionRow];

  if (isReply) return _reply(interaction, { embeds: [embed], components });
  return _edit(interaction, client, { embeds: [embed], components });
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

        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.festa} Atualizado para v${updated.version}!`,
            description: `**${updated.name}** foi atualizado com **${flowIds.length}** fluxo(s).\nOs instaladores serão notificados via DM~`,
            color:       COLORS.success
          }]
        });
      } catch (err) {
        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.assustada} Erro ao atualizar`,
            description: err.message,
            color:       COLORS.danger
          }]
        });
      }
    }
  });

  return client.interactions.showModal(interaction, modal);
}

async function _editar(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _reply(interaction, {
      embeds: [{
        title:       `${e.emduvida} Entrada não encontrada`,
        description: 'Não encontrei nada com esse ID~',
        color:       COLORS.danger
      }]
    });
  }
  if (entry.authorId !== userId) {
    return _reply(interaction, {
      embeds: [{
        title:       `${e.brava} Sem permissão`,
        description: 'Você não é o autor desta entrada.',
        color:       COLORS.danger
      }]
    });
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

        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.feliz} Entrada atualizada!`,
            description: 'As informações foram salvas com sucesso~',
            color:       COLORS.success
          }]
        });
      } catch (err) {
        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.assustada} Erro ao editar`,
            description: err.message,
            color:       COLORS.danger
          }]
        });
      }
    }
  });

  return client.interactions.showModal(interaction, modal);
}

async function _apagar(interaction, client, lib, opts, userId, e) {
  const entry = await lib.getById(opts.id);
  if (!entry) {
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.emduvida} Entrada não encontrada`,
        description: 'Não encontrei nada com esse ID~',
        color:       COLORS.danger
      }]
    });
  }
  if (entry.authorId !== userId) {
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.brava} Sem permissão`,
        description: 'Você não é o autor desta entrada.',
        color:       COLORS.danger
      }]
    });
  }

  const btnConfirm = client.interactions.createButton({
    user: userId,
    data: { label: '✅ Confirmar exclusão', style: 4 },
    funcao: async (i) => {
      await _deferUpdate(i);
      try {
        await lib.delete(opts.id, userId);
        return _edit(i, client, {
          embeds: [{
            title:       `${e.emburrada} Entrada removida`,
            description: `**${entry.name}** foi removida da biblioteca.`,
            color:       COLORS.danger
          }],
          components: []
        });
      } catch (err) {
        return _edit(i, client, {
          embeds: [{
            title:       `${e.assustada} Erro ao apagar`,
            description: err.message,
            color:       COLORS.danger
          }],
          components: []
        });
      }
    }
  });

  const btnCancel = client.interactions.createButton({
    user: userId,
    data: { label: '❌ Cancelar', style: 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _edit(i, client, {
        embeds: [{
          title:       `${e.feliz} Cancelado!`,
          description: 'A entrada continua na biblioteca~',
          color:       COLORS.default
        }],
        components: []
      });
    }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.assustada} Confirmar exclusão`,
      description: `Tem certeza que quer remover **${entry.name}** da biblioteca?\n\nEssa ação **não pode ser desfeita**.\nInstalações existentes nos servidores não serão afetadas.`,
      color:       COLORS.danger
    }],
    components: [{ type: 1, components: [btnConfirm, btnCancel] }]
  });
}

async function _minhas(interaction, client, lib, userId, e) {
  const entries = await lib.getMyPublications(userId);

  if (!entries.length) {
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.pensando} Minhas Publicações`,
        description: 'Você ainda não publicou nada na biblioteca.\nUse `/biblioteca publicar` para começar~!',
        color:       COLORS.library
      }]
    });
  }

  const lines = entries.map((entry, i) => {
    const statusIcon = entry.status === 'approved' ? '🟢' : entry.status === 'pending' ? '🟡' : '🔴';
    const emoji      = CATEGORY_EMOJI[entry.category] || '📦';
    return (
      `**${i + 1}.** ${statusIcon} ${emoji} **${entry.name}** \`v${entry.version}\`\n` +
      `📥 ${entry.stats.installs} instalações  •  ${_stars(entry.stats.avgRating, 0)}`
    );
  }).join('\n\n');

  const selectOptions = entries.slice(0, 25).map(entry => ({
    label:       entry.name.slice(0, 100),
    value:       entry.libId,
    description: (`v${entry.version} • ${entry.stats.installs} instalações`).slice(0, 100)
  }));

  const sel = client.interactions.createSelect({
    user: userId,
    data: { placeholder: '✨ Selecione para gerenciar~', options: selectOptions },
    funcao: async (i) => {
      await _deferUpdate(i);
      const selected = entries.find(entry => entry.libId === i.data.values[0]);
      return _renderManageEntry(i, client, lib, selected, userId, e);
    }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.curtida} Minhas Publicações (${entries.length})`,
      description: lines,
      color:       COLORS.library,
      footer:      { text: 'Selecione uma entrada para gerenciá-la • Ayami Hoshiori' }
    }],
    components: [{ type: 1, components: [sel] }]
  });
}

async function _renderManageEntry(interaction, client, lib, entry, userId, e) {
  const changelog = entry.lastChangelog ? `\n**Último changelog:** ${entry.lastChangelog}` : '';

  const history = entry.versionHistory?.length
    ? entry.versionHistory.slice(-3).reverse()
        .map(v => `• \`v${v.version}\` — ${v.changelog || 'sem changelog'}`)
        .join('\n')
    : '_Nenhum histórico_';

  const btnEditar = client.interactions.createButton({
    user: userId,
    data: { label: '✏️ Editar', style: 2 },
    funcao: async (i) => _editar(i, client, lib, { id: entry.libId }, userId, e)
  });

  const btnAtualizar = client.interactions.createButton({
    user: userId,
    data: { label: '🔄 Atualizar versão', style: 1 },
    funcao: async (i) => _atualizar(i, client, lib, { id: entry.libId }, userId, i.guild_id, e)
  });

  const btnApagar = client.interactions.createButton({
    user: userId,
    data: { label: '🗑️ Apagar', style: 4 },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _apagar(i, client, lib, { id: entry.libId }, userId, e);
    }
  });

  const btnVoltar = client.interactions.createButton({
    user: userId,
    data: { label: '⬅️ Voltar', style: 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _minhas(i, client, lib, userId, e);
    }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${CATEGORY_EMOJI[entry.category] || '📦'} ${entry.name} \`v${entry.version}\``,
      description: entry.shortDesc + changelog,
      color:       COLORS.library,
      fields: [
        { name: '📊 Stats',     value: `📥 ${entry.stats.installs} instalações  •  👍 ${entry.stats.likes}  •  ⭐ ${entry.stats.avgRating}`, inline: false },
        { name: '📜 Histórico', value: history,                                                                                                inline: false },
        { name: '🆔 ID',        value: `\`${entry.libId}\``,                                                                                  inline: false }
      ]
    }],
    components: [{ type: 1, components: [btnEditar, btnAtualizar, btnApagar, btnVoltar] }]
  });
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
  const components  = [];

  if (!isSelf) {
    const btnFollow = client.interactions.createButton({
      user: userId,
      data: { label: isFollowing ? '➖ Deixar de seguir' : '➕ Seguir', style: isFollowing ? 4 : 3 },
      funcao: async (i) => {
        await _deferUpdate(i);
        await lib.toggleFollow(userId, targetId);
        return _renderProfile(i, client, lib, targetId, userId, e);
      }
    });
    components.push({ type: 1, components: [btnFollow] });
  }

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.carinho} ${displayName}`,
      description: profile.bio || '_Sem bio_',
      color:       COLORS.library,
      fields: [
        { name: '📦 Publicações', value: String(profile.stats.totalFlows),                    inline: true },
        { name: '📥 Instalações', value: profile.stats.totalInstalls.toLocaleString('pt-BR'), inline: true },
        { name: '👍 Likes',       value: String(profile.stats.totalLikes),                    inline: true },
        { name: '⭐ Avaliação',   value: `${profile.stats.avgRating.toFixed(1)} ⭐`,          inline: true },
        { name: '👥 Seguidores',  value: String(profile.followers),                           inline: true },
        { name: '🏆 Top Fluxos',  value: topEntries,                                          inline: false }
      ],
      footer: { text: `ID: ${targetId} • Ayami Hoshiori` }
    }],
    components
  });
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

  return _edit(interaction, client, {
    embeds: [{
      title:  `${e.festa} Destaques da Semana`,
      color:  COLORS.library,
      fields: [
        { name: '📈 Tendência',        value: fTrending, inline: false },
        { name: '📥 Mais instalados',  value: fInstalls, inline: false },
        { name: '⭐ Melhor avaliados', value: fRated,    inline: false },
        { name: '🕐 Mais recentes',    value: fRecent,   inline: false }
      ],
      footer:    { text: 'Logic Builder • Ayami Hoshiori' },
      timestamp: new Date().toISOString()
    }]
  });
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
        return _followUp(modalInteraction, client, {
          embeds: [{
            title:       `${e.emduvida} Nota inválida`,
            description: 'Informe um número entre 1 e 5~',
            color:       COLORS.danger
          }]
        });
      }

      const result = await lib.rate(libId, userId, rating);
      return _followUp(modalInteraction, client, {
        embeds: [{
          title:       `${e.corao} Avaliação registrada!`,
          description: `Você deu **${rating} ⭐** para este fluxo.\nNova média: **${result.avg} ⭐** (${result.count} avaliações)`,
          color:       COLORS.success
        }]
      });
    }
  });

  return client.interactions.showModal(interaction, modal);
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

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
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}/messages/@original`,
    { method: 'PATCH', body: data }
  );
}

async function _followUp(interaction, client, data) {
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}`,
    { method: 'POST', body: data }
  );
}
