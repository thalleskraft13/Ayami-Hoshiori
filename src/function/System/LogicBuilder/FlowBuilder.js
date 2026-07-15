'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const { localeCtx }  = require('../../Utils/ctxLocale.js');
const { FlowModel }  = require('../../../Mongodb/flow.js');
const { randomUUID } = require('crypto');
const getPerm        = require('../../Utils/GetPerm.js');
const holeHighter    = require('../../Utils/RoleHigher.js');
const { parseDuration, formatDuration } = require('./LogicEngine.js');

/* ─────────────────────────────────────────────
   EMOJIS DA AYAMI — fallback
   ───────────────────────────────────────────── */
const AYAMI_FALLBACK = {
  default:    '<:ayami:1513904360407695370>',
  animada:    '<:ayamianimada:1513895694824378408>',
  assustada:  '<:ayamiassustada:1513895638809579720>',
  brava:      '<:ayamibrava:1513895453912076420>',
  carinho:    '<:ayamicarinho:1513903963240530121>',
  chorando:   '<:ayamichorando:1513895575026663575>',
  chorando2:  '<:ayamichorando2:1513904145193766912>',
  corao:      '<:ayamicorao:1513895869420929094>',
  curtida:    '<:ayamicurtida:1513904205306400930>',
  emburrada:  '<:ayamiemburrada:1513904309480456374>',
  emduvida:   '<:ayamiemduvida:1513904029556670546>',
  escondida:  '<:ayamiescondida:1513904510387355818>',
  feliz:      '<:ayamifeliz:1513904597649981561>',
  festa:      '<:ayamifesta:1513895771676737746>',
  pensando:   '<:ayamipensando:1513891183036989533>',
  rindo:      '<:ayamirindo:1513886810806157382>',
  sonolenta:  '<:ayamisonolenta:1513895512997367980>',
  sria:       '<:ayamisria:1513904083969380372>'
};

/* ─────────────────────────────────────────────
   CORES DA AYAMI
   ───────────────────────────────────────────── */
const COLOR = {
  main:    0x7C8FFF,
  gold:    0xFFD966,
  dark:    0x243B7A,
  hair:    0xA9D6FF,
  white:   0xFFFFFF,
  pink:    0xFFB6C8,
  danger:  0xED4245,
  success: 0x57F287,
};

const GUIDE_URL = 'https://ayami-hoshiori.discloud.app/logic-builder';

/* ─────────────────────────────────────────────
   CATÁLOGOS
   ───────────────────────────────────────────── */

const TRIGGER_CATALOG = [
  { category: 'time',      type: 'scheduled_trigger',       label: '🕐 Horário agendado',       description: 'Dispara em um horário específico todo dia' },
  { category: 'command',   type: 'command_executed',         label: '🔧 Comando executado',       description: 'Disparado quando um comando personalizado é usado' },
  { category: 'message',   type: 'message_created',          label: '💬 Mensagem criada',         description: 'Qualquer mensagem enviada' },
  { category: 'message',   type: 'message_edited',           label: '✏️ Mensagem editada',         description: 'Mensagem editada por alguém' },
  { category: 'message',   type: 'message_deleted',          label: '🗑️ Mensagem apagada',         description: 'Mensagem deletada' },
  { category: 'message',   type: 'message_contains_text',    label: '🔍 Contém texto',             description: 'Mensagem com conteúdo específico' },
  { category: 'message',   type: 'message_contains_link',    label: '🔗 Contém link',              description: 'Mensagem com URL' },
  { category: 'message',   type: 'message_contains_image',   label: '🖼️ Contém imagem',            description: 'Mensagem com imagem anexada' },
  { category: 'message',   type: 'message_contains_file',    label: '📎 Contém arquivo',           description: 'Mensagem com arquivo anexado' },
  { category: 'message',   type: 'message_contains_mention', label: '📣 Contém menção',            description: 'Mensagem que menciona alguém' },
  { category: 'message',   type: 'message_contains_emoji',   label: '😀 Contém emoji',             description: 'Mensagem com emoji unicode' },
  { category: 'message',   type: 'message_contains_sticker', label: '🎭 Contém sticker',           description: 'Mensagem com sticker' },
  { category: 'reaction',  type: 'reaction_added',           label: '➕ Reação adicionada',        description: 'Alguém reagiu a uma mensagem' },
  { category: 'reaction',  type: 'reaction_removed',         label: '➖ Reação removida',          description: 'Reação foi removida' },
  { category: 'member',    type: 'member_joined',            label: '👋 Membro entrou',            description: 'Novo membro no servidor' },
  { category: 'member',    type: 'member_left',              label: '🚪 Membro saiu',              description: 'Membro saiu ou foi expulso' },
  { category: 'member',    type: 'member_banned',            label: '🔨 Membro banido',            description: 'Membro foi banido' },
  { category: 'member',    type: 'member_unbanned',          label: '✅ Membro desbanido',         description: 'Ban removido' },
  { category: 'member',    type: 'member_nick_changed',      label: '📝 Nickname alterado',        description: 'Membro mudou o apelido' },
  { category: 'channel',   type: 'channel_created',          label: '📁 Canal criado',             description: 'Novo canal no servidor' },
  { category: 'channel',   type: 'channel_deleted',          label: '❌ Canal apagado',            description: 'Canal foi deletado' },
  { category: 'channel',   type: 'channel_updated',          label: '🔧 Canal atualizado',         description: 'Canal teve configurações alteradas' },
  { category: 'voice',     type: 'voice_joined',             label: '🔊 Entrou em call',           description: 'Usuário entrou em canal de voz' },
  { category: 'voice',     type: 'voice_left',               label: '🔇 Saiu da call',             description: 'Usuário saiu de canal de voz' },
  { category: 'voice',     type: 'voice_moved',              label: '🔀 Mudou de call',            description: 'Usuário trocou de canal de voz' },
  { category: 'voice',     type: 'camera_on',                label: '📷 Câmera ligada',            description: 'Usuário ligou a câmera' },
  { category: 'voice',     type: 'camera_off',               label: '📷 Câmera desligada',         description: 'Usuário desligou a câmera' },
  { category: 'voice',     type: 'screen_share_start',       label: '🖥️ Tela compartilhada',       description: 'Usuário começou a compartilhar tela' },
  { category: 'voice',     type: 'screen_share_stop',        label: '🖥️ Tela parada',              description: 'Usuário parou de compartilhar' },
  { category: 'component', type: 'button_clicked',           label: '🖱️ Botão clicado',            description: 'Usuário clicou em um botão' },
  { category: 'component', type: 'select_used',              label: '📋 Select usado',             description: 'Usuário usou um select menu' },
  { category: 'component', type: 'modal_submitted',          label: '📝 Modal enviado',            description: 'Usuário enviou um modal' },
  { category: 'thread',    type: 'thread_created',           label: '🧵 Tópico criado',            description: 'Um novo tópico (thread) foi criado' },
  { category: 'thread',    type: 'thread_deleted',           label: '🧵 Tópico fechado',           description: 'Um tópico (thread) foi fechado/arquivado' },
  { category: 'member',    type: 'boost_added',              label: '🚀 Boost adicionado',         description: 'Membro começou a impulsionar o servidor' },
  { category: 'member',    type: 'boost_removed',            label: '💔 Boost removido',           description: 'Membro parou de impulsionar o servidor' },
  { category: 'internal',  type: 'custom_event',             label: '⚡ Evento customizado',       description: 'Disparado por outro fluxo' }
];

const CONDITION_CATALOG = [
  { category: 'user',        type: 'has_role',          label: '👤 Possui cargo',                   params: ['roleId'] },
  { category: 'user',        type: 'not_has_role',       label: '👤 Não possui cargo',               params: ['roleId'] },
  { category: 'user',        type: 'is_bot',             label: '🤖 É bot',                          params: [] },
  { category: 'user',        type: 'not_bot',            label: '🧑 Não é bot',                      params: [] },
  { category: 'user',        type: 'is_boosting',        label: '🚀 Está impulsionando o servidor',  params: [] },
  { category: 'user',        type: 'in_voice',           label: '🔊 Está em call',                   params: [] },
  { category: 'user',        type: 'account_age_gt',     label: '📅 Conta criada há +X dias',        params: ['days'] },
  { category: 'user',        type: 'joined_gt',          label: '📅 Entrou há +X dias',              params: ['days'] },
  { category: 'channel',     type: 'is_channel',         label: '📌 Canal específico',               params: ['channelId'] },
  { category: 'channel',     type: 'not_channel',        label: '📌 Não é este canal',               params: ['channelId'] },
  { category: 'channel',     type: 'is_category',        label: '📂 Categoria específica',           params: ['categoryId'] },
  { category: 'channel',     type: 'is_thread_channel',  label: '🧵 Canal atual é um tópico',        params: [] },
  { category: 'message',     type: 'contains_text',      label: '🔍 Mensagem contém texto',          params: ['text'] },
  { category: 'message',     type: 'not_contains',       label: '🔍 Não contém texto',               params: ['text'] },
  { category: 'message',     type: 'contains_link',      label: '🔗 Contém link',                    params: [] },
  { category: 'message',     type: 'length_gt',          label: '📏 Tamanho maior que X',            params: ['length'] },
  { category: 'message',     type: 'length_lt',          label: '📏 Tamanho menor que X',            params: ['length'] },
  { category: 'message',     type: 'matches_regex',      label: '🔤 Regex',                          params: ['pattern'] },
  { category: 'reaction',    type: 'bot_reacted',        label: '🤖 Bot reagiu na mensagem',         params: [] },
  { category: 'reaction',    type: 'bot_reacted_with',   label: '🤖 Bot reagiu com emoji',           params: ['emoji'] },
  { category: 'reaction',    type: 'reaction_is',        label: '😀 Reação é emoji específico',      params: ['emoji'] },
  { category: 'time',        type: 'hour_eq',            label: '🕐 Hora igual a',                   params: ['hour'] },
  { category: 'time',        type: 'minute_eq',          label: '🕐 Minuto igual a',                 params: ['minute'] },
  { category: 'variable',    type: 'eq',                 label: '🔢 Variável igual a',               params: ['name', 'value'] },
  { category: 'variable',    type: 'neq',                label: '🔢 Variável diferente de',          params: ['name', 'value'] },
  { category: 'variable',    type: 'gt',                 label: '🔢 Variável maior que',             params: ['name', 'value'] },
  { category: 'variable',    type: 'lt',                 label: '🔢 Variável menor que',             params: ['name', 'value'] },
  { category: 'variable',    type: 'list_contains',      label: '📋 Lista contém valor',             params: ['name', 'value'] },
  { category: 'variable',    type: 'not_list_contains',  label: '📋 Lista não contém valor',         params: ['name', 'value'] },
  { category: 'variable',    type: 'progressive_goal',   label: '📈 Meta Progressiva',               params: ['currentValue', 'progressionBase', 'baseValue'] },
  { category: 'probability', type: 'chance',             label: '🎲 Chance %',                       params: ['percent'] },
  { category: 'date',        type: 'before',             label: '📅 Antes de data',                  params: ['date'] },
  { category: 'date',        type: 'after',              label: '📅 Depois de data',                 params: ['date'] },
  { category: 'date',        type: 'between',            label: '📅 Entre datas',                    params: ['from', 'to'] },
  { category: 'time',        type: 'before',             label: '⏰ Antes de horário',               params: ['time'] },
  { category: 'time',        type: 'after',              label: '⏰ Depois de horário',              params: ['time'] },
  { category: 'time',        type: 'between',            label: '⏰ Entre horários',                 params: ['from', 'to'] },
  { category: 'permission',  type: 'is_admin',           label: '🛡️ É administrador',               params: [] },
  { category: 'permission',  type: 'has_permission',     label: '🛡️ Tem permissão',                 params: ['permSelect'] },
  { category: 'args',        type: 'args_has_content',   label: '📝 Args tem conteúdo',              params: ['errorMsg'] },
  { category: 'args',        type: 'arg_is_type',        label: '🔍 Arg X é tipo específico',        params: ['argSelect', 'errorMsg'] },
];

const ACTION_CATALOG = [
  { category: 'message',  type: 'send_message',             label: '💬 Enviar mensagem',                    params: ['content', 'channelId', 'embedObj', 'interactionObj'] },
  { category: 'message',  type: 'send_dm',                  label: '📩 Enviar DM',                          params: ['content', 'embedObj', 'interactionObj'] },
  { category: 'message',  type: 'reply_message',            label: '↩️ Responder mensagem',                 params: ['content', 'ephemeral', 'embedObj', 'interactionObj'] },
  { category: 'message',  type: 'edit_interaction_message', label: '🖱️ Editar mensagem da interação',       params: ['content', 'embedObj', 'removeComponents'] },
  { category: 'message',  type: 'delete_message',           label: '🗑️ Apagar mensagem',                    params: [] },
  { category: 'message',  type: 'edit_message',             label: '✏️ Editar mensagem',                    params: ['content'] },
  { category: 'message',  type: 'delete_bot_message',       label: '🗑️ Apagar mensagem do bot',             params: ['messageId', 'channelId'] },
  { category: 'system',   type: 'ask_confirm',              label: '❓ Pedir confirmação',                  params: ['content', 'targetUserId', 'timeout', 'cancelMessage'] },
  { category: 'user',     type: 'give_role',                label: '🏷️ Dar cargo',                         params: ['roleId'] },
  { category: 'user',     type: 'remove_role',              label: '🏷️ Remover cargo',                     params: ['roleId'] },
  { category: 'user',     type: 'give_temp_role',           label: '⏱️ Cargo temporário',                  params: ['roleId', 'duration'] },
  { category: 'user',     type: 'toggle_role',              label: '🔄 Alternar cargo',                     params: ['roleId'] },
  { category: 'user',     type: 'ban',                      label: '🔨 Banir usuário',                      params: ['reason'] },
  { category: 'user',     type: 'kick',                     label: '👢 Expulsar usuário',                   params: [] },
  { category: 'user',     type: 'timeout',                  label: '⏸️ Timeout',                            params: ['duration'] },
  { category: 'user',     type: 'remove_timeout',           label: '▶️ Remover timeout',                    params: [] },
  { category: 'user',     type: 'change_nickname',          label: '📝 Alterar nickname',                   params: ['nickname'] },
  { category: 'variable', type: 'set',                      label: '📦 Definir variável',                   params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'set_user_var',             label: '📦 Definir var de usuário',             params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'add',                      label: '➕ Somar variável',                     params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'sub',                      label: '➖ Subtrair variável',                  params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'mul',                      label: '✖️ Multiplicar variável',               params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'div',                      label: '➗ Dividir variável',                   params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'random',                   label: '🎲 Valor aleatório',                    params: ['name', 'min', 'max', 'targetUserId'] },
  { category: 'variable', type: 'push',                     label: '➕ Adicionar à lista',                  params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'remove_item',              label: '➖ Remover da lista (por valor)',        params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'remove_index',             label: '🗑️ Remover da lista (por índice)',      params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'random_from',              label: '🎲 Aleatório da lista',                 params: ['name', 'saveAs', 'targetUserId'] },
  { category: 'variable', type: 'show_ranking',             label: '🏆 Mostrar Ranking',                    params: ['varName', 'title', 'ephemeral'] },
  { category: 'time',     type: 'wait_seconds',             label: '⏱️ Aguardar segundos',                  params: ['seconds'] },
  { category: 'time',     type: 'wait_minutes',             label: '⏱️ Aguardar minutos',                   params: ['minutes'] },
  { category: 'discord',  type: 'add_reaction',             label: '😀 Adicionar reação',                   params: ['emoji'] },
  { category: 'discord',  type: 'remove_reaction',          label: '😶 Remover reação',                     params: ['emoji'] },
  { category: 'discord',  type: 'pin_message',              label: '📌 Fixar mensagem',                     params: [] },
  { category: 'channel',  type: 'create_channel',           label: '📁 Criar canal',                        params: ['name'] },
  { category: 'channel',  type: 'delete_channel',           label: '❌ Apagar canal',                       params: ['channelId'] },
  { category: 'channel',  type: 'rename_channel',           label: '✏️ Renomear canal',                     params: ['channelId', 'name'] },
  { category: 'channel',  type: 'lock_channel',             label: '🔒 Trancar canal',                      params: ['channelId', 'roleId'] },
  { category: 'channel',  type: 'unlock_channel',           label: '🔓 Destrancar canal',                   params: ['channelId', 'roleId'] },
  { category: 'thread',   type: 'create_public_thread',     label: '🧵 Criar tópico público',               params: ['channelId', 'name'] },
  { category: 'thread',   type: 'create_private_thread',    label: '🔒 Criar tópico privado',               params: ['channelId', 'name'] },
  { category: 'thread',   type: 'add_thread_member',        label: '➕ Adicionar ao tópico',                params: ['threadTargetTypeSelect'] },
  { category: 'thread',   type: 'close_thread',             label: '🔐 Fechar tópico',                      params: [] },
  { category: 'system',   type: 'run_flow',                 label: '⚡ Executar fluxo',                     params: ['flowId'] },
  { category: 'system',   type: 'emit_event',               label: '📡 Disparar evento',                    params: ['eventType'] },
  { category: 'system',   type: 'cancel_flow',              label: '🛑 Cancelar fluxo',                     params: [] },
  { category: 'system',   type: 'stop_execution',           label: '⏹️ Parar execução',                     params: [] }
];

