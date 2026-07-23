'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const { FlowModel }  = require('../../../Mongodb/flow.js');
const { randomUUID } = require('crypto');
const getPerm        = require('../../Utils/GetPerm.js');
const holeHighter    = require('../../Utils/RoleHigher.js');
const { parseDuration, formatDuration } = require('./LogicEngine.js');

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

const GUIDE_URL = 'https://ayami-hoshiori.vercel.app/logic-builder';


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
  { category: 'system',   type: 'stop_execution',           label: '⏹️ Parar execução',                     params: [] },
  { category: 'webhook',  type: 'send_webhook',             label: '🔗 Enviar webhook',                     params: ['url', 'content'] },
  { category: 'webhook',  type: 'http_request',             label: '🌐 Requisição HTTP',                    params: ['url', 'method'] }
];

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
  webhook: { label: '🔗 Webhook / HTTP',  description: 'Enviar dados externos' },
};

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

const BOOLEAN_PARAMS = {
  ephemeral:        { label: 'Mensagem visível só para o usuário?',     yes: '👁️ Sim — só ele(a) vê (ephemeral)',   no: '📢 Não — todo mundo vê',                default: 'false' },
  removeComponents: { label: 'Remover os botões/selects da mensagem?', yes: '🗑️ Sim — remove tudo (padrão)',       no: '✅ Não — mantém os componentes atuais', default: 'true'  },
};



class FlowBuilder {

  constructor(client, ui) {
    this.client = client;
    this.ui     = ui;
  }

  _e(name) {
    return this.client?.emoji?.[name] ?? AYAMI_FALLBACK[name] ?? '';
  }

  _guideButton() {
    return { type: 2, style: 5, label: '📖 Guia', url: GUIDE_URL };
  }

  _cv2(blocks, opts = {}) {
    return this.ui.cv2Payload(blocks, { ephemeral: false, ...opts });
  }