/* ─────────────────────────────────────────────
   METADADOS DE CATEGORIA — usados para organizar
   Trigger / Condições / Ações em 2 passos:
   1) escolher a CATEGORIA   2) escolher o ITEM dela
   Isso evita a "parede de selects" com 25+ opções soltas.
   ───────────────────────────────────────────── */
const TRIGGER_CATEGORY_META = {
  time:      { label: '🕐 Tempo / Horário',     description: 'Disparos agendados' },
  command:   { label: '🔧 Comandos',            description: 'Comando personalizado executado' },
  message:   { label: '💬 Mensagens',           description: 'Criada, editada, com link, imagem...' },
  reaction:  { label: '😀 Reações',             description: 'Adicionadas ou removidas' },
  member:    { label: '👤 Membros',             description: 'Entrou, saiu, banido, boost...' },
  channel:   { label: '📁 Canais',              description: 'Criado, apagado, atualizado' },
  voice:     { label: '🔊 Voz / Call',          description: 'Entrar, sair, câmera, tela' },
  component: { label: '🖱️ Componentes',        description: 'Botão, select, modal' },
  thread:    { label: '🧵 Tópicos (Threads)',   description: 'Criado ou fechado' },
  internal:  { label: '⚡ Internos',            description: 'Eventos disparados por outro fluxo' },
};

const CONDITION_CATEGORY_META = {
  user:        { label: '👤 Usuário',         description: 'Cargo, conta, boost, voz...' },
  channel:     { label: '📌 Canal',           description: 'Canal específico, categoria, thread' },
  message:     { label: '💬 Mensagem',        description: 'Texto, link, tamanho, regex' },
  reaction:    { label: '😀 Reação',          description: 'Emoji específico, reação do bot' },
  time:        { label: '🕐 Horário',         description: 'Hora, minuto, intervalo' },
  date:        { label: '📅 Data',            description: 'Antes, depois, entre datas' },
  variable:    { label: '📦 Variável',        description: 'Comparações e listas' },
  probability: { label: '🎲 Probabilidade',   description: 'Chance percentual' },
  permission:  { label: '🛡️ Permissão',      description: 'Admin ou permissão específica' },
  args:        { label: '📝 Argumentos',      description: 'Validação de args de comando' },
};

const ACTION_CATEGORY_META = {
  message: { label: '💬 Mensagens',       description: 'Enviar, responder, editar, apagar' },
  user:    { label: '👤 Usuário',         description: 'Cargos, ban, kick, timeout, nick' },
  variable:{ label: '📦 Variáveis',       description: 'Definir, somar, listas, ranking' },
  time:    { label: '⏱️ Tempo',           description: 'Aguardar segundos/minutos' },
  discord: { label: '😀 Discord',         description: 'Reações, fixar mensagem' },
  channel: { label: '📁 Canais',          description: 'Criar, apagar, renomear, trancar' },
  thread:  { label: '🧵 Tópicos',         description: 'Criar, adicionar membro, fechar' },
  system:  { label: '⚙️ Sistema',         description: 'Executar/cancelar fluxo, eventos' },
};

/** Agrupa um catálogo plano em { categoria: [itens...] } preservando ordem de primeira aparição. */
function groupByCategory(catalog) {
  const groups = new Map();
  for (const item of catalog) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return groups;
}

const TRIGGER_GROUPS   = groupByCategory(TRIGGER_CATALOG);
const CONDITION_GROUPS = groupByCategory(CONDITION_CATALOG);
const ACTION_GROUPS    = groupByCategory(ACTION_CATALOG);

const NEEDS_CHANNEL_SELECT = ['channelId', 'categoryId'];
const NEEDS_ROLE_SELECT    = ['roleId'];
const NEEDS_ARG_SELECT     = ['argSelect'];
const NEEDS_PERM_SELECT    = ['permSelect'];
const NEEDS_THREAD_TARGET  = ['threadTargetTypeSelect'];
const SKIP_IN_MODAL = [...NEEDS_CHANNEL_SELECT, ...NEEDS_ROLE_SELECT, ...NEEDS_ARG_SELECT, ...NEEDS_PERM_SELECT, ...NEEDS_THREAD_TARGET];

const OPTIONAL_PARAMS = [
  'reason', 'description', 'channelId', 'userId',
  'ephemeral', 'saveAs', 'messageId', 'embed', 'embedObj', 'interactionObj',
  'targetUserId', 'timeout', 'cancelMessage', 'baseValue', 'removeComponents'
];

function booleanParams(t, ctx) {
  return {
    ephemeral:        { label: t('bp_ephemeral_label', ctx),        yes: t('bp_ephemeral_yes', ctx),        no: t('bp_ephemeral_no', ctx),        default: 'false' },
    removeComponents: { label: t('bp_removeComponents_label', ctx), yes: t('bp_removeComponents_yes', ctx), no: t('bp_removeComponents_no', ctx), default: 'true'  },
  };
}


/* ─────────────────────────────────────────────
   FLOW BUILDER — Components V2
   ───────────────────────────────────────────── */

class FlowBuilder {

  constructor(client, ui) {
    this.client = client;
    this.ui     = ui;
  }

  _e(name) {
    return this.client?.emoji?.[name] ?? AYAMI_FALLBACK[name] ?? '';
  }

  /** Atalho pra tradução de uma chave do sistema "logicbuilder". */
  t(key, ctx, extra = {}) {
    return this.client.t(`logicbuilder.${key}`, { ...ctx, ...extra });
  }

  /** Contexto de locale + atalhos de emoji, a partir da interação. */
  _tctx(interaction, extra = {}) {
    return localeCtx(interaction, {
      animada:   this._e('animada'),
      pensando:  this._e('pensando'),
      assustada: this._e('assustada'),
      emburrada: this._e('emburrada'),
      emduvida:  this._e('emduvida'),
      festa:     this._e('festa'),
      feliz:     this._e('feliz'),
      curtida:   this._e('curtida'),
      chorando:  this._e('chorando'),
      brava:     this._e('brava'),
      carinho:   this._e('carinho'),
      corao:     this._e('corao'),
      ...extra,
    });
  }

  /* ── Traduções dos catálogos (Trigger / Condição / Ação) ── */
  _trgLabel(item, ctx) { return this.t(`trg_cat_${item.category}_${item.type}_label`, ctx); }
  _trgDesc(item, ctx)  { return this.t(`trg_cat_${item.category}_${item.type}_desc`, ctx); }
  _cndLabel(item, ctx) { return this.t(`cnd_cat_${item.category}_${item.type}_label`, ctx); }
  _actLabel(item, ctx) { return this.t(`act_cat_${item.category}_${item.type}_label`, ctx); }

  _trgCatMeta(cat, ctx) { return { label: this.t(`trgcatmeta_${cat}_label`, ctx), description: this.t(`trgcatmeta_${cat}_desc`, ctx) }; }
  _cndCatMeta(cat, ctx) { return { label: this.t(`cndcatmeta_${cat}_label`, ctx), description: this.t(`cndcatmeta_${cat}_desc`, ctx) }; }
  _actCatMeta(cat, ctx) { return { label: this.t(`actcatmeta_${cat}_label`, ctx), description: this.t(`actcatmeta_${cat}_desc`, ctx) }; }

  /** Label traduzido de um trigger { category, type }, com fallback pro catálogo cru. */
  _triggerLabelTranslated(trigger, ctx) {
    if (!trigger) return this.t('trigger_not_configured', ctx);
    const found = TRIGGER_CATALOG.find(t => t.category === trigger.category && t.type === trigger.type);
    if (!found) return `${trigger.category}/${trigger.type}`;
    return this._trgLabel(found, ctx);
  }

  _guideButton(ctx = {}) {
    return { type: 2, style: 5, label: this.t('guide_button', ctx), url: GUIDE_URL };
  }

  /* ── helper: painel CV2 sem ephemeral (mensagem original visível ao servidor) ── */
  _cv2(blocks, opts = {}) {
    return this.ui.cv2Payload(blocks, { ephemeral: false, ...opts });
  }

  /* ══════════════════════════════════════════════
     CRIAR FLUXO — modal (inalterado, não tem CV2)
     ══════════════════════════════════════════════ */

  async startCreate(interaction, user) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_create_flow_modal_title', ctx),
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'name',        label: this.t('fb_field_flow_name_label', ctx),        style: 1, required: true,  max_length: 100, placeholder: this.t('fb_field_flow_name_placeholder', ctx) }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: this.t('fb_field_flow_desc_label', ctx), style: 2, required: false, max_length: 300, placeholder: this.t('fb_field_flow_desc_placeholder', ctx) }] }
      ],
      funcao: async (mi, client, fields) => {
        const miCtx = this._tctx(mi);
        const name = fields.name?.trim();
        if (!name) {
          return DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, {
            method: 'POST', body: { type: 4, data: { content: this.t('fb_invalid_name', miCtx), flags: 64 } }
          });
        }

        const flow = await this.client.logicEngine.createFlow({
          guildId:     mi.guild_id,
          name,
          description: fields.description?.trim() || '',
          trigger:     { category: 'message', type: 'message_created', filters: {} },
          createdBy:   user
        });

        await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
        return this.triggerMenu(mi, user, flow.flowId);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ══════════════════════════════════════════════
     MENU: TRIGGER  ─ CV2
     ══════════════════════════════════════════════ */

  async triggerMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const ctx  = this._tctx(interaction);
    if (!flow) return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
      this.ui.cv2Text(this.t('fb_flow_not_found', ctx))
    ]));

    const current = this._triggerLabelTranslated(flow.trigger, ctx);

    /* ── Passo 1: escolher CATEGORIA do trigger (lista curta e organizada) ── */
    const categorySel = this.ui.select(
      user,
      [...TRIGGER_GROUPS.keys()].map(cat => {
        const meta = this._trgCatMeta(cat, ctx);
        return {
          label:       meta.label?.slice(0, 100) || cat,
          value:       cat,
          description: meta.description?.slice(0, 100),
        };
      }),
      this.t('fb_trigger_choose_category', ctx),
      async (si) => {
        await this.ui.deferUpdate(si);
        return this._triggerCategoryMenu(si, user, flowId, si.data.values[0]);
      }
    );

    const btnFilters = this.ui.btn(user, this.t('fb_btn_trigger_filters', ctx), 2, async (i) => {
      return this._triggerFilters(i, user, flowId);
    });

    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_trigger_menu_header', { ...ctx, successMsg, current })),
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('fb_trigger_choose_category_hint', ctx)),
      this.ui.row(categorySel),
      this.ui.cv2Divider(),
      this.ui.row(btnFilters, btnBack, this._guideButton(ctx)),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  /** Passo 2: dentro da categoria escolhida, lista só os triggers daquele grupo. */
  async _triggerCategoryMenu(interaction, user, flowId, category) {
    const items = TRIGGER_GROUPS.get(category) || [];
    const ctx   = this._tctx(interaction);
    const meta  = this._trgCatMeta(category, ctx);

    const itemSel = this.ui.select(
      user,
      items.map(a => ({ label: this._trgLabel(a, ctx).slice(0, 100), value: `${a.category}:${a.type}`, description: this._trgDesc(a, ctx)?.slice(0, 100) })),
      this.t('fb_trigger_choose_event', { ...ctx, category: meta?.label || category }),
      async (si) => {
        await this.ui.deferUpdate(si);
        const [cat, typ] = si.data.values[0].split(':');
        return this._setTrigger(si, user, flowId, cat, typ);
      }
    );

    const btnBack = this.ui.btn(user, this.t('fb_btn_other_category', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.triggerMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_trigger_category_header', { ...ctx, category: meta?.label || category, description: meta?.description || '' })),
      this.ui.cv2Divider(),
      this.ui.row(itemSel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _setTrigger(interaction, user, flowId, category, type) {
    const ctx = this._tctx(interaction);
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, {
      trigger: { category, type, filters: {} }
    });
    return this.triggerMenu(interaction, user, flowId, {
      successMsg: this.t('fb_trigger_set_success', { ...ctx, trigger: this._triggerLabelTranslated({ category, type }, ctx) })
    });
  }

  /* ── Filtros do Trigger (mantém embed, são painéis secundários) ── */
  async _triggerFilters(interaction, user, flowId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const ctx  = this._tctx(interaction);
    if (!flow?.trigger) {
      return this.ui.followUpEphemeral(interaction, { content: this.t('fb_no_trigger_configured', ctx) });
    }
    const { category, type, filters = {} } = flow.trigger;

    const saveFilters = async (i, f) => {
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, {
        trigger: { category, type, filters: f }
      });
      return this.triggerMenu(i, user, flowId, {
        successMsg: this.t('fb_filters_saved', this._tctx(i))
      });
    };

    if (category === 'message')   return this._filterPanelMessage(interaction, user, flowId, filters, saveFilters);
    if (category === 'reaction')  return this._filterPanelReaction(interaction, user, flowId, filters, saveFilters);
    if (category === 'member')    return this._filterPanelMember(interaction, user, flowId, filters, saveFilters);
    if (category === 'voice')     return this._filterPanelVoice(interaction, user, flowId, filters, saveFilters);
    if (category === 'component') return this._filterPanelComponent(interaction, user, flowId, type, filters, saveFilters);
    if (category === 'time')      return this._filterPanelTime(interaction, user, flowId, filters, saveFilters);

    await this.ui.deferUpdate(interaction);
    return this.triggerMenu(interaction, user, flowId, {
      successMsg: this.t('fb_no_configurable_filters', ctx)
    });
  }

  // ── Filtros: Mensagem ─────────────────────────────────────────────────────
  async _filterPanelMessage(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const ctx = this._tctx(i);
      const lines = [
        `${this.t('fb_filter_channel_label', ctx)} ${f.channelId ? `<#${f.channelId}>` : this.t('fb_filter_any_channel', ctx)}`,
        `${this.t('fb_filter_role_label', ctx)} ${f.roleId    ? `<@&${f.roleId}>`   : this.t('fb_filter_any_role', ctx)}`,
        `${this.t('fb_filter_humans_only_label', ctx)} ${f.ignoreBots === 'true' ? this.t('fb_filter_yes_check', ctx) : this.t('fb_filter_no_check', ctx)}`,
        `${this.t('fb_filter_prefix_label', ctx)} ${f.prefix ? `\`${f.prefix}\`` : this.t('fb_filter_no_prefix', ctx)}`,
      ].join('\n');

      const chSel = this.client.interactions.createChannelSelect({
        user, data: { placeholder: this.t('fb_filter_channel_placeholder', ctx), channel_types: [0, 5] },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); }
      });
      const roleSel = this.client.interactions.createRoleSelect({
        user, data: { placeholder: this.t('fb_filter_role_placeholder', ctx) },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.roleId = si.data.values[0]; return renderPanel(si, f); }
      });
      const botsSel = this.client.interactions.createSelect({
        user, data: { placeholder: this.t('fb_filter_ignore_bots_placeholder', { ...ctx, status: f.ignoreBots === 'true' ? this.t('fb_filter_yes_check', ctx).replace(' ✅','') : this.t('fb_filter_no_check', ctx).replace(' ❌','') }), options: [
          { label: this.t('fb_filter_yes_humans_option', ctx), value: 'true', emoji: { name: '✅' } },
          { label: this.t('fb_filter_no_bots_option', ctx), value: 'false', emoji: { name: '❌' } },
        ]},
        funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); }
      });
      const btnPrefix = this.client.interactions.createButton({
        user, data: { label: this.t('fb_filter_set_prefix_button', { ...ctx, prefix: f.prefix }), style: 2 },
        funcao: async (bi) => {
          const biCtx = this._tctx(bi);
          const modal = this.client.interactions.createModal({
            user, title: this.t('fb_filter_prefix_modal_title', biCtx),
            components: [{ type: 1, components: [{ type: 4, custom_id: 'prefix', label: this.t('fb_filter_prefix_field_label', biCtx), style: 1, required: false, max_length: 10, placeholder: this.t('fb_filter_prefix_placeholder', biCtx), value: f.prefix || '' }]}],
            funcao: async (mi, _, fields) => {
              f.prefix = fields.prefix?.trim() || undefined;
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderPanel(mi, f);
            }
          });
          return this.client.interactions.showModal(bi, modal);
        }
      });
      const btnClear = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_clear', ctx), style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_save', ctx), style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });

      return this.ui.editOriginal(i, {
        embeds: [{ title: this.t('fb_filter_header_message', ctx), description: `${this.t('fb_filter_desc', ctx)}\n\n${lines}\n\n${this.t('fb_filter_empty_hint_message', ctx)}`, color: COLOR.main }],
        components: [this.ui.row(chSel), this.ui.row(roleSel), this.ui.row(botsSel), this.ui.row(btnPrefix, btnClear, btnSave)]
      });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Reação ───────────────────────────────────────────────────────
  async _filterPanelReaction(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const ctx = this._tctx(i);
      const lines = [
        `${this.t('fb_filter_channel_label', ctx)} ${f.channelId ? `<#${f.channelId}>` : this.t('fb_filter_any_channel', ctx)}`,
        `${this.t('fb_filter_emoji_label', ctx)} ${f.emoji || this.t('fb_filter_any_emoji', ctx)}`,
      ].join('\n');
      const chSel = this.client.interactions.createChannelSelect({ user, data: { placeholder: this.t('fb_filter_channel_placeholder', ctx), channel_types: [0, 5] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); } });
      const btnEmoji = this.client.interactions.createButton({ user, data: { label: this.t('fb_filter_set_emoji_button', { ...ctx, emoji: f.emoji }), style: 2 }, funcao: async (bi) => {
        const biCtx = this._tctx(bi);
        const modal = this.client.interactions.createModal({ user, title: this.t('fb_filter_emoji_modal_title', biCtx), components: [{ type: 1, components: [{ type: 4, custom_id: 'emoji', label: this.t('fb_filter_emoji_field_label', biCtx), style: 1, required: false, max_length: 50, placeholder: this.t('fb_filter_emoji_placeholder', biCtx), value: f.emoji || '' }]}], funcao: async (mi, _, fields) => { f.emoji = fields.emoji?.trim() || undefined; await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } }); return renderPanel(mi, f); } });
        return this.client.interactions.showModal(bi, modal);
      }});
      const btnClear = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_clear', ctx), style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_save', ctx), style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: this.t('fb_filter_header_reaction', ctx), description: `${this.t('fb_filter_desc', ctx)}\n\n${lines}`, color: COLOR.main }], components: [this.ui.row(chSel), this.ui.row(btnEmoji, btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Membro ───────────────────────────────────────────────────────
  async _filterPanelMember(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const ctx = this._tctx(i);
      const lines = [
        `${this.t('fb_filter_role_label', ctx)} ${f.roleId ? `<@&${f.roleId}>` : this.t('fb_filter_any_role', ctx)}`,
        `${this.t('fb_filter_humans_only_label', ctx)} ${f.ignoreBots === 'true' ? this.t('fb_filter_yes_check', ctx) : this.t('fb_filter_no_check', ctx)}`,
      ].join('\n');
      const roleSel = this.client.interactions.createRoleSelect({ user, data: { placeholder: this.t('fb_filter_member_role_placeholder', ctx) }, funcao: async (si) => { await this.ui.deferUpdate(si); f.roleId = si.data.values[0]; return renderPanel(si, f); } });
      const botsSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_filter_ignore_bots_placeholder', { ...ctx, status: f.ignoreBots === 'true' ? this.t('fb_filter_yes_check', ctx).replace(' ✅','') : this.t('fb_filter_no_check', ctx).replace(' ❌','') }), options: [{ label: this.t('fb_filter_yes_real_people_option', ctx), value: 'true', emoji: { name: '✅' } }, { label: this.t('fb_filter_no_bots_option', ctx), value: 'false', emoji: { name: '❌' } }]}, funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); } });
      const btnClear = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_clear', ctx), style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_save', ctx), style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: this.t('fb_filter_header_member', ctx), description: `${this.t('fb_filter_desc', ctx)}\n\n${lines}`, color: COLOR.main }], components: [this.ui.row(roleSel), this.ui.row(botsSel), this.ui.row(btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Voz ──────────────────────────────────────────────────────────
  async _filterPanelVoice(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const ctx = this._tctx(i);
      const lines = [`${this.t('fb_filter_voice_channel_label', ctx)} ${f.channelId ? `<#${f.channelId}>` : this.t('fb_filter_any_voice_channel', ctx)}`, `${this.t('fb_filter_humans_only_label', ctx)} ${f.ignoreBots === 'true' ? this.t('fb_filter_yes_check', ctx) : this.t('fb_filter_no_check', ctx)}`].join('\n');
      const chSel   = this.client.interactions.createChannelSelect({ user, data: { placeholder: this.t('fb_filter_voice_channel_placeholder', ctx), channel_types: [2] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); } });
      const botsSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_filter_ignore_bots_placeholder', { ...ctx, status: f.ignoreBots === 'true' ? this.t('fb_filter_yes_check', ctx).replace(' ✅','') : this.t('fb_filter_no_check', ctx).replace(' ❌','') }), options: [{ label: this.t('fb_filter_yes_real_people_option', ctx), value: 'true', emoji: { name: '✅' } }, { label: this.t('fb_filter_no_bots_option', ctx), value: 'false', emoji: { name: '❌' } }]}, funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); } });
      const btnClear = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_clear', ctx), style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_save', ctx), style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: this.t('fb_filter_header_voice', ctx), description: `${this.t('fb_filter_desc', ctx)}\n\n${lines}`, color: COLOR.main }], components: [this.ui.row(chSel), this.ui.row(botsSel), this.ui.row(btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Componente ───────────────────────────────────────────────────
  async _filterPanelComponent(interaction, user, flowId, type, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const ctx = this._tctx(i);
      const typeLabel = type === 'button_clicked' ? this.t('fb_component_type_button', ctx) : type === 'select_used' ? this.t('fb_component_type_select', ctx) : this.t('fb_component_type_modal', ctx);
      const lines = [`${this.t('fb_filter_component_id_label', { ...ctx, typeLabel })} ${f.customId ? `\`${f.customId}\`` : this.t('fb_filter_any_id', ctx)}`, `${this.t('fb_filter_channel_label', ctx)} ${f.channelId ? `<#${f.channelId}>` : this.t('fb_filter_any_channel', ctx)}`].join('\n');
      const chSel = this.client.interactions.createChannelSelect({ user, data: { placeholder: this.t('fb_filter_channel_placeholder', ctx), channel_types: [0, 5] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); } });
      const btnId = this.client.interactions.createButton({ user, data: { label: this.t('fb_filter_component_id_button', { ...ctx, customId: f.customId?.slice(0, 20) }), style: 1 }, funcao: async (bi) => {
        const biCtx = this._tctx(bi);
        const modal = this.client.interactions.createModal({ user, title: this.t('fb_filter_component_id_modal_title', { ...biCtx, typeLabel }), components: [{ type: 1, components: [{ type: 4, custom_id: 'customId', label: this.t('fb_filter_component_id_field_label', { ...biCtx, typeLabel }), style: 1, required: false, max_length: 100, placeholder: this.t('fb_filter_component_id_placeholder', biCtx), value: f.customId || '' }]}], funcao: async (mi, _, fields) => { f.customId = fields.customId?.trim() || undefined; await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } }); return renderPanel(mi, f); } });
        return this.client.interactions.showModal(bi, modal);
      }});
      const btnClear = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_clear', ctx), style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_save', ctx), style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: this.t('fb_filter_header_component', { ...ctx, typeLabel }), description: this.t('fb_filter_component_desc', { ...ctx, typeLabel, lines }), color: COLOR.main }], components: [this.ui.row(chSel), this.ui.row(btnId, btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Horário ──────────────────────────────────────────────────────
  async _filterPanelTime(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const ctx = this._tctx(i);
      const dayNames = [this.t('fb_day_sun',ctx), this.t('fb_day_mon',ctx), this.t('fb_day_tue',ctx), this.t('fb_day_wed',ctx), this.t('fb_day_thu',ctx), this.t('fb_day_fri',ctx), this.t('fb_day_sat',ctx)];
      const lines = [
        `${this.t('fb_time_hour_label', ctx)} ${f.hour !== undefined ? `${String(f.hour).padStart(2, '0')}h` : this.t('fb_time_hour_not_set', ctx)}`,
        `${this.t('fb_time_minute_label', ctx)} :${String(f.minute ?? 0).padStart(2, '0')}`,
        `${this.t('fb_time_days_label', ctx)} ${f.weekdays?.length ? f.weekdays.map(d => dayNames[d]).join(', ') : this.t('fb_time_all_days', ctx)}`,
      ].join('\n');
      const hourOpts1 = Array.from({ length: 12 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: String(h), description: h < 6 ? this.t('fb_time_dawn', ctx) : this.t('fb_time_morning', ctx) }));
      const hourOpts2 = Array.from({ length: 12 }, (_, h) => ({ label: `${String(h + 12).padStart(2, '0')}:00`, value: String(h + 12), description: h + 12 < 18 ? this.t('fb_time_afternoon', ctx) : this.t('fb_time_night', ctx) }));
      const hourSel1  = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_time_hour1_placeholder', { ...ctx, current: f.hour !== undefined && f.hour < 12 ? f.hour + 'h' : this.t('fb_time_not_selected', ctx) }), options: hourOpts1 }, funcao: async (si) => { await this.ui.deferUpdate(si); f.hour = Number(si.data.values[0]); return renderPanel(si, f); } });
      const hourSel2  = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_time_hour2_placeholder', { ...ctx, current: f.hour !== undefined && f.hour >= 12 ? f.hour + 'h' : this.t('fb_time_not_selected', ctx) }), options: hourOpts2 }, funcao: async (si) => { await this.ui.deferUpdate(si); f.hour = Number(si.data.values[0]); return renderPanel(si, f); } });
      const minuteSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_time_minute_placeholder', { ...ctx, minute: String(f.minute ?? 0).padStart(2, '0') }), options: [0,5,10,15,20,25,30,35,40,45,50,55].map(m => ({ label: `:${String(m).padStart(2, '0')}`, value: String(m) })) }, funcao: async (si) => { await this.ui.deferUpdate(si); f.minute = Number(si.data.values[0]); return renderPanel(si, f); } });
      const daysSel   = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_time_weekdays_placeholder', ctx), min_values: 0, max_values: 7, options: [{ label: this.t('fb_day_sunday',ctx), value: '0', emoji: { name: '🌞' } }, { label: this.t('fb_day_monday',ctx), value: '1', emoji: { name: '💼' } }, { label: this.t('fb_day_tuesday',ctx), value: '2', emoji: { name: '💼' } }, { label: this.t('fb_day_wednesday',ctx), value: '3', emoji: { name: '💼' } }, { label: this.t('fb_day_thursday',ctx), value: '4', emoji: { name: '💼' } }, { label: this.t('fb_day_friday',ctx), value: '5', emoji: { name: '🎉' } }, { label: this.t('fb_day_saturday',ctx), value: '6', emoji: { name: '🌟' } }] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.weekdays = si.data.values.length ? si.data.values.map(Number) : undefined; return renderPanel(si, f); } });
      const btnClear = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_clear', ctx), style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_save', ctx), style: 3 }, funcao: async (bi) => {
        await this.ui.deferUpdate(bi);
        const biCtx = this._tctx(bi);
        if (f.hour === undefined) return this.ui.editOriginal(bi, { embeds: [{ title: this.t('fb_time_hour_required_title', biCtx), description: this.t('fb_time_hour_required_desc', biCtx), color: COLOR.danger }], components: [] });
        return saveFilters(bi, f);
      }});
      return this.ui.editOriginal(i, { embeds: [{ title: this.t('fb_filter_header_time', ctx), description: this.t('fb_filter_time_desc', { ...ctx, lines }), color: COLOR.main }], components: [this.ui.row(hourSel1), this.ui.row(hourSel2), this.ui.row(minuteSel), this.ui.row(daysSel), this.ui.row(btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }


  /* ══════════════════════════════════════════════
     MENU: CONDIÇÕES  ─ CV2
     ══════════════════════════════════════════════ */

  async conditionsMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow  = await this._getFlow(interaction.guild_id, flowId);
    if (!flow) return;
    const conds = flow.conditions || [];
    const ctx   = this._tctx(interaction);

    const lines = conds.length
      ? conds.map((c, i) => {
          const meta    = CONDITION_CATALOG.find(x => x.category === c.category && x.type === c.type);
          const opLabel = i === 0 ? '' : ` **(${c.operator})**`;
          const neg     = c.negate ? this.t('fb_cnd_negated_tag', ctx) : '';
          return `\`${i + 1}.\`${opLabel} ${meta ? this._cndLabel(meta, ctx) : c.type}${neg}`;
        }).join('\n')
      : this.t('fb_no_conditions', ctx);

    /* ── Passo 1: escolher categoria da NOVA condição ── */
    const categorySel = this.ui.select(
      user,
      [...CONDITION_GROUPS.keys()].map(cat => {
        const meta = this._cndCatMeta(cat, ctx);
        return {
          label:       meta.label?.slice(0, 100) || cat,
          value:       cat,
          description: meta.description?.slice(0, 100),
        };
      }),
      this.t('fb_cnd_choose_category', ctx),
      async (si) => {
        await this.ui.deferUpdate(si);
        return this._conditionCategoryMenu(si, user, flowId, si.data.values[0]);
      }
    );

    const editComponents = [];
    if (conds.length > 0) {
      const editSel = this.ui.select(
        user,
        conds.map((c, i) => {
          const meta = CONDITION_CATALOG.find(x => x.category === c.category && x.type === c.type);
          return { label: `${i + 1}. ${meta ? this._cndLabel(meta, ctx) : c.type}`.slice(0, 100), value: c.id };
        }),
        this.t('fb_cnd_edit_existing', ctx),
        async (si) => {
          return this._editConditionSelect(si, user, flowId, si.data.values[0]);
        }
      );
      editComponents.push(this.ui.row(editSel));
    }

    const btnRemove = this.ui.btn(user, this.t('fb_btn_remove_last', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!conds.length) return;
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { conditions: conds.slice(0, -1) });
      return this.conditionsMenu(i, user, flowId);
    });
    const btnClear = this.ui.btn(user, this.t('fb_btn_clear_all', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { conditions: [] });
      return this.conditionsMenu(i, user, flowId);
    });
    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_conditions_header', { ...ctx, count: conds.length, successMsg })),
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('fb_conditions_configured_label', { ...ctx, lines })),
      ...editComponents,
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('fb_conditions_add_hint', ctx)),
      this.ui.row(categorySel),
      this.ui.cv2Divider(),
      this.ui.row(btnRemove, btnClear, btnBack, this._guideButton(ctx)),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  /** Passo 2: dentro da categoria escolhida, lista só as condições daquele grupo. */
  async _conditionCategoryMenu(interaction, user, flowId, category) {
    const items = CONDITION_GROUPS.get(category) || [];
    const ctx   = this._tctx(interaction);
    const meta  = this._cndCatMeta(category, ctx);

    const itemSel = this.ui.select(
      user,
      items.map(a => ({ label: this._cndLabel(a, ctx).slice(0, 100), value: `${a.category}:${a.type}` })),
      this.t('fb_cnd_choose_specific', { ...ctx, category: meta?.label || category }),
      async (si) => {
        const [cat, typ] = si.data.values[0].split(':');
        return this._addCondition(si, user, flowId, cat, typ);
      }
    );

    const btnBack = this.ui.btn(user, this.t('fb_btn_other_category', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.conditionsMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_trigger_category_header', { ...ctx, category: meta?.label || category, description: meta?.description || '' })),
      this.ui.cv2Divider(),
      this.ui.row(itemSel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _addCondition(interaction, user, flowId, category, type) {
    const ctx  = this._tctx(interaction);
    const meta = CONDITION_CATALOG.find(c => c.category === category && c.type === type);
    const metaLabel = meta ? this._cndLabel(meta, ctx) : type;
    if (!meta?.params?.length) {
      await this.ui.deferUpdate(interaction);
      const flow  = await this._getFlow(interaction.guild_id, flowId);
      const conds = flow.conditions || [];
      conds.push({ id: this._uid(), category, type, params: {}, operator: 'AND', negate: false });
      await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { conditions: conds });
      return this.conditionsMenu(interaction, user, flowId, { successMsg: this.t('fb_condition_added', { ...ctx, label: metaLabel }) });
    }

    const modalParams = meta.params.filter(p => !SKIP_IN_MODAL.includes(p));
    const needsSelect = meta.params.some(p => SKIP_IN_MODAL.includes(p));

    if (modalParams.length > 0) {
      return this._openConditionModal(interaction, user, flowId, meta, null, modalParams, needsSelect);
    }

    await this.ui.deferUpdate(interaction);
    return this._resolveSelectParams(interaction, user, flowId, meta, {}, 'condition');
  }

  async _openConditionModal(interaction, user, flowId, meta, existingCond, modalParams, needsSelect) {
    const isEdit     = !!existingCond;
    const components = [];
    const ctx = this._tctx(interaction);
    const metaLabel = this._cndLabel(meta, ctx);

    for (const p of modalParams.slice(0, 4)) {
      components.push({
        type: 1,
        components: [{
          type:        4,
          custom_id:   p,
          label:       this._paramLabel(p, ctx).slice(0, 45),
          style:       1,
          required:    !['errorMsg'].includes(p),
          max_length:  200,
          placeholder: this._paramPlaceholder(p, ctx),
          value:       isEdit ? String(existingCond.params?.[p] ?? '') : undefined
        }]
      });
    }

    components.push(
      this.ui.modalSelect('_operator', this.t('fb_operator_field_label', ctx), [
        { label: this.t('fb_operator_and_option', ctx), value: 'AND', default: !isEdit || existingCond.operator !== 'OR' },
        { label: this.t('fb_operator_or_option', ctx),  value: 'OR',  default: isEdit && existingCond.operator === 'OR' },
      ], { placeholder: this.t('fb_operator_placeholder', ctx) }),
      this.ui.modalYesNo('_negate', this.t('fb_negate_field_label', ctx), {
        yesLabel:     this.t('fb_negate_yes_option', ctx),
        noLabel:      this.t('fb_negate_no_option', ctx),
        defaultValue: isEdit && existingCond.negate ? 'true' : 'false'
      })
    );

    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_condition_modal_title', { ...ctx, isEdit, label: metaLabel.slice(0, 35) }),
      components,
      funcao: async (mi, _, fields) => {
        const params   = isEdit ? { ...existingCond.params } : {};
        for (const p of modalParams) {
          const val = fields[p];
          if (val !== undefined && val.trim() !== '') params[p] = val.trim();
        }
        const operator = fields._operator === 'OR' ? 'OR' : 'AND';
        const negate   = fields._negate === 'true';

        await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });

        if (needsSelect) {
          params._condId   = isEdit ? existingCond.id : undefined;
          params._operator = operator;
          params._negate   = negate;
          return this._resolveSelectParams(mi, user, flowId, meta, params, isEdit ? 'condition_edit' : 'condition');
        }

        if (isEdit) return this._applyConditionEdit(mi, user, flowId, existingCond.id, params, operator, negate);
        return this._saveCondition(mi, user, flowId, meta.category, meta.type, { ...params, _operator: operator, _negate: negate });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _saveCondition(interaction, user, flowId, category, type, params) {
    const operator = params._operator || 'AND';
    const negate   = params._negate === true || params._negate === 'true';
    const clean    = { ...params };
    delete clean._operator;
    delete clean._negate;

    const flow  = await this._getFlow(interaction.guild_id, flowId);
    const conds = flow.conditions || [];
    conds.push({ id: this._uid(), category, type, params: clean, operator, negate });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { conditions: conds });

    const ctx  = this._tctx(interaction);
    const meta = CONDITION_CATALOG.find(c => c.category === category && c.type === type);
    return this.conditionsMenu(interaction, user, flowId, { successMsg: this.t('fb_condition_added', { ...ctx, label: meta ? this._cndLabel(meta, ctx) : type }) });
  }

  async _editConditionSelect(interaction, user, flowId, condId) {
    const flow  = await this._getFlow(interaction.guild_id, flowId);
    const cond  = (flow?.conditions || []).find(c => c.id === condId);
    if (!cond) return this.conditionsMenu(interaction, user, flowId);

    const meta        = CONDITION_CATALOG.find(c => c.category === cond.category && c.type === cond.type);
    const modalParams = (meta?.params || []).filter(p => !SKIP_IN_MODAL.includes(p));
    const needsSelect = meta?.params?.some(p => SKIP_IN_MODAL.includes(p));

    if (!modalParams.length && !needsSelect) {
      return this.conditionsMenu(interaction, user, flowId, { successMsg: this.t('fb_no_params_to_edit', this._tctx(interaction)) });
    }
    if (!modalParams.length && needsSelect) {
      return this._resolveSelectParams(interaction, user, flowId, meta, { ...cond.params, _condId: cond.id }, 'condition_edit');
    }
    return this._openConditionModal(interaction, user, flowId, meta, cond, modalParams, needsSelect);
  }

  async _applyConditionEdit(interaction, user, flowId, condId, params, operator, negate) {
    const flow  = await this._getFlow(interaction.guild_id, flowId);
    const conds = (flow.conditions || []).map(c => c.id !== condId ? c : { ...c, params, operator, negate });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { conditions: conds });
    return this.conditionsMenu(interaction, user, flowId, { successMsg: this.t('fb_condition_updated', this._tctx(interaction)) });
  }


  /* ══════════════════════════════════════════════
     MENU: AÇÕES  ─ CV2
     ══════════════════════════════════════════════ */

  async actionsMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow    = await this._getFlow(interaction.guild_id, flowId);
    const actions = flow?.actions || [];
    const ctx     = this._tctx(interaction);

    const lines = actions.length
      ? actions
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((a, i) => {
            const meta = ACTION_CATALOG.find(x => x.category === a.category && x.type === a.type);
            return `\`${i + 1}.\` ${meta ? this._actLabel(meta, ctx) : a.type}`;
          })
          .join('\n')
      : this.t('fb_no_actions', ctx);

    /* ── Passo 1: escolher categoria da NOVA ação ── */
    const categorySel = this.ui.select(
      user,
      [...ACTION_GROUPS.keys()].map(cat => {
        const meta = this._actCatMeta(cat, ctx);
        return {
          label:       meta.label?.slice(0, 100) || cat,
          value:       cat,
          description: meta.description?.slice(0, 100),
        };
      }),
      this.t('fb_act_choose_category', ctx),
      async (si) => {
        await this.ui.deferUpdate(si);
        return this._actionCategoryMenu(si, user, flowId, si.data.values[0]);
      }
    );

    const editComponents = [];
    if (actions.length > 0) {
      const sorted  = [...actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const editSel = this.ui.select(
        user,
        sorted.map((a, i) => {
          const meta = ACTION_CATALOG.find(x => x.category === a.category && x.type === a.type);
          return { label: `${i + 1}. ${meta ? this._actLabel(meta, ctx) : a.type}`.slice(0, 100), value: a.id };
        }),
        this.t('fb_act_edit_existing', ctx),
        async (si) => {
          return this._editActionSelect(si, user, flowId, si.data.values[0]);
        }
      );
      editComponents.push(this.ui.row(editSel));
    }

    const btnRemove = this.ui.btn(user, this.t('fb_btn_remove_last', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!actions.length) return;
      const sorted  = [...actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { actions: sorted.slice(0, -1) });
      return this.actionsMenu(i, user, flowId);
    });
    const btnClear = this.ui.btn(user, this.t('fb_btn_clear_all', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { actions: [] });
      return this.actionsMenu(i, user, flowId);
    });
    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_actions_header', { ...ctx, count: actions.length, successMsg })),
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('fb_actions_configured_label', { ...ctx, lines })),
      ...editComponents,
      this.ui.cv2Divider(),
      this.ui.cv2Text(this.t('fb_actions_add_hint', ctx)),
      this.ui.row(categorySel),
      this.ui.cv2Divider(),
      this.ui.row(btnRemove, btnClear, btnBack, this._guideButton(ctx)),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  /** Passo 2: dentro da categoria escolhida, lista só as ações daquele grupo. */
  async _actionCategoryMenu(interaction, user, flowId, category) {
    const items = ACTION_GROUPS.get(category) || [];
    const ctx   = this._tctx(interaction);
    const meta  = this._actCatMeta(category, ctx);

    const itemSel = this.ui.select(
      user,
      items.map(a => ({ label: this._actLabel(a, ctx).slice(0, 100), value: `${a.category}:${a.type}` })),
      this.t('fb_act_choose_specific', { ...ctx, category: meta?.label || category }),
      async (si) => {
        const [cat, typ] = si.data.values[0].split(':');
        return this._addAction(si, user, flowId, cat, typ);
      }
    );

    const btnBack = this.ui.btn(user, this.t('fb_btn_other_category', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.actionsMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_trigger_category_header', { ...ctx, category: meta?.label || category, description: meta?.description || '' })),
      this.ui.cv2Divider(),
      this.ui.row(itemSel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _addAction(interaction, user, flowId, category, type) {
    const ctx  = this._tctx(interaction);
    const meta = ACTION_CATALOG.find(a => a.category === category && a.type === type);
    const metaLabel = meta ? this._actLabel(meta, ctx) : type;
    if (!meta?.params?.length) {
      await this.ui.deferUpdate(interaction);
      const flow    = await this._getFlow(interaction.guild_id, flowId);
      const actions = flow.actions || [];
      actions.push({ id: this._uid(), category, type, params: {}, order: actions.length });
      await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { actions });
      return this.actionsMenu(interaction, user, flowId, { successMsg: this.t('fb_action_added', { ...ctx, label: metaLabel }) });
    }

    const modalParams = meta.params.filter(p => !SKIP_IN_MODAL.includes(p) && p !== 'embed' && p !== 'embedObj');
    const hasEmbedObj = meta.params.includes('embedObj');
    const needsSelect = meta.params.some(p => SKIP_IN_MODAL.includes(p));

    if (modalParams.length > 0) {
      return this._openActionModal(interaction, user, flowId, meta, null, modalParams, false, needsSelect, hasEmbedObj);
    }
    if (hasEmbedObj) {
      return this._askEmbedOrSave(interaction, user, flowId, meta, {}, false, null, needsSelect);
    }
    await this.ui.deferUpdate(interaction);
    return this._resolveSelectParams(interaction, user, flowId, meta, {}, 'action');
  }

  async _openActionModal(interaction, user, flowId, meta, existingAction, modalParams, _unused, needsSelect, hasEmbedObj = false) {
    const isEdit     = !!existingAction;
    const components = [];
    const ctx = this._tctx(interaction);
    const metaLabel = this._actLabel(meta, ctx);
    const BOOLEAN_PARAMS = booleanParams(this.t.bind(this), ctx);

    for (const p of modalParams.slice(0, 4)) {
      if (BOOLEAN_PARAMS[p]) {
        const cfg    = BOOLEAN_PARAMS[p];
        const curVal = isEdit ? String(existingAction.params?.[p] ?? cfg.default) : cfg.default;
        components.push(this.ui.modalYesNo(p, cfg.label, { yesLabel: cfg.yes, noLabel: cfg.no, defaultValue: curVal === 'true' ? 'true' : 'false' }));
        continue;
      }
      components.push({
        type: 1,
        components: [{
          type:        4,
          custom_id:   p,
          label:       p === 'content' && meta.type === 'edit_interaction_message' ? this.t('param_edit_interaction_content_label', ctx) : this._paramLabel(p, ctx).slice(0, 45),
          style:       p === 'content' || p === 'reason' ? 2 : 1,
          required:    !OPTIONAL_PARAMS.includes(p) && !(p === 'content' && meta.type === 'edit_interaction_message'),
          max_length:  p === 'content' ? 4000 : 200,
          placeholder: this._paramPlaceholder(p, ctx),
          value:       isEdit ? String(existingAction.params?.[p] ?? '') : undefined
        }]
      });
    }

    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_action_modal_title', { ...ctx, isEdit, label: metaLabel.slice(0, 35) }),
      components,
      funcao: async (mi, _, fields) => {
        const params = isEdit ? { ...existingAction.params } : {};
        for (const p of modalParams) {
          const val = fields[p];
          if (val === undefined) continue;
          if (isEdit && val.trim() === '' && OPTIONAL_PARAMS.includes(p)) continue;
          params[p] = val;
        }
        await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });

        if (hasEmbedObj) {
          return this._askEmbedOrSave(mi, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
        if (needsSelect && !isEdit) return this._resolveSelectParams(mi, user, flowId, meta, params, 'action');
        if (needsSelect && isEdit)  { params._actionId = existingAction.id; return this._resolveSelectParams(mi, user, flowId, meta, params, 'action_edit'); }
        if (isEdit) return this._applyActionEdit(mi, user, flowId, existingAction.id, params);
        return this._saveAction(mi, user, flowId, meta.category, meta.type, params);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _editActionSelect(interaction, user, flowId, actionId) {
    const flow   = await this._getFlow(interaction.guild_id, flowId);
    const action = (flow?.actions || []).find(a => a.id === actionId);
    if (!action) return this.actionsMenu(interaction, user, flowId);

    const meta        = ACTION_CATALOG.find(a => a.category === action.category && a.type === action.type);
    const modalParams = (meta?.params || []).filter(p => !SKIP_IN_MODAL.includes(p) && p !== 'embed' && p !== 'embedObj');
    const hasEmbedObj = meta?.params?.includes('embedObj');
    const needsSelect = meta?.params?.some(p => SKIP_IN_MODAL.includes(p));

    if (!modalParams.length && !hasEmbedObj && !needsSelect) {
      return this.actionsMenu(interaction, user, flowId, { successMsg: this.t('fb_no_params_to_edit_action', this._tctx(interaction)) });
    }
    if (!modalParams.length && !hasEmbedObj && needsSelect) {
      return this._resolveSelectParams(interaction, user, flowId, meta, { ...action.params, _actionId: action.id }, 'action_edit');
    }
    return this._openActionModal(interaction, user, flowId, meta, action, modalParams, false, needsSelect, hasEmbedObj);
  }

  async _applyActionEdit(interaction, user, flowId, actionId, params) {
    const flow    = await this._getFlow(interaction.guild_id, flowId);
    const actions = (flow?.actions || []).map(a => a.id !== actionId ? a : { ...a, params: JSON.parse(JSON.stringify(params)) });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { actions });
    return this.actionsMenu(interaction, user, flowId, { successMsg: this.t('fb_action_updated', this._tctx(interaction)) });
  }

  async _saveAction(interaction, user, flowId, category, type, params) {
    const ctx      = this._tctx(interaction);
    const meta     = ACTION_CATALOG.find(a => a.category === category && a.type === type);
    const metaLabel = meta ? this._actLabel(meta, ctx) : type;
    const guildId  = interaction.guild_id;
    const warnings = [];

    const idWarnings = await this._validateIds(guildId, params, ctx);
    warnings.push(...idWarnings);

    if (params.channelId && ['send_message', 'reply_message', 'edit_message'].includes(type)) {
      const rawId = params.channelId.replace(/[<#>]/g, '').trim();
      try {
        const perms = await getPerm({ channel: true, id: rawId, guildId, bot: true, client: this.client });
        if (!perms.includes('SEND_MESSAGES') || !perms.includes('VIEW_CHANNEL')) {
          warnings.push(this.t('fb_warn_no_send_perm', { ...ctx, channelId: rawId }));
        }
      } catch {}
    }

    if (['give_role', 'remove_role', 'toggle_role', 'give_temp_role'].includes(type) && params.roleId) {
      const rawId = params.roleId.replace(/[<@&>]/g, '').trim();
      try {
        const higher = await holeHighter({ guildId, roleId: rawId, bot: true });
        if (!higher) warnings.push(this.t('fb_warn_role_hierarchy', { ...ctx, roleId: rawId }));
      } catch {}
    }

    const PERM_MAP = {
      'user:ban': 'BAN_MEMBERS', 'user:kick': 'KICK_MEMBERS', 'user:timeout': 'MODERATE_MEMBERS',
      'user:give_role': 'MANAGE_ROLES', 'user:remove_role': 'MANAGE_ROLES', 'user:toggle_role': 'MANAGE_ROLES',
      'user:give_temp_role': 'MANAGE_ROLES', 'user:change_nickname': 'MANAGE_NICKNAMES',
      'channel:create_channel': 'MANAGE_CHANNELS', 'channel:delete_channel': 'MANAGE_CHANNELS',
      'channel:rename_channel': 'MANAGE_CHANNELS', 'channel:lock_channel': 'MANAGE_CHANNELS',
      'channel:unlock_channel': 'MANAGE_CHANNELS', 'message:delete_message': 'MANAGE_MESSAGES',
      'message:delete_bot_message': 'MANAGE_MESSAGES',
    };
    const requiredPerm = PERM_MAP[`${category}:${type}`];
    if (requiredPerm) {
      try {
        const perms = await getPerm({ guildId, bot: true, client: this.client });
        if (!perms.includes(requiredPerm)) warnings.push(this.t('fb_warn_missing_perm', { ...ctx, perm: requiredPerm }));
      } catch {}
    }

    const flow    = await this._getFlow(guildId, flowId);
    const actions = flow.actions || [];
    actions.push({ id: this._uid(), category, type, params: JSON.parse(JSON.stringify(params)), order: actions.length });
    await this.client.logicEngine.updateFlow(flowId, guildId, { actions });

    const msg = warnings.length
      ? this.t('fb_action_added_with_warnings', { ...ctx, label: metaLabel, warnings: warnings.join('\n') })
      : this.t('fb_action_added', { ...ctx, label: metaLabel });

    return this.actionsMenu(interaction, user, flowId, { successMsg: msg });
  }

  /* ══════════════════════════════════════════════
     EMBED BUILDER  — followUp + edita msg original
     ══════════════════════════════════════════════

     Fluxo:
       1. _askEmbedOrSave   → pergunta se quer embed (na msg original/raiz)
       2. _openFlowEmbedBuilder → CAPTURA channelId + messageId REAIS da
          msg raiz (via interaction.message, que ainda é a msg raiz neste
          ponto), faz followUp com o painel builder (embed real + controles)
       3. renderBuilder     → loop de edição (edita o followUp, preview ao vivo)
       4. btnConfirm/btnRemove → apaga o followUp e edita a MSG RAIZ via
          editMessageById(channelId, messageId, ...) — usa REST puro por
          channel+messageId, então funciona mesmo vindo de um token de
          followUp diferente (que é o caso aqui).

     IMPORTANTE: `@original` só é válido dentro da MESMA cadeia de token
     que originou a resposta. Um followUp cria uma mensagem nova com seu
     próprio ciclo — por isso NUNCA usamos editOriginal() depois de abrir
     o followUp; sempre editMessageById() com o ID real salvo no passo 2.
     ══════════════════════════════════════════════ */

  async _askEmbedOrSave(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const existingEmbed = params.embedObj ?? existingAction?.params?.embedObj ?? null;
    const hasEmbed      = !!existingEmbed;
    const ctx = this._tctx(interaction);

    const btnSim = this.client.interactions.createButton({
      user,
      data: { label: hasEmbed ? this.t('fb_embed_btn_edit', ctx) : this.t('fb_embed_btn_create', ctx), style: 1 },
      funcao: async (i) => {
        // NÃO faz deferUpdate aqui — precisamos de `i` intacto (com
        // channel_id e message) para capturar a msg raiz antes de
        // qualquer followUp ser criado.
        return this._openFlowEmbedBuilder(i, user, flowId, meta, params, isEdit, existingAction, needsSelect, existingEmbed);
      }
    });

    const btnNao = this.client.interactions.createButton({
      user,
      data: { label: hasEmbed ? this.t('fb_embed_btn_remove', ctx) : this.t('fb_embed_btn_skip', ctx), style: hasEmbed ? 4 : 2 },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        delete params.embedObj;
        return this._afterEmbedDecision(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
      }
    });

    const rows = hasEmbed && isEdit
      ? [this.ui.row(btnSim, btnNao, this.client.interactions.createButton({
          user, data: { label: this.t('fb_embed_btn_keep', ctx), style: 3 },
          funcao: async (i) => {
            await this.ui.deferUpdate(i);
            params.embedObj = existingEmbed;
            return this._afterEmbedDecision(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
          }
        }))]
      : [this.ui.row(btnSim, btnNao)];

    const blocks = [
      this.ui.cv2Text(
        hasEmbed
          ? this.t('fb_embed_configured_header', ctx)
          : this.t('fb_embed_add_header', ctx)
      ),
      this.ui.cv2Divider(),
      ...rows,
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  /**
   * Abre o painel criador de embed como FOLLOWUP, com preview real
   * (mensagem clássica com `embeds: [...]`, já que CV2 não permite
   * combinar embeds tradicionais).
   *
   * Captura channelId + messageId da mensagem RAIZ logo de cara —
   * isso é o que permite voltar e editá-la depois, vinda de qualquer
   * token (followUp, modal, etc).
   */
  async _openFlowEmbedBuilder(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect, existingEmbed) {
    // ── Captura definitiva da msg raiz (canal + id) ──
    const rootChannelId = interaction.channel_id || interaction.channel?.id;
    const rootMessageId = interaction.message?.id;
    const ctx = this._tctx(interaction);
    const t = (key, extra = {}) => this.client.t(`ticket.${key}`, { ...ctx, ...extra });

    // defer agora que já lemos o necessário de `interaction`
    await this.ui.deferUpdate(interaction);

    const embed = existingEmbed
      ? JSON.parse(JSON.stringify(existingEmbed))
      : { title: '', description: '', color: COLOR.main, url: '', author: { name: '', icon_url: '', url: '' }, footer: { text: '', icon_url: '' }, thumbnail: { url: '' }, image: { url: '' }, fields: [] };

    const PRESET_COLORS = [
      { label: t('eb_color_blue_ayami'), value: '7C8FFF' },
      { label: t('eb_color_blue_hair'),  value: 'A9D6FF' },
      { label: t('eb_color_dark_blue'),  value: '243B7A' },
      { label: t('eb_color_gold'),       value: 'FFD966' },
      { label: t('eb_color_pink'),       value: 'FFB6C8' },
      { label: t('eb_color_green'),      value: '57F287' },
      { label: t('eb_color_red'),        value: 'ED4245' },
      { label: t('eb_color_yellow'),     value: 'FEE75C' },
      { label: t('eb_color_orange'),     value: 'E67E22' },
      { label: t('eb_color_purple'),     value: '9B59B6' },
      { label: t('eb_color_black'),      value: '000000' },
      { label: t('eb_color_custom'),     value: 'custom' },
    ];

    function cleanEmbed(e) {
      const out = {};
      if (e.title)            out.title       = e.title;
      if (e.description)      out.description = e.description;
      if (e.color != null)    out.color       = e.color;
      if (e.url)              out.url         = e.url;
      if (e.author?.name)     out.author      = { name: e.author.name, ...(e.author.icon_url ? { icon_url: e.author.icon_url } : {}), ...(e.author.url ? { url: e.author.url } : {}) };
      if (e.footer?.text)     out.footer      = { text: e.footer.text, ...(e.footer.icon_url ? { icon_url: e.footer.icon_url } : {}) };
      if (e.thumbnail?.url)   out.thumbnail   = { url: e.thumbnail.url };
      if (e.image?.url)       out.image       = { url: e.image.url };
      if (e.fields?.length)   out.fields      = e.fields;
      return out;
    }

    /** Embed "ao vivo" pronta pro Discord renderizar de verdade, com
     *  fallbacks pra nunca mandar uma embed 100% vazia (Discord rejeita). */
    function buildLiveEmbed() {
      const e = cleanEmbed(embed);
      if (!e.title && !e.description && !e.fields?.length && !e.image && !e.thumbnail && !e.author) {
        e.description = t('eb_blank_placeholder');
      }
      e.color = embed.color ?? COLOR.gold;
      return e;
    }

    /* ── renderBuilder: edita o followUp a cada mudança, com preview real ── */
    const renderBuilder = async (i, followUpMsgId) => {

      const editSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: t('eb_field_select_placeholder'),
          options: [
            { label: t('eb_field_title'),        value: 'title'        },
            { label: t('eb_field_description'),  value: 'description'  },
            { label: t('eb_field_url'),          value: 'url'          },
            { label: t('eb_field_author_name'),  value: 'author_name'  },
            { label: t('eb_field_author_icon'),  value: 'author_icon'  },
            { label: t('eb_field_author_url'),   value: 'author_url'   },
            { label: t('eb_field_footer_text'),  value: 'footer_text'  },
            { label: t('eb_field_footer_icon'),  value: 'footer_icon'  },
            { label: t('eb_field_thumbnail'),    value: 'thumbnail'    },
            { label: t('eb_field_image'),        value: 'image'        },
          ]
        },
        funcao: async (si) => {
          const editPrefix = t('eb_edit_prefix');
          const MAP = {
            title:       [`${editPrefix} ${t('eb_field_title')}`,         () => embed.title,           v => { embed.title           = v; }, false],
            description: [`${editPrefix} ${t('eb_field_description')}`,   () => embed.description,     v => { embed.description     = v; }, true ],
            url:         [`${editPrefix} ${t('eb_field_url')}`,           () => embed.url,             v => { embed.url             = v; }, false],
            author_name: [`${editPrefix} ${t('eb_field_author_name')}`,   () => embed.author.name,     v => { embed.author.name     = v; }, false],
            author_icon: [`${editPrefix} ${t('eb_field_author_icon')}`,   () => embed.author.icon_url, v => { embed.author.icon_url = v; }, false],
            author_url:  [`${editPrefix} ${t('eb_field_author_url')}`,    () => embed.author.url,      v => { embed.author.url      = v; }, false],
            footer_text: [`${editPrefix} ${t('eb_field_footer_text')}`,   () => embed.footer.text,     v => { embed.footer.text     = v; }, false],
            footer_icon: [`${editPrefix} ${t('eb_field_footer_icon')}`,   () => embed.footer.icon_url, v => { embed.footer.icon_url = v; }, false],
            thumbnail:   [`${editPrefix} ${t('eb_field_thumbnail')}`,     () => embed.thumbnail.url,   v => { embed.thumbnail.url   = v; }, false],
            image:       [`${editPrefix} ${t('eb_field_image')}`,        () => embed.image.url,       v => { embed.image.url       = v; }, false],
          };
          const [title, getter, setter, multi] = MAP[si.data.values[0]] || [];
          if (!title) return;
          const modal = this.client.interactions.createModal({
            user, title,
            components: [{ type: 1, components: [{ type: 4, custom_id: 'val', label: title, style: multi ? 2 : 1, required: false, value: getter() || '', max_length: multi ? 4000 : 256 }] }],
            funcao: async (mi, _, fields) => {
              setter(fields.val ?? '');
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderBuilder(mi, followUpMsgId);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const fieldSel = this.client.interactions.createSelect({
        user,
        data: { placeholder: t('eb_fields_manage_placeholder'), options: [
          { label: t('eb_add_field_label'), value: 'add',   description: t('eb_add_field_desc', { count: embed.fields.length }) },
          { label: t('eb_remove_field_label'),  value: 'remove' },
        ]},
        funcao: async (si) => {
          if (si.data.values[0] === 'remove') {
            if (!embed.fields.length) return;
            embed.fields.pop();
            await this.ui.deferUpdate(si);
            return renderBuilder(si, followUpMsgId);
          }
          if (embed.fields.length >= 25) return;
          const modal = this.client.interactions.createModal({
            user, title: t('eb_add_field_modal_title'),
            components: [
              this.ui.modalText('name',  t('eb_field_name_label'),  { required: true, maxLength: 256 }),
              this.ui.modalText('value', t('eb_field_value_label'), { required: true, maxLength: 1024, style: 2 }),
              this.ui.modalYesNo('inline', this.t('fb_embed_field_inline_label', ctx), { yesLabel: this.t('fb_embed_field_inline_yes', ctx), noLabel: this.t('fb_embed_field_inline_no', ctx), defaultValue: 'false' }),
            ],
            funcao: async (mi, _, fields) => {
              embed.fields.push({ name: fields.name, value: fields.value, inline: fields.inline === 'true' });
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderBuilder(mi, followUpMsgId);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const colorSel = this.client.interactions.createSelect({
        user,
        data: { placeholder: t('eb_color_select_placeholder'), options: PRESET_COLORS.map(c => ({ label: c.label, value: c.value })) },
        funcao: async (si) => {
          const val = si.data.values[0];
          if (val === 'custom') {
            const modal = this.client.interactions.createModal({
              user, title: t('eb_custom_hex_modal_title'),
              components: [{ type: 1, components: [{ type: 4, custom_id: 'hex', label: t('eb_hex_label'), style: 1, required: true, max_length: 7, placeholder: t('eb_hex_placeholder') }] }],
              funcao: async (mi, _, fields) => {
                const hex = (fields.hex || '').replace('#', '').trim();
                if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return;
                embed.color = parseInt(hex, 16);
                await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
                return renderBuilder(mi, followUpMsgId);
              }
            });
            return this.client.interactions.showModal(si, modal);
          }
          embed.color = parseInt(val, 16);
          await this.ui.deferUpdate(si);
          return renderBuilder(si, followUpMsgId);
        }
      });

      /* ── Confirmar: salva embed, apaga followUp, edita a MSG RAIZ de verdade ── */
      const btnConfirm = this.client.interactions.createButton({
        user, data: { label: t('eb_confirm_label'), style: 3 },
        funcao: async (i2) => {
          await this.ui.deferUpdate(i2);
          params.embedObj = cleanEmbed(embed);

          // Apaga o painel builder (followUp) — usa o token desta MESMA interação,
          // que é o token que efetivamente criou/possui este followUp.
          await this.ui.deleteFollowUp(i2, followUpMsgId).catch(() => {});

          // Edita a mensagem RAIZ de verdade via REST puro (channel+id),
          // independente do token atual, e continua o fluxo de configuração.
          return this._continueFlowOnRoot(i2, rootChannelId, rootMessageId, user, flowId, meta, params, isEdit, existingAction, needsSelect, '_afterEmbedDecision');
        }
      });

      /* ── Remover embed: mesma lógica, sem salvar embedObj ── */
      const btnRemove = this.client.interactions.createButton({
        user, data: { label: t('eb_remove_label'), style: 4 },
        funcao: async (i2) => {
          await this.ui.deferUpdate(i2);
          delete params.embedObj;
          await this.ui.deleteFollowUp(i2, followUpMsgId).catch(() => {});
          return this._continueFlowOnRoot(i2, rootChannelId, rootMessageId, user, flowId, meta, params, isEdit, existingAction, needsSelect, '_afterEmbedDecision');
        }
      });

      const btnCancel = this.client.interactions.createButton({
        user, data: { label: t('eb_cancel_label'), style: 2 },
        funcao: async (i2) => {
          await this.ui.deferUpdate(i2);
          await this.ui.deleteFollowUp(i2, followUpMsgId).catch(() => {});
          return this._continueFlowOnRoot(i2, rootChannelId, rootMessageId, user, flowId, meta, params, isEdit, existingAction, needsSelect, '_afterEmbedDecision');
        }
      });

      /* ── Painel: embed REAL (preview ao vivo) + controles em ActionRows ── */
      const builderPayload = {
        content:    t('eb_builder_content', { title: t('eb_default_title') }),
        embeds:     [buildLiveEmbed()],
        components: [
          this.ui.row(editSel),
          this.ui.row(fieldSel),
          this.ui.row(colorSel),
          this.ui.row(btnConfirm, btnRemove, btnCancel),
        ],
        flags: 64, // ephemeral — SEM flag CV2, pois embed real não roda junto com Components V2
      };

      /* Edita o followUp (a partir do token de QUALQUER interação que
         ocorreu dentro dele — modal submit, select, etc — todos
         compartilham o token raiz do followUp original via `i`). */
      return DiscordRequest(
        `/webhooks/${this.client.clientId}/${i.token}/messages/${followUpMsgId}`,
        { method: 'PATCH', body: builderPayload }
      );
    };

    /* ── Envia o followUp pela primeira vez (já com preview real) e captura o messageId ── */
    const initialPayload = {
      content:    t('eb_builder_content', { title: t('eb_default_title') }),
      embeds:     [buildLiveEmbed()],
      components: [],
      flags: 64,
    };

    const followUpResponse = await this.ui.followUp(interaction, initialPayload);
    const followUpMsgId = followUpResponse?.id;

    /* Renderiza de fato (com os componentes) com o followUpMsgId em mãos */
    return renderBuilder(interaction, followUpMsgId);
  }

  /**
   * Prossegue o wizard a partir do passo indicado, mas marcando a
   * interação com um "override de destino": qualquer chamada a
   * `this.ui.editOriginal(interaction, data)` daqui pra frente nesta
   * cadeia vai, na verdade, editar a mensagem RAIZ (channelId+messageId
   * reais, capturados antes do followUp) via REST puro — em vez de
   * tentar `@original` do token atual, que pertenceria ao followUp.
   */
  async _continueFlowOnRoot(interaction, rootChannelId, rootMessageId, user, flowId, meta, params, isEdit, existingAction, needsSelect, nextStep) {
    interaction.__rootOverride = { channelId: rootChannelId, messageId: rootMessageId };

    if (nextStep === '_afterEmbedDecision') {
      return this._afterEmbedDecision(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect);
    }
  }

  async _afterEmbedDecision(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    if (meta.params.includes('interactionObj') && params._skipInteractionAsk !== true) {
      return this._askInteractionOrFinish(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect);
    }
    return this._continueAfterMessageExtras(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect);
  }

  async _continueAfterMessageExtras(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    if (needsSelect && !isEdit) return this._resolveSelectParams(interaction, user, flowId, meta, params, 'action');
    if (needsSelect && isEdit)  { params._actionId = existingAction.id; return this._resolveSelectParams(interaction, user, flowId, meta, params, 'action_edit'); }
    if (isEdit) return this._applyActionEdit(interaction, user, flowId, existingAction.id, params);
    return this._saveAction(interaction, user, flowId, meta.category, meta.type, params);
  }


  /* ══════════════════════════════════════════════
     INTERAÇÃO (Botão / Select vinculado a fluxo)
     ══════════════════════════════════════════════ */

  async _askInteractionOrFinish(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const existing    = params.interactionObj ?? existingAction?.params?.interactionObj ?? null;
    const hasExisting = !!existing;
    const ctx = this._tctx(interaction);

    const btnSim = this.client.interactions.createButton({ user, data: { label: hasExisting ? this.t('fb_int_btn_edit', ctx) : this.t('fb_int_btn_add', ctx), style: 1 }, funcao: async (i) => { await this.ui.deferUpdate(i); return this._showInteractionTypeSelect(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); } });
    const btnNao = this.client.interactions.createButton({ user, data: { label: hasExisting ? this.t('fb_int_btn_remove', ctx) : this.t('fb_int_btn_skip', ctx), style: hasExisting ? 4 : 2 }, funcao: async (i) => { await this.ui.deferUpdate(i); delete params.interactionObj; return this._continueAfterMessageExtras(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); } });

    const rows = hasExisting
      ? [this.ui.row(btnSim, btnNao, this.client.interactions.createButton({ user, data: { label: this.t('fb_int_btn_keep', ctx), style: 3 }, funcao: async (i) => { await this.ui.deferUpdate(i); params.interactionObj = existing; return this._continueAfterMessageExtras(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); }}))]
      : [this.ui.row(btnSim, btnNao)];

    const previewLine = hasExisting
      ? (existing.kind === 'button' ? this.t('fb_int_preview_button', { ...ctx, label: existing.label }) : this.t('fb_int_preview_select', { ...ctx, count: existing.options?.length || 0 }))
      : this.t('fb_int_none_configured', ctx);

    const blocks = [
      this.ui.cv2Text(this.t('fb_int_ask_header', { ...ctx, preview: previewLine })),
      this.ui.cv2Divider(),
      ...rows,
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showInteractionTypeSelect(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const ctx = this._tctx(interaction);
    const typeSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_int_type_placeholder', ctx), options: [{ label: this.t('fb_int_type_button_label', ctx), value: 'button', description: this.t('fb_int_type_button_desc', ctx) }, { label: this.t('fb_int_type_select_label', ctx), value: 'select', description: this.t('fb_int_type_select_desc', ctx) }] }, funcao: async (i) => { await this.ui.deferUpdate(i); if (i.data.values[0] === 'button') return this._buildInteractionButton(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); return this._buildInteractionSelect(i, user, flowId, meta, params, isEdit, existingAction, needsSelect, []); } });
    const blocks = [this.ui.cv2Text(this.t('fb_int_type_header', ctx)), this.ui.cv2Divider(), this.ui.row(typeSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _buildInteractionButton(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const flows = await FlowModel.find({ guildId: interaction.guild_id, enabled: true, 'trigger.type': 'button_clicked' }).lean();
    const ctx = this._tctx(interaction);
    if (!flows.length) {
      const blocks = [this.ui.cv2Text(this.t('fb_int_no_flows_button_title', ctx)), this.ui.cv2Divider(), this.ui.row(this.ui.btn(user, this.t('fb_btn_go_back', ctx), 2, async (i) => { await this.ui.deferUpdate(i); return this._askInteractionOrFinish(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); }))];
      return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.danger }));
    }
    return this._showFlowPicker(interaction, user, flows, 0, async (si, pickedFlowId) => {
      const cur = params.interactionObj || {};
      const siCtx = this._tctx(si);
      const modal = this.client.interactions.createModal({ user, title: this.t('fb_int_configure_button_modal_title', siCtx), components: [
        this.ui.modalText('label', this.t('fb_int_button_text_label', siCtx), { required: true, maxLength: 80, value: cur.label || '' }),
        this.ui.modalSelect('style', this.t('fb_int_button_color_label', siCtx), [{ label: this.t('fb_int_color_blue', siCtx), value: '1', default: !cur.style || cur.style === 1 }, { label: this.t('fb_int_color_gray', siCtx), value: '2', default: cur.style === 2 }, { label: this.t('fb_int_color_green', siCtx), value: '3', default: cur.style === 3 }, { label: this.t('fb_int_color_red', siCtx), value: '4', default: cur.style === 4 }], { placeholder: this.t('fb_int_color_placeholder', siCtx) }),
        this.ui.modalText('emoji', this.t('fb_int_button_emoji_label', siCtx), { required: false, maxLength: 50, value: cur.emoji || '' }),
        this.ui.modalYesNo('permanent', this.t('fb_int_permanent_label', siCtx), { yesLabel: this.t('fb_int_permanent_yes', siCtx), noLabel: this.t('fb_int_permanent_no', siCtx), defaultValue: cur.permanent === false ? 'false' : 'true', placeholder: this.t('fb_int_permanent_placeholder', siCtx) }),
      ], funcao: async (mi, _, fields) => {
        const style = [1,2,3,4].includes(Number(fields.style)) ? Number(fields.style) : 1;
        params.interactionObj = { kind: 'button', label: fields.label?.trim() || this.t('ar_click_here', this._tctx(mi)), style, emoji: fields.emoji?.trim() || '', permanent: fields.permanent !== 'false', flowId: pickedFlowId };
        await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
        return this._continueAfterMessageExtras(mi, user, flowId, meta, params, isEdit, existingAction, needsSelect);
      }});
      return this.client.interactions.showModal(si, modal);
    });
  }

  async _buildInteractionSelect(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect, options) {
    const flows = await FlowModel.find({ guildId: interaction.guild_id, enabled: true, 'trigger.type': 'select_used' }).lean();
    const renderPanel = async (i, opts) => {
      const ctx = this._tctx(i);
      if (!flows.length && !opts.length) {
        const blocks = [this.ui.cv2Text(this.t('fb_int_no_flows_select_title', ctx)), this.ui.cv2Divider(), this.ui.row(this.ui.btn(user, this.t('fb_btn_go_back', ctx), 2, async (bi) => { await this.ui.deferUpdate(bi); return this._askInteractionOrFinish(bi, user, flowId, meta, params, isEdit, existingAction, needsSelect); }))];
        return this.ui.editOriginal(i, this._cv2(blocks, { accentColor: COLOR.danger }));
      }
      const lines = opts.length ? opts.map((o, idx) => `**${idx + 1}.** ${o.emoji || '▪️'} ${o.label}`).join('\n') : this.t('fb_int_no_options_yet', ctx);
      const btnAdd = this.client.interactions.createButton({ user, data: { label: this.t('fb_int_btn_add_option', ctx), style: 1 }, funcao: async (bi) => {
        if (!flows.length) return;
        return this._showFlowPicker(bi, user, flows, 0, async (si, pickedFlowId) => {
          const siCtx = this._tctx(si);
          const modal = this.client.interactions.createModal({ user, title: this.t('fb_int_new_option_modal_title', siCtx), components: [this.ui.modalText('label', this.t('fb_int_option_text_label', siCtx), { required: true, maxLength: 100 }), this.ui.modalText('description', this.t('fb_int_option_desc_label', siCtx), { required: false, maxLength: 100 }), this.ui.modalText('emoji', this.t('fb_int_option_emoji_label', siCtx), { required: false, maxLength: 50 })], funcao: async (mi, _, fields) => {
            opts.push({ label: fields.label?.trim() || this.t('ar_option_default_label', this._tctx(mi)), description: fields.description?.trim() || '', emoji: fields.emoji?.trim() || '', flowId: pickedFlowId });
            await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
            return renderPanel(mi, opts);
          }});
          return this.client.interactions.showModal(si, modal);
        });
      }});
      const btnRemove = this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_remove_last', ctx), style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); opts.pop(); return renderPanel(bi, opts); }});
      const btnSave   = this.client.interactions.createButton({ user, data: { label: this.t('fb_int_btn_save_select', ctx), style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); params.interactionObj = { kind: 'select', options: opts }; return this._continueAfterMessageExtras(bi, user, flowId, meta, params, isEdit, existingAction, needsSelect); }});
      const blocks = [this.ui.cv2Text(this.t('fb_int_select_config_header', { ...ctx, count: opts.length, lines })), this.ui.cv2Divider(), this.ui.row(btnAdd, btnRemove, btnSave)];
      return this.ui.editOriginal(i, this._cv2(blocks, { accentColor: COLOR.main }));
    };
    return renderPanel(interaction, options);
  }

  /**
   * Picker genérico de fluxo (paginado). NÃO faz deferUpdate aqui —
   * os callers de `onPick` quase sempre abrem um modal em seguida
   * (showModal precisa de uma interação ainda não confirmada; um
   * deferUpdate prévio causa erro 40060 "already acknowledged").
   * Cabe a cada `onPick` decidir se faz deferUpdate ou showModal.
   */
  async _showFlowPicker(interaction, user, flows, page, onPick) {
    const { page: safePage, maxPage } = this.ui._clampPage(page, flows.length);
    const pageItems = this.ui._pageSlice(flows, safePage);
    const ctx = this._tctx(interaction);
    const options   = pageItems.map(f => ({ label: f.name.slice(0, 100), value: f.flowId, description: this.t('fb_flow_picker_id_desc', { ...ctx, id: f.flowId }) }));
    const sel = this.ui.select(user, options, this.t('fb_flow_picker_placeholder', ctx), async (i) => {
      return onPick(i, i.data.values[0]);
    });
    const components = [this.ui.row(sel)];
    if (maxPage > 0) components.push(this.ui._paginationRow(user, safePage, maxPage, (i, p) => this._showFlowPicker(i, user, flows, p, onPick), (i, p) => this._showFlowPicker(i, user, flows, p, onPick), ctx));
    const blocks = [this.ui.cv2Text(this.t('fb_flow_picker_header', { ...ctx, page: safePage + 1, maxPage: maxPage + 1 })), this.ui.cv2Divider(), ...components];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  /* ══════════════════════════════════════════════
     RESOLVER CANAL / CARGO / ARG / PERM VIA SELECT
     ══════════════════════════════════════════════ */

  async _resolveSelectParams(interaction, user, flowId, meta, params, mode) {
    const needsChannel = meta.params.some(p => NEEDS_CHANNEL_SELECT.includes(p)) && params.channelId === undefined;
    const needsRole    = meta.params.some(p => NEEDS_ROLE_SELECT.includes(p))    && params.roleId    === undefined;
    const needsArg     = meta.params.includes('argSelect')  && params.argIndex   === undefined;
    const needsPerm    = meta.params.includes('permSelect') && !params.permission;
    const needsThread  = meta.params.includes('threadTargetTypeSelect') && params.threadTargetType === undefined;

    if (needsChannel) return this._showChannelSelect(interaction, user, flowId, meta, params, mode);
    if (needsRole)    return this._showRoleSelect(interaction, user, flowId, meta, params, mode);
    if (needsArg)     return this._showArgSelect(interaction, user, flowId, meta, params, mode);
    if (needsPerm)    return this._showPermSelect(interaction, user, flowId, meta, params, mode);
    if (needsThread)  return this._showThreadTargetSelect(interaction, user, flowId, meta, params, mode);
    return this._finalizeSave(interaction, user, flowId, meta, params, mode);
  }

  async _showChannelSelect(interaction, user, flowId, meta, params, mode) {
    const ctx = this._tctx(interaction);
    const label = this._metaLabelForMode(meta, ctx);
    const channelSel = this.client.interactions.createChannelSelect({ user, data: { placeholder: this.t('fb_select_channel_placeholder', { ...ctx, label: label.slice(0, 68) }), channel_types: [0, 5] }, funcao: async (i) => { await this.ui.deferUpdate(i); params.channelId = i.data.values[0]; return this._resolveSelectParams(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(this.t('fb_select_channel_header', { ...ctx, label })), this.ui.cv2Divider(), this.ui.row(channelSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showRoleSelect(interaction, user, flowId, meta, params, mode) {
    const ctx = this._tctx(interaction);
    const label = this._metaLabelForMode(meta, ctx);
    const roleSel = this.client.interactions.createRoleSelect({ user, data: { placeholder: this.t('fb_select_role_placeholder', { ...ctx, label: label.slice(0, 70) }) }, funcao: async (i) => { await this.ui.deferUpdate(i); params.roleId = i.data.values[0]; return this._resolveSelectParams(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(this.t('fb_select_role_header', { ...ctx, label })), this.ui.cv2Divider(), this.ui.row(roleSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  /** Label traduzido de uma condição OU ação (usado nos seletores compartilhados). */
  _metaLabelForMode(meta, ctx) {
    return CONDITION_CATALOG.includes(meta) || CONDITION_CATALOG.some(c => c === meta)
      ? this._cndLabel(meta, ctx)
      : this._actLabel(meta, ctx);
  }

  async _showPermSelect(interaction, user, flowId, meta, params, mode) {
    const ctx = this._tctx(interaction);
    const p = (key) => this.t(`permname_${key}`, ctx);
    const PERM_PAGES = [
      [{ label: p('view_channel'), value: 'VIEW_CHANNEL' }, { label: p('send_messages'), value: 'SEND_MESSAGES' }, { label: p('send_messages_in_threads'), value: 'SEND_MESSAGES_IN_THREADS' }, { label: p('create_public_threads'), value: 'CREATE_PUBLIC_THREADS' }, { label: p('create_private_threads'), value: 'CREATE_PRIVATE_THREADS' }, { label: p('embed_links'), value: 'EMBED_LINKS' }, { label: p('attach_files'), value: 'ATTACH_FILES' }, { label: p('read_message_history'), value: 'READ_MESSAGE_HISTORY' }, { label: p('mention_everyone'), value: 'MENTION_EVERYONE' }, { label: p('use_external_emojis'), value: 'USE_EXTERNAL_EMOJIS' }, { label: p('use_external_stickers'), value: 'USE_EXTERNAL_STICKERS' }, { label: p('add_reactions'), value: 'ADD_REACTIONS' }, { label: p('use_application_commands'), value: 'USE_APPLICATION_COMMANDS' }, { label: p('manage_messages'), value: 'MANAGE_MESSAGES' }, { label: p('manage_threads'), value: 'MANAGE_THREADS' }, { label: p('send_tts_messages'), value: 'SEND_TTS_MESSAGES' }],
      [{ label: p('connect'), value: 'CONNECT' }, { label: p('speak'), value: 'SPEAK' }, { label: p('stream'), value: 'STREAM' }, { label: p('use_vad'), value: 'USE_VAD' }, { label: p('mute_members'), value: 'MUTE_MEMBERS' }, { label: p('deafen_members'), value: 'DEAFEN_MEMBERS' }, { label: p('move_members'), value: 'MOVE_MEMBERS' }, { label: p('priority_speaker'), value: 'PRIORITY_SPEAKER' }, { label: p('kick_members'), value: 'KICK_MEMBERS' }, { label: p('ban_members'), value: 'BAN_MEMBERS' }, { label: p('moderate_members'), value: 'MODERATE_MEMBERS' }, { label: p('manage_nicknames'), value: 'MANAGE_NICKNAMES' }, { label: p('manage_roles'), value: 'MANAGE_ROLES' }, { label: p('manage_channels'), value: 'MANAGE_CHANNELS' }, { label: p('manage_emojis_and_stickers'), value: 'MANAGE_EMOJIS_AND_STICKERS' }, { label: p('manage_webhooks'), value: 'MANAGE_WEBHOOKS' }],
      [{ label: p('manage_guild'), value: 'MANAGE_GUILD' }, { label: p('manage_events'), value: 'MANAGE_EVENTS' }, { label: p('view_audit_log'), value: 'VIEW_AUDIT_LOG' }, { label: p('view_guild_insights'), value: 'VIEW_GUILD_INSIGHTS' }, { label: p('change_nickname'), value: 'CHANGE_NICKNAME' }, { label: p('create_instant_invite'), value: 'CREATE_INSTANT_INVITE' }, { label: p('administrator'), value: 'ADMINISTRATOR' }],
    ];
    const PAGE_LABELS = [this.t('fb_perm_page1_label', ctx), this.t('fb_perm_page2_label', ctx), this.t('fb_perm_page3_label', ctx)];
    const renderPage = async (i, page) => {
      const iCtx = this._tctx(i);
      const pageSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_perm_select_placeholder', { ...iCtx, pageLabel: PAGE_LABELS[page] }), options: PERM_PAGES[page] }, funcao: async (si) => { await this.ui.deferUpdate(si); params.permission = si.data.values[0]; return this._finalizeSave(si, user, flowId, meta, params, mode); } });
      const navBtns = [];
      if (page > 0) navBtns.push(this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_prev_small', iCtx), style: 2 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPage(bi, page - 1); } }));
      if (page < PERM_PAGES.length - 1) navBtns.push(this.client.interactions.createButton({ user, data: { label: this.t('fb_btn_next_small', iCtx), style: 2 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPage(bi, page + 1); } }));
      const rows = [this.ui.row(pageSel)];
      if (navBtns.length) rows.push(this.ui.row(...navBtns));
      const blocks = [this.ui.cv2Text(this.t('fb_perm_header', { ...iCtx, page: page + 1, total: PERM_PAGES.length, pageLabel: PAGE_LABELS[page] })), this.ui.cv2Divider(), ...rows];
      return this.ui.editOriginal(i, this._cv2(blocks, { accentColor: COLOR.main }));
    };
    return renderPage(interaction, 0);
  }

  async _showThreadTargetSelect(interaction, user, flowId, meta, params, mode) {
    const ctx = this._tctx(interaction);
    const typeSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_thread_target_placeholder', ctx), options: [{ label: this.t('fb_thread_target_user_option', ctx), value: 'user' }, { label: this.t('fb_thread_target_role_option', ctx), value: 'role' }] }, funcao: async (i) => {
      params.threadTargetType = i.data.values[0];
      if (params.threadTargetType === 'role') { await this.ui.deferUpdate(i); return this._showRoleSelect(i, user, flowId, meta, params, mode); }
      const iCtx = this._tctx(i);
      const modal = this.client.interactions.createModal({ user, title: this.t('fb_thread_user_modal_title', iCtx), components: [{ type: 1, components: [{ type: 4, custom_id: 'targetUserId', label: this.t('fb_thread_user_field_label', iCtx), style: 1, required: true, max_length: 100, placeholder: this.t('fb_thread_user_placeholder', iCtx) }] }], funcao: async (mi, _, fields) => { params.targetUserId = fields.targetUserId?.trim(); await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } }); return this._resolveSelectParams(mi, user, flowId, meta, params, mode); } });
      return this.client.interactions.showModal(i, modal);
    }});
    const blocks = [this.ui.cv2Text(this.t('fb_thread_target_header', ctx)), this.ui.cv2Divider(), this.ui.row(typeSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showArgSelect(interaction, user, flowId, meta, params, mode) {
    const ctx = this._tctx(interaction);
    const label = this._cndLabel(meta, ctx);
    const argIndexSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_arg_select_placeholder', ctx), options: [0,1,2,3,4].map(n => ({ label: this.t('fb_arg_option_label', { ...ctx, n: n + 1 }), value: String(n), description: `{arg${n}}` })) }, funcao: async (i) => { await this.ui.deferUpdate(i); params.argIndex = Number(i.data.values[0]); return this._showArgTypeSel(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(this.t('fb_arg_select_header', { ...ctx, label })), this.ui.cv2Divider(), this.ui.row(argIndexSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showArgTypeSel(interaction, user, flowId, meta, params, mode) {
    const ctx = this._tctx(interaction);
    const argNum = (params.argIndex ?? 0) + 1;
    const argTypeSel = this.client.interactions.createSelect({ user, data: { placeholder: this.t('fb_arg_type_placeholder', { ...ctx, n: argNum }), options: [{ label: this.t('fb_arg_type_user_mention', ctx), value: 'user_mention' }, { label: this.t('fb_arg_type_channel_mention', ctx), value: 'channel_mention' }, { label: this.t('fb_arg_type_number', ctx), value: 'number' }, { label: this.t('fb_arg_type_text', ctx), value: 'text' }] }, funcao: async (i) => { await this.ui.deferUpdate(i); params.argType = i.data.values[0]; return this._finalizeSave(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(this.t('fb_arg_type_header', { ...ctx, n: argNum })), this.ui.cv2Divider(), this.ui.row(argTypeSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _finalizeSave(interaction, user, flowId, meta, params, mode) {
    const actionId = params._actionId;
    const condId   = params._condId;
    delete params._actionId;
    delete params._condId;

    if (mode === 'action')         return this._saveAction(interaction, user, flowId, meta.category, meta.type, params);
    if (mode === 'action_edit')    return this._applyActionEdit(interaction, user, flowId, actionId, params);
    if (mode === 'condition') {
      const operator = params._operator || 'AND'; const negate = params._negate || false;
      delete params._operator; delete params._negate;
      return this._saveCondition(interaction, user, flowId, meta.category, meta.type, { ...params, _operator: operator, _negate: negate });
    }
    if (mode === 'condition_edit') {
      const operator = params._operator || 'AND'; const negate = params._negate || false;
      delete params._operator; delete params._negate;
      return this._applyConditionEdit(interaction, user, flowId, condId, params, operator, negate);
    }
  }


  /* ─── validação de IDs ─── */

  async _validateIds(guildId, params, ctx = {}) {
    const warnings = [];

    if (params.channelId) {
      const rawId = params.channelId.replace(/[<#>]/g, '').trim();
      try {
        const ch = await DiscordRequest(`/channels/${rawId}`);
        if (!ch || ch.guild_id !== guildId) warnings.push(this.t('fb_warn_channel_wrong_guild', { ...ctx, id: rawId }));
      } catch { warnings.push(this.t('fb_warn_channel_not_found', { ...ctx, id: rawId })); }
    }

    if (params.roleId) {
      const rawId = params.roleId.replace(/[<@&>]/g, '').trim();
      try {
        const roles  = await DiscordRequest(`/guilds/${guildId}/roles`);
        const exists = roles?.some(r => r.id === rawId);
        if (!exists) warnings.push(this.t('fb_warn_role_not_found', { ...ctx, id: rawId }));
      } catch { warnings.push(this.t('fb_warn_role_check_failed', { ...ctx, id: rawId })); }
    }

    if (params.flowId) {
      try {
        const f = await this._getFlow(guildId, params.flowId);
        if (!f) warnings.push(this.t('fb_warn_flow_not_found', { ...ctx, id: params.flowId }));
      } catch { warnings.push(this.t('fb_warn_flow_check_failed', { ...ctx, id: params.flowId })); }
    }

    return warnings;
  }

  /* ══════════════════════════════════════════════
     MENU: VARIÁVEIS  ─ CV2
     ══════════════════════════════════════════════ */

  async variablesMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const vars = flow?.variables || [];
    const ctx  = this._tctx(interaction);

    const lines = vars.length
      ? vars.map(v =>
          `• **${v.name}** (\`${v.type}\`) = \`${v.defaultValue ?? 'null'}\`` +
          `${v.persistent ? ' 💾' : ''}` +
          ` — ${v.scope === 'user' ? `👤 ${this.t('fb_var_scope_user_line', ctx)}` : `🌐 ${this.t('fb_var_scope_flow_line', ctx)}`}`
        ).join('\n')
      : this.t('fb_var_no_vars', ctx);

    const btnAdd = this.ui.btn(user, this.t('fb_var_btn_create', ctx), 1, async (i) => {
      await this.ui.deferUpdate(i);
      return this._varStep1_Scope(i, user, flowId);
    });

    const btnRemove = this.ui.btn(user, this.t('fb_btn_remove_last', ctx), 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!vars.length) return;
      const updated = vars.slice(0, -1);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { variables: updated });
      return this.variablesMenu(i, user, flowId);
    });

    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_var_header', { ...ctx, count: vars.length, successMsg, lines })),
      this.ui.cv2Divider(),
      this.ui.row(btnAdd, btnRemove, btnBack, this._guideButton(ctx)),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varStep1_Scope(interaction, user, flowId) {
    const ctx = this._tctx(interaction);
    const sel = this.ui.select(
      user,
      [
        { label: this.t('fb_var_scope_flow_option', ctx), value: 'flow', description: this.t('fb_var_scope_flow_desc', ctx) },
        { label: this.t('fb_var_scope_user_option', ctx), value: 'user', description: this.t('fb_var_scope_user_desc', ctx) }
      ],
      this.t('fb_var_scope_placeholder', ctx),
      async (i) => {
        await this.ui.deferUpdate(i);
        return this._varStep2_Type(i, user, flowId, i.data.values[0]);
      }
    );

    const blocks = [
      this.ui.cv2Text(this.t('fb_var_step1_header', ctx)),
      this.ui.cv2Divider(),
      this.ui.row(sel),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varStep2_Type(interaction, user, flowId, scope) {
    const ctx = this._tctx(interaction);
    const sel = this.ui.select(
      user,
      [
        { label: this.t('fb_var_type_string', ctx),  value: 'string',  description: this.t('fb_var_type_string_desc', ctx) },
        { label: this.t('fb_var_type_number', ctx), value: 'number',  description: this.t('fb_var_type_number_desc', ctx) },
        { label: this.t('fb_var_type_boolean', ctx), value: 'boolean', description: this.t('fb_var_type_boolean_desc', ctx) },
        { label: this.t('fb_var_type_list', ctx),    value: 'list',    description: this.t('fb_var_type_list_desc', ctx) }
      ],
      this.t('fb_var_type_placeholder', ctx),
      async (i) => {
        // NÃO dar deferUpdate — _varStep3_Name abre modal
        return this._varStep3_Name(i, user, flowId, scope, i.data.values[0]);
      }
    );

    const blocks = [
      this.ui.cv2Text(this.t('fb_var_step2_header', ctx)),
      this.ui.cv2Divider(),
      this.ui.row(sel),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varStep3_Name(interaction, user, flowId, scope, type) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_var_step3_modal_title', ctx),
      components: [
        this.ui.modalText('name', this.t('fb_var_name_label', ctx), { required: true, maxLength: 50, placeholder: this.t('fb_var_name_placeholder', ctx) }),
        this.ui.modalYesNo('persistent', this.t('fb_var_persistent_label', ctx), {
          yesLabel: this.t('fb_var_persistent_yes', ctx),
          noLabel:  this.t('fb_var_persistent_no', ctx),
          defaultValue: 'false'
        }),
      ],
      funcao: async (modalInteraction, client, fields) => {
        const miCtx = this._tctx(modalInteraction);
        const name = fields.name?.trim().replace(/\s+/g, '_');
        if (!name) {
          return DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, {
            method: 'POST', body: { type: 4, data: { content: this.t('fb_var_invalid_name', miCtx), flags: 64 } }
          });
        }

        const flow = await this._getFlow(modalInteraction.guild_id, flowId);
        if ((flow.variables || []).find(v => v.name === name)) {
          return DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, {
            method: 'POST', body: { type: 4, data: { content: this.t('fb_var_already_exists', { ...miCtx, name }), flags: 64 } }
          });
        }

        const persistent = fields.persistent === 'true';
        await DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, { method: 'POST', body: { type: 6 } });
        return this._varStep4_Default(modalInteraction, user, flowId, { name, scope, type, persistent });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _varStep4_Default(interaction, user, flowId, varData) {
    const ctx = this._tctx(interaction);
    const defaultsByType = { string: this.t('fb_var_default_string_desc', ctx), number: this.t('fb_var_default_number_desc', ctx), boolean: this.t('fb_var_default_boolean_desc', ctx), list: this.t('fb_var_default_list_desc', ctx) };
    const scopeLabel = varData.scope === 'user' ? `👤 ${this.t('fb_var_scope_user_line', ctx)}` : `🌐 ${this.t('fb_var_scope_flow_line', ctx)}`;

    if (varData.type === 'boolean') {
      const sel = this.ui.select(user, [
        { label: this.t('fb_var_bool_true', ctx), value: 'true' },
        { label: this.t('fb_var_bool_false', ctx), value: 'false' },
      ], this.t('fb_var_initial_value_placeholder', ctx), async (i) => {
        await this.ui.deferUpdate(i);
        return this._saveVariable(i, user, flowId, { ...varData, defaultValue: i.data.values[0] === 'true' });
      });
      const blocks = [
        this.ui.cv2Text(this.t('fb_var_step4_bool_header', { ...ctx, name: varData.name, scope: scopeLabel })),
        this.ui.cv2Divider(),
        this.ui.row(sel),
      ];
      return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
    }

    if (varData.type === 'list') {
      const sel = this.ui.select(user, [
        { label: this.t('fb_var_list_empty_option', ctx), value: 'empty', description: this.t('fb_var_list_empty_desc', ctx) },
        { label: this.t('fb_var_list_custom_option', ctx), value: 'custom', description: this.t('fb_var_list_custom_desc', ctx) },
      ], this.t('fb_var_list_start_placeholder', ctx), async (i) => {
        const choice = i.data.values[0];
        if (choice === 'empty') {
          await this.ui.deferUpdate(i);
          return this._saveVariable(i, user, flowId, { ...varData, defaultValue: [] });
        }
        return this._varListDefaultModal(i, user, flowId, varData);
      });
      const blocks = [
        this.ui.cv2Text(this.t('fb_var_step4_list_header', { ...ctx, name: varData.name, scope: scopeLabel })),
        this.ui.cv2Divider(),
        this.ui.row(sel),
      ];
      return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
    }

    // string / number — usa modal
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_var_default_value_modal_title', { ...ctx, name: varData.name }),
      components: [{ type: 1, components: [{
        type: 4, custom_id: 'defaultValue', label: this.t('fb_var_default_value_label', ctx),
        style: 1, required: false, max_length: 200,
        placeholder: varData.type === 'number' ? this.t('fb_var_default_number_placeholder', ctx) : this.t('fb_var_default_text_placeholder', ctx)
      }]}],
      funcao: async (modalInteraction, client, fields) => {
        let defaultValue = fields.defaultValue?.trim() || null;
        if (varData.type === 'number') defaultValue = defaultValue !== null ? (Number(defaultValue) || 0) : 0;
        else if (defaultValue === null) defaultValue = '';

        await DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, { method: 'POST', body: { type: 6 } });
        return this._saveVariable(modalInteraction, user, flowId, { ...varData, defaultValue });
      }
    });

    const defaultLabel = varData.type === 'number' ? '0' : this.t('fb_var_default_empty_label', ctx);

    const blocks = [
      this.ui.cv2Text(this.t('fb_var_step4_summary_header', {
        ...ctx,
        name: varData.name,
        scope: scopeLabel,
        type: varData.type,
        persistent: varData.persistent ? this.t('fb_var_yes', ctx) : this.t('fb_var_no', ctx),
        defaultDesc: defaultsByType[varData.type],
      })),
      this.ui.cv2Divider(),
      this.ui.row(
        this.ui.btn(user, this.t('fb_var_btn_custom_value', ctx), 1, async (i) => this.client.interactions.showModal(i, modal)),
        this.ui.btn(user, this.t('fb_var_btn_use_default', { ...ctx, defaultLabel }), 2, async (i) => {
          await this.ui.deferUpdate(i);
          const defaultValue = varData.type === 'number' ? 0 : '';
          return this._saveVariable(i, user, flowId, { ...varData, defaultValue });
        })
      ),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varListDefaultModal(interaction, user, flowId, varData) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_var_list_items_modal_title', { ...ctx, name: varData.name }),
      components: [{ type: 1, components: [{
        type: 4, custom_id: 'items', label: this.t('fb_var_list_items_label', ctx),
        style: 2, required: true, max_length: 1000,
        placeholder: this.t('fb_var_list_items_placeholder', ctx)
      }]}],
      funcao: async (modalInteraction, client, fields) => {
        const raw  = fields.items || '';
        const list = raw.split(',').map(s => s.trim()).filter(Boolean);
        await DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, { method: 'POST', body: { type: 6 } });
        return this._saveVariable(modalInteraction, user, flowId, { ...varData, defaultValue: list });
      }
    });
    return this.client.interactions.showModal(interaction, modal);
  }

  async _saveVariable(interaction, user, flowId, varData) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const vars = flow.variables || [];
    const ctx  = this._tctx(interaction);

    if (vars.find(v => v.name === varData.name)) {
      return this.variablesMenu(interaction, user, flowId, {
        successMsg: this.t('fb_var_already_exists', { ...ctx, name: varData.name })
      });
    }

    const { name, scope, type, persistent, defaultValue } = varData;
    vars.push({ name, type, defaultValue, persistent, scope });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { variables: vars });

    const defLabel = Array.isArray(defaultValue) ? `[${defaultValue.join(', ') || this.t('fb_var_default_empty_paren', ctx)}]` : String(defaultValue ?? 'null');
    const scopeLabel = scope === 'user' ? `👤 ${this.t('fb_var_scope_user_line', ctx)}` : `🌐 ${this.t('fb_var_scope_flow_line', ctx)}`;

    return this.variablesMenu(interaction, user, flowId, {
      successMsg: this.t('fb_var_created_success', { ...ctx, name, scope: scopeLabel, type, defLabel })
    });
  }


  /* ══════════════════════════════════════════════
     MENU: CONFIGURAÇÕES  ─ CV2
     ══════════════════════════════════════════════ */

  async settingsMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const ctx  = this._tctx(interaction);

    const btnCooldown = this.ui.btn(user, this.t('fb_settings_btn_cooldown', ctx), 2, i => this._setCooldown(i, user, flowId));
    const btnMode = this.ui.btn(
      user,
      flow.executionMode === 'parallel' ? this.t('fb_settings_mode_parallel', ctx) : this.t('fb_settings_mode_sequential', ctx),
      2,
      async (i) => {
        await this.ui.deferUpdate(i);
        const newMode = flow.executionMode === 'parallel' ? 'sequential' : 'parallel';
        await this.client.logicEngine.updateFlow(flowId, i.guild_id, { executionMode: newMode });
        return this.settingsMenu(i, user, flowId);
      }
    );
    const btnRename = this.ui.btn(user, this.t('fb_settings_btn_rename', ctx), 2, i => this._rename(i, user, flowId));
    const btnLogs = this.ui.btn(user, this.t('fb_settings_btn_logs', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this._showLogs(i, user, flowId);
    });
    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const executionModeLabel = flow.executionMode === 'parallel' ? this.t('fb_settings_mode_parallel_desc', ctx) : this.t('fb_settings_mode_sequential_desc', ctx);
    const cooldownLabel = flow.cooldown > 0 ? this.t('fb_settings_cooldown_per_user', { ...ctx, duration: formatDuration(flow.cooldown, ctx.system?.locale) }) : this.t('fb_settings_no_cooldown', ctx);

    const blocks = [
      this.ui.cv2Text(this.t('fb_settings_header', {
        ...ctx,
        sria: this._e('sria'),
        successMsg,
        name: flow.name,
        description: flow.description || this.t('no_description_italic', ctx),
        executionModeLabel,
        cooldown: cooldownLabel,
        createdBy: flow.createdBy ? `<@${flow.createdBy}>` : this.t('fb_settings_na', ctx),
      })),
      this.ui.cv2Divider(),
      this.ui.row(btnCooldown, btnMode, btnRename),
      this.ui.row(btnLogs, btnBack, this._guideButton(ctx)),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.dark }));
  }

  async _setCooldown(interaction, user, flowId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const ctx  = this._tctx(interaction);
    const current = flow?.cooldown > 0 ? formatDuration(flow.cooldown, ctx.system?.locale) : '';

    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_cooldown_modal_title', ctx),
      components: [
        this.ui.modalText('duration', this.t('fb_cooldown_field_label', ctx), {
          required: true, maxLength: 30,
          placeholder: this.t('fb_cooldown_placeholder', ctx),
          value: current
        })
      ],
      funcao: async (modalInteraction, client, fields) => {
        const miCtx = this._tctx(modalInteraction);
        const raw = fields.duration?.trim() || '0';
        const ms  = raw === '0' ? 0 : parseDuration(raw);

        if (raw !== '0' && ms === 0) {
          return DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, {
            method: 'POST', body: { type: 4, data: {
              content: this.t('fb_cooldown_invalid', miCtx),
              flags: 64
            }}
          });
        }

        await this.client.logicEngine.updateFlow(flowId, modalInteraction.guild_id, { cooldown: ms });
        await DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, { method: 'POST', body: { type: 6 } });

        return this.settingsMenu(modalInteraction, user, flowId, {
          successMsg: ms > 0
            ? this.t('fb_cooldown_set_success', { ...miCtx, duration: formatDuration(ms, miCtx.system?.locale) })
            : this.t('fb_cooldown_removed_success', miCtx)
        });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _rename(interaction, user, flowId) {
    const ctx = this._tctx(interaction);
    const modal = this.client.interactions.createModal({
      user,
      title: this.t('fb_rename_modal_title', ctx),
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'name',        label: this.t('fb_rename_name_label', ctx),      style: 1, required: true,  max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: this.t('fb_rename_desc_label', ctx), style: 2, required: false, max_length: 300 }] }
      ],
      funcao: async (modalInteraction, client, fields) => {
        const updates = {};
        if (fields.name?.trim())              updates.name        = fields.name.trim();
        if (fields.description !== undefined) updates.description = fields.description.trim();

        await this.client.logicEngine.updateFlow(flowId, modalInteraction.guild_id, updates);
        await DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, { method: 'POST', body: { type: 6 } });

        return this.settingsMenu(modalInteraction, user, flowId);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _showLogs(interaction, user, flowId) {
    const { FlowRunLogModel } = require('../../logic-builder/schema/flow.schema.js');
    const logs = await FlowRunLogModel.find({ flowId }).sort({ runAt: -1 }).limit(10).lean();
    const ctx  = this._tctx(interaction);

    const lines = logs.length
      ? logs.map(l => {
          const icon = l.result === 'success' ? '✅' : l.result === 'failed' ? '❌' : '⚠️';
          const ts   = new Date(l.runAt).toLocaleString(ctx.system?.locale || 'pt-BR');
          return `${icon} \`${ts}\` — ${l.duration}ms${l.error ? `\n  > ${l.error.slice(0, 80)}` : ''}`;
        }).join('\n')
      : this.t('fb_logs_no_runs', ctx);

    const btnBack = this.ui.btn(user, this.t('btn_back', ctx), 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.settingsMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(this.t('fb_logs_header', { ...ctx, lines })),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  /* ══════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════ */

  async _getFlow(guildId, flowId) {
    return FlowModel.findOne({ flowId, guildId }).lean();
  }

  _uid() {
    return randomUUID().replace(/-/g, '').slice(0, 24);
  }

  _paramLabel(p, ctx = {}) {
    return this.t(`param_${p}_label`, ctx) || p;
  }

  _paramPlaceholder(p, ctx = {}) {
    return this.t(`param_${p}_placeholder`, ctx) || '';
  }
}

module.exports = FlowBuilder;