  async startCreate(interaction, user) {
    const modal = this.client.interactions.createModal({
      user,
      title: 'Criar novo Fluxo ✨',
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'name',        label: 'Nome do fluxo',        style: 1, required: true,  max_length: 100, placeholder: 'Ex: Boas-vindas, Anti-link, Daily...' }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: 'Descrição (opcional)', style: 2, required: false, max_length: 300, placeholder: 'Descreva o que este fluxo vai fazer...' }] }
      ],
      funcao: async (mi, client, fields) => {
        const name = fields.name?.trim();
        if (!name) {
          return DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, {
            method: 'POST', body: { type: 4, data: { content: `❌ Nome inválido! ${this._e('assustada')}`, flags: 64 } }
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


  async triggerMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    if (!flow) return this.ui.followUpEphemeral(interaction, this.ui.cv2Payload([
      this.ui.cv2Text(`❌ Fluxo não encontrado. ${this._e('assustada')}`)
    ]));

    const current = this.ui._triggerLabel(flow.trigger);

    const categorySel = this.ui.select(
      user,
      [...TRIGGER_GROUPS.keys()].map(cat => ({
        label:       TRIGGER_CATEGORY_META[cat]?.label?.slice(0, 100) || cat,
        value:       cat,
        description: TRIGGER_CATEGORY_META[cat]?.description?.slice(0, 100),
      })),
      '🎯 1️⃣ Escolha a categoria do Trigger',
      async (si) => {
        await this.ui.deferUpdate(si);
        return this._triggerCategoryMenu(si, user, flowId, si.data.values[0]);
      }
    );

    const btnFilters = this.ui.btn(user, '🔧 Filtros do Trigger', 2, async (i) => {
      return this._triggerFilters(i, user, flowId);
    });

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# 🎯 Configurar Trigger ${this._e('pensando')}\n` +
        (successMsg ? `${successMsg}\n\n` : '') +
        `**O que é um Trigger?** É o "gatilho" que faz seu fluxo começar!\n` +
        `Por exemplo: quando alguém entra no servidor, quando uma mensagem é enviada...\n\n` +
        `> 🎯 **Trigger atual:** ${current}`
      ),
      this.ui.cv2Divider(),
      this.ui.cv2Text(`**Escolha a categoria abaixo** — depois você escolhe o evento específico dela:`),
      this.ui.row(categorySel),
      this.ui.cv2Divider(),
      this.ui.row(btnFilters, btnBack, this._guideButton()),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _triggerCategoryMenu(interaction, user, flowId, category) {
    const items = TRIGGER_GROUPS.get(category) || [];
    const meta  = TRIGGER_CATEGORY_META[category];

    const itemSel = this.ui.select(
      user,
      items.map(a => ({ label: a.label.slice(0, 100), value: `${a.category}:${a.type}`, description: a.description?.slice(0, 100) })),
      `🎯 2️⃣ Escolha o evento — ${meta?.label || category}`,
      async (si) => {
        await this.ui.deferUpdate(si);
        const [cat, typ] = si.data.values[0].split(':');
        return this._setTrigger(si, user, flowId, cat, typ);
      }
    );

    const btnBack = this.ui.btn(user, '⬅️ Outra categoria', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.triggerMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(`# ${meta?.label || category} ${this._e('pensando')}\n${meta?.description || ''}\n\nEscolha o evento específico:`),
      this.ui.cv2Divider(),
      this.ui.row(itemSel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _setTrigger(interaction, user, flowId, category, type) {
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, {
      trigger: { category, type, filters: {} }
    });
    return this.triggerMenu(interaction, user, flowId, {
      successMsg: `${this._e('curtida')} Trigger definido: **${this.ui._triggerLabel({ category, type })}**`
    });
  }

  async _triggerFilters(interaction, user, flowId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    if (!flow?.trigger) {
      return this.ui.followUpEphemeral(interaction, { content: `${this._e('assustada')} Configure o trigger primeiro!` });
    }
    const { category, type, filters = {} } = flow.trigger;

    const saveFilters = async (i, f) => {
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, {
        trigger: { category, type, filters: f }
      });
      return this.triggerMenu(i, user, flowId, {
        successMsg: `${this._e('curtida')} Filtros salvos!`
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
      successMsg: `${this._e('emduvida')} Este trigger não tem filtros configuráveis.`
    });
  }

  async _filterPanelMessage(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [
        `> 📌 **Canal:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal_'}`,
        `> 🏷️ **Cargo:** ${f.roleId    ? `<@&${f.roleId}>`   : '_qualquer membro_'}`,
        `> 👤 **Só humanos:** ${f.ignoreBots === 'true' ? 'Sim ✅' : 'Não ❌'}`,
        `> 🔍 **Prefixo:** ${f.prefix ? `\`${f.prefix}\`` : '_sem prefixo_'}`,
      ].join('\n');

      const chSel = this.client.interactions.createChannelSelect({
        user, data: { placeholder: '📌 Limitar a um canal (opcional)', channel_types: [0, 5] },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); }
      });
      const roleSel = this.client.interactions.createRoleSelect({
        user, data: { placeholder: '🏷️ Limitar a membros com cargo (opcional)' },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.roleId = si.data.values[0]; return renderPanel(si, f); }
      });
      const botsSel = this.client.interactions.createSelect({
        user, data: { placeholder: `👤 Ignorar bots? Atual: ${f.ignoreBots === 'true' ? 'Sim' : 'Não'}`, options: [
          { label: 'Sim — só humanos', value: 'true', emoji: { name: '✅' } },
          { label: 'Não — incluir bots', value: 'false', emoji: { name: '❌' } },
        ]},
        funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); }
      });
      const btnPrefix = this.client.interactions.createButton({
        user, data: { label: f.prefix ? `🔍 Prefixo: ${f.prefix}` : '🔍 Definir prefixo (opcional)', style: 2 },
        funcao: async (bi) => {
          const modal = this.client.interactions.createModal({
            user, title: 'Prefixo da Mensagem',
            components: [{ type: 1, components: [{ type: 4, custom_id: 'prefix', label: 'Disparar só se a mensagem começar com', style: 1, required: false, max_length: 10, placeholder: 'Ex: ! ou / ou $', value: f.prefix || '' }]}],
            funcao: async (mi, _, fields) => {
              f.prefix = fields.prefix?.trim() || undefined;
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderPanel(mi, f);
            }
          });
          return this.client.interactions.showModal(bi, modal);
        }
      });
      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });

      return this.ui.editOriginal(i, {
        embeds: [{ title: `🔧 Filtros — Mensagem ${this._e('pensando')}`, description: `Configure quando o trigger deve disparar:\n\n${lines}\n\n${this._e('emduvida')} Filtros vazios = dispara em qualquer mensagem!`, color: COLOR.main }],
        components: [this.ui.row(chSel), this.ui.row(roleSel), this.ui.row(botsSel), this.ui.row(btnPrefix, btnClear, btnSave)]
      });
    };
    return renderPanel(interaction, filters);
  }

  async _filterPanelReaction(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [
        `> 📌 **Canal:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal_'}`,
        `> 😀 **Emoji:** ${f.emoji || '_qualquer emoji_'}`,
      ].join('\n');
      const chSel = this.client.interactions.createChannelSelect({ user, data: { placeholder: '📌 Limitar a um canal (opcional)', channel_types: [0, 5] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); } });
      const btnEmoji = this.client.interactions.createButton({ user, data: { label: f.emoji ? `😀 Emoji: ${f.emoji}` : '😀 Filtrar por emoji (opcional)', style: 2 }, funcao: async (bi) => {
        const modal = this.client.interactions.createModal({ user, title: 'Filtro de Emoji', components: [{ type: 1, components: [{ type: 4, custom_id: 'emoji', label: 'Só disparar para esse emoji', style: 1, required: false, max_length: 50, placeholder: 'Ex: ⭐ ou 🔥', value: f.emoji || '' }]}], funcao: async (mi, _, fields) => { f.emoji = fields.emoji?.trim() || undefined; await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } }); return renderPanel(mi, f); } });
        return this.client.interactions.showModal(bi, modal);
      }});
      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: `🔧 Filtros — Reação ${this._e('pensando')}`, description: `Configure quando o trigger deve disparar:\n\n${lines}`, color: COLOR.main }], components: [this.ui.row(chSel), this.ui.row(btnEmoji, btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  async _filterPanelMember(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [
        `> 🏷️ **Cargo:** ${f.roleId ? `<@&${f.roleId}>` : '_qualquer membro_'}`,
        `> 👤 **Só humanos:** ${f.ignoreBots === 'true' ? 'Sim ✅' : 'Não ❌'}`,
      ].join('\n');
      const roleSel = this.client.interactions.createRoleSelect({ user, data: { placeholder: '🏷️ Limitar a membros com esse cargo (opcional)' }, funcao: async (si) => { await this.ui.deferUpdate(si); f.roleId = si.data.values[0]; return renderPanel(si, f); } });
      const botsSel = this.client.interactions.createSelect({ user, data: { placeholder: `👤 Ignorar bots? Atual: ${f.ignoreBots === 'true' ? 'Sim' : 'Não'}`, options: [{ label: 'Sim — só pessoas reais', value: 'true', emoji: { name: '✅' } }, { label: 'Não — incluir bots', value: 'false', emoji: { name: '❌' } }]}, funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); } });
      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: `🔧 Filtros — Membro ${this._e('pensando')}`, description: `Configure quando o trigger deve disparar:\n\n${lines}`, color: COLOR.main }], components: [this.ui.row(roleSel), this.ui.row(botsSel), this.ui.row(btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  async _filterPanelVoice(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [`> 🔊 **Canal de voz:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal de voz_'}`, `> 👤 **Só humanos:** ${f.ignoreBots === 'true' ? 'Sim ✅' : 'Não ❌'}`].join('\n');
      const chSel   = this.client.interactions.createChannelSelect({ user, data: { placeholder: '🔊 Limitar a um canal de voz (opcional)', channel_types: [2] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); } });
      const botsSel = this.client.interactions.createSelect({ user, data: { placeholder: `👤 Ignorar bots? Atual: ${f.ignoreBots === 'true' ? 'Sim' : 'Não'}`, options: [{ label: 'Sim — só pessoas reais', value: 'true', emoji: { name: '✅' } }, { label: 'Não — incluir bots', value: 'false', emoji: { name: '❌' } }]}, funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); } });
      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: `🔧 Filtros — Voz ${this._e('pensando')}`, description: `Configure quando o trigger deve disparar:\n\n${lines}`, color: COLOR.main }], components: [this.ui.row(chSel), this.ui.row(botsSel), this.ui.row(btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  async _filterPanelComponent(interaction, user, flowId, type, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const typeLabel = type === 'button_clicked' ? 'Botão' : type === 'select_used' ? 'Select Menu' : 'Modal';
      const lines = [`> 🆔 **ID do ${typeLabel}:** ${f.customId ? `\`${f.customId}\`` : '_qualquer_'}`, `> 📌 **Canal:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal_'}`].join('\n');
      const chSel = this.client.interactions.createChannelSelect({ user, data: { placeholder: '📌 Limitar a um canal (opcional)', channel_types: [0, 5] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); } });
      const btnId = this.client.interactions.createButton({ user, data: { label: f.customId ? `🆔 ID: "${f.customId.slice(0, 20)}"` : `🆔 Definir Custom ID (opcional)`, style: 1 }, funcao: async (bi) => {
        const modal = this.client.interactions.createModal({ user, title: `Custom ID — ${typeLabel}`, components: [{ type: 1, components: [{ type: 4, custom_id: 'customId', label: `ID único do ${typeLabel} (vazio = qualquer)`, style: 1, required: false, max_length: 100, placeholder: 'Ex: btn_aceitar, modal_form', value: f.customId || '' }]}], funcao: async (mi, _, fields) => { f.customId = fields.customId?.trim() || undefined; await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } }); return renderPanel(mi, f); } });
        return this.client.interactions.showModal(bi, modal);
      }});
      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });
      return this.ui.editOriginal(i, { embeds: [{ title: `🔧 Filtros — ${typeLabel} ${this._e('pensando')}`, description: `O **Custom ID** é o identificador que você deu ao ${typeLabel}.\nDeixe vazio para disparar em qualquer ${typeLabel}.\n\n${lines}`, color: COLOR.main }], components: [this.ui.row(chSel), this.ui.row(btnId, btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }

  async _filterPanelTime(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const lines = [
        `> 🕐 **Hora:** ${f.hour !== undefined ? `${String(f.hour).padStart(2, '0')}h` : '_não definida (obrigatório!)_'}`,
        `> ⏱️ **Minuto:** :${String(f.minute ?? 0).padStart(2, '0')}`,
        `> 📅 **Dias:** ${f.weekdays?.length ? f.weekdays.map(d => dayNames[d]).join(', ') : '_todos os dias_'}`,
      ].join('\n');
      const hourOpts1 = Array.from({ length: 12 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: String(h), description: h < 6 ? 'Madrugada' : 'Manhã' }));
      const hourOpts2 = Array.from({ length: 12 }, (_, h) => ({ label: `${String(h + 12).padStart(2, '0')}:00`, value: String(h + 12), description: h + 12 < 18 ? 'Tarde' : 'Noite' }));
      const hourSel1  = this.client.interactions.createSelect({ user, data: { placeholder: `🌅 Hora 00h–11h — Atual: ${f.hour !== undefined && f.hour < 12 ? f.hour + 'h' : 'não selecionada'}`, options: hourOpts1 }, funcao: async (si) => { await this.ui.deferUpdate(si); f.hour = Number(si.data.values[0]); return renderPanel(si, f); } });
      const hourSel2  = this.client.interactions.createSelect({ user, data: { placeholder: `🌆 Hora 12h–23h — Atual: ${f.hour !== undefined && f.hour >= 12 ? f.hour + 'h' : 'não selecionada'}`, options: hourOpts2 }, funcao: async (si) => { await this.ui.deferUpdate(si); f.hour = Number(si.data.values[0]); return renderPanel(si, f); } });
      const minuteSel = this.client.interactions.createSelect({ user, data: { placeholder: `⏱️ Minuto — Atual: :${String(f.minute ?? 0).padStart(2, '0')}`, options: [0,5,10,15,20,25,30,35,40,45,50,55].map(m => ({ label: `:${String(m).padStart(2, '0')}`, value: String(m) })) }, funcao: async (si) => { await this.ui.deferUpdate(si); f.minute = Number(si.data.values[0]); return renderPanel(si, f); } });
      const daysSel   = this.client.interactions.createSelect({ user, data: { placeholder: '📅 Dias da semana (padrão = todos)', min_values: 0, max_values: 7, options: [{ label: 'Domingo', value: '0', emoji: { name: '🌞' } }, { label: 'Segunda', value: '1', emoji: { name: '💼' } }, { label: 'Terça', value: '2', emoji: { name: '💼' } }, { label: 'Quarta', value: '3', emoji: { name: '💼' } }, { label: 'Quinta', value: '4', emoji: { name: '💼' } }, { label: 'Sexta', value: '5', emoji: { name: '🎉' } }, { label: 'Sábado', value: '6', emoji: { name: '🌟' } }] }, funcao: async (si) => { await this.ui.deferUpdate(si); f.weekdays = si.data.values.length ? si.data.values.map(Number) : undefined; return renderPanel(si, f); } });
      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => {
        await this.ui.deferUpdate(bi);
        if (f.hour === undefined) return this.ui.editOriginal(bi, { embeds: [{ title: '❌ Hora obrigatória', description: `${this._e('brava')} Selecione a hora antes de salvar!`, color: COLOR.danger }], components: [] });
        return saveFilters(bi, f);
      }});
      return this.ui.editOriginal(i, { embeds: [{ title: `🔧 Filtros — Horário Agendado ${this._e('pensando')}`, description: `Configure em que hora e dias o trigger vai disparar:\n\n${lines}\n\n${this._e('emduvida')} A hora é obrigatória. Fuso horário: UTC.`, color: COLOR.main }], components: [this.ui.row(hourSel1), this.ui.row(hourSel2), this.ui.row(minuteSel), this.ui.row(daysSel), this.ui.row(btnClear, btnSave)] });
    };
    return renderPanel(interaction, filters);
  }



  async conditionsMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow  = await this._getFlow(interaction.guild_id, flowId);
    if (!flow) return;
    const conds = flow.conditions || [];

    const lines = conds.length
      ? conds.map((c, i) => {
          const meta    = CONDITION_CATALOG.find(x => x.category === c.category && x.type === c.type);
          const opLabel = i === 0 ? '' : ` **(${c.operator})**`;
          const neg     = c.negate ? ' ~~negado~~' : '';
          return `\`${i + 1}.\`${opLabel} ${meta?.label || c.type}${neg}`;
        }).join('\n')
      : `_Nenhuma condição — fluxo sempre executa ${this._e('feliz')}_`;

    const categorySel = this.ui.select(
      user,
      [...CONDITION_GROUPS.keys()].map(cat => ({
        label:       CONDITION_CATEGORY_META[cat]?.label?.slice(0, 100) || cat,
        value:       cat,
        description: CONDITION_CATEGORY_META[cat]?.description?.slice(0, 100),
      })),
      '➕ 1️⃣ Categoria da nova condição',
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
          return { label: `${i + 1}. ${meta?.label || c.type}`.slice(0, 100), value: c.id };
        }),
        '✏️ Editar uma condição já adicionada',
        async (si) => {
          return this._editConditionSelect(si, user, flowId, si.data.values[0]);
        }
      );
      editComponents.push(this.ui.row(editSel));
    }

    const btnRemove = this.ui.btn(user, '🗑️ Remover última', 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!conds.length) return;
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { conditions: conds.slice(0, -1) });
      return this.conditionsMenu(i, user, flowId);
    });
    const btnClear = this.ui.btn(user, '🧹 Limpar tudo', 4, async (i) => {
      await this.ui.deferUpdate(i);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { conditions: [] });
      return this.conditionsMenu(i, user, flowId);
    });
    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# 🔍 Condições (${conds.length}) ${this._e('emduvida')}\n` +
        (successMsg ? `${successMsg}\n\n` : '') +
        `**O que são condições?** São verificações que devem ser verdadeiras para o fluxo rodar!\n` +
        `Ex: "Só executa se o usuário tiver o cargo Membro" ou "Só se a mensagem contiver um link".`
      ),
      this.ui.cv2Divider(),
      this.ui.cv2Text(`**📋 Condições configuradas:**\n${lines}`),
      ...editComponents,
      this.ui.cv2Divider(),
      this.ui.cv2Text(`**Adicionar nova condição** — escolha a categoria:`),
      this.ui.row(categorySel),
      this.ui.cv2Divider(),
      this.ui.row(btnRemove, btnClear, btnBack, this._guideButton()),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _conditionCategoryMenu(interaction, user, flowId, category) {
    const items = CONDITION_GROUPS.get(category) || [];
    const meta  = CONDITION_CATEGORY_META[category];

    const itemSel = this.ui.select(
      user,
      items.map(a => ({ label: a.label.slice(0, 100), value: `${a.category}:${a.type}` })),
      `➕ 2️⃣ Condição — ${meta?.label || category}`,
      async (si) => {
        const [cat, typ] = si.data.values[0].split(':');
        return this._addCondition(si, user, flowId, cat, typ);
      }
    );

    const btnBack = this.ui.btn(user, '⬅️ Outra categoria', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.conditionsMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(`# ${meta?.label || category} ${this._e('pensando')}\n${meta?.description || ''}\n\nEscolha a condição específica:`),
      this.ui.cv2Divider(),
      this.ui.row(itemSel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _addCondition(interaction, user, flowId, category, type) {
    const meta = CONDITION_CATALOG.find(c => c.category === category && c.type === type);
    if (!meta?.params?.length) {
      await this.ui.deferUpdate(interaction);
      const flow  = await this._getFlow(interaction.guild_id, flowId);
      const conds = flow.conditions || [];
      conds.push({ id: this._uid(), category, type, params: {}, operator: 'AND', negate: false });
      await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { conditions: conds });
      return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('curtida')} Condição **${meta?.label}** adicionada!` });
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

    for (const p of modalParams.slice(0, 4)) {
      components.push({
        type: 1,
        components: [{
          type:        4,
          custom_id:   p,
          label:       this._paramLabel(p).slice(0, 45),
          style:       1,
          required:    !['errorMsg'].includes(p),
          max_length:  200,
          placeholder: this._paramPlaceholder(p),
          value:       isEdit ? String(existingCond.params?.[p] ?? '') : undefined
        }]
      });
    }

    components.push(
      this.ui.modalSelect('_operator', 'Operador (AND = todas, OR = alguma)', [
        { label: '🔗 AND — todas as condições devem ser verdadeiras', value: 'AND', default: !isEdit || existingCond.operator !== 'OR' },
        { label: '🔀 OR — basta uma ser verdadeira',                   value: 'OR',  default: isEdit && existingCond.operator === 'OR' },
      ], { placeholder: 'AND ou OR?' }),
      this.ui.modalYesNo('_negate', 'Negar (inverter) esta condição?', {
        yesLabel:     '🔁 Sim — o resultado é invertido',
        noLabel:      '➡️ Não — mantém o resultado normal',
        defaultValue: isEdit && existingCond.negate ? 'true' : 'false'
      })
    );

    const modal = this.client.interactions.createModal({
      user,
      title: `${isEdit ? '✏️ Editar' : '➕'} Condição: ${meta.label.slice(0, 35)}`,
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

    const meta = CONDITION_CATALOG.find(c => c.category === category && c.type === type);
    return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('curtida')} Condição **${meta?.label}** adicionada!` });
  }

  async _editConditionSelect(interaction, user, flowId, condId) {
    const flow  = await this._getFlow(interaction.guild_id, flowId);
    const cond  = (flow?.conditions || []).find(c => c.id === condId);
    if (!cond) return this.conditionsMenu(interaction, user, flowId);

    const meta        = CONDITION_CATALOG.find(c => c.category === cond.category && c.type === cond.type);
    const modalParams = (meta?.params || []).filter(p => !SKIP_IN_MODAL.includes(p));
    const needsSelect = meta?.params?.some(p => SKIP_IN_MODAL.includes(p));

    if (!modalParams.length && !needsSelect) {
      return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('emduvida')} Esta condição não tem parâmetros para editar!` });
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
    return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('feliz')} Condição atualizada!` });
  }



  async actionsMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow    = await this._getFlow(interaction.guild_id, flowId);
    const actions = flow?.actions || [];

    const lines = actions.length
      ? actions
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((a, i) => {
            const meta = ACTION_CATALOG.find(x => x.category === a.category && x.type === a.type);
            return `\`${i + 1}.\` ${meta?.label || a.type}`;
          })
          .join('\n')
      : `_Nenhuma ação configurada ${this._e('emburrada')}_`;

    const categorySel = this.ui.select(
      user,
      [...ACTION_GROUPS.keys()].map(cat => ({
        label:       ACTION_CATEGORY_META[cat]?.label?.slice(0, 100) || cat,
        value:       cat,
        description: ACTION_CATEGORY_META[cat]?.description?.slice(0, 100),
      })),
      '➕ 1️⃣ Categoria da nova ação',
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
          return { label: `${i + 1}. ${meta?.label || a.type}`.slice(0, 100), value: a.id };
        }),
        '✏️ Editar uma ação já adicionada',
        async (si) => {
          return this._editActionSelect(si, user, flowId, si.data.values[0]);
        }
      );
      editComponents.push(this.ui.row(editSel));
    }

    const btnRemove = this.ui.btn(user, '🗑️ Remover última', 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!actions.length) return;
      const sorted  = [...actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { actions: sorted.slice(0, -1) });
      return this.actionsMenu(i, user, flowId);
    });
    const btnClear = this.ui.btn(user, '🧹 Limpar tudo', 4, async (i) => {
      await this.ui.deferUpdate(i);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { actions: [] });
      return this.actionsMenu(i, user, flowId);
    });
    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# ⚡ Ações (${actions.length}) ${this._e('animada')}\n` +
        (successMsg ? `${successMsg}\n\n` : '') +
        `**O que são ações?** São as coisas que o fluxo vai fazer quando disparar!\n` +
        `Ex: "Enviar uma mensagem de boas-vindas", "Dar o cargo Membro", etc.`
      ),
      this.ui.cv2Divider(),
      this.ui.cv2Text(`**📋 Ações configuradas (em ordem):**\n${lines}`),
      ...editComponents,
      this.ui.cv2Divider(),
      this.ui.cv2Text(`**Adicionar nova ação** — escolha a categoria:`),
      this.ui.row(categorySel),
      this.ui.cv2Divider(),
      this.ui.row(btnRemove, btnClear, btnBack, this._guideButton()),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _actionCategoryMenu(interaction, user, flowId, category) {
    const items = ACTION_GROUPS.get(category) || [];
    const meta  = ACTION_CATEGORY_META[category];

    const itemSel = this.ui.select(
      user,
      items.map(a => ({ label: a.label.slice(0, 100), value: `${a.category}:${a.type}` })),
      `➕ 2️⃣ Ação — ${meta?.label || category}`,
      async (si) => {
        const [cat, typ] = si.data.values[0].split(':');
        return this._addAction(si, user, flowId, cat, typ);
      }
    );

    const btnBack = this.ui.btn(user, '⬅️ Outra categoria', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.actionsMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(`# ${meta?.label || category} ${this._e('pensando')}\n${meta?.description || ''}\n\nEscolha a ação específica:`),
      this.ui.cv2Divider(),
      this.ui.row(itemSel),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _addAction(interaction, user, flowId, category, type) {
    const meta = ACTION_CATALOG.find(a => a.category === category && a.type === type);
    if (!meta?.params?.length) {
      await this.ui.deferUpdate(interaction);
      const flow    = await this._getFlow(interaction.guild_id, flowId);
      const actions = flow.actions || [];
      actions.push({ id: this._uid(), category, type, params: {}, order: actions.length });
      await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { actions });
      return this.actionsMenu(interaction, user, flowId, { successMsg: `${this._e('curtida')} Ação **${meta?.label}** adicionada!` });
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
          label:       p === 'content' && meta.type === 'edit_interaction_message' ? 'Novo conteúdo (vazio = mantém)' : this._paramLabel(p).slice(0, 45),
          style:       p === 'content' || p === 'reason' ? 2 : 1,
          required:    !OPTIONAL_PARAMS.includes(p) && !(p === 'content' && meta.type === 'edit_interaction_message'),
          max_length:  p === 'content' ? 4000 : 200,
          placeholder: this._paramPlaceholder(p),
          value:       isEdit ? String(existingAction.params?.[p] ?? '') : undefined
        }]
      });
    }

    const modal = this.client.interactions.createModal({
      user,
      title: `${isEdit ? '✏️ Editar' : '➕'} Ação: ${meta.label.slice(0, 35)}`,
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
      return this.actionsMenu(interaction, user, flowId, { successMsg: `${this._e('emduvida')} Esta ação não tem parâmetros para editar!` });
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
    return this.actionsMenu(interaction, user, flowId, { successMsg: `${this._e('feliz')} Ação atualizada!` });
  }

  async _saveAction(interaction, user, flowId, category, type, params) {
    const meta     = ACTION_CATALOG.find(a => a.category === category && a.type === type);
    const guildId  = interaction.guild_id;
    const warnings = [];

    const idWarnings = await this._validateIds(guildId, params);
    warnings.push(...idWarnings);

    if (params.channelId && ['send_message', 'reply_message', 'edit_message'].includes(type)) {
      const rawId = params.channelId.replace(/[<#>]/g, '').trim();
      try {
        const perms = await getPerm({ channel: true, id: rawId, guildId, bot: true, client: this.client });
        if (!perms.includes('SEND_MESSAGES') || !perms.includes('VIEW_CHANNEL')) {
          warnings.push(`⚠️ O bot não tem permissão para enviar mensagens no canal <#${rawId}>.`);
        }
      } catch {}
    }

    if (['give_role', 'remove_role', 'toggle_role', 'give_temp_role'].includes(type) && params.roleId) {
      const rawId = params.roleId.replace(/[<@&>]/g, '').trim();
      try {
        const higher = await holeHighter({ guildId, roleId: rawId, bot: true });
        if (!higher) warnings.push(`⚠️ O cargo do bot é igual ou menor que o cargo <@&${rawId}>. A ação pode falhar.`);
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
        if (!perms.includes(requiredPerm)) warnings.push(`⚠️ O bot não tem a permissão **${requiredPerm}** no servidor.`);
      } catch {}
    }

    const flow    = await this._getFlow(guildId, flowId);
    const actions = flow.actions || [];
    actions.push({ id: this._uid(), category, type, params: JSON.parse(JSON.stringify(params)), order: actions.length });
    await this.client.logicEngine.updateFlow(flowId, guildId, { actions });

    const msg = warnings.length
      ? `${this._e('emduvida')} Ação **${meta?.label}** adicionada, mas com avisos:\n\n${warnings.join('\n')}`
      : `${this._e('curtida')} Ação **${meta?.label}** adicionada!`;

    return this.actionsMenu(interaction, user, flowId, { successMsg: msg });
  }


  async _askEmbedOrSave(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const existingEmbed = params.embedObj ?? existingAction?.params?.embedObj ?? null;
    const hasEmbed      = !!existingEmbed;

    const btnSim = this.client.interactions.createButton({
      user,
      data: { label: hasEmbed ? '✏️ Editar embed' : '✨ Criar embed', style: 1 },
      funcao: async (i) => {
        return this._openFlowEmbedBuilder(i, user, flowId, meta, params, isEdit, existingAction, needsSelect, existingEmbed);
      }
    });

    const btnNao = this.client.interactions.createButton({
      user,
      data: { label: hasEmbed ? '🗑️ Remover embed' : '⏭️ Sem embed', style: hasEmbed ? 4 : 2 },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        delete params.embedObj;
        return this._afterEmbedDecision(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
      }
    });

    const rows = hasEmbed && isEdit
      ? [this.ui.row(btnSim, btnNao, this.client.interactions.createButton({
          user, data: { label: '✅ Manter embed atual', style: 3 },
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
          ? `# ${this._e('animada')} Embed configurada!\n> Você quer **editar**, **remover** ou **manter** a embed atual?`
          : `# ${this._e('emduvida')} Adicionar embed à mensagem?\n` +
            `${this._e('pensando')} Embeds deixam a mensagem bem mais bonita — título, descrição, cor, imagem, fields e muito mais! ${this._e('feliz')}`
      ),
      this.ui.cv2Divider(),
      ...rows,
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _openFlowEmbedBuilder(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect, existingEmbed) {
    const rootChannelId = interaction.channel_id || interaction.channel?.id;
    const rootMessageId = interaction.message?.id;

    await this.ui.deferUpdate(interaction);

    const embed = existingEmbed
      ? JSON.parse(JSON.stringify(existingEmbed))
      : { title: '', description: '', color: COLOR.main, url: '', author: { name: '', icon_url: '', url: '' }, footer: { text: '', icon_url: '' }, thumbnail: { url: '' }, image: { url: '' }, fields: [] };

    const PRESET_COLORS = [
      { label: '🔵 Azul Ayami',    value: '7C8FFF' },
      { label: '💙 Azul Cabelo',   value: 'A9D6FF' },
      { label: '🌙 Azul Escuro',   value: '243B7A' },
      { label: '⭐ Dourado',       value: 'FFD966' },
      { label: '🌸 Rosa',          value: 'FFB6C8' },
      { label: '🟢 Verde',         value: '57F287' },
      { label: '🔴 Vermelho',      value: 'ED4245' },
      { label: '🟡 Amarelo',       value: 'FEE75C' },
      { label: '🟠 Laranja',       value: 'E67E22' },
      { label: '🟣 Roxo',          value: '9B59B6' },
      { label: '⚫ Preto',         value: '000000' },
      { label: '🎨 HEX Personalizado', value: 'custom' },
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

    function buildLiveEmbed() {
      const e = cleanEmbed(embed);
      if (!e.title && !e.description && !e.fields?.length && !e.image && !e.thumbnail && !e.author) {
        e.description = '*Embed em branco — comece escolhendo um campo para editar abaixo* 👇';
      }
      e.color = embed.color ?? COLOR.gold;
      return e;
    }

    const renderBuilder = async (i, followUpMsgId) => {

      const editSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: '✏️ Editar campo da embed…',
          options: [
            { label: 'Título',           value: 'title'        },
            { label: 'Descrição',        value: 'description'  },
            { label: 'URL do Título',    value: 'url'          },
            { label: 'Author Nome',      value: 'author_name'  },
            { label: 'Author Icon URL',  value: 'author_icon'  },
            { label: 'Author URL',       value: 'author_url'   },
            { label: 'Footer Texto',     value: 'footer_text'  },
            { label: 'Footer Icon URL',  value: 'footer_icon'  },
            { label: 'Thumbnail URL',    value: 'thumbnail'    },
            { label: 'Image URL',        value: 'image'        },
          ]
        },
        funcao: async (si) => {
          const MAP = {
            title:       ['Editar Título',          () => embed.title,           v => { embed.title           = v; }, false],
            description: ['Editar Descrição',       () => embed.description,     v => { embed.description     = v; }, true ],
            url:         ['Editar URL do Título',    () => embed.url,             v => { embed.url             = v; }, false],
            author_name: ['Editar Author Nome',      () => embed.author.name,     v => { embed.author.name     = v; }, false],
            author_icon: ['Editar Author Icon URL',  () => embed.author.icon_url, v => { embed.author.icon_url = v; }, false],
            author_url:  ['Editar Author URL',       () => embed.author.url,      v => { embed.author.url      = v; }, false],
            footer_text: ['Editar Footer Texto',     () => embed.footer.text,     v => { embed.footer.text     = v; }, false],
            footer_icon: ['Editar Footer Icon URL',  () => embed.footer.icon_url, v => { embed.footer.icon_url = v; }, false],
            thumbnail:   ['Editar Thumbnail URL',    () => embed.thumbnail.url,   v => { embed.thumbnail.url   = v; }, false],
            image:       ['Editar Image URL',        () => embed.image.url,       v => { embed.image.url       = v; }, false],
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
        data: { placeholder: '📊 Gerenciar Fields…', options: [
          { label: '➕ Adicionar Field', value: 'add',   description: `Atual: ${embed.fields.length}/25` },
          { label: '🗑️ Remover Última',  value: 'remove' },
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
            user, title: 'Adicionar Field',
            components: [
              this.ui.modalText('name',  'Nome do field',  { required: true, maxLength: 256 }),
              this.ui.modalText('value', 'Valor do field', { required: true, maxLength: 1024, style: 2 }),
              this.ui.modalYesNo('inline', 'Exibir em linha (inline)?', { yesLabel: '↔️ Sim — lado a lado', noLabel: '⬇️ Não — linha inteira', defaultValue: 'false' }),
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
        data: { placeholder: '🎨 Escolher cor…', options: PRESET_COLORS.map(c => ({ label: c.label, value: c.value })) },
        funcao: async (si) => {
          const val = si.data.values[0];
          if (val === 'custom') {
            const modal = this.client.interactions.createModal({
              user, title: 'Cor HEX Personalizada',
              components: [{ type: 1, components: [{ type: 4, custom_id: 'hex', label: 'HEX (ex: FF5733)', style: 1, required: true, max_length: 7, placeholder: 'FF5733' }] }],
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

      const btnConfirm = this.client.interactions.createButton({
        user, data: { label: '✅ Confirmar embed', style: 3 },
        funcao: async (i2) => {
          await this.ui.deferUpdate(i2);
          params.embedObj = cleanEmbed(embed);

          await this.ui.deleteFollowUp(i2, followUpMsgId).catch(() => {});

          return this._continueFlowOnRoot(i2, rootChannelId, rootMessageId, user, flowId, meta, params, isEdit, existingAction, needsSelect, '_afterEmbedDecision');
        }
      });

      const btnRemove = this.client.interactions.createButton({
        user, data: { label: '🗑️ Remover embed', style: 4 },
        funcao: async (i2) => {
          await this.ui.deferUpdate(i2);
          delete params.embedObj;
          await this.ui.deleteFollowUp(i2, followUpMsgId).catch(() => {});
          return this._continueFlowOnRoot(i2, rootChannelId, rootMessageId, user, flowId, meta, params, isEdit, existingAction, needsSelect, '_afterEmbedDecision');
        }
      });

      const btnCancel = this.client.interactions.createButton({
        user, data: { label: '✖️ Cancelar', style: 2 },
        funcao: async (i2) => {
          await this.ui.deferUpdate(i2);
          await this.ui.deleteFollowUp(i2, followUpMsgId).catch(() => {});
          return this._continueFlowOnRoot(i2, rootChannelId, rootMessageId, user, flowId, meta, params, isEdit, existingAction, needsSelect, '_afterEmbedDecision');
        }
      });

      const builderPayload = {
        content:    `🎨 **Editor de Embed** ${this._e('animada')} — o preview abaixo é exatamente como a embed vai ficar!`,
        embeds:     [buildLiveEmbed()],
        components: [
          this.ui.row(editSel),
          this.ui.row(fieldSel),
          this.ui.row(colorSel),
          this.ui.row(btnConfirm, btnRemove, btnCancel),
        ],
        flags: 64, // ephemeral — SEM flag CV2, pois embed real não roda junto com Components V2
      };

      return DiscordRequest(
        `/webhooks/${this.client.clientId}/${i.token}/messages/${followUpMsgId}`,
        { method: 'PATCH', body: builderPayload }
      );
    };

    const initialPayload = {
      content:    `🎨 **Editor de Embed** ${this._e('animada')} — o preview abaixo é exatamente como a embed vai ficar!`,
      embeds:     [buildLiveEmbed()],
      components: [],
      flags: 64,
    };

    const followUpResponse = await this.ui.followUp(interaction, initialPayload);
    const followUpMsgId = followUpResponse?.id;

    return renderBuilder(interaction, followUpMsgId);
  }

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



  async _askInteractionOrFinish(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const existing    = params.interactionObj ?? existingAction?.params?.interactionObj ?? null;
    const hasExisting = !!existing;

    const btnSim = this.client.interactions.createButton({ user, data: { label: hasExisting ? '✏️ Editar interação' : '⚡ Adicionar interação', style: 1 }, funcao: async (i) => { await this.ui.deferUpdate(i); return this._showInteractionTypeSelect(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); } });
    const btnNao = this.client.interactions.createButton({ user, data: { label: hasExisting ? '🗑️ Remover interação' : '⏭️ Sem interação', style: hasExisting ? 4 : 2 }, funcao: async (i) => { await this.ui.deferUpdate(i); delete params.interactionObj; return this._continueAfterMessageExtras(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); } });

    const rows = hasExisting
      ? [this.ui.row(btnSim, btnNao, this.client.interactions.createButton({ user, data: { label: '✅ Manter atual', style: 3 }, funcao: async (i) => { await this.ui.deferUpdate(i); params.interactionObj = existing; return this._continueAfterMessageExtras(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); }}))]
      : [this.ui.row(btnSim, btnNao)];

    const previewLine = hasExisting
      ? (existing.kind === 'button' ? `🔘 Botão **"${existing.label}"** → dispara um fluxo` : `📋 Select com **${existing.options?.length || 0}** opção(ões) → cada uma dispara um fluxo`)
      : '_nenhuma interação configurada_';

    const blocks = [
      this.ui.cv2Text(`# ⚡ Adicionar Interação? ${this._e('emduvida')}\n${this._e('pensando')} Você quer que a mensagem tenha um **botão** ou **select menu** que dispare outro fluxo?\n\n**Atual:** ${previewLine}\n\n*Útil para criar menus, painéis de ticket, confirmar ações e mais!*`),
      this.ui.cv2Divider(),
      ...rows,
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showInteractionTypeSelect(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const typeSel = this.client.interactions.createSelect({ user, data: { placeholder: '⚡ Tipo de interação', options: [{ label: '🔘 Botão', value: 'button', description: 'Um único botão que dispara um fluxo' }, { label: '📋 Select Menu', value: 'select', description: 'Várias opções, cada uma dispara um fluxo diferente' }] }, funcao: async (i) => { await this.ui.deferUpdate(i); if (i.data.values[0] === 'button') return this._buildInteractionButton(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); return this._buildInteractionSelect(i, user, flowId, meta, params, isEdit, existingAction, needsSelect, []); } });
    const blocks = [this.ui.cv2Text(`# ⚡ Tipo de Interação ${this._e('emduvida')}\n${this._e('pensando')} A mensagem deve ter um botão ou um select menu?`), this.ui.cv2Divider(), this.ui.row(typeSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _buildInteractionButton(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const flows = await FlowModel.find({ guildId: interaction.guild_id, enabled: true, 'trigger.type': 'button_clicked' }).lean();
    if (!flows.length) {
      const blocks = [this.ui.cv2Text(`# ❌ Nenhum fluxo disponível\n${this._e('emduvida')} Não encontrei nenhum fluxo ativo com trigger **🖱️ Botão clicado**.\nCrie um fluxo com esse trigger primeiro!`), this.ui.cv2Divider(), this.ui.row(this.ui.btn(user, '◀ Voltar', 2, async (i) => { await this.ui.deferUpdate(i); return this._askInteractionOrFinish(i, user, flowId, meta, params, isEdit, existingAction, needsSelect); }))];
      return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.danger }));
    }
    return this._showFlowPicker(interaction, user, flows, 0, async (si, pickedFlowId) => {
      const cur = params.interactionObj || {};
      const modal = this.client.interactions.createModal({ user, title: 'Configurar Botão', components: [
        this.ui.modalText('label', 'Texto do botão', { required: true, maxLength: 80, value: cur.label || '' }),
        this.ui.modalSelect('style', 'Cor do botão', [{ label: '🔵 Azul', value: '1', default: !cur.style || cur.style === 1 }, { label: '⚪ Cinza', value: '2', default: cur.style === 2 }, { label: '🟢 Verde', value: '3', default: cur.style === 3 }, { label: '🔴 Vermelho', value: '4', default: cur.style === 4 }], { placeholder: 'Escolha a cor' }),
        this.ui.modalText('emoji', 'Emoji (opcional)', { required: false, maxLength: 50, value: cur.emoji || '' }),
        this.ui.modalYesNo('permanent', 'Botão permanente?', { yesLabel: '♾️ Sim — nunca expira', noLabel: '⏳ Não — temporário', defaultValue: cur.permanent === false ? 'false' : 'true', placeholder: 'Permanente ou temporário?' }),
      ], funcao: async (mi, _, fields) => {
        const style = [1,2,3,4].includes(Number(fields.style)) ? Number(fields.style) : 1;
        params.interactionObj = { kind: 'button', label: fields.label?.trim() || 'Clique aqui', style, emoji: fields.emoji?.trim() || '', permanent: fields.permanent !== 'false', flowId: pickedFlowId };
        await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
        return this._continueAfterMessageExtras(mi, user, flowId, meta, params, isEdit, existingAction, needsSelect);
      }});
      return this.client.interactions.showModal(si, modal);
    });
  }

  async _buildInteractionSelect(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect, options) {
    const flows = await FlowModel.find({ guildId: interaction.guild_id, enabled: true, 'trigger.type': 'select_used' }).lean();
    const renderPanel = async (i, opts) => {
      if (!flows.length && !opts.length) {
        const blocks = [this.ui.cv2Text(`# ❌ Nenhum fluxo disponível\n${this._e('emduvida')} Não encontrei nenhum fluxo ativo com trigger **📋 Select usado**.\nCrie um fluxo com esse trigger primeiro!`), this.ui.cv2Divider(), this.ui.row(this.ui.btn(user, '◀ Voltar', 2, async (bi) => { await this.ui.deferUpdate(bi); return this._askInteractionOrFinish(bi, user, flowId, meta, params, isEdit, existingAction, needsSelect); }))];
        return this.ui.editOriginal(i, this._cv2(blocks, { accentColor: COLOR.danger }));
      }
      const lines = opts.length ? opts.map((o, idx) => `**${idx + 1}.** ${o.emoji || '▪️'} ${o.label}`).join('\n') : '_nenhuma opção adicionada ainda_';
      const btnAdd = this.client.interactions.createButton({ user, data: { label: '➕ Adicionar opção', style: 1 }, funcao: async (bi) => {
        if (!flows.length) return;
        return this._showFlowPicker(bi, user, flows, 0, async (si, pickedFlowId) => {
          const modal = this.client.interactions.createModal({ user, title: 'Nova Opção do Select', components: [this.ui.modalText('label', 'Texto da opção', { required: true, maxLength: 100 }), this.ui.modalText('description', 'Descrição (opcional)', { required: false, maxLength: 100 }), this.ui.modalText('emoji', 'Emoji (opcional)', { required: false, maxLength: 50 })], funcao: async (mi, _, fields) => {
            opts.push({ label: fields.label?.trim() || 'Opção', description: fields.description?.trim() || '', emoji: fields.emoji?.trim() || '', flowId: pickedFlowId });
            await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
            return renderPanel(mi, opts);
          }});
          return this.client.interactions.showModal(si, modal);
        });
      }});
      const btnRemove = this.client.interactions.createButton({ user, data: { label: '🗑️ Remover última', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); opts.pop(); return renderPanel(bi, opts); }});
      const btnSave   = this.client.interactions.createButton({ user, data: { label: '✅ Salvar Select', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); params.interactionObj = { kind: 'select', options: opts }; return this._continueAfterMessageExtras(bi, user, flowId, meta, params, isEdit, existingAction, needsSelect); }});
      const blocks = [this.ui.cv2Text(`# 📋 Configurar Select Menu ${this._e('pensando')}\nAdicione as opções que o usuário vai ver. Cada opção dispara um fluxo diferente!\n\n**Opções adicionadas (${opts.length}/25):**\n${lines}`), this.ui.cv2Divider(), this.ui.row(btnAdd, btnRemove, btnSave)];
      return this.ui.editOriginal(i, this._cv2(blocks, { accentColor: COLOR.main }));
    };
    return renderPanel(interaction, options);
  }

  async _showFlowPicker(interaction, user, flows, page, onPick) {
    const { page: safePage, maxPage } = this.ui._clampPage(page, flows.length);
    const pageItems = this.ui._pageSlice(flows, safePage);
    const options   = pageItems.map(f => ({ label: f.name.slice(0, 100), value: f.flowId, description: `ID: ${f.flowId}` }));
    const sel = this.ui.select(user, options, '⚡ Selecionar fluxo…', async (i) => {
      return onPick(i, i.data.values[0]);
    });
    const components = [this.ui.row(sel)];
    if (maxPage > 0) components.push(this.ui._paginationRow(user, safePage, maxPage, (i, p) => this._showFlowPicker(i, user, flows, p, onPick), (i, p) => this._showFlowPicker(i, user, flows, p, onPick)));
    const blocks = [this.ui.cv2Text(`# ⚡ Selecionar Fluxo ${this._e('pensando')}\nQual fluxo será disparado? *(Página ${safePage + 1}/${maxPage + 1})*`), this.ui.cv2Divider(), ...components];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }


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
    const channelSel = this.client.interactions.createChannelSelect({ user, data: { placeholder: `📌 Canal para: ${meta.label.slice(0, 68)}`, channel_types: [0, 5] }, funcao: async (i) => { await this.ui.deferUpdate(i); params.channelId = i.data.values[0]; return this._resolveSelectParams(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(`# 📌 Selecionar Canal ${this._e('emduvida')}\n${this._e('pensando')} Para a ação **${meta.label}**, selecione o canal onde ela vai acontecer!`), this.ui.cv2Divider(), this.ui.row(channelSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showRoleSelect(interaction, user, flowId, meta, params, mode) {
    const roleSel = this.client.interactions.createRoleSelect({ user, data: { placeholder: `🏷️ Cargo para: ${meta.label.slice(0, 70)}` }, funcao: async (i) => { await this.ui.deferUpdate(i); params.roleId = i.data.values[0]; return this._resolveSelectParams(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(`# 🏷️ Selecionar Cargo ${this._e('emduvida')}\n${this._e('pensando')} Para a ação **${meta.label}**, selecione o cargo que será usado!`), this.ui.cv2Divider(), this.ui.row(roleSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showPermSelect(interaction, user, flowId, meta, params, mode) {
    const PERM_PAGES = [
      [{ label: 'Ver Canais', value: 'VIEW_CHANNEL' }, { label: 'Enviar Mensagens', value: 'SEND_MESSAGES' }, { label: 'Enviar em Threads', value: 'SEND_MESSAGES_IN_THREADS' }, { label: 'Criar Threads Públicas', value: 'CREATE_PUBLIC_THREADS' }, { label: 'Criar Threads Privadas', value: 'CREATE_PRIVATE_THREADS' }, { label: 'Incorporar Links', value: 'EMBED_LINKS' }, { label: 'Anexar Arquivos', value: 'ATTACH_FILES' }, { label: 'Ver Histórico', value: 'READ_MESSAGE_HISTORY' }, { label: 'Mencionar @everyone', value: 'MENTION_EVERYONE' }, { label: 'Usar Emojis Externos', value: 'USE_EXTERNAL_EMOJIS' }, { label: 'Usar Stickers Externos', value: 'USE_EXTERNAL_STICKERS' }, { label: 'Adicionar Reações', value: 'ADD_REACTIONS' }, { label: 'Usar Comandos de App', value: 'USE_APPLICATION_COMMANDS' }, { label: 'Gerenciar Mensagens', value: 'MANAGE_MESSAGES' }, { label: 'Gerenciar Threads', value: 'MANAGE_THREADS' }, { label: 'Text-to-Speech', value: 'SEND_TTS_MESSAGES' }],
      [{ label: 'Conectar em Voz', value: 'CONNECT' }, { label: 'Falar em Voz', value: 'SPEAK' }, { label: 'Vídeo/Tela em Voz', value: 'STREAM' }, { label: 'Usar Voz com Atividade', value: 'USE_VAD' }, { label: 'Mutar Membros', value: 'MUTE_MEMBERS' }, { label: 'Ensurdecer Membros', value: 'DEAFEN_MEMBERS' }, { label: 'Mover Membros', value: 'MOVE_MEMBERS' }, { label: 'Prioridade de Palestra', value: 'PRIORITY_SPEAKER' }, { label: 'Expulsar Membros', value: 'KICK_MEMBERS' }, { label: 'Banir Membros', value: 'BAN_MEMBERS' }, { label: 'Dar Timeout', value: 'MODERATE_MEMBERS' }, { label: 'Gerenciar Apelidos', value: 'MANAGE_NICKNAMES' }, { label: 'Gerenciar Cargos', value: 'MANAGE_ROLES' }, { label: 'Gerenciar Canais', value: 'MANAGE_CHANNELS' }, { label: 'Gerenciar Emojis', value: 'MANAGE_EMOJIS_AND_STICKERS' }, { label: 'Gerenciar Webhooks', value: 'MANAGE_WEBHOOKS' }],
      [{ label: 'Gerenciar Servidor', value: 'MANAGE_GUILD' }, { label: 'Gerenciar Eventos', value: 'MANAGE_EVENTS' }, { label: 'Ver Audit Log', value: 'VIEW_AUDIT_LOG' }, { label: 'Ver Insights do Servidor', value: 'VIEW_GUILD_INSIGHTS' }, { label: 'Mudar Apelido Próprio', value: 'CHANGE_NICKNAME' }, { label: 'Criar Convite', value: 'CREATE_INSTANT_INVITE' }, { label: 'Administrador', value: 'ADMINISTRATOR' }],
    ];
    const PAGE_LABELS = ['💬 Mensagens e Canais', '🔊 Voz e Moderação', '⚙️ Servidor e Especiais'];
    const renderPage = async (i, page) => {
      const pageSel = this.client.interactions.createSelect({ user, data: { placeholder: `${PAGE_LABELS[page]} — escolha a permissão`, options: PERM_PAGES[page] }, funcao: async (si) => { await this.ui.deferUpdate(si); params.permission = si.data.values[0]; return this._finalizeSave(si, user, flowId, meta, params, mode); } });
      const navBtns = [];
      if (page > 0) navBtns.push(this.client.interactions.createButton({ user, data: { label: '◀ Anterior', style: 2 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPage(bi, page - 1); } }));
      if (page < PERM_PAGES.length - 1) navBtns.push(this.client.interactions.createButton({ user, data: { label: 'Próxima ▶', style: 2 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPage(bi, page + 1); } }));
      const rows = [this.ui.row(pageSel)];
      if (navBtns.length) rows.push(this.ui.row(...navBtns));
      const blocks = [this.ui.cv2Text(`# 🛡️ Selecionar Permissão ${this._e('emduvida')}\n${this._e('pensando')} Escolha a permissão que o usuário precisa ter!\nPágina **${page + 1}/${PERM_PAGES.length}** — ${PAGE_LABELS[page]}`), this.ui.cv2Divider(), ...rows];
      return this.ui.editOriginal(i, this._cv2(blocks, { accentColor: COLOR.main }));
    };
    return renderPage(interaction, 0);
  }

  async _showThreadTargetSelect(interaction, user, flowId, meta, params, mode) {
    const typeSel = this.client.interactions.createSelect({ user, data: { placeholder: '➕ Adicionar ao tópico: usuário ou cargo?', options: [{ label: '👤 Um usuário específico', value: 'user' }, { label: '🏷️ Todos com um cargo', value: 'role' }] }, funcao: async (i) => {
      params.threadTargetType = i.data.values[0];
      if (params.threadTargetType === 'role') { await this.ui.deferUpdate(i); return this._showRoleSelect(i, user, flowId, meta, params, mode); }
      const modal = this.client.interactions.createModal({ user, title: 'Usuário a adicionar', components: [{ type: 1, components: [{ type: 4, custom_id: 'targetUserId', label: 'ID, @menção ou {arg0} do usuário', style: 1, required: true, max_length: 100, placeholder: 'Ex: {arg0} ou 123456789012345678' }] }], funcao: async (mi, _, fields) => { params.targetUserId = fields.targetUserId?.trim(); await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } }); return this._resolveSelectParams(mi, user, flowId, meta, params, mode); } });
      return this.client.interactions.showModal(i, modal);
    }});
    const blocks = [this.ui.cv2Text(`# ➕ Adicionar ao Tópico ${this._e('emduvida')}\n${this._e('pensando')} Quem você quer adicionar ao tópico (thread)?`), this.ui.cv2Divider(), this.ui.row(typeSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showArgSelect(interaction, user, flowId, meta, params, mode) {
    const argIndexSel = this.client.interactions.createSelect({ user, data: { placeholder: '🔢 Qual argumento? (1 = primeiro)', options: [0,1,2,3,4].map(n => ({ label: `Argumento ${n + 1}`, value: String(n), description: `{arg${n}}` })) }, funcao: async (i) => { await this.ui.deferUpdate(i); params.argIndex = Number(i.data.values[0]); return this._showArgTypeSel(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(`# 🔍 Condição: ${meta.label} ${this._e('emduvida')}\n${this._e('pensando')} **Qual argumento você quer verificar?**\n\nOs argumentos são as palavras que o usuário digita após o comando.\nEx: \`!ban @Usuario motivo\` → arg1 = \`@Usuario\`, arg2 = \`motivo\``), this.ui.cv2Divider(), this.ui.row(argIndexSel)];
    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _showArgTypeSel(interaction, user, flowId, meta, params, mode) {
    const argNum = (params.argIndex ?? 0) + 1;
    const argTypeSel = this.client.interactions.createSelect({ user, data: { placeholder: `🔍 O Argumento ${argNum} é…`, options: [{ label: '👤 Menção de usuário', value: 'user_mention' }, { label: '📌 Menção de canal', value: 'channel_mention' }, { label: '🔢 Número', value: 'number' }, { label: '✏️ Texto não-vazio', value: 'text' }] }, funcao: async (i) => { await this.ui.deferUpdate(i); params.argType = i.data.values[0]; return this._finalizeSave(i, user, flowId, meta, params, mode); } });
    const blocks = [this.ui.cv2Text(`# 🔍 Tipo do Argumento ${argNum} ${this._e('emduvida')}\n${this._e('pensando')} **O Argumento ${argNum} deve ser do tipo:**`), this.ui.cv2Divider(), this.ui.row(argTypeSel)];
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



  async _validateIds(guildId, params) {
    const warnings = [];

    if (params.channelId) {
      const rawId = params.channelId.replace(/[<#>]/g, '').trim();
      try {
        const ch = await DiscordRequest(`/channels/${rawId}`);
        if (!ch || ch.guild_id !== guildId) warnings.push(`⚠️ Canal \`${rawId}\` não pertence a este servidor.`);
      } catch { warnings.push(`⚠️ Canal \`${rawId}\` não encontrado.`); }
    }

    if (params.roleId) {
      const rawId = params.roleId.replace(/[<@&>]/g, '').trim();
      try {
        const roles  = await DiscordRequest(`/guilds/${guildId}/roles`);
        const exists = roles?.some(r => r.id === rawId);
        if (!exists) warnings.push(`⚠️ Cargo \`${rawId}\` não encontrado neste servidor.`);
      } catch { warnings.push(`⚠️ Não foi possível verificar o cargo \`${rawId}\`.`); }
    }

    if (params.flowId) {
      try {
        const f = await this._getFlow(guildId, params.flowId);
        if (!f) warnings.push(`⚠️ Fluxo \`${params.flowId}\` não encontrado.`);
      } catch { warnings.push(`⚠️ Não foi possível verificar o fluxo \`${params.flowId}\`.`); }
    }

    return warnings;
  }


  async variablesMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const vars = flow?.variables || [];

    const lines = vars.length
      ? vars.map(v =>
          `• **${v.name}** (\`${v.type}\`) = \`${v.defaultValue ?? 'null'}\`` +
          `${v.persistent ? ' 💾' : ''}` +
          ` — ${v.scope === 'user' ? '👤 por usuário' : '🌐 do fluxo'}`
        ).join('\n')
      : `_Nenhuma variável criada ${this._e('sonolenta')}_`;

    const btnAdd = this.ui.btn(user, '➕ Criar Variável', 1, async (i) => {
      await this.ui.deferUpdate(i);
      return this._varStep1_Scope(i, user, flowId);
    });

    const btnRemove = this.ui.btn(user, '🗑️ Remover última', 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!vars.length) return;
      const updated = vars.slice(0, -1);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { variables: updated });
      return this.variablesMenu(i, user, flowId);
    });

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# 📦 Variáveis (${vars.length}) ${this._e('pensando')}\n` +
        (successMsg ? `${successMsg}\n\n` : '') +
        `**O que são variáveis?** São "caixinhas" que guardam informações durante o fluxo!\n` +
        `Por exemplo: pontos, contador de mensagens, status de um usuário...\n` +
        `Você as usa nas ações com \`{var:nome}\`.\n` +
        `Variáveis 💾 são salvas mesmo depois do fluxo terminar!\n\n` +
        `**Variáveis configuradas:**\n${lines}`
      ),
      this.ui.cv2Divider(),
      this.ui.row(btnAdd, btnRemove, btnBack, this._guideButton()),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varStep1_Scope(interaction, user, flowId) {
    const sel = this.ui.select(
      user,
      [
        { label: '🌐 Variável do Fluxo (Flow)', value: 'flow', description: 'Funciona para TODOS os usuários ao mesmo tempo.' },
        { label: '👤 Variável de Usuário (User)', value: 'user', description: 'Cada usuário tem o SEU valor.' }
      ],
      '🔍 Qual o escopo da variável?',
      async (i) => {
        await this.ui.deferUpdate(i);
        return this._varStep2_Type(i, user, flowId, i.data.values[0]);
      }
    );

    const blocks = [
      this.ui.cv2Text(
        `# 📦 Criar Variável — Passo 1 de 4 ${this._e('animada')}\n` +
        `**Qual é o tipo de variável que você quer criar?**\n\n` +
        `**🌐 Variável do Fluxo (Flow)**\n` +
        `> Compartilhada entre todos os usuários. Use para coisas do servidor inteiro.\n` +
        `> *Exemplo: "quantidade de entradas hoje", "status da live"*\n\n` +
        `**👤 Variável de Usuário (User)**\n` +
        `> Cada usuário tem o seu próprio valor separado.\n` +
        `> *Exemplo: "pontos do usuário", "número de mensagens enviadas"*`
      ),
      this.ui.cv2Divider(),
      this.ui.row(sel),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varStep2_Type(interaction, user, flowId, scope) {
    const sel = this.ui.select(
      user,
      [
        { label: '🔤 Texto (String)',  value: 'string',  description: 'Guarda palavras e frases. Ex: "ativo", "Olá Mundo"' },
        { label: '🔢 Número (Number)', value: 'number',  description: 'Guarda números inteiros ou decimais. Ex: 0, 100, 3.14' },
        { label: '✅ Verdadeiro/Falso (Boolean)', value: 'boolean', description: 'Guarda apenas "true" ou "false"' },
        { label: '📋 Lista (List)',    value: 'list',    description: 'Guarda vários itens. Ex: ["Item1", "Item2"]' }
      ],
      '📦 Qual o tipo de valor?',
      async (i) => {
        return this._varStep3_Name(i, user, flowId, scope, i.data.values[0]);
      }
    );

    const blocks = [
      this.ui.cv2Text(
        `# 📦 Criar Variável — Passo 2 de 4 ${this._e('emduvida')}\n` +
        `**Qual o tipo de valor que sua variável vai guardar?**\n\n` +
        `**🔤 Texto (String)**\n> Guarda qualquer texto. Valor padrão: \`""\` (vazio)\n\n` +
        `**🔢 Número (Number)**\n> Guarda números. Valor padrão: \`0\`\n\n` +
        `**✅ Verdadeiro/Falso (Boolean)**\n> Só pode ser \`true\` ou \`false\`. Valor padrão: \`false\`\n\n` +
        `**📋 Lista (List)**\n> Guarda vários itens de uma vez. Valor padrão: \`[]\` (lista vazia)`
      ),
      this.ui.cv2Divider(),
      this.ui.row(sel),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varStep3_Name(interaction, user, flowId, scope, type) {
    const modal = this.client.interactions.createModal({
      user,
      title: '📦 Criar Variável — Passo 3',
      components: [
        this.ui.modalText('name', 'Nome da variável (sem espaços)', { required: true, maxLength: 50, placeholder: 'contador, pontos, status, xp_usuario...' }),
        this.ui.modalYesNo('persistent', 'Salvar valor após o fluxo terminar?', {
          yesLabel: '💾 Sim — mantém o valor entre execuções',
          noLabel:  '🔄 Não — reseta a cada execução do fluxo',
          defaultValue: 'false'
        }),
      ],
      funcao: async (modalInteraction, client, fields) => {
        const name = fields.name?.trim().replace(/\s+/g, '_');
        if (!name) {
          return DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, {
            method: 'POST', body: { type: 4, data: { content: `❌ Nome inválido! ${this._e('brava')}`, flags: 64 } }
          });
        }

        const flow = await this._getFlow(modalInteraction.guild_id, flowId);
        if ((flow.variables || []).find(v => v.name === name)) {
          return DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, {
            method: 'POST', body: { type: 4, data: { content: `${this._e('emburrada')} Já existe uma variável chamada **${name}**!`, flags: 64 } }
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
    const defaultsByType = { string: '`""` (vazio)', number: '`0`', boolean: '`false`', list: '`[]` (vazia)' };

    if (varData.type === 'boolean') {
      const sel = this.ui.select(user, [
        { label: '✅ true (verdadeiro)', value: 'true' },
        { label: '❌ false (falso)',     value: 'false' },
      ], '✅ Valor inicial', async (i) => {
        await this.ui.deferUpdate(i);
        return this._saveVariable(i, user, flowId, { ...varData, defaultValue: i.data.values[0] === 'true' });
      });
      const blocks = [
        this.ui.cv2Text(`# 📦 Criar Variável — Passo 4 de 4 ${this._e('festa')}\n**Variável:** \`${varData.name}\` (${varData.scope === 'user' ? '👤 usuário' : '🌐 fluxo'})\n**Tipo:** ✅ Boolean\n\nQual o valor inicial?`),
        this.ui.cv2Divider(),
        this.ui.row(sel),
      ];
      return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
    }

    if (varData.type === 'list') {
      const sel = this.ui.select(user, [
        { label: '📋 Lista vazia', value: 'empty', description: 'Começa sem nenhum item' },
        { label: '✏️ Definir itens iniciais', value: 'custom', description: 'Adicionar alguns itens já de início' },
      ], '📦 Como a lista começa?', async (i) => {
        const choice = i.data.values[0];
        if (choice === 'empty') {
          await this.ui.deferUpdate(i);
          return this._saveVariable(i, user, flowId, { ...varData, defaultValue: [] });
        }
        return this._varListDefaultModal(i, user, flowId, varData);
      });
      const blocks = [
        this.ui.cv2Text(
          `# 📦 Criar Variável — Passo 4 de 4 ${this._e('festa')}\n` +
          `**Quase lá! Variável:** \`${varData.name}\` (${varData.scope === 'user' ? '👤 usuário' : '🌐 fluxo'})\n` +
          `**Tipo:** 📋 Lista\n\n**Como você quer que a lista comece?**\n\n` +
          `*Lista vazia é a escolha mais comum — você adiciona itens depois com a ação "Adicionar à lista".*`
        ),
        this.ui.cv2Divider(),
        this.ui.row(sel),
      ];
      return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
    }

    const modal = this.client.interactions.createModal({
      user,
      title: `📦 Valor Padrão — ${varData.name}`,
      components: [{ type: 1, components: [{
        type: 4, custom_id: 'defaultValue', label: 'Valor padrão (deixe vazio = padrão do tipo)',
        style: 1, required: false, max_length: 200,
        placeholder: varData.type === 'number' ? '0' : 'Meu texto padrão'
      }]}],
      funcao: async (modalInteraction, client, fields) => {
        let defaultValue = fields.defaultValue?.trim() || null;
        if (varData.type === 'number') defaultValue = defaultValue !== null ? (Number(defaultValue) || 0) : 0;
        else if (defaultValue === null) defaultValue = '';

        await DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, { method: 'POST', body: { type: 6 } });
        return this._saveVariable(modalInteraction, user, flowId, { ...varData, defaultValue });
      }
    });

    const defaultLabel = varData.type === 'number' ? '0' : 'vazio';

    const blocks = [
      this.ui.cv2Text(
        `# 📦 Criar Variável — Passo 4 de 4 ${this._e('festa')}\n` +
        `**Quase lá! Resumo da variável:**\n` +
        `> 📛 **Nome:** \`${varData.name}\`\n` +
        `> 🏷️ **Escopo:** ${varData.scope === 'user' ? '👤 por usuário' : '🌐 do fluxo'}\n` +
        `> 📦 **Tipo:** ${varData.type}\n` +
        `> 💾 **Persistente:** ${varData.persistent ? 'Sim' : 'Não'}\n\n` +
        `**Valor padrão automático:** ${defaultsByType[varData.type]}\n` +
        `*Clique para personalizar o valor inicial ou use o padrão!*`
      ),
      this.ui.cv2Divider(),
      this.ui.row(
        this.ui.btn(user, '✏️ Definir valor personalizado', 1, async (i) => this.client.interactions.showModal(i, modal)),
        this.ui.btn(user, `✅ Usar padrão (${defaultLabel})`, 2, async (i) => {
          await this.ui.deferUpdate(i);
          const defaultValue = varData.type === 'number' ? 0 : '';
          return this._saveVariable(i, user, flowId, { ...varData, defaultValue });
        })
      ),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }

  async _varListDefaultModal(interaction, user, flowId, varData) {
    const modal = this.client.interactions.createModal({
      user,
      title: `📋 Itens Iniciais — ${varData.name}`,
      components: [{ type: 1, components: [{
        type: 4, custom_id: 'items', label: 'Itens separados por vírgula',
        style: 2, required: true, max_length: 1000,
        placeholder: 'Item 1, Item 2, Item 3\n\nCada item separado por vírgula!'
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

    if (vars.find(v => v.name === varData.name)) {
      return this.variablesMenu(interaction, user, flowId, {
        successMsg: `${this._e('emburrada')} Já existe uma variável chamada **${varData.name}**!`
      });
    }

    const { name, scope, type, persistent, defaultValue } = varData;
    vars.push({ name, type, defaultValue, persistent, scope });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { variables: vars });

    const defLabel = Array.isArray(defaultValue) ? `[${defaultValue.join(', ') || 'vazio'}]` : String(defaultValue ?? 'null');

    return this.variablesMenu(interaction, user, flowId, {
      successMsg:
        `${this._e('festa')} **Variável \`${name}\` criada!** Use com \`{var:${name}}\` nas ações.\n` +
        `Escopo: ${scope === 'user' ? '👤 por usuário' : '🌐 do fluxo'} • Tipo: ${type} • Valor inicial: \`${defLabel}\``
    });
  }



  async settingsMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow = await this._getFlow(interaction.guild_id, flowId);

    const btnCooldown = this.ui.btn(user, '⏱️ Cooldown', 2, i => this._setCooldown(i, user, flowId));
    const btnMode = this.ui.btn(
      user,
      flow.executionMode === 'parallel' ? '🔀 Modo: Paralelo' : '➡️ Modo: Sequencial',
      2,
      async (i) => {
        await this.ui.deferUpdate(i);
        const newMode = flow.executionMode === 'parallel' ? 'sequential' : 'parallel';
        await this.client.logicEngine.updateFlow(flowId, i.guild_id, { executionMode: newMode });
        return this.settingsMenu(i, user, flowId);
      }
    );
    const btnRename = this.ui.btn(user, '✏️ Renomear', 2, i => this._rename(i, user, flowId));
    const btnLogs = this.ui.btn(user, '📊 Ver logs', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this._showLogs(i, user, flowId);
    });
    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(
        `# ⚙️ Configurações do Fluxo ${this._e('sria')}\n` +
        (successMsg ? `${successMsg}\n\n` : '') +
        `**Nome:** ${flow.name}\n` +
        `**Descrição:** ${flow.description || '_Sem descrição_'}\n` +
        `**Modo de execução:** ${flow.executionMode === 'parallel' ? '🔀 Paralelo (ações ao mesmo tempo)' : '➡️ Sequencial (ações em ordem)'}\n` +
        `**Cooldown:** ${flow.cooldown > 0 ? `${formatDuration(flow.cooldown)} por usuário` : 'Nenhum'}\n` +
        `**Criado por:** ${flow.createdBy ? `<@${flow.createdBy}>` : 'N/A'}`
      ),
      this.ui.cv2Divider(),
      this.ui.row(btnCooldown, btnMode, btnRename),
      this.ui.row(btnLogs, btnBack, this._guideButton()),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.dark }));
  }

  async _setCooldown(interaction, user, flowId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const current = flow?.cooldown > 0 ? formatDuration(flow.cooldown) : '';

    const modal = this.client.interactions.createModal({
      user,
      title: '⏱️ Definir Cooldown',
      components: [
        this.ui.modalText('duration', 'Cooldown (ex: 24h, 22h 10m, 1d 5h, 0)', {
          required: true, maxLength: 30,
          placeholder: 'Ex: 24h • 22h 10m • 1d 5h 30m • 90m • 0 (sem cooldown)',
          value: current
        })
      ],
      funcao: async (modalInteraction, client, fields) => {
        const raw = fields.duration?.trim() || '0';
        const ms  = raw === '0' ? 0 : parseDuration(raw);

        if (raw !== '0' && ms === 0) {
          return DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, {
            method: 'POST', body: { type: 4, data: {
              content: `❌ Não entendi essa duração! ${this._e('emduvida')}\nUse algo como \`24h\`, \`22h 10m\`, \`1d 5h\` ou \`0\` para remover o cooldown.`,
              flags: 64
            }}
          });
        }

        await this.client.logicEngine.updateFlow(flowId, modalInteraction.guild_id, { cooldown: ms });
        await DiscordRequest(`/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`, { method: 'POST', body: { type: 6 } });

        return this.settingsMenu(modalInteraction, user, flowId, {
          successMsg: ms > 0
            ? `${this._e('feliz')} Cooldown definido: **${formatDuration(ms)}** por usuário.`
            : `${this._e('feliz')} Cooldown removido.`
        });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _rename(interaction, user, flowId) {
    const modal = this.client.interactions.createModal({
      user,
      title: '✏️ Renomear Fluxo',
      components: [
        { type: 1, components: [{ type: 4, custom_id: 'name',        label: 'Novo nome',      style: 1, required: true,  max_length: 100 }] },
        { type: 1, components: [{ type: 4, custom_id: 'description', label: 'Nova descrição', style: 2, required: false, max_length: 300 }] }
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

    const lines = logs.length
      ? logs.map(l => {
          const icon = l.result === 'success' ? '✅' : l.result === 'failed' ? '❌' : '⚠️';
          const ts   = new Date(l.runAt).toLocaleString('pt-BR');
          return `${icon} \`${ts}\` — ${l.duration}ms${l.error ? `\n  > ${l.error.slice(0, 80)}` : ''}`;
        }).join('\n')
      : `_Nenhuma execução registrada ainda ${this._e('sonolenta')}_`;

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.settingsMenu(i, user, flowId);
    });

    const blocks = [
      this.ui.cv2Text(`# 📊 Últimas Execuções ${this._e('emduvida')}\n${lines}\n\n*Logs são mantidos por 7 dias*`),
      this.ui.cv2Divider(),
      this.ui.row(btnBack),
    ];

    return this.ui.editOriginal(interaction, this._cv2(blocks, { accentColor: COLOR.main }));
  }


  async _getFlow(guildId, flowId) {
    return FlowModel.findOne({ flowId, guildId }).lean();
  }

  _uid() {
    return randomUUID().replace(/-/g, '').slice(0, 24);
  }

  _paramLabel(p) {
    const labels = {
      content: 'Conteúdo da mensagem', channelId: 'ID do canal', roleId: 'ID do cargo',
      reason: 'Motivo', duration: 'Duração (ex: 1h, 30m, 1d)', name: 'Nome', value: 'Valor',
      min: 'Valor mínimo', max: 'Valor máximo', saveAs: 'Salvar resultado em (variável)',
      seconds: 'Segundos', minutes: 'Minutos', emoji: 'Emoji', url: 'URL', method: 'Método HTTP',
      flowId: 'ID do fluxo', eventType: 'Tipo do evento', nickname: 'Novo nickname',
      ephemeral: 'Visível só para o usuário?', messageId: 'ID da mensagem',
      targetUserId: 'ID/menção do usuário alvo', timeout: 'Tempo limite (segundos)',
      cancelMessage: 'Mensagem se cancelar/expirar', baseValue: 'Valor base',
      progressionBase: 'Base de progressão', currentValue: 'Variável de progresso atual',
      removeComponents: 'Remover componentes?', varName: 'Nome da variável de ranking',
      title: 'Título do ranking', errorMsg: 'Mensagem de erro (opcional)',
      hour: 'Hora (0-23)', minute: 'Minuto (0-59)', percent: 'Chance (0-100)',
      length: 'Tamanho (número de caracteres)', pattern: 'Padrão regex', text: 'Texto',
      date: 'Data (AAAA-MM-DD)', from: 'De', to: 'Até', time: 'Horário (HH:MM)', days: 'Dias',
    };
    return labels[p] || p;
  }

  _paramPlaceholder(p) {
    const placeholders = {
      content: 'Olá {user}, bem-vindo(a)!', channelId: '123456789012345678 ou #canal',
      roleId: '123456789012345678 ou @cargo', reason: 'Motivo da ação...', duration: 'Ex: 1h, 30m, 1d',
      name: 'nome_da_variavel', value: '1 ou {arg0}', min: '0', max: '100',
      saveAs: 'resultado', seconds: '5', minutes: '5', emoji: '⭐ ou nome:id',
      url: 'https://...', method: 'GET, POST, PUT...', flowId: 'ID do fluxo a executar',
      eventType: 'nome_do_evento', nickname: 'Novo Nick', messageId: 'ID da mensagem',
      timeout: '60', baseValue: '10', progressionBase: '1.5', currentValue: 'nivel_atual',
      varName: 'pontos', title: '🏆 Ranking de Pontos', errorMsg: 'Uso incorreto! Use: !comando <arg>',
      hour: '14', minute: '30', percent: '50', length: '100', pattern: '^[a-z]+$',
      text: 'palavra-chave', date: '2026-12-31', time: '14:30',
    };
    return placeholders[p] || '';
  }
}

module.exports = FlowBuilder;
