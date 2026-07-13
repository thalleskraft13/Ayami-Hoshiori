'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const { FlowModel }  = require('../../../Mongodb/flow.js');
const { randomUUID } = require('crypto');
const getPerm        = require('../../Utils/GetPerm.js');
const holeHighter    = require('../../Utils/RoleHigher.js');
const { parseDuration, formatDuration } = require('./LogicEngine.js');

/* ─────────────────────────────────────────────
   EMOJIS DA AYAMI — client.emoji
   ───────────────────────────────────────────── */
// Usado como: AYAMI.feliz  →  "<:ayamifeliz:...>"
// (acesso real via this.client.emoji.<nome>)
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
  main:    0x7C8FFF,   // azul principal (hoodie/meias)
  gold:    0xFFD966,   // dourado (estrelas)
  dark:    0x243B7A,   // azul escuro (camiseta)
  hair:    0xA9D6FF,   // azul cabelo
  white:   0xFFFFFF,   // branco
  pink:    0xFFB6C8,   // bochechas
  danger:  0xED4245,   // vermelho Discord
  success: 0x57F287,   // verde Discord
};

/* ─────────────────────────────────────────────
   LINK DO GUIA
   ───────────────────────────────────────────── */
const GUIDE_URL = 'https://ayami-hoshiori.vercel.app/logic-builder';

/* ─────────────────────────────────────────────
   CATÁLOGOS — label e metadados de cada tipo
   ───────────────────────────────────────────── */

const TRIGGER_CATALOG = [
  { category: 'time',      type: 'scheduled_trigger',      label: '🕐 Horário agendado',      description: 'Dispara em um horário específico todo dia' },
  { category: 'command',   type: 'command_executed',        label: '🔧 Comando executado',      description: 'Disparado quando um comando personalizado é usado' },
  { category: 'message',   type: 'message_created',         label: '💬 Mensagem criada',        description: 'Qualquer mensagem enviada' },
  { category: 'message',   type: 'message_edited',          label: '✏️ Mensagem editada',        description: 'Mensagem editada por alguém' },
  { category: 'message',   type: 'message_deleted',         label: '🗑️ Mensagem apagada',        description: 'Mensagem deletada' },
  { category: 'message',   type: 'message_contains_text',   label: '🔍 Contém texto',            description: 'Mensagem com conteúdo específico' },
  { category: 'message',   type: 'message_contains_link',   label: '🔗 Contém link',             description: 'Mensagem com URL' },
  { category: 'message',   type: 'message_contains_image',  label: '🖼️ Contém imagem',           description: 'Mensagem com imagem anexada' },
  { category: 'message',   type: 'message_contains_file',   label: '📎 Contém arquivo',          description: 'Mensagem com arquivo anexado' },
  { category: 'message',   type: 'message_contains_mention',label: '📣 Contém menção',           description: 'Mensagem que menciona alguém' },
  { category: 'message',   type: 'message_contains_emoji',  label: '😀 Contém emoji',            description: 'Mensagem com emoji unicode' },
  { category: 'message',   type: 'message_contains_sticker',label: '🎭 Contém sticker',          description: 'Mensagem com sticker' },
  { category: 'reaction',  type: 'reaction_added',          label: '➕ Reação adicionada',       description: 'Alguém reagiu a uma mensagem' },
  { category: 'reaction',  type: 'reaction_removed',        label: '➖ Reação removida',         description: 'Reação foi removida' },
  { category: 'member',    type: 'member_joined',           label: '👋 Membro entrou',           description: 'Novo membro no servidor' },
  { category: 'member',    type: 'member_left',             label: '🚪 Membro saiu',             description: 'Membro saiu ou foi expulso' },
  { category: 'member',    type: 'member_banned',           label: '🔨 Membro banido',           description: 'Membro foi banido' },
  { category: 'member',    type: 'member_unbanned',         label: '✅ Membro desbanido',        description: 'Ban removido' },
  { category: 'member',    type: 'member_nick_changed',     label: '📝 Nickname alterado',       description: 'Membro mudou o apelido' },
  { category: 'channel',   type: 'channel_created',         label: '📁 Canal criado',            description: 'Novo canal no servidor' },
  { category: 'channel',   type: 'channel_deleted',         label: '❌ Canal apagado',           description: 'Canal foi deletado' },
  { category: 'channel',   type: 'channel_updated',         label: '🔧 Canal atualizado',        description: 'Canal teve configurações alteradas' },
  { category: 'voice',     type: 'voice_joined',            label: '🔊 Entrou em call',          description: 'Usuário entrou em canal de voz' },
  { category: 'voice',     type: 'voice_left',              label: '🔇 Saiu da call',            description: 'Usuário saiu de canal de voz' },
  { category: 'voice',     type: 'voice_moved',             label: '🔀 Mudou de call',           description: 'Usuário trocou de canal de voz' },
  { category: 'voice',     type: 'camera_on',               label: '📷 Câmera ligada',           description: 'Usuário ligou a câmera' },
  { category: 'voice',     type: 'camera_off',              label: '📷 Câmera desligada',        description: 'Usuário desligou a câmera' },
  { category: 'voice',     type: 'screen_share_start',      label: '🖥️ Tela compartilhada',      description: 'Usuário começou a compartilhar tela' },
  { category: 'voice',     type: 'screen_share_stop',       label: '🖥️ Tela parada',             description: 'Usuário parou de compartilhar' },
  { category: 'component', type: 'button_clicked',          label: '🖱️ Botão clicado',           description: 'Usuário clicou em um botão' },
  { category: 'component', type: 'select_used',             label: '📋 Select usado',            description: 'Usuário usou um select menu' },
  { category: 'component', type: 'modal_submitted',         label: '📝 Modal enviado',           description: 'Usuário enviou um modal' },
  { category: 'thread',    type: 'thread_created',          label: '🧵 Tópico criado',           description: 'Um novo tópico (thread) foi criado' },
  { category: 'thread',    type: 'thread_deleted',          label: '🧵 Tópico fechado',          description: 'Um tópico (thread) foi fechado/arquivado' },
  { category: 'member',    type: 'boost_added',             label: '🚀 Boost adicionado',        description: 'Membro começou a impulsionar o servidor' },
  { category: 'member',    type: 'boost_removed',           label: '💔 Boost removido',          description: 'Membro parou de impulsionar o servidor' },
  { category: 'internal',  type: 'custom_event',            label: '⚡ Evento customizado',      description: 'Disparado por outro fluxo' }
];

const CONDITION_CATALOG = [
  { category: 'user',        type: 'has_role',          label: '👤 Possui cargo',              params: ['roleId'] },
  { category: 'user',        type: 'not_has_role',       label: '👤 Não possui cargo',          params: ['roleId'] },
  { category: 'user',        type: 'is_bot',             label: '🤖 É bot',                     params: [] },
  { category: 'user',        type: 'not_bot',            label: '🧑 Não é bot',                 params: [] },
  { category: 'user',        type: 'is_boosting',        label: '🚀 Está impulsionando o servidor', params: [] },
  { category: 'user',        type: 'in_voice',           label: '🔊 Está em call',              params: [] },
  { category: 'user',        type: 'account_age_gt',     label: '📅 Conta criada há +X dias',   params: ['days'] },
  { category: 'user',        type: 'joined_gt',          label: '📅 Entrou há +X dias',         params: ['days'] },
  { category: 'channel',     type: 'is_channel',         label: '📌 Canal específico',          params: ['channelId'] },
  { category: 'channel',     type: 'not_channel',        label: '📌 Não é este canal',          params: ['channelId'] },
  { category: 'channel',     type: 'is_category',        label: '📂 Categoria específica',      params: ['categoryId'] },
  { category: 'channel',     type: 'is_thread_channel',  label: '🧵 Canal atual é um tópico',   params: [] },
  { category: 'message',     type: 'contains_text',      label: '🔍 Mensagem contém texto',     params: ['text'] },
  { category: 'message',     type: 'not_contains',       label: '🔍 Não contém texto',          params: ['text'] },
  { category: 'message',     type: 'contains_link',      label: '🔗 Contém link',               params: [] },
  { category: 'message',     type: 'length_gt',          label: '📏 Tamanho maior que X',       params: ['length'] },
  { category: 'message',     type: 'length_lt',          label: '📏 Tamanho menor que X',       params: ['length'] },
  { category: 'message',     type: 'matches_regex',      label: '🔤 Regex',                     params: ['pattern'] },
  { category: 'reaction',    type: 'bot_reacted',        label: '🤖 Bot reagiu na mensagem',    params: [] },
  { category: 'reaction',    type: 'bot_reacted_with',   label: '🤖 Bot reagiu com emoji',      params: ['emoji'] },
  { category: 'reaction',    type: 'reaction_is',        label: '😀 Reação é emoji específico', params: ['emoji'] },
  { category: 'time',        type: 'hour_eq',            label: '🕐 Hora igual a',              params: ['hour'] },
  { category: 'time',        type: 'minute_eq',          label: '🕐 Minuto igual a',            params: ['minute'] },
  { category: 'variable',    type: 'eq',                 label: '🔢 Variável igual a',          params: ['name', 'value'] },
  { category: 'variable',    type: 'neq',                label: '🔢 Variável diferente de',     params: ['name', 'value'] },
  { category: 'variable',    type: 'gt',                 label: '🔢 Variável maior que',        params: ['name', 'value'] },
  { category: 'variable',    type: 'lt',                 label: '🔢 Variável menor que',        params: ['name', 'value'] },
  { category: 'variable',    type: 'list_contains',      label: '📋 Lista contém valor',        params: ['name', 'value'] },
  { category: 'variable',    type: 'not_list_contains',  label: '📋 Lista não contém valor',    params: ['name', 'value'] },
  { category: 'variable',    type: 'progressive_goal',   label: '📈 Meta Progressiva',           params: ['currentValue', 'progressionBase', 'baseValue'] },
  { category: 'probability', type: 'chance',             label: '🎲 Chance %',                  params: ['percent'] },
  { category: 'date',        type: 'before',             label: '📅 Antes de data',             params: ['date'] },
  { category: 'date',        type: 'after',              label: '📅 Depois de data',            params: ['date'] },
  { category: 'date',        type: 'between',            label: '📅 Entre datas',               params: ['from', 'to'] },
  { category: 'time',        type: 'before',             label: '⏰ Antes de horário',          params: ['time'] },
  { category: 'time',        type: 'after',              label: '⏰ Depois de horário',         params: ['time'] },
  { category: 'time',        type: 'between',            label: '⏰ Entre horários',            params: ['from', 'to'] },
  { category: 'permission',  type: 'is_admin',           label: '🛡️ É administrador',           params: [] },
  { category: 'permission',  type: 'has_permission',     label: '🛡️ Tem permissão',             params: ['permSelect'] },
  // ── Args ────────────────────────────────────────────────────
  { category: 'args', type: 'args_has_content', label: '📝 Args tem conteúdo',          params: ['errorMsg'] },
  { category: 'args', type: 'arg_is_type',      label: '🔍 Arg X é tipo específico',   params: ['argSelect', 'errorMsg'] },
];

const ACTION_CATALOG = [
  { category: 'message',  type: 'send_message',        label: '💬 Enviar mensagem',               params: ['content', 'channelId', 'embedObj', 'interactionObj'] },
  { category: 'message',  type: 'send_dm',             label: '📩 Enviar DM',                     params: ['content', 'embedObj', 'interactionObj'] },
  { category: 'message',  type: 'reply_message',       label: '↩️ Responder mensagem',            params: ['content', 'ephemeral', 'embedObj', 'interactionObj'] },
  { category: 'message',  type: 'edit_interaction_message', label: '🖱️ Editar mensagem da interação', params: ['content', 'embedObj', 'removeComponents'] },
  { category: 'message',  type: 'delete_message',      label: '🗑️ Apagar mensagem',               params: [] },
  { category: 'message',  type: 'edit_message',        label: '✏️ Editar mensagem',               params: ['content'] },
  { category: 'message',  type: 'delete_bot_message',  label: '🗑️ Apagar mensagem do bot',        params: ['messageId', 'channelId'] },
  { category: 'system',   type: 'ask_confirm',         label: '❓ Pedir confirmação',             params: ['content', 'targetUserId', 'timeout', 'cancelMessage'] },
  { category: 'user',     type: 'give_role',           label: '🏷️ Dar cargo',                    params: ['roleId'] },
  { category: 'user',     type: 'remove_role',         label: '🏷️ Remover cargo',                params: ['roleId'] },
  { category: 'user',     type: 'give_temp_role',      label: '⏱️ Cargo temporário',             params: ['roleId', 'duration'] },
  { category: 'user',     type: 'toggle_role',         label: '🔄 Alternar cargo',               params: ['roleId'] },
  { category: 'user',     type: 'ban',                 label: '🔨 Banir usuário',                params: ['reason'] },
  { category: 'user',     type: 'kick',                label: '👢 Expulsar usuário',             params: [] },
  { category: 'user',     type: 'timeout',             label: '⏸️ Timeout',                      params: ['duration'] },
  { category: 'user',     type: 'remove_timeout',      label: '▶️ Remover timeout',              params: [] },
  { category: 'user',     type: 'change_nickname',     label: '📝 Alterar nickname',             params: ['nickname'] },
  { category: 'variable', type: 'set',                 label: '📦 Definir variável',             params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'set_user_var',        label: '📦 Definir var de usuário',       params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'add',                 label: '➕ Somar variável',               params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'sub',                 label: '➖ Subtrair variável',            params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'mul',                 label: '✖️ Multiplicar variável',         params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'div',                 label: '➗ Dividir variável',             params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'random',              label: '🎲 Valor aleatório',              params: ['name', 'min', 'max', 'targetUserId'] },
  { category: 'variable', type: 'push',                label: '➕ Adicionar à lista',            params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'remove_item',         label: '➖ Remover da lista (por valor)', params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'remove_index',        label: '🗑️ Remover da lista (por índice)',params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'random_from',         label: '🎲 Aleatório da lista',           params: ['name', 'saveAs', 'targetUserId'] },
  { category: 'variable', type: 'show_ranking',        label: '🏆 Mostrar Ranking',              params: ['varName', 'title', 'ephemeral'] },
  { category: 'time',     type: 'wait_seconds',        label: '⏱️ Aguardar segundos',            params: ['seconds'] },
  { category: 'time',     type: 'wait_minutes',        label: '⏱️ Aguardar minutos',             params: ['minutes'] },
  { category: 'discord',  type: 'add_reaction',        label: '😀 Adicionar reação',             params: ['emoji'] },
  { category: 'discord',  type: 'remove_reaction',     label: '😶 Remover reação',               params: ['emoji'] },
  { category: 'discord',  type: 'pin_message',         label: '📌 Fixar mensagem',               params: [] },
  { category: 'channel',  type: 'create_channel',      label: '📁 Criar canal',                  params: ['name'] },
  { category: 'channel',  type: 'delete_channel',      label: '❌ Apagar canal',                 params: ['channelId'] },
  { category: 'channel',  type: 'rename_channel',      label: '✏️ Renomear canal',               params: ['channelId', 'name'] },
  { category: 'channel',  type: 'lock_channel',        label: '🔒 Trancar canal',               params: ['channelId', 'roleId'] },
  { category: 'channel',  type: 'unlock_channel',      label: '🔓 Destrancar canal',            params: ['channelId', 'roleId'] },
  { category: 'thread',   type: 'create_public_thread',  label: '🧵 Criar tópico público',       params: ['channelId', 'name'] },
  { category: 'thread',   type: 'create_private_thread', label: '🔒 Criar tópico privado',       params: ['channelId', 'name'] },
  { category: 'thread',   type: 'add_thread_member',     label: '➕ Adicionar ao tópico',        params: ['threadTargetTypeSelect'] },
  { category: 'thread',   type: 'close_thread',          label: '🔐 Fechar tópico',              params: [] },
  { category: 'system',   type: 'run_flow',            label: '⚡ Executar fluxo',              params: ['flowId'] },
  { category: 'system',   type: 'emit_event',          label: '📡 Disparar evento',             params: ['eventType'] },
  { category: 'system',   type: 'cancel_flow',         label: '🛑 Cancelar fluxo',             params: [] },
  { category: 'system',   type: 'stop_execution',      label: '⏹️ Parar execução',              params: [] },
  { category: 'webhook',  type: 'send_webhook',        label: '🔗 Enviar webhook',              params: ['url', 'content'] },
  { category: 'webhook',  type: 'http_request',        label: '🌐 Requisição HTTP',             params: ['url', 'method'] }
];

/* ─────────────────────────────────────────────
   Quais params precisam de seleção de CANAL ou CARGO
   via select-menu (ao invés de digitar ID)
   ───────────────────────────────────────────── */
const NEEDS_CHANNEL_SELECT = ['channelId', 'categoryId'];
const NEEDS_ROLE_SELECT    = ['roleId'];

/* ─────────────────────────────────────────────
   Params opcionais (não obrigatórios no modal)
   ───────────────────────────────────────────── */
const OPTIONAL_PARAMS = [
  'reason', 'description', 'channelId', 'userId',
  'ephemeral', 'saveAs', 'messageId', 'embed', 'embedObj', 'interactionObj',
  'targetUserId', 'timeout', 'cancelMessage', 'baseValue', 'removeComponents'
];

/* ─────────────────────────────────────────────
   Params booleanos (sim/não) — usam Select Menu
   dentro do modal em vez de campo de texto livre
   ───────────────────────────────────────────── */
const BOOLEAN_PARAMS = {
  ephemeral:        { label: 'Mensagem visível só para o usuário?',     yes: '👁️ Sim — só ele(a) vê (ephemeral)',   no: '📢 Não — todo mundo vê',                default: 'false' },
  removeComponents: { label: 'Remover os botões/selects da mensagem?', yes: '🗑️ Sim — remove tudo (padrão)',       no: '✅ Não — mantém os componentes atuais', default: 'true'  },
};

/* ─────────────────────────────────────────────
   Params que NÃO entram no modal (resolvidos via select)
   ───────────────────────────────────────────── */
const NEEDS_ARG_SELECT    = ['argSelect'];
const NEEDS_PERM_SELECT   = ['permSelect'];
const NEEDS_THREAD_TARGET = ['threadTargetTypeSelect'];
const SKIP_IN_MODAL = [...NEEDS_CHANNEL_SELECT, ...NEEDS_ROLE_SELECT, ...NEEDS_ARG_SELECT, ...NEEDS_PERM_SELECT, ...NEEDS_THREAD_TARGET];

/* ─────────────────────────────────────────────
   FLOW BUILDER
   ───────────────────────────────────────────── */

class FlowBuilder {

  constructor(client, ui) {
    this.client = client;
    this.ui     = ui;
  }

  /* ── helper rápido para pegar emojis da Ayami ── */
  _e(name) {
    return this.client?.emoji?.[name] ?? AYAMI_FALLBACK[name] ?? '';
  }

  /* ── botão de link para o guia ── */
  _guideButton() {
    // Botão de link Discord (style 5) — não precisa de handler
    return {
      type:  2,
      style: 5,
      label: '📖 Guia do Logic Builder',
      url:   GUIDE_URL
    };
  }

  /* ═══════════════════════════════════════════
     CRIAR FLUXO
     ═══════════════════════════════════════════ */

  async startCreate(interaction, user) {
    const ayami = this._e('animada');
    const modal = this.client.interactions.createModal({
      user,
      title: 'Criar novo Fluxo ✨',
      components: [
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'name',
            label:       'Nome do fluxo',
            style:       1,
            required:    true,
            max_length:  100,
            placeholder: 'Ex: Boas-vindas, Anti-link, Daily...'
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'description',
            label:       'Descrição (opcional)',
            style:       2,
            required:    false,
            max_length:  300,
            placeholder: 'Descreva o que este fluxo vai fazer...'
          }]
        }
      ],
      funcao: async (modalInteraction, client, fields) => {
        const name = fields.name?.trim();
        if (!name) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: { content: `❌ Nome inválido! ${this._e('assustada')}`, flags: 64 } } }
          );
        }

        const flow = await this.client.logicEngine.createFlow({
          guildId:     modalInteraction.guild_id,
          name,
          description: fields.description?.trim() || '',
          trigger:     { category: 'message', type: 'message_created', filters: {} },
          createdBy:   user
        });

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this.triggerMenu(modalInteraction, user, flow.flowId);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ═══════════════════════════════════════════
     MENU: TRIGGER
     ═══════════════════════════════════════════ */

  async triggerMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    if (!flow) return this.ui.followUpEphemeral(interaction, { content: `❌ Fluxo não encontrado. ${this._e('assustada')}` });

    const selectRows = [];
    for (let i = 0; i < TRIGGER_CATALOG.length; i += 25) {
      const chunk = TRIGGER_CATALOG.slice(i, i + 25);
      const select = this.ui.select(
        user,
        chunk.map(a => ({ label: a.label.slice(0, 100), value: `${a.category}:${a.type}`, description: a.description?.slice(0, 100) })),
        `🎯 Escolher Trigger${TRIGGER_CATALOG.length > 25 ? ` (${Math.floor(i / 25) + 1})` : ''}`,
        async (i) => {
          await this.ui.deferUpdate(i);
          const [cat, typ] = i.data.values[0].split(':');
          return this._setTrigger(i, user, flowId, cat, typ);
        }
      );
      selectRows.push(this.ui.row(select));
    }

    const btnFilters = this.ui.btn(user, '🔧 Filtros', 2, async (i) => {
      return this._triggerFilters(i, user, flowId);
    });

    const btnBack = this.ui.btn(user, '⬅️ Voltar', 2, async (i) => {
      await this.ui.deferUpdate(i);
      return this.ui.flowMenu(i, user, flowId);
    });

    const current = this.ui._triggerLabel(flow.trigger);

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `🎯 Configurar Trigger ${this._e('pensando')}`,
        description:
          (successMsg ? `${successMsg}\n\n` : ``) +
          `**O que é um Trigger?** É o "gatilho" que faz seu fluxo começar!\n` +
          `Por exemplo: quando alguém entra no servidor, quando uma mensagem é enviada, etc.\n\n` +
          `**Trigger atual:** ${current}\n\n` +
          `Escolha abaixo qual evento vai disparar este fluxo:`,
        color:       COLOR.main,
        footer:      { text: `📖 Acesse o guia • ${GUIDE_URL}` }
      }],
      components: [
        ...selectRows,
        this.ui.row(btnFilters, btnBack, this._guideButton())
      ]
    });
  }

  async _setTrigger(interaction, user, flowId, category, type) {
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, {
      trigger: { category, type, filters: {} }
    });
    return this.triggerMenu(interaction, user, flowId, { successMsg: `${this._e('curtida')} Trigger definido: **${this.ui._triggerLabel({ category, type })}**` });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FILTROS DO TRIGGER — UI visual por categoria
     ══════════════════════════════════════════════════════════════════════════ */
  async _triggerFilters(interaction, user, flowId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    if (!flow) return;

    const { category, type } = flow.trigger;
    const filters = JSON.parse(JSON.stringify(flow.trigger.filters || {}));

    const saveFilters = async (i, newFilters) => {
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, {
        'trigger.filters': newFilters
      });
      return this.triggerMenu(i, user, flowId, { successMsg: `${this._e('feliz')} Filtros salvos!` });
    };

    switch (category) {
      case 'message':   return this._filterPanelMessage(interaction, user, flowId, type, filters, saveFilters);
      case 'reaction':  return this._filterPanelReaction(interaction, user, flowId, filters, saveFilters);
      case 'member':    return this._filterPanelMember(interaction, user, flowId, filters, saveFilters);
      case 'voice':     return this._filterPanelVoice(interaction, user, flowId, filters, saveFilters);
      case 'component': return this._filterPanelComponent(interaction, user, flowId, type, filters, saveFilters);
      case 'time':      return this._filterPanelTime(interaction, user, flowId, filters, saveFilters);
      default:
        return this.triggerMenu(interaction, user, flowId, {
          successMsg: `${this._e('pensando')} Este trigger não tem filtros configuráveis.`
        });
    }
  }

  // ── Filtros: Mensagem ──────────────────────────────────────────────────────
  async _filterPanelMessage(interaction, user, flowId, type, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [
        `> 📌 **Canal:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal_'}`,
        type === 'message_contains_text' ? `> 🔍 **Texto:** ${f.text ? `\`${f.text}\`` : '_qualquer texto_'}` : null,
        `> 👤 **Só humanos:** ${f.ignoreBots === 'true' ? 'Sim ✅' : 'Não ❌'}`,
        `> ⌨️ **Prefixo:** ${f.prefix ? `\`${f.prefix}\`` : '_sem filtro_'}`,
      ].filter(Boolean).join('\n');

      const chSel = this.client.interactions.createChannelSelect({
        user,
        data: { placeholder: '📌 Limitar a um canal (opcional)', channel_types: [0, 5] },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); }
      });

      const botsSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: `👤 Ignorar bots? Atual: ${f.ignoreBots === 'true' ? 'Sim' : 'Não'}`,
          options: [
            { label: 'Sim — só mensagens de pessoas', value: 'true',  emoji: { name: '✅' } },
            { label: 'Não — incluir bots também',     value: 'false', emoji: { name: '❌' } },
          ]
        },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); }
      });

      const rows = [this.ui.row(chSel), this.ui.row(botsSel)];

      if (type === 'message_contains_text') {
        const btnText = this.client.interactions.createButton({
          user, data: { label: f.text ? `✏️ Texto: "${f.text.slice(0, 20)}"` : '🔍 Definir texto obrigatório', style: 1 },
          funcao: async (bi) => {
            const modal = this.client.interactions.createModal({
              user, title: 'Filtro de Texto',
              components: [{ type: 1, components: [{
                type: 4, custom_id: 'text', label: 'A mensagem deve conter esse texto',
                style: 1, required: false, max_length: 200,
                placeholder: 'Ex: !ajuda, promoção, discord.gg',
                value: f.text || ''
              }]}],
              funcao: async (mi, _, fields) => {
                f.text = fields.text?.trim() || undefined;
                await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
                return renderPanel(mi, f);
              }
            });
            return this.client.interactions.showModal(bi, modal);
          }
        });
        rows.push(this.ui.row(btnText));
      }

      const btnPrefix = this.client.interactions.createButton({
        user, data: { label: f.prefix ? `✏️ Prefixo: "${f.prefix}"` : '⌨️ Filtrar por prefixo (opcional)', style: 2 },
        funcao: async (bi) => {
          const modal = this.client.interactions.createModal({
            user, title: 'Filtro de Prefixo',
            components: [{ type: 1, components: [{
              type: 4, custom_id: 'prefix', label: 'Disparar só se a mensagem começar com',
              style: 1, required: false, max_length: 10,
              placeholder: 'Ex: ! ou / ou $',
              value: f.prefix || ''
            }]}],
            funcao: async (mi, _, fields) => {
              f.prefix = fields.prefix?.trim() || undefined;
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderPanel(mi, f);
            }
          });
          return this.client.interactions.showModal(bi, modal);
        }
      });

      const btnClear = this.client.interactions.createButton({
        user, data: { label: '🗑️ Limpar tudo', style: 4 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); }
      });
      const btnSave = this.client.interactions.createButton({
        user, data: { label: '✅ Salvar filtros', style: 3 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); }
      });

      rows.push(this.ui.row(btnPrefix, btnClear, btnSave));

      return this.ui.editOriginal(i, {
        embeds: [{
          title: `🔧 Filtros — Mensagem ${this._e('pensando')}`,
          description:
            `Configure quando exatamente o trigger deve disparar:\n\n${lines}\n\n` +
            `${this._e('emduvida')} Filtros vazios = dispara em **qualquer** mensagem!`,
          color: COLOR.main
        }],
        components: rows
      });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Reação ────────────────────────────────────────────────────────
  async _filterPanelReaction(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [
        `> 📌 **Canal:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal_'}`,
        `> 😀 **Emoji:** ${f.emoji || '_qualquer emoji_'}`,
      ].join('\n');

      const chSel = this.client.interactions.createChannelSelect({
        user,
        data: { placeholder: '📌 Limitar a um canal (opcional)', channel_types: [0, 5] },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); }
      });

      const btnEmoji = this.client.interactions.createButton({
        user, data: { label: f.emoji ? `😀 Emoji: ${f.emoji}` : '😀 Filtrar por emoji (opcional)', style: 2 },
        funcao: async (bi) => {
          const modal = this.client.interactions.createModal({
            user, title: 'Filtro de Emoji',
            components: [{ type: 1, components: [{
              type: 4, custom_id: 'emoji', label: 'Só disparar para esse emoji',
              style: 1, required: false, max_length: 50,
              placeholder: 'Ex: ⭐ ou 🔥 ou o nome do emoji personalizado',
              value: f.emoji || ''
            }]}],
            funcao: async (mi, _, fields) => {
              f.emoji = fields.emoji?.trim() || undefined;
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderPanel(mi, f);
            }
          });
          return this.client.interactions.showModal(bi, modal);
        }
      });

      const btnClear = this.client.interactions.createButton({
        user, data: { label: '🗑️ Limpar', style: 4 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); }
      });
      const btnSave = this.client.interactions.createButton({
        user, data: { label: '✅ Salvar', style: 3 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); }
      });

      return this.ui.editOriginal(i, {
        embeds: [{
          title: `🔧 Filtros — Reação ${this._e('pensando')}`,
          description: `Configure quando o trigger deve disparar:\n\n${lines}`,
          color: COLOR.main
        }],
        components: [this.ui.row(chSel), this.ui.row(btnEmoji, btnClear, btnSave)]
      });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Membro ────────────────────────────────────────────────────────
  async _filterPanelMember(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [
        `> 🏷️ **Cargo:** ${f.roleId ? `<@&${f.roleId}>` : '_qualquer membro_'}`,
        `> 👤 **Só humanos:** ${f.ignoreBots === 'true' ? 'Sim ✅' : 'Não ❌'}`,
      ].join('\n');

      const roleSel = this.client.interactions.createRoleSelect({
        user,
        data: { placeholder: '🏷️ Limitar a membros com esse cargo (opcional)' },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.roleId = si.data.values[0]; return renderPanel(si, f); }
      });

      const botsSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: `👤 Ignorar bots? Atual: ${f.ignoreBots === 'true' ? 'Sim' : 'Não'}`,
          options: [
            { label: 'Sim — só eventos de pessoas reais', value: 'true',  emoji: { name: '✅' } },
            { label: 'Não — incluir bots também',         value: 'false', emoji: { name: '❌' } },
          ]
        },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); }
      });

      const btnClear = this.client.interactions.createButton({
        user, data: { label: '🗑️ Limpar', style: 4 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); }
      });
      const btnSave = this.client.interactions.createButton({
        user, data: { label: '✅ Salvar', style: 3 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); }
      });

      return this.ui.editOriginal(i, {
        embeds: [{
          title: `🔧 Filtros — Membro ${this._e('pensando')}`,
          description: `Configure quando o trigger deve disparar:\n\n${lines}`,
          color: COLOR.main
        }],
        components: [this.ui.row(roleSel), this.ui.row(botsSel), this.ui.row(btnClear, btnSave)]
      });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Voz ──────────────────────────────────────────────────────────
  async _filterPanelVoice(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const lines = [
        `> 🔊 **Canal de voz:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal de voz_'}`,
        `> 👤 **Só humanos:** ${f.ignoreBots === 'true' ? 'Sim ✅' : 'Não ❌'}`,
      ].join('\n');

      const chSel = this.client.interactions.createChannelSelect({
        user,
        data: { placeholder: '🔊 Limitar a um canal de voz (opcional)', channel_types: [2] },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); }
      });

      const botsSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: `👤 Ignorar bots? Atual: ${f.ignoreBots === 'true' ? 'Sim' : 'Não'}`,
          options: [
            { label: 'Sim — só eventos de pessoas reais', value: 'true',  emoji: { name: '✅' } },
            { label: 'Não — incluir bots também',         value: 'false', emoji: { name: '❌' } },
          ]
        },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.ignoreBots = si.data.values[0]; return renderPanel(si, f); }
      });

      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });

      return this.ui.editOriginal(i, {
        embeds: [{ title: `🔧 Filtros — Voz ${this._e('pensando')}`, description: `Configure quando o trigger deve disparar:\n\n${lines}`, color: COLOR.main }],
        components: [this.ui.row(chSel), this.ui.row(botsSel), this.ui.row(btnClear, btnSave)]
      });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Componente (botão/select/modal) ───────────────────────────────
  async _filterPanelComponent(interaction, user, flowId, type, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const typeLabel = type === 'button_clicked' ? 'Botão' : type === 'select_used' ? 'Select Menu' : 'Modal';
      const lines = [
        `> 🆔 **ID do ${typeLabel}:** ${f.customId ? `\`${f.customId}\`` : '_qualquer_'}`,
        `> 📌 **Canal:** ${f.channelId ? `<#${f.channelId}>` : '_qualquer canal_'}`,
      ].join('\n');

      const btnId = this.client.interactions.createButton({
        user, data: { label: f.customId ? `🆔 ID: "${f.customId.slice(0, 20)}"` : `🆔 Definir Custom ID do ${typeLabel}`, style: 1 },
        funcao: async (bi) => {
          const modal = this.client.interactions.createModal({
            user, title: `Custom ID — ${typeLabel}`,
            components: [{ type: 1, components: [{
              type: 4, custom_id: 'customId',
              label: `ID único do ${typeLabel} (vazio = qualquer)`,
              style: 1, required: false, max_length: 100,
              placeholder: 'Ex: btn_aceitar, select_cargo, modal_form',
              value: f.customId || ''
            }]}],
            funcao: async (mi, _, fields) => {
              f.customId = fields.customId?.trim() || undefined;
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderPanel(mi, f);
            }
          });
          return this.client.interactions.showModal(bi, modal);
        }
      });

      const chSel = this.client.interactions.createChannelSelect({
        user,
        data: { placeholder: '📌 Limitar a um canal (opcional)', channel_types: [0, 5] },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.channelId = si.data.values[0]; return renderPanel(si, f); }
      });

      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({ user, data: { label: '✅ Salvar', style: 3 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return saveFilters(bi, f); } });

      return this.ui.editOriginal(i, {
        embeds: [{
          title: `🔧 Filtros — ${typeLabel} ${this._e('pensando')}`,
          description:
            `O **Custom ID** é o identificador que você deu ao ${typeLabel} quando criou ele.\n` +
            `Se não lembrar, deixe vazio para disparar em qualquer ${typeLabel}.\n\n${lines}`,
          color: COLOR.main
        }],
        components: [this.ui.row(chSel), this.ui.row(btnId, btnClear, btnSave)]
      });
    };
    return renderPanel(interaction, filters);
  }

  // ── Filtros: Horário ──────────────────────────────────────────────────────
  async _filterPanelTime(interaction, user, flowId, filters, saveFilters) {
    const renderPanel = async (i, f) => {
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const lines = [
        `> 🕐 **Hora:** ${f.hour !== undefined ? `${String(f.hour).padStart(2, '0')}h` : '_não definida (obrigatório!)_'}`,
        `> ⏱️ **Minuto:** :${String(f.minute ?? 0).padStart(2, '0')}`,
        `> 📅 **Dias:** ${f.weekdays?.length ? f.weekdays.map(d => dayNames[d]).join(', ') : '_todos os dias_'}`,
      ].join('\n');

      const hourOpts1 = Array.from({ length: 12 }, (_, h) => ({
        label: `${String(h).padStart(2, '0')}:00`, value: String(h),
        description: h < 6 ? 'Madrugada' : 'Manhã'
      }));
      const hourOpts2 = Array.from({ length: 12 }, (_, h) => ({
        label: `${String(h + 12).padStart(2, '0')}:00`, value: String(h + 12),
        description: h + 12 < 18 ? 'Tarde' : 'Noite'
      }));

      const hourSel1 = this.client.interactions.createSelect({
        user, data: { placeholder: `🌅 Hora: 00h–11h — Atual: ${f.hour !== undefined && f.hour < 12 ? f.hour + 'h' : 'não selecionada'}`, options: hourOpts1 },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.hour = Number(si.data.values[0]); return renderPanel(si, f); }
      });
      const hourSel2 = this.client.interactions.createSelect({
        user, data: { placeholder: `🌆 Hora: 12h–23h — Atual: ${f.hour !== undefined && f.hour >= 12 ? f.hour + 'h' : 'não selecionada'}`, options: hourOpts2 },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.hour = Number(si.data.values[0]); return renderPanel(si, f); }
      });

      const minuteOpts = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => ({
        label: `:${String(m).padStart(2, '0')}`, value: String(m),
        description: m === 0 ? 'Na hora exata' : `${m} minutos após a hora`
      }));
      const minuteSel = this.client.interactions.createSelect({
        user, data: { placeholder: `⏱️ Minuto — Atual: :${String(f.minute ?? 0).padStart(2, '0')}`, options: minuteOpts },
        funcao: async (si) => { await this.ui.deferUpdate(si); f.minute = Number(si.data.values[0]); return renderPanel(si, f); }
      });

      const daysSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: '📅 Dias da semana (padrão = todos os dias)',
          min_values: 0, max_values: 7,
          options: [
            { label: 'Domingo',       value: '0', emoji: { name: '🌞' } },
            { label: 'Segunda-feira', value: '1', emoji: { name: '💼' } },
            { label: 'Terça-feira',   value: '2', emoji: { name: '💼' } },
            { label: 'Quarta-feira',  value: '3', emoji: { name: '💼' } },
            { label: 'Quinta-feira',  value: '4', emoji: { name: '💼' } },
            { label: 'Sexta-feira',   value: '5', emoji: { name: '🎉' } },
            { label: 'Sábado',        value: '6', emoji: { name: '🌟' } },
          ]
        },
        funcao: async (si) => {
          await this.ui.deferUpdate(si);
          f.weekdays = si.data.values.length ? si.data.values.map(Number) : undefined;
          return renderPanel(si, f);
        }
      });

      const btnClear = this.client.interactions.createButton({ user, data: { label: '🗑️ Limpar', style: 4 }, funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPanel(bi, {}); } });
      const btnSave  = this.client.interactions.createButton({
        user, data: { label: '✅ Salvar', style: 3 },
        funcao: async (bi) => {
          await this.ui.deferUpdate(bi);
          if (f.hour === undefined) {
            return this.ui.editOriginal(bi, {
              embeds: [{ title: `❌ Hora obrigatória`, description: `${this._e('brava')} Selecione a hora antes de salvar!`, color: COLOR.danger }],
              components: []
            });
          }
          return saveFilters(bi, f);
        }
      });

      return this.ui.editOriginal(i, {
        embeds: [{
          title: `🔧 Filtros — Horário Agendado ${this._e('pensando')}`,
          description:
            `Configure em que hora e dias o trigger vai disparar:\n\n${lines}\n\n` +
            `${this._e('emduvida')} A hora é obrigatória. O fuso horário é UTC.`,
          color: COLOR.main
        }],
        components: [
          this.ui.row(hourSel1),
          this.ui.row(hourSel2),
          this.ui.row(minuteSel),
          this.ui.row(daysSel),
          this.ui.row(btnClear, btnSave)
        ]
      });
    };
    return renderPanel(interaction, filters);
  }

  /* ═══════════════════════════════════════════
     MENU: CONDIÇÕES
     ═══════════════════════════════════════════ */

  async conditionsMenu(interaction, user, flowId, { successMsg } = {}) {
    const flow  = await this._getFlow(interaction.guild_id, flowId);
    if (!flow) return;

    const conds = flow.conditions || [];
    const lines = conds.length
      ? conds.map((c, i) => {
          const meta    = CONDITION_CATALOG.find(x => x.category === c.category && x.type === c.type);
          const opLabel = i === 0 ? '' : ` **(${c.operator})**`;
          const neg     = c.negate ? ' ~~(negado)~~' : '';
          return `\`${i + 1}.\`${opLabel} ${meta?.label || c.type}${neg}`;
        }).join('\n')
      : `_Nenhuma condição — fluxo sempre executa ${this._e('feliz')}_`;

    const selectRows = [];
    for (let i = 0; i < CONDITION_CATALOG.length; i += 25) {
      const chunk = CONDITION_CATALOG.slice(i, i + 25);
      const select = this.ui.select(
        user,
        chunk.map(a => ({ label: a.label.slice(0, 100), value: `${a.category}:${a.type}` })),
        `➕ Adicionar Condição${CONDITION_CATALOG.length > 25 ? ` (${Math.floor(i / 25) + 1})` : ''}`,
        async (i) => {
          const [cat, typ] = i.data.values[0].split(':');
          return this._addCondition(i, user, flowId, cat, typ);
        }
      );
      selectRows.push(this.ui.row(select));
    }

    // Select de edição de condição existente
    const editComponents = [];
    if (conds.length > 0) {
      const editSel = this.ui.select(
        user,
        conds.map((c, i) => {
          const meta = CONDITION_CATALOG.find(x => x.category === c.category && x.type === c.type);
          return { label: `✏️ ${i + 1}. ${meta?.label || c.type}`.slice(0, 100), value: c.id };
        }),
        '✏️ Editar condição existente',
        async (i) => {
          // SEM deferUpdate — _editConditionSelect abre modal via showModal
          const condId = i.data.values[0];
          return this._editConditionSelect(i, user, flowId, condId);
        }
      );
      editComponents.push(this.ui.row(editSel));
    }

    const btnRemove = this.ui.btn(user, '🗑️ Remover última', 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!conds.length) return;
      const updated = conds.slice(0, -1);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { conditions: updated });
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

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `🔍 Condições (${conds.length}) ${this._e('emduvida')}`,
        description:
          (successMsg ? `${successMsg}\n\n` : ``) +
          `**O que são condições?** São verificações que devem ser verdadeiras para o fluxo rodar!\n` +
          `Ex: "Só executa se o usuário tiver o cargo Membro" ou "Só se a mensagem contiver um link".\n\n` +
          `**Condições configuradas:**\n${lines}`,
        color:  COLOR.main,
        footer: { text: `📖 Acesse o guia • ${GUIDE_URL}` }
      }],
      components: [
        ...selectRows,
        ...editComponents,
        this.ui.row(btnRemove, btnClear, btnBack, this._guideButton())
      ]
    });
  }

  async _addCondition(interaction, user, flowId, category, type) {
    const meta = CONDITION_CATALOG.find(c => c.category === category && c.type === type);

    // Sem params — adiciona direto
    if (!meta?.params?.length) {
      await this.ui.deferUpdate(interaction);
      const flow  = await this._getFlow(interaction.guild_id, flowId);
      const conds = flow.conditions || [];
      conds.push({ id: this._uid(), category, type, params: {}, operator: 'AND', negate: false });
      await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { conditions: conds });
      return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('curtida')} Condição **${meta?.label}** adicionada!` });
    }

    // Verifica se precisa de canal/cargo via select
    const needsChannelOrRole = meta.params.some(p => SKIP_IN_MODAL.includes(p));
    const modalParams         = meta.params.filter(p => !SKIP_IN_MODAL.includes(p));

    // Só tem params de canal/cargo — pula modal, vai direto pro select
    if (modalParams.length === 0) {
      await this.ui.deferUpdate(interaction);
      return this._resolveSelectParams(interaction, user, flowId, meta, {}, 'condition');
    }

    // Tem params de texto — abre modal primeiro
    const components = modalParams.slice(0, 4).map(p => ({
      type: 1,
      components: [{
        type:        4,
        custom_id:   p,
        label:       this._paramLabel(p).slice(0, 45),
        style:       p === 'content' || p === 'reason' ? 2 : 1,
        required:    !OPTIONAL_PARAMS.includes(p),
        max_length:  200,
        placeholder: this._paramPlaceholder(p),
        value:       p === 'baseValue' ? '1000' : undefined
      }]
    }));

    // Campo de operador (AND/OR) + negação — agora como selects, não texto livre
    components.push(
      this.ui.modalSelect('_operator', 'Como combinar com a condição anterior?', [
        { label: '✅ E (AND) — as duas precisam ser verdadeiras', value: 'AND', default: true },
        { label: '🔀 OU (OR) — basta uma ser verdadeira',         value: 'OR' },
      ], { placeholder: 'AND ou OR (ignorado se for a 1ª condição)' }),
      this.ui.modalYesNo('_negate', 'Inverter o resultado desta condição?', {
        yesLabel:     '🔄 Sim — NÃO (ex: "NÃO tem o cargo")',
        noLabel:      '➡️ Não — normal',
        defaultValue: 'false'
      })
    );

    const modal = this.client.interactions.createModal({
      user,
      title: `Condição: ${meta.label.slice(0, 40)}`,
      components,
      funcao: async (modalInteraction, client, fields) => {
        const params = {};
        for (const p of modalParams) {
          if (fields[p] !== undefined) params[p] = fields[p];
        }

        params._operator = fields._operator === 'OR' ? 'OR' : 'AND';
        params._negate   = fields._negate === 'true';

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        // Se ainda precisa de canal/cargo, vai pro select
        if (needsChannelOrRole) {
          return this._resolveSelectParams(modalInteraction, user, flowId, meta, params, 'condition');
        }

        // Senão salva direto
        return this._saveCondition(modalInteraction, user, flowId, category, type, params);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _saveCondition(interaction, user, flowId, category, type, params) {
    const meta     = CONDITION_CATALOG.find(c => c.category === category && c.type === type);
    const operator = params._operator || 'AND';
    const negate   = params._negate   || false;
    delete params._operator;
    delete params._negate;

    const flow  = await this._getFlow(interaction.guild_id, flowId);
    const conds = flow.conditions || [];
    conds.push({ id: this._uid(), category, type, params, operator, negate });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { conditions: conds });

    return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('curtida')} Condição **${meta?.label}** adicionada!` });
  }

  /* ─── Editar condição existente ─── */

  async _editConditionSelect(interaction, user, flowId, condId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const cond = (flow.conditions || []).find(c => c.id === condId);
    if (!cond) return this.conditionsMenu(interaction, user, flowId);

    const meta = CONDITION_CATALOG.find(c => c.category === cond.category && c.type === cond.type);

    // Monta preview dos valores atuais
    const currentVals = Object.entries(cond.params || {})
      .map(([k, v]) => `**${this._paramLabel(k)}:** \`${v}\``)
      .join('\n') || '_Sem parâmetros_';

    // Apenas abre o modal direto, sem followUp extra

    // Reabre o fluxo de adição para essa condição, passando os valores existentes
    return this._openEditConditionModal(interaction, user, flowId, cond, meta);
  }

  async _openEditConditionModal(interaction, user, flowId, cond, meta) {
    if (!meta?.params?.length) {
      return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('emduvida')} Esta condição não tem parâmetros para editar!` });
    }

    const modalParams = meta.params.filter(p => !SKIP_IN_MODAL.includes(p));
    if (!modalParams.length) {
      // Só tem canal/cargo, vai pro select
      return this._resolveSelectParams(interaction, user, flowId, meta, { _condId: cond.id }, 'condition_edit');
    }

    const components = modalParams.slice(0, 4).map(p => ({
      type: 1,
      components: [{
        type:        4,
        custom_id:   p,
        label:       this._paramLabel(p).slice(0, 45),
        style:       p === 'content' || p === 'reason' ? 2 : 1,
        required:    false,
        max_length:  200,
        placeholder: this._paramPlaceholder(p),
        value:       String(cond.params?.[p] ?? (p === 'baseValue' ? '1000' : ''))
      }]
    }));

    components.push(
      this.ui.modalSelect('_operator', 'Como combinar com a condição anterior?', [
        { label: '✅ E (AND) — as duas precisam ser verdadeiras', value: 'AND', default: (cond.operator || 'AND') === 'AND' },
        { label: '🔀 OU (OR) — basta uma ser verdadeira',         value: 'OR',  default: cond.operator === 'OR' },
      ], { placeholder: 'AND ou OR (ignorado se for a 1ª condição)' }),
      this.ui.modalYesNo('_negate', 'Inverter o resultado desta condição?', {
        yesLabel:     '🔄 Sim — NÃO (ex: "NÃO tem o cargo")',
        noLabel:      '➡️ Não — normal',
        defaultValue: cond.negate ? 'true' : 'false'
      })
    );

    const modal = this.client.interactions.createModal({
      user,
      title: `Editar: ${meta.label.slice(0, 40)}`,
      components,
      funcao: async (modalInteraction, client, fields) => {
        const params = { ...cond.params };
        for (const p of modalParams) {
          if (fields[p] !== undefined && fields[p].trim() !== '') {
            params[p] = fields[p].trim();
          }
        }
        const operator = fields._operator === 'OR' ? 'OR' : 'AND';
        const negate   = fields._negate === 'true';

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        const needsSelect = meta.params.some(p => SKIP_IN_MODAL.includes(p));
        if (needsSelect) {
          params._condId    = cond.id;
          params._operator  = operator;
          params._negate    = negate;
          return this._resolveSelectParams(modalInteraction, user, flowId, meta, params, 'condition_edit');
        }

        return this._applyConditionEdit(modalInteraction, user, flowId, cond.id, params, operator, negate);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _applyConditionEdit(interaction, user, flowId, condId, params, operator, negate) {
    const flow  = await this._getFlow(interaction.guild_id, flowId);
    const conds = (flow.conditions || []).map(c => {
      if (c.id !== condId) return c;
      return { ...c, params, operator, negate };
    });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { conditions: conds });
    return this.conditionsMenu(interaction, user, flowId, { successMsg: `${this._e('feliz')} Condição atualizada!` });
  }

  /* ═══════════════════════════════════════════
     MENU: AÇÕES
     ═══════════════════════════════════════════ */

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

    const selectRows = [];
    for (let i = 0; i < ACTION_CATALOG.length; i += 25) {
      const chunk = ACTION_CATALOG.slice(i, i + 25);
      const select = this.ui.select(
        user,
        chunk.map(a => ({ label: a.label.slice(0, 100), value: `${a.category}:${a.type}` })),
        `➕ Adicionar Ação${ACTION_CATALOG.length > 25 ? ` (${Math.floor(i / 25) + 1})` : ''}`,
        async (i) => {
          const [cat, typ] = i.data.values[0].split(':');
          return this._addAction(i, user, flowId, cat, typ);
        }
      );
      selectRows.push(this.ui.row(select));
    }

    // Select de edição de ação existente
    const editComponents = [];
    if (actions.length > 0) {
      const sorted = [...actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const editSel = this.ui.select(
        user,
        sorted.map((a, i) => {
          const meta = ACTION_CATALOG.find(x => x.category === a.category && x.type === a.type);
          return { label: `✏️ ${i + 1}. ${meta?.label || a.type}`.slice(0, 100), value: a.id };
        }),
        '✏️ Editar ação existente',
        async (i) => {
          // NÃO deferUpdate aqui — _editActionSelect abre modal via showModal
          // e modal não pode ser aberto após a interação já ter sido acknowledged
          return this._editActionSelect(i, user, flowId, i.data.values[0]);
        }
      );
      editComponents.push(this.ui.row(editSel));
    }

    const btnRemove = this.ui.btn(user, '🗑️ Remover última', 4, async (i) => {
      await this.ui.deferUpdate(i);
      if (!actions.length) return;
      const sorted  = [...actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const updated = sorted.slice(0, -1);
      await this.client.logicEngine.updateFlow(flowId, i.guild_id, { actions: updated });
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

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `⚡ Ações (${actions.length}) ${this._e('animada')}`,
        description:
          (successMsg ? `${successMsg}\n\n` : ``) +
          `**O que são ações?** São as coisas que o fluxo vai fazer quando disparar!\n` +
          `Ex: "Enviar uma mensagem de boas-vindas", "Dar o cargo Membro", "Banir o usuário", etc.\n\n` +
          `**Ações configuradas (em ordem):**\n${lines}`,
        color:  COLOR.main,
        footer: { text: `📖 Acesse o guia • ${GUIDE_URL}` }
      }],
      components: [
        ...selectRows,
        ...editComponents,
        this.ui.row(btnRemove, btnClear, btnBack, this._guideButton())
      ]
    });
  }

  async _addAction(interaction, user, flowId, category, type) {
    const meta = ACTION_CATALOG.find(a => a.category === category && a.type === type);

    // Sem params — adiciona imediatamente
    if (!meta?.params?.length) {
      await this.ui.deferUpdate(interaction);
      const flow    = await this._getFlow(interaction.guild_id, flowId);
      const actions = flow.actions || [];
      actions.push({ id: this._uid(), category, type, params: {}, order: actions.length });
      await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { actions });
      return this.actionsMenu(interaction, user, flowId, { successMsg: `${this._e('curtida')} Ação **${meta?.label}** adicionada!` });
    }

    // Params que vão no modal (sem canal/cargo/embed)
    const modalParams = meta.params.filter(p => !SKIP_IN_MODAL.includes(p) && p !== 'embed' && p !== 'embedObj');
    const hasEmbedObj = meta.params.includes('embedObj');
    const needsSelect = meta.params.some(p => SKIP_IN_MODAL.includes(p));

    // Modal com os params de texto (embed é tratado depois pelo builder)
    if (modalParams.length > 0) {
      return this._openActionModal(interaction, user, flowId, meta, null, modalParams, false, needsSelect, hasEmbedObj);
    }

    // Sem params de texto mas tem embedObj — vai direto pro ask
    if (hasEmbedObj) {
      return this._askEmbedOrSave(interaction, user, flowId, meta, {}, false, null, needsSelect);
    }

    // Só precisa de canal/cargo — vai direto pro select
    await this.ui.deferUpdate(interaction);
    return this._resolveSelectParams(interaction, user, flowId, meta, {}, 'action');
  }

  async _openActionModal(interaction, user, flowId, meta, existingAction, modalParams, _unused, needsSelect, hasEmbedObj = false) {
    const isEdit     = !!existingAction;
    const components = [];

    // Params textuais
    for (const p of modalParams.slice(0, 4)) {
      if (BOOLEAN_PARAMS[p]) {
        const cfg = BOOLEAN_PARAMS[p];
        const curVal = isEdit ? String(existingAction.params?.[p] ?? cfg.default) : cfg.default;
        components.push(this.ui.modalYesNo(p, cfg.label, {
          yesLabel:     cfg.yes,
          noLabel:      cfg.no,
          defaultValue: curVal === 'true' ? 'true' : 'false'
        }));
        continue;
      }

      components.push({
        type: 1,
        components: [{
          type:        4,
          custom_id:   p,
          label:       p === 'content' && meta.type === 'edit_interaction_message'
                         ? 'Novo conteúdo (vazio = mantém o atual)'
                         : this._paramLabel(p).slice(0, 45),
          style:       p === 'content' || p === 'reason' ? 2 : 1,
          required:    !OPTIONAL_PARAMS.includes(p) && !(p === 'content' && meta.type === 'edit_interaction_message'),
          max_length:  p === 'content' ? 4000 : 200,
          placeholder: this._paramPlaceholder(p),
          value:       isEdit ? String(existingAction.params?.[p] ?? '') : undefined
        }]
      });
    }

    // embedObj é tratado pelo builder visual, não por campo no modal

    const modal = this.client.interactions.createModal({
      user,
      title: `${isEdit ? '✏️ Editar' : '➕'} Ação: ${meta.label.slice(0, 35)}`,
      components,
      funcao: async (modalInteraction, client, fields) => {
        const params = isEdit ? { ...existingAction.params } : {};

        for (const p of modalParams) {
          const val = fields[p];
          if (val === undefined) continue;
          if (isEdit && val.trim() === '' && OPTIONAL_PARAMS.includes(p)) continue;
          params[p] = val;
        }

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        // Se precisa de embed builder
        if (hasEmbedObj) {
          return this._askEmbedOrSave(modalInteraction, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }

        // Se precisa de canal/cargo, vai pro select
        if (needsSelect && !isEdit) {
          return this._resolveSelectParams(modalInteraction, user, flowId, meta, params, 'action');
        }

        // Se é edição com canal/cargo
        if (needsSelect && isEdit) {
          params._actionId = existingAction.id;
          return this._resolveSelectParams(modalInteraction, user, flowId, meta, params, 'action_edit');
        }

        // Salva direto
        if (isEdit) {
          return this._applyActionEdit(modalInteraction, user, flowId, existingAction.id, params);
        }
        return this._saveAction(modalInteraction, user, flowId, meta.category, meta.type, params);
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EMBED BUILDER integrado ao FlowBuilder
  // Pergunta se quer embed, abre o builder e salva no params.embedObj
  // ══════════════════════════════════════════════════════════════════════════

  async _askEmbedOrSave(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const existingEmbed = params.embedObj ?? existingAction?.params?.embedObj ?? null;
    const hasEmbed      = !!existingEmbed;

    const btnSim = this.client.interactions.createButton({
      user,
      data: { label: hasEmbed ? '✏️ Editar embed' : '✨ Criar embed', style: 1 },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
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

    const buttons = hasEmbed ? [btnSim, btnNao] : [btnSim, btnNao];

    // Também mostra botão "manter" se já tem embed e é edição
    const rows = [this.ui.row(...buttons)];
    if (hasEmbed && isEdit) {
      const btnManter = this.client.interactions.createButton({
        user,
        data: { label: '✅ Manter embed atual', style: 3 },
        funcao: async (i) => {
          await this.ui.deferUpdate(i);
          params.embedObj = existingEmbed;
          return this._afterEmbedDecision(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
      });
      rows[0] = this.ui.row(btnSim, btnNao, btnManter);
    }

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `${this._e('emduvida')} Adicionar embed à mensagem?`,
        description:
          hasEmbed
            ? `${this._e('animada')} Essa ação já tem uma embed configurada!\n\n> **Você quer editar, remover ou manter a embed atual?**`
            : `${this._e('pensando')} Você quer adicionar uma **embed** à mensagem?\n\n` +
              `Embeds deixam a mensagem bem mais bonita — têm título, descrição, cor, imagem, fields e muito mais! ${this._e('feliz')}`,
        color:  COLOR.main
      }],
      components: rows
    });
  }

  async _afterEmbedDecision(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    // Só pergunta sobre interação se a ação suporta (tem 'interactionObj' no catálogo)
    if (meta.params.includes('interactionObj') && params._skipInteractionAsk !== true) {
      return this._askInteractionOrFinish(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect);
    }
    return this._continueAfterMessageExtras(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect);
  }

  async _continueAfterMessageExtras(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    if (needsSelect && !isEdit) {
      return this._resolveSelectParams(interaction, user, flowId, meta, params, 'action');
    }
    if (needsSelect && isEdit) {
      params._actionId = existingAction.id;
      return this._resolveSelectParams(interaction, user, flowId, meta, params, 'action_edit');
    }
    if (isEdit) {
      return this._applyActionEdit(interaction, user, flowId, existingAction.id, params);
    }
    return this._saveAction(interaction, user, flowId, meta.category, meta.type, params);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INTERAÇÃO (Botão / Select vinculado a outro fluxo) — painel embutido
     ══════════════════════════════════════════════════════════════════════════ */

  async _askInteractionOrFinish(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const existing  = params.interactionObj ?? existingAction?.params?.interactionObj ?? null;
    const hasExisting = !!existing;

    const btnSim = this.client.interactions.createButton({
      user,
      data: { label: hasExisting ? '✏️ Editar interação' : '⚡ Adicionar interação', style: 1 },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        return this._showInteractionTypeSelect(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
      }
    });

    const btnNao = this.client.interactions.createButton({
      user,
      data: { label: hasExisting ? '🗑️ Remover interação' : '⏭️ Sem interação', style: hasExisting ? 4 : 2 },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        delete params.interactionObj;
        return this._continueAfterMessageExtras(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
      }
    });

    const rows = [this.ui.row(btnSim, btnNao)];
    if (hasExisting) {
      const btnManter = this.client.interactions.createButton({
        user, data: { label: '✅ Manter atual', style: 3 },
        funcao: async (i) => {
          await this.ui.deferUpdate(i);
          params.interactionObj = existing;
          return this._continueAfterMessageExtras(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
      });
      rows[0] = this.ui.row(btnSim, btnNao, btnManter);
    }

    const previewLine = hasExisting
      ? (existing.kind === 'button'
          ? `🔘 Botão **"${existing.label}"** → dispara um fluxo`
          : `📋 Select com **${existing.options?.length || 0}** opção(ões) → cada uma dispara um fluxo`)
      : '_nenhuma interação configurada_';

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `⚡ Adicionar Interação? ${this._e('emduvida')}`,
        description:
          `${this._e('pensando')} Você quer que a mensagem tenha um **botão** ou **select menu** que dispare outro fluxo?\n\n` +
          `**Atual:** ${previewLine}\n\n` +
          `*Útil para criar menus, painéis de ticket, confirmar ações e mais!*`,
        color: COLOR.main
      }],
      components: rows
    });
  }

  async _showInteractionTypeSelect(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    const typeSel = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: '⚡ Tipo de interação',
        options: [
          { label: '🔘 Botão',       value: 'button', description: 'Um único botão que dispara um fluxo' },
          { label: '📋 Select Menu', value: 'select', description: 'Várias opções, cada uma dispara um fluxo diferente' },
        ]
      },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        if (i.data.values[0] === 'button') {
          return this._buildInteractionButton(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
        return this._buildInteractionSelect(i, user, flowId, meta, params, isEdit, existingAction, needsSelect, []);
      }
    });

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `⚡ Tipo de Interação ${this._e('emduvida')}`,
        description: `${this._e('pensando')} A mensagem deve ter um botão ou um select menu?`,
        color: COLOR.main
      }],
      components: [this.ui.row(typeSel)]
    });
  }

  /* ── Botão vinculado a fluxo ── */
  async _buildInteractionButton(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect) {
    // Só fluxos cujo trigger é "Botão clicado" aparecem na lista
    const flows = await FlowModel.find({
      guildId:       interaction.guild_id,
      enabled:       true,
      'trigger.type': 'button_clicked'
    }).lean();

    if (!flows.length) {
      return this.ui.editOriginal(interaction, {
        embeds: [{
          title:       `❌ Nenhum fluxo disponível`,
          description:
            `${this._e('emduvida')} Não encontrei nenhum fluxo ativo com trigger **🖱️ Botão clicado**.\n\n` +
            `Crie um fluxo com esse trigger primeiro, depois volte aqui para vincular o botão!`,
          color: COLOR.danger
        }],
        components: [this.ui.row(
          this.ui.btn(user, '◀ Voltar', 2, async (i) => {
            await this.ui.deferUpdate(i);
            return this._askInteractionOrFinish(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
          })
        )]
      });
    }

    return this._showFlowPicker(interaction, user, flows, 0, async (si, pickedFlowId) => {
      const cur = params.interactionObj || {};

      const modal = this.client.interactions.createModal({
        user,
        title: 'Configurar Botão',
        components: [
          this.ui.modalText('label', 'Texto do botão', {
            required: true, maxLength: 80, value: cur.label || ''
          }),
          this.ui.modalSelect('style', 'Cor do botão', [
            { label: '🔵 Azul (primário)',    value: '1', default: !cur.style || cur.style === 1 },
            { label: '⚪ Cinza (secundário)',  value: '2', default: cur.style === 2 },
            { label: '🟢 Verde (sucesso)',     value: '3', default: cur.style === 3 },
            { label: '🔴 Vermelho (perigo)',   value: '4', default: cur.style === 4 },
          ], { placeholder: 'Escolha a cor' }),
          this.ui.modalText('emoji', 'Emoji (opcional)', {
            required: false, maxLength: 50, value: cur.emoji || ''
          }),
          this.ui.modalYesNo('permanent', 'Botão permanente?', {
            yesLabel:    '♾️ Sim — nunca expira (recomendado para painéis fixos)',
            noLabel:     '⏳ Não — temporário, expira após um tempo',
            defaultValue: cur.permanent === false ? 'false' : 'true',
            placeholder: 'Permanente ou temporário?'
          }),
        ],
        funcao: async (mi, _, fields) => {
          const style = [1, 2, 3, 4].includes(Number(fields.style)) ? Number(fields.style) : 1;
          params.interactionObj = {
            kind:      'button',
            label:     fields.label?.trim() || 'Clique aqui',
            style,
            emoji:     fields.emoji?.trim() || '',
            permanent: fields.permanent !== 'false', // padrão: permanente
            flowId:    pickedFlowId
          };
          await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
          return this._continueAfterMessageExtras(mi, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
      });
      return this.client.interactions.showModal(si, modal);
    });
  }

  /* ── Select Menu vinculado a fluxos (cada opção = um fluxo) ── */
  async _buildInteractionSelect(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect, options) {
    const flows = await FlowModel.find({
      guildId:       interaction.guild_id,
      enabled:       true,
      'trigger.type': 'select_used'
    }).lean();

    const renderPanel = async (i, opts) => {
      if (!flows.length && !opts.length) {
        return this.ui.editOriginal(i, {
          embeds: [{
            title:       `❌ Nenhum fluxo disponível`,
            description:
              `${this._e('emduvida')} Não encontrei nenhum fluxo ativo com trigger **📋 Select usado**.\n\n` +
              `Crie um fluxo com esse trigger primeiro, depois volte aqui!`,
            color: COLOR.danger
          }],
          components: [this.ui.row(
            this.ui.btn(user, '◀ Voltar', 2, async (bi) => {
              await this.ui.deferUpdate(bi);
              return this._askInteractionOrFinish(bi, user, flowId, meta, params, isEdit, existingAction, needsSelect);
            })
          )]
        });
      }

      const lines = opts.length
        ? opts.map((o, idx) => `**${idx + 1}.** ${o.emoji || '▪️'} ${o.label}`).join('\n')
        : '_nenhuma opção adicionada ainda_';

      const menuSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: `📋 Gerenciar opções (${opts.length}/25)`,
          options: [
            { label: '➕ Adicionar opção', value: 'add', description: `${opts.length}/25` },
            ...(opts.length ? [{ label: '🗑️ Remover última opção', value: 'remove_last' }] : []),
            { label: '✏️ Editar placeholder', value: 'placeholder', description: params.interactionObj?.placeholder || 'Escolha uma opção' },
          ]
        },
        funcao: async (si) => {
          const action = si.data.values[0];

          if (action === 'remove_last') {
            opts.pop();
            await this.ui.deferUpdate(si);
            return renderPanel(si, opts);
          }

          if (action === 'placeholder') {
            const modal = this.client.interactions.createModal({
              user, title: 'Placeholder do Select',
              components: [{ type: 1, components: [{
                type: 4, custom_id: 'ph', label: 'Texto exibido antes de escolher',
                style: 1, required: false, max_length: 150,
                value: params.interactionObj?.placeholder || ''
              }]}],
              funcao: async (mi, _, fields) => {
                params._tempPlaceholder = fields.ph?.trim() || '';
                await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
                return renderPanel(mi, opts);
              }
            });
            return this.client.interactions.showModal(si, modal);
          }

          if (action === 'add') {
            if (opts.length >= 25) return renderPanel(si, opts);
            if (!flows.length) return renderPanel(si, opts);

            return this._showFlowPicker(si, user, flows, 0, async (fsi, pickedFlowId) => {
              const modal = this.client.interactions.createModal({
                user, title: 'Nova Opção',
                components: [
                  { type: 1, components: [{ type: 4, custom_id: 'label',       label: 'Label da opção',       style: 1, required: true,  max_length: 100 }] },
                  { type: 1, components: [{ type: 4, custom_id: 'description', label: 'Descrição (opcional)', style: 1, required: false, max_length: 100 }] },
                  { type: 1, components: [{ type: 4, custom_id: 'emoji',       label: 'Emoji (opcional)',     style: 1, required: false, max_length: 50  }] },
                ],
                funcao: async (mi, _, fields) => {
                  opts.push({
                    label:       fields.label?.trim() || 'Opção',
                    description: fields.description?.trim() || '',
                    emoji:       fields.emoji?.trim() || '',
                    flowId:      pickedFlowId
                  });
                  await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
                  return renderPanel(mi, opts);
                }
              });
              return this.client.interactions.showModal(fsi, modal);
            });
          }
        }
      });

      const btnDone = this.client.interactions.createButton({
        user, data: { label: '✅ Concluir', style: 3 },
        funcao: async (bi) => {
          await this.ui.deferUpdate(bi);
          if (!opts.length) return renderPanel(bi, opts);
          params.interactionObj = {
            kind:        'select',
            id:          'fb_' + this._uid().slice(0, 8),
            placeholder: params._tempPlaceholder || params.interactionObj?.placeholder || 'Escolha uma opção',
            options:     opts
          };
          delete params._tempPlaceholder;
          return this._continueAfterMessageExtras(bi, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
      });

      const btnCancel = this.client.interactions.createButton({
        user, data: { label: '◀ Voltar', style: 2 },
        funcao: async (bi) => {
          await this.ui.deferUpdate(bi);
          return this._askInteractionOrFinish(bi, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
      });

      return this.ui.editOriginal(i, {
        embeds: [{
          title:       `📋 Configurar Select Menu ${this._e('pensando')}`,
          description:
            `Adicione opções — cada uma dispara um fluxo diferente quando escolhida!\n\n${lines}`,
          color: COLOR.main
        }],
        components: [this.ui.row(menuSel), this.ui.row(btnDone, btnCancel)]
      });
    };

    const initialOpts = options.length ? options : (params.interactionObj?.options ? [...params.interactionObj.options] : []);
    return renderPanel(interaction, initialOpts);
  }

  /**
   * Picker paginado de fluxos (25 por página) — reutilizado por botão e select.
   */
  async _showFlowPicker(interaction, user, flows, page, onPick) {
    const PAGE_SIZE = 25;
    const pages     = Math.ceil(flows.length / PAGE_SIZE);
    const slice     = flows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const flowSel = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: `⚡ Escolha o fluxo (página ${page + 1}/${pages})`,
        options: slice.map(f => ({
          label:       f.name.slice(0, 100),
          value:       f.flowId,
          description: f.description?.slice(0, 100) || `Trigger: ${f.trigger?.type}`
        }))
      },
      funcao: async (si) => onPick(si, si.data.values[0])
    });

    const navBtns = [];
    if (page > 0) {
      navBtns.push(this.client.interactions.createButton({
        user, data: { label: '◀ Anterior', style: 2 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return this._showFlowPicker(bi, user, flows, page - 1, onPick); }
      }));
    }
    if (page < pages - 1) {
      navBtns.push(this.client.interactions.createButton({
        user, data: { label: 'Próxima ▶', style: 2 },
        funcao: async (bi) => { await this.ui.deferUpdate(bi); return this._showFlowPicker(bi, user, flows, page + 1, onPick); }
      }));
    }

    const rows = [this.ui.row(flowSel)];
    if (navBtns.length) rows.push(this.ui.row(...navBtns));

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `⚡ Selecionar Fluxo ${this._e('emduvida')}`,
        description: `${this._e('pensando')} Qual fluxo essa interação deve disparar?`,
        color: COLOR.main
      }],
      components: rows
    });
  }

  async _openFlowEmbedBuilder(interaction, user, flowId, meta, params, isEdit, existingAction, needsSelect, existingEmbed) {
    // Estado do builder — apenas embed (sem content/botões, pois esses já estão em params)
    const embed = existingEmbed ? JSON.parse(JSON.stringify(existingEmbed)) : {
      title: '', description: '', color: 0x7C8FFF,
      url: '', author: { name: '', icon_url: '', url: '' },
      footer: { text: '', icon_url: '' },
      thumbnail: { url: '' }, image: { url: '' }, fields: []
    };

    const PRESET_COLORS = [
      { label: '🩵 Azul Ayami',       value: 'A9D6FF' },
      { label: '💙 Azul Secundário',  value: '7C8FFF' },
      { label: '🌙 Azul Escuro',      value: '243B7A' },
      { label: '⭐ Dourado',           value: 'FFD966' },
      { label: '🔵 Azul Discord',     value: '5865F2' },
      { label: '🟢 Verde',            value: '2ECC71' },
      { label: '🔴 Vermelho',         value: 'E74C3C' },
      { label: '🟣 Roxo',             value: '9B59B6' },
      { label: '🎨 HEX Personalizado',value: 'custom'  },
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

    function buildPreviewLine() {
      const parts = [];
      if (embed.title)           parts.push(`📌 **${embed.title.slice(0, 40)}**`);
      if (embed.description)     parts.push(`📝 Descrição: ${embed.description.slice(0, 60)}…`);
      if (embed.author?.name)    parts.push(`👤 Author: ${embed.author.name}`);
      if (embed.footer?.text)    parts.push(`📋 Footer: ${embed.footer.text.slice(0, 40)}`);
      if (embed.thumbnail?.url)  parts.push(`🖼️ Thumbnail: ✅`);
      if (embed.image?.url)      parts.push(`🖼️ Image: ✅`);
      if (embed.fields?.length)  parts.push(`📊 Fields: ${embed.fields.length}`);
      const colorHex = embed.color ? `#${embed.color.toString(16).padStart(6, '0').toUpperCase()}` : 'nenhuma';
      parts.push(`🎨 Cor: ${colorHex}`);
      return parts.length ? parts.join('\n') : '_Embed em branco_';
    }

    const renderBuilder = async (i) => {
      const editSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: '✏️ Editar campo da embed…',
          options: [
            { label: 'Título',           value: 'title'       },
            { label: 'Descrição',        value: 'description' },
            { label: 'URL do Título',    value: 'url'         },
            { label: 'Author Nome',      value: 'author_name' },
            { label: 'Author Icon URL',  value: 'author_icon' },
            { label: 'Author URL',       value: 'author_url'  },
            { label: 'Footer Texto',     value: 'footer_text' },
            { label: 'Footer Icon URL',  value: 'footer_icon' },
            { label: 'Thumbnail URL',    value: 'thumbnail'   },
            { label: 'Image URL',        value: 'image'       },
          ]
        },
        funcao: async (si) => {
          const MAP = {
            title      : ['Editar Título',           () => embed.title,           v => { embed.title           = v; }, false],
            description: ['Editar Descrição',        () => embed.description,     v => { embed.description     = v; }, true ],
            url        : ['Editar URL do Título',     () => embed.url,             v => { embed.url             = v; }, false],
            author_name: ['Editar Author Nome',       () => embed.author.name,     v => { embed.author.name     = v; }, false],
            author_icon: ['Editar Author Icon URL',   () => embed.author.icon_url, v => { embed.author.icon_url = v; }, false],
            author_url : ['Editar Author URL',        () => embed.author.url,      v => { embed.author.url      = v; }, false],
            footer_text: ['Editar Footer Texto',      () => embed.footer.text,     v => { embed.footer.text     = v; }, false],
            footer_icon: ['Editar Footer Icon URL',   () => embed.footer.icon_url, v => { embed.footer.icon_url = v; }, false],
            thumbnail  : ['Editar Thumbnail URL',     () => embed.thumbnail.url,   v => { embed.thumbnail.url   = v; }, false],
            image      : ['Editar Image URL',         () => embed.image.url,       v => { embed.image.url       = v; }, false],
          };
          const [title, getter, setter, multi] = MAP[si.data.values[0]] || [];
          if (!title) return;
          const modal = this.client.interactions.createModal({
            user, title,
            components: [{ type: 1, components: [{ type: 4, custom_id: 'val', label: title, style: multi ? 2 : 1, required: false, value: getter() || '', max_length: multi ? 4000 : 256 }] }],
            funcao: async (mi, _, fields) => {
              setter(fields.val ?? '');
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderBuilder(mi);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const fieldSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: '📊 Gerenciar Fields…',
          options: [
            { label: '➕ Adicionar Field', value: 'add',    description: `Atual: ${embed.fields.length}/25` },
            { label: '🗑️ Remover Última',  value: 'remove'  },
          ]
        },
        funcao: async (si) => {
          if (si.data.values[0] === 'remove') {
            if (!embed.fields.length) return;
            embed.fields.pop();
            await this.ui.deferUpdate(si);
            return renderBuilder(si);
          }
          if (embed.fields.length >= 25) return;
          const modal = this.client.interactions.createModal({
            user, title: 'Adicionar Field',
            components: [
              this.ui.modalText('name',  'Nome do field',  { required: true, maxLength: 256 }),
              this.ui.modalText('value', 'Valor do field', { required: true, maxLength: 1024, style: 2 }),
              this.ui.modalYesNo('inline', 'Exibir em linha (inline)?', {
                yesLabel: '↔️ Sim — lado a lado com outros fields',
                noLabel:  '⬇️ Não — ocupa a linha inteira',
                defaultValue: 'false'
              }),
            ],
            funcao: async (mi, _, fields) => {
              embed.fields.push({ name: fields.name, value: fields.value, inline: fields.inline === 'true' });
              await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
              return renderBuilder(mi);
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
                return renderBuilder(mi);
              }
            });
            return this.client.interactions.showModal(si, modal);
          }
          embed.color = parseInt(val, 16);
          await this.ui.deferUpdate(si);
          return renderBuilder(si);
        }
      });

      const btnConfirm = this.client.interactions.createButton({
        user, data: { label: '✅ Confirmar embed', style: 3 },
        funcao: async (i) => {
          await this.ui.deferUpdate(i);
          params.embedObj = cleanEmbed(embed);
          return this._afterEmbedDecision(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
      });

      const btnRemove = this.client.interactions.createButton({
        user, data: { label: '🗑️ Remover embed', style: 4 },
        funcao: async (i) => {
          await this.ui.deferUpdate(i);
          delete params.embedObj;
          return this._afterEmbedDecision(i, user, flowId, meta, params, isEdit, existingAction, needsSelect);
        }
      });

      // A embed renderizada É o preview em tempo real — cada edição re-renderiza
      return this.ui.editOriginal(i, {
        embeds: [{
          title:       embed.title       || `🎨 Editor de Embed ${this._e('animada')}`,
          description: embed.description || `${this._e('pensando')} Edite os campos usando os menus abaixo!\nO preview atualiza a cada mudança. ${this._e('feliz')}`,
          color:       embed.color ?? 0x7C8FFF,
          url:         embed.url         || undefined,
          thumbnail:   embed.thumbnail?.url ? { url: embed.thumbnail.url } : undefined,
          image:       embed.image?.url     ? { url: embed.image.url }     : undefined,
          author:      embed.author?.name   ? { name: embed.author.name, icon_url: embed.author.icon_url || undefined, url: embed.author.url || undefined } : undefined,
          footer:      embed.footer?.text   ? { text: embed.footer.text, icon_url: embed.footer.icon_url || undefined } : undefined,
          fields:      embed.fields?.length ? embed.fields                 : undefined,
        }],
        components: [
          this.ui.row(editSel),
          this.ui.row(fieldSel),
          this.ui.row(colorSel),
          this.ui.row(btnConfirm, btnRemove),
        ]
      });
    };

    return renderBuilder(interaction);
  }

  async _saveAction(interaction, user, flowId, category, type, params) {
    const meta    = ACTION_CATALOG.find(a => a.category === category && a.type === type);
    const guildId = interaction.guild_id;
    const warnings = [];

    // ── validação de permissões ──
    const idWarnings = await this._validateIds(guildId, params);
    warnings.push(...idWarnings);

    if (params.channelId && ['send_message', 'reply_message', 'edit_message'].includes(type)) {
      const rawId = params.channelId.replace(/[<#>]/g, '').trim();
      try {
        const perms = await getPerm({ channel: true, id: rawId, guildId, bot: true });
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
      'user:ban':                  'BAN_MEMBERS',
      'user:kick':                 'KICK_MEMBERS',
      'user:timeout':              'MODERATE_MEMBERS',
      'user:give_role':            'MANAGE_ROLES',
      'user:remove_role':          'MANAGE_ROLES',
      'user:toggle_role':          'MANAGE_ROLES',
      'user:give_temp_role':       'MANAGE_ROLES',
      'user:change_nickname':      'MANAGE_NICKNAMES',
      'channel:create_channel':    'MANAGE_CHANNELS',
      'channel:delete_channel':    'MANAGE_CHANNELS',
      'channel:rename_channel':    'MANAGE_CHANNELS',
      'channel:lock_channel':      'MANAGE_CHANNELS',
      'channel:unlock_channel':    'MANAGE_CHANNELS',
      'message:delete_message':    'MANAGE_MESSAGES',
      'message:delete_bot_message':'MANAGE_MESSAGES',
    };
    const requiredPerm = PERM_MAP[`${category}:${type}`];
    if (requiredPerm) {
      try {
        const perms = await getPerm({ guildId, bot: true });
        if (!perms.includes(requiredPerm)) {
          warnings.push(`⚠️ O bot não tem a permissão **${requiredPerm}** no servidor.`);
        }
      } catch {}
    }

    const flow    = await this._getFlow(guildId, flowId);
    const actions = flow.actions || [];
    // JSON roundtrip garante que objetos aninhados (embedObj) são detectados pelo Mongoose
    const safeParams = JSON.parse(JSON.stringify(params));
    actions.push({ id: this._uid(), category, type, params: safeParams, order: actions.length });
    await this.client.logicEngine.updateFlow(flowId, guildId, { actions });

    const msg = warnings.length
      ? `${this._e('emduvida')} Ação **${meta?.label}** adicionada, mas com avisos:\n\n${warnings.join('\n')}`
      : `${this._e('curtida')} Ação **${meta?.label}** adicionada!`;

    return this.actionsMenu(interaction, user, flowId, { successMsg: msg });
  }

  /* ─── Editar ação existente ─── */

  async _editActionSelect(interaction, user, flowId, actionId) {
    const flow   = await this._getFlow(interaction.guild_id, flowId);
    const action = (flow?.actions || []).find(a => a.id === actionId);
    if (!action) return this.actionsMenu(interaction, user, flowId);

    const meta = ACTION_CATALOG.find(a => a.category === action.category && a.type === action.type);

    const currentVals = Object.entries(action.params || {})
      .map(([k, v]) => `**${this._paramLabel(k)}:** \`${String(v).slice(0, 50)}\``)
      .join('\n') || '_Sem parâmetros_';

    // Apenas abre o modal direto, sem followUp extra

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
    const actions = (flow?.actions || []).map(a => {
      if (a.id !== actionId) return a;
      // JSON roundtrip garante que objetos aninhados (embedObj) são detectados pelo Mongoose
      return { ...a, params: JSON.parse(JSON.stringify(params)) };
    });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { actions });
    return this.actionsMenu(interaction, user, flowId, { successMsg: `${this._e('feliz')} Ação atualizada!` });
  }

  /* ═══════════════════════════════════════════
     RESOLVER CANAL / CARGO VIA SELECT MENU
     ═══════════════════════════════════════════ */

  /**
   * Fluxo unificado para preencher channelId ou roleId via select.
   * @param {string} mode 'action' | 'action_edit' | 'condition' | 'condition_edit'
   */
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

    // Não precisa de nenhum select — salva direto
    return this._finalizeSave(interaction, user, flowId, meta, params, mode);
  }

  async _showChannelSelect(interaction, user, flowId, meta, params, mode) {
    // Usa Channel Select nativo do Discord (type 8) — options preenchidas automaticamente
    const channelSel = this.client.interactions.createChannelSelect({
      user,
      data: {
        placeholder:   `📌 Canal para: ${meta.label.slice(0, 68)}`,
        channel_types: [0, 5], // text + announcement
      },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        params.channelId = i.data.values[0];
        return this._resolveSelectParams(i, user, flowId, meta, params, mode);
      }
    });

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `📌 Selecionar Canal ${this._e('emduvida')}`,
        description:
          `${this._e('pensando')} Para a ação **${meta.label}**, selecione o canal onde ela vai acontecer!\n\n` +
          `Escolha abaixo um canal de texto do servidor:`,
        color: COLOR.main
      }],
      components: [this.ui.row(channelSel)]
    });
  }

  async _showRoleSelect(interaction, user, flowId, meta, params, mode) {
    // Usa Role Select nativo do Discord (type 6) — options preenchidas automaticamente
    const roleSel = this.client.interactions.createRoleSelect({
      user,
      data: {
        placeholder: `🏷️ Cargo para: ${meta.label.slice(0, 70)}`,
      },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        params.roleId = i.data.values[0];
        return this._resolveSelectParams(i, user, flowId, meta, params, mode);
      }
    });

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `🏷️ Selecionar Cargo ${this._e('emduvida')}`,
        description:
          `${this._e('pensando')} Para a ação **${meta.label}**, selecione o cargo que será usado!\n\n` +
          `Escolha abaixo um dos cargos do servidor:`,
        color: COLOR.main
      }],
      components: [this.ui.row(roleSel)]
    });
  }

  /* ── Permission Select — 3 páginas com todas as perms do Discord ── */
  async _showPermSelect(interaction, user, flowId, meta, params, mode) {
    const PERM_PAGES = [
      [
        { label: 'Ver Canais',              value: 'VIEW_CHANNEL',                description: 'Visualizar canais de texto e voz' },
        { label: 'Enviar Mensagens',        value: 'SEND_MESSAGES',               description: 'Enviar mensagens nos canais' },
        { label: 'Enviar em Threads',       value: 'SEND_MESSAGES_IN_THREADS',    description: 'Enviar mensagens em threads' },
        { label: 'Criar Threads Públicas',  value: 'CREATE_PUBLIC_THREADS',       description: 'Criar threads públicas' },
        { label: 'Criar Threads Privadas',  value: 'CREATE_PRIVATE_THREADS',      description: 'Criar threads privadas' },
        { label: 'Incorporar Links',        value: 'EMBED_LINKS',                 description: 'Incorporar links com preview' },
        { label: 'Anexar Arquivos',         value: 'ATTACH_FILES',                description: 'Enviar arquivos e imagens' },
        { label: 'Ver Histórico',           value: 'READ_MESSAGE_HISTORY',        description: 'Ler mensagens antigas' },
        { label: 'Mencionar @everyone',     value: 'MENTION_EVERYONE',            description: 'Mencionar @everyone e @here' },
        { label: 'Usar Emojis Externos',    value: 'USE_EXTERNAL_EMOJIS',         description: 'Usar emojis de outros servidores' },
        { label: 'Usar Stickers Externos',  value: 'USE_EXTERNAL_STICKERS',       description: 'Usar stickers de outros servidores' },
        { label: 'Adicionar Reações',       value: 'ADD_REACTIONS',               description: 'Reagir a mensagens' },
        { label: 'Usar Comandos de App',    value: 'USE_APPLICATION_COMMANDS',    description: 'Usar slash commands e bots' },
        { label: 'Gerenciar Mensagens',     value: 'MANAGE_MESSAGES',             description: 'Apagar/fixar mensagens de outros' },
        { label: 'Gerenciar Threads',       value: 'MANAGE_THREADS',              description: 'Renomear, deletar, arquivar threads' },
        { label: 'Text-to-Speech',          value: 'SEND_TTS_MESSAGES',           description: 'Enviar mensagens de voz TTS' },
      ],
      [
        { label: 'Conectar em Voz',         value: 'CONNECT',                     description: 'Entrar em canais de voz' },
        { label: 'Falar em Voz',            value: 'SPEAK',                       description: 'Transmitir áudio em voz' },
        { label: 'Vídeo/Tela em Voz',       value: 'STREAM',                      description: 'Compartilhar vídeo ou tela' },
        { label: 'Usar Voz com Atividade',  value: 'USE_VAD',                     description: 'Usar detecção de atividade de voz' },
        { label: 'Mutar Membros',           value: 'MUTE_MEMBERS',                description: 'Mutar outros membros em voz' },
        { label: 'Ensurdecer Membros',      value: 'DEAFEN_MEMBERS',              description: 'Ensurdecer membros em voz' },
        { label: 'Mover Membros',           value: 'MOVE_MEMBERS',                description: 'Mover membros entre canais de voz' },
        { label: 'Prioridade de Palestra',  value: 'PRIORITY_SPEAKER',            description: 'Falar com prioridade em voz' },
        { label: 'Expulsar Membros',        value: 'KICK_MEMBERS',                description: 'Expulsar membros do servidor' },
        { label: 'Banir Membros',           value: 'BAN_MEMBERS',                 description: 'Banir membros permanentemente' },
        { label: 'Dar Timeout',             value: 'MODERATE_MEMBERS',            description: 'Aplicar timeout em membros' },
        { label: 'Gerenciar Apelidos',      value: 'MANAGE_NICKNAMES',            description: 'Alterar apelidos de outros' },
        { label: 'Gerenciar Cargos',        value: 'MANAGE_ROLES',                description: 'Criar, editar e excluir cargos' },
        { label: 'Gerenciar Canais',        value: 'MANAGE_CHANNELS',             description: 'Criar, editar e excluir canais' },
        { label: 'Gerenciar Emojis',        value: 'MANAGE_EMOJIS_AND_STICKERS',  description: 'Gerenciar emojis e stickers' },
        { label: 'Gerenciar Webhooks',      value: 'MANAGE_WEBHOOKS',             description: 'Criar e gerenciar webhooks' },
      ],
      [
        { label: 'Gerenciar Servidor',      value: 'MANAGE_GUILD',                description: 'Alterar configurações do servidor' },
        { label: 'Gerenciar Eventos',       value: 'MANAGE_EVENTS',               description: 'Criar e gerenciar eventos' },
        { label: 'Ver Audit Log',           value: 'VIEW_AUDIT_LOG',              description: 'Ver o log de auditoria' },
        { label: 'Ver Insights do Servidor',value: 'VIEW_GUILD_INSIGHTS',         description: 'Ver analytics do servidor' },
        { label: 'Mudar Apelido Próprio',   value: 'CHANGE_NICKNAME',             description: 'Alterar o próprio apelido' },
        { label: 'Criar Convite',           value: 'CREATE_INSTANT_INVITE',       description: 'Criar links de convite' },
        { label: 'Administrador',           value: 'ADMINISTRATOR',               description: 'Permissao total no servidor' },
      ]
    ];

    const PAGE_LABELS = ['💬 Mensagens e Canais', '🔊 Voz e Moderação', '⚙️ Servidor e Especiais'];

    const renderPage = async (i, page) => {
      const pageSel = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: `${PAGE_LABELS[page]} — escolha a permissão`,
          options:     PERM_PAGES[page]
        },
        funcao: async (si) => {
          await this.ui.deferUpdate(si);
          params.permission = si.data.values[0];
          return this._finalizeSave(si, user, flowId, meta, params, mode);
        }
      });

      const navBtns = [];
      if (page > 0) {
        navBtns.push(this.client.interactions.createButton({
          user, data: { label: '◀ Anterior', style: 2 },
          funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPage(bi, page - 1); }
        }));
      }
      if (page < PERM_PAGES.length - 1) {
        navBtns.push(this.client.interactions.createButton({
          user, data: { label: 'Próxima ▶', style: 2 },
          funcao: async (bi) => { await this.ui.deferUpdate(bi); return renderPage(bi, page + 1); }
        }));
      }

      const rows = [this.ui.row(pageSel)];
      if (navBtns.length) rows.push(this.ui.row(...navBtns));

      return this.ui.editOriginal(i, {
        embeds: [{
          title:       `🛡️ Selecionar Permissão ${this._e('emduvida')}`,
          description:
            `${this._e('pensando')} Escolha a permissão que o usuário precisa ter!\n` +
            `Página **${page + 1}/${PERM_PAGES.length}** — ${PAGE_LABELS[page]}`,
          color: COLOR.main
        }],
        components: rows
      });
    };

    return renderPage(interaction, 0);
  }

  /* ── Thread Target Select — escolhe Usuário ou Cargo para adicionar ao tópico ── */
  async _showThreadTargetSelect(interaction, user, flowId, meta, params, mode) {
    const typeSel = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: '➕ Adicionar ao tópico: usuário ou cargo?',
        options: [
          { label: '👤 Um usuário específico', value: 'user', description: 'Adiciona uma pessoa pelo ID ou {arg0}' },
          { label: '🏷️ Todos com um cargo',    value: 'role', description: 'Adiciona quem tiver o cargo escolhido' },
        ]
      },
      funcao: async (i) => {
        params.threadTargetType = i.data.values[0];

        if (params.threadTargetType === 'role') {
          await this.ui.deferUpdate(i);
          return this._showRoleSelect(i, user, flowId, meta, params, mode);
        }

        // Usuário — pede o ID via modal (aceita {arg0}, menção ou ID puro)
        const modal = this.client.interactions.createModal({
          user,
          title: 'Usuário a adicionar',
          components: [{
            type: 1,
            components: [{
              type: 4, custom_id: 'targetUserId',
              label: 'ID, @menção ou {arg0} do usuário',
              style: 1, required: true, max_length: 100,
              placeholder: 'Ex: {arg0} ou 123456789012345678'
            }]
          }],
          funcao: async (mi, _, fields) => {
            params.targetUserId = fields.targetUserId?.trim();
            await DiscordRequest(`/interactions/${mi.id}/${mi.token}/callback`, { method: 'POST', body: { type: 6 } });
            return this._resolveSelectParams(mi, user, flowId, meta, params, mode);
          }
        });
        return this.client.interactions.showModal(i, modal);
      }
    });

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `➕ Adicionar ao Tópico ${this._e('emduvida')}`,
        description: `${this._e('pensando')} Quem você quer adicionar ao tópico (thread)?`,
        color: COLOR.main
      }],
      components: [this.ui.row(typeSel)]
    });
  }

  /* ── Arg Select — escolhe índice e tipo do arg ── */
  async _showArgSelect(interaction, user, flowId, meta, params, mode) {
    // Step 1: seleciona o índice do arg (0-4, exibidos como 1-5)
    const argIndexSel = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: '🔢 Qual argumento? (1 = primeiro)',
        options: [0,1,2,3,4].map(n => ({
          label:       `Argumento ${n + 1}`,
          value:       String(n),
          description: `{arg${n}} — ${n === 0 ? 'primeiro' : n === 1 ? 'segundo' : n === 2 ? 'terceiro' : n === 3 ? 'quarto' : 'quinto'} argumento`
        }))
      },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        params.argIndex = Number(i.data.values[0]);
        return this._showArgTypeSel(i, user, flowId, meta, params, mode);
      }
    });

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `🔍 Condição: ${meta.label} ${this._e('emduvida')}`,
        description:
          `${this._e('pensando')} **Qual argumento você quer verificar?**\n\n` +
          `Os argumentos são as palavras que o usuário digita após o comando.\n` +
          `Ex: \`!ban @Usuario motivo\` → arg1 = \`@Usuario\`, arg2 = \`motivo\``,
        color: COLOR.main
      }],
      components: [this.ui.row(argIndexSel)]
    });
  }

  async _showArgTypeSel(interaction, user, flowId, meta, params, mode) {
    const argNum = (params.argIndex ?? 0) + 1;

    const argTypeSel = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: `🔍 O Argumento ${argNum} é…`,
        options: [
          { label: '👤 Menção de usuário',  value: 'user_mention',  description: `{arg${argNum - 1}} é uma menção @usuário` },
          { label: '📌 Menção de canal',    value: 'channel_mention', description: `{arg${argNum - 1}} é uma menção #canal` },
          { label: '🔢 Número',            value: 'number',          description: `{arg${argNum - 1}} é um número válido` },
          { label: '✏️ Texto não-vazio',   value: 'text',            description: `{arg${argNum - 1}} tem qualquer conteúdo` },
        ]
      },
      funcao: async (i) => {
        await this.ui.deferUpdate(i);
        params.argType = i.data.values[0];
        return this._finalizeSave(i, user, flowId, meta, params, mode);
      }
    });

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `🔍 Tipo do Argumento ${argNum} ${this._e('emduvida')}`,
        description:
          `${this._e('pensando')} **O Argumento ${argNum} deve ser do tipo:**`,
        color: COLOR.main
      }],
      components: [this.ui.row(argTypeSel)]
    });
  }

  async _finalizeSave(interaction, user, flowId, meta, params, mode) {
    const actionId = params._actionId;
    const condId   = params._condId;
    delete params._actionId;
    delete params._condId;

    if (mode === 'action') {
      // Edita a mensagem original e salva
      return this._saveAction(interaction, user, flowId, meta.category, meta.type, params);
    }

    if (mode === 'action_edit') {
      return this._applyActionEdit(interaction, user, flowId, actionId, params);
    }

    if (mode === 'condition') {
      const operator = params._operator || 'AND';
      const negate   = params._negate   || false;
      delete params._operator;
      delete params._negate;
      return this._saveCondition(interaction, user, flowId, meta.category, meta.type, { ...params, _operator: operator, _negate: negate });
    }

    if (mode === 'condition_edit') {
      const operator = params._operator || 'AND';
      const negate   = params._negate   || false;
      delete params._operator;
      delete params._negate;
      return this._applyConditionEdit(interaction, user, flowId, condId, params, operator, negate);
    }
  }

  /* ─── validação de IDs ─── */

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

  /* ═══════════════════════════════════════════
     MENU: VARIÁVEIS  (novo fluxo guiado)
     ═══════════════════════════════════════════ */

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

    const btnAdd = this.ui.btn(user, `➕ Criar Variável`, 1, async (i) => {
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

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `📦 Variáveis (${vars.length}) ${this._e('pensando')}`,
        description:
          (successMsg ? `${successMsg}\n\n` : ``) +
          `**O que são variáveis?** São "caixinhas" que guardam informações durante o fluxo!\n` +
          `Por exemplo: pontos, contador de mensagens, status de um usuário...\n` +
          `Você as usa nas ações com \`{var:nome}\`.\n` +
          `Variáveis 💾 são salvas mesmo depois do fluxo terminar!\n\n` +
          `**Variáveis configuradas:**\n${lines}`,
        color:  COLOR.main,
        footer: { text: `📖 Acesse o guia • ${GUIDE_URL}` }
      }],
      components: [this.ui.row(btnAdd, btnRemove, btnBack, this._guideButton())]
    });
  }

  /* ── PASSO 1: Escopo da variável ── */
  async _varStep1_Scope(interaction, user, flowId) {
    const sel = this.ui.select(
      user,
      [
        {
          label:       '🌐 Variável do Fluxo (Flow)',
          value:       'flow',
          description: 'Funciona para TODOS os usuários ao mesmo tempo. Ex: contador global, status do servidor.'
        },
        {
          label:       '👤 Variável de Usuário (User)',
          value:       'user',
          description: 'Cada usuário tem o SEU valor. Ex: pontos de XP, moedas, nível individual.'
        }
      ],
      '🔍 Qual o escopo da variável?',
      async (i) => {
        await this.ui.deferUpdate(i);
        return this._varStep2_Type(i, user, flowId, i.data.values[0]);
      }
    );

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `📦 Criar Variável — Passo 1 de 4 ${this._e('animada')}`,
        description:
          `**Qual é o tipo de variável que você quer criar?**\n\n` +
          `**🌐 Variável do Fluxo (Flow)**\n` +
          `> Compartilhada entre todos os usuários. Use para coisas do servidor inteiro.\n` +
          `> *Exemplo: "quantidade de entradas hoje", "status da live"*\n\n` +
          `**👤 Variável de Usuário (User)**\n` +
          `> Cada usuário tem o seu próprio valor separado.\n` +
          `> *Exemplo: "pontos do usuário", "número de mensagens enviadas"*`,
        color:  COLOR.main
      }],
      components: [this.ui.row(sel)]
    });
  }

  /* ── PASSO 2: Tipo de valor ── */
  async _varStep2_Type(interaction, user, flowId, scope) {
    const sel = this.ui.select(
      user,
      [
        {
          label:       '🔤 Texto (String)',
          value:       'string',
          description: 'Guarda palavras e frases. Ex: "ativo", "banido", "Olá Mundo"'
        },
        {
          label:       '🔢 Número (Number)',
          value:       'number',
          description: 'Guarda números inteiros ou decimais. Ex: 0, 100, 3.14'
        },
        {
          label:       '✅ Verdadeiro/Falso (Boolean)',
          value:       'boolean',
          description: 'Guarda apenas "true" (sim) ou "false" (não)'
        },
        {
          label:       '📋 Lista (List)',
          value:       'list',
          description: 'Guarda vários itens. Ex: ["Item1", "Item2", "Item3"]'
        }
      ],
      '📦 Qual o tipo de valor?',
      async (i) => {
        // NÃO dar deferUpdate aqui — _varStep3_Name abre um modal (showModal),
        // e modal não pode ser aberto após a interação já ter sido acknowledged.
        return this._varStep3_Name(i, user, flowId, scope, i.data.values[0]);
      }
    );

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `📦 Criar Variável — Passo 2 de 4 ${this._e('emduvida')}`,
        description:
          `**Qual o tipo de valor que sua variável vai guardar?**\n\n` +
          `**🔤 Texto (String)**\n> Guarda qualquer texto. Valor padrão: \`""\` (vazio)\n\n` +
          `**🔢 Número (Number)**\n> Guarda números. Valor padrão: \`0\`\n> *Pode fazer somas, subtrações, etc.*\n\n` +
          `**✅ Verdadeiro/Falso (Boolean)**\n> Só pode ser \`true\` ou \`false\`. Valor padrão: \`false\`\n\n` +
          `**📋 Lista (List)**\n> Guarda vários itens de uma vez. Valor padrão: \`[]\` (lista vazia)\n> *Pode adicionar/remover itens depois!*`,
        color:  COLOR.main
      }],
      components: [this.ui.row(sel)]
    });
  }

  /* ── PASSO 3: Nome e persistência ── */
  async _varStep3_Name(interaction, user, flowId, scope, type) {
    const modal = this.client.interactions.createModal({
      user,
      title: '📦 Criar Variável — Passo 3',
      components: [
        this.ui.modalText('name', 'Nome da variável (sem espaços)', {
          required: true, maxLength: 50,
          placeholder: 'contador, pontos, status, xp_usuario...'
        }),
        this.ui.modalYesNo('persistent', 'Salvar valor após o fluxo terminar?', {
          yesLabel:     '💾 Sim — mantém o valor entre execuções',
          noLabel:      '🔄 Não — reseta a cada execução do fluxo',
          defaultValue: 'false'
        }),
      ],
      funcao: async (modalInteraction, client, fields) => {
        const name = fields.name?.trim().replace(/\s+/g, '_');
        if (!name) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: { content: `❌ Nome inválido! ${this._e('brava')}`, flags: 64 } } }
          );
        }

        const flow = await this._getFlow(modalInteraction.guild_id, flowId);
        const vars = flow.variables || [];
        if (vars.find(v => v.name === name)) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: { content: `❌ Já existe uma variável chamada **${name}**! ${this._e('emburrada')}`, flags: 64 } } }
          );
        }

        const persistent = fields.persistent === 'true';

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this._varStep4_DefaultValue(modalInteraction, user, flowId, { name, scope, type, persistent });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  /* ── PASSO 4: Valor padrão ── */
  async _varStep4_DefaultValue(interaction, user, flowId, varData) {
    const defaultsByType = {
      string:  '`""` — texto vazio',
      number:  '`0` — zero',
      boolean: '`false` — falso (desativado)',
      list:    '`[]` — lista vazia'
    };

    // Para listas, oferece opção de definir valores iniciais
    if (varData.type === 'list') {
      const sel = this.ui.select(
        user,
        [
          {
            label:       '📋 Começar com lista vazia []',
            value:       'empty',
            description: 'A lista começa sem nenhum item (recomendado)'
          },
          {
            label:       '✏️ Definir itens iniciais da lista',
            value:       'custom',
            description: 'Você digita os itens que a lista começa tendo'
          }
        ],
        '📋 Como a lista começa?',
        async (i) => {
          const choice = i.data.values[0];
          if (choice === 'empty') {
            await this.ui.deferUpdate(i);
            return this._saveVariable(i, user, flowId, { ...varData, defaultValue: [] });
          }
          // Abre modal para definir itens iniciais
          return this._varListDefaultModal(i, user, flowId, varData);
        }
      );

      // interaction vem de modal submit (type:6 já enviado) — editOriginal edita a mensagem do painel
      return this.ui.editOriginal(interaction, {
        embeds: [{
          title:       `📦 Criar Variável — Passo 4 de 4 ${this._e('festa')}`,
          description:
            `**Quase lá! Variável:** \`${varData.name}\` (${varData.scope === 'user' ? '👤 usuário' : '🌐 fluxo'})\n` +
            `**Tipo:** 📋 Lista\n\n` +
            `**Como você quer que a lista comece?**\n\n` +
            `*Lista vazia é a escolha mais comum — você adiciona itens depois com a ação "Adicionar à lista".*`,
          color: COLOR.main
        }],
        components: [this.ui.row(sel)]
      });
    }

    // Para outros tipos — cria modal e mostra via followUpEphemeral com botões
    // (não é possível abrir modal a partir de modal submit — precisamos de um componente intermediário)
    const modal = this.client.interactions.createModal({
      user,
      title: `📦 Valor Padrão — ${varData.name}`,
      components: [{
        type: 1,
        components: [{
          type:        4,
          custom_id:   'defaultValue',
          label:       'Valor padrão (deixe vazio = padrão do tipo)',
          style:       1,
          required:    false,
          max_length:  200,
          placeholder: varData.type === 'number' ? '0' : varData.type === 'boolean' ? 'false' : 'Meu texto padrão'
        }]
      }],
      funcao: async (modalInteraction, client, fields) => {
        let defaultValue = fields.defaultValue?.trim() || null;

        if (varData.type === 'number') {
          defaultValue = defaultValue !== null ? (Number(defaultValue) || 0) : 0;
        } else if (varData.type === 'boolean') {
          defaultValue = ['true', 'sim', 's', 'yes'].includes(defaultValue?.toLowerCase()) ? true : false;
        } else if (defaultValue === null) {
          defaultValue = '';
        }

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this._saveVariable(modalInteraction, user, flowId, { ...varData, defaultValue });
      }
    });

    const defaultLabel = varData.type === 'number' ? '0' : varData.type === 'boolean' ? 'false' : 'vazio';

    // interaction vem de modal submit — editOriginal edita a mensagem do painel com os botões
    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `📦 Criar Variável — Passo 4 de 4 ${this._e('festa')}`,
        description:
          `**Quase lá! Resumo da variável:**\n` +
          `> 📛 **Nome:** \`${varData.name}\`\n` +
          `> 🏷️ **Escopo:** ${varData.scope === 'user' ? '👤 por usuário' : '🌐 do fluxo'}\n` +
          `> 📦 **Tipo:** ${varData.type}\n` +
          `> 💾 **Persistente:** ${varData.persistent ? 'Sim' : 'Não'}\n\n` +
          `**Valor padrão automático:** ${defaultsByType[varData.type]}\n` +
          `*Clique para personalizar o valor inicial ou use o padrão!*`,
        color: COLOR.main
      }],
      components: [this.ui.row(
        this.ui.btn(user, '✏️ Definir valor personalizado', 1, async (i) => {
          return this.client.interactions.showModal(i, modal);
        }),
        this.ui.btn(user, `✅ Usar padrão (${defaultLabel})`, 2, async (i) => {
          await this.ui.deferUpdate(i);
          const defaultValue = varData.type === 'number' ? 0 : varData.type === 'boolean' ? false : '';
          return this._saveVariable(i, user, flowId, { ...varData, defaultValue });
        })
      )]
    });
  }
  async _varListDefaultModal(interaction, user, flowId, varData) {
    const modal = this.client.interactions.createModal({
      user,
      title: `📋 Itens Iniciais — ${varData.name}`,
      components: [{
        type: 1,
        components: [{
          type:        4,
          custom_id:   'items',
          label:       'Itens separados por vírgula',
          style:       2,
          required:    true,
          max_length:  1000,
          placeholder: 'Item 1, Item 2, Item 3\n\nCada item separado por vírgula!'
        }]
      }],
      funcao: async (modalInteraction, client, fields) => {
        const raw  = fields.items || '';
        const list = raw.split(',').map(s => s.trim()).filter(Boolean);

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this._saveVariable(modalInteraction, user, flowId, { ...varData, defaultValue: list });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
  }

  async _saveVariable(interaction, user, flowId, varData) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const vars = flow.variables || [];

    // Guarda de duplicidade (pode ter sido criada enquanto o usuário preenchia)
    if (vars.find(v => v.name === varData.name)) {
      return this.variablesMenu(interaction, user, flowId, {
        successMsg: `${this._e('emburrada')} Já existe uma variável chamada **${varData.name}**!`
      });
    }

    const { name, scope, type, persistent, defaultValue } = varData;
    vars.push({ name, type, defaultValue, persistent, scope });
    await this.client.logicEngine.updateFlow(flowId, interaction.guild_id, { variables: vars });

    const defLabel = Array.isArray(defaultValue)
      ? `[${defaultValue.join(', ') || 'vazio'}]`
      : String(defaultValue ?? 'null');

    // Edita a mensagem do painel direto com confirmação + volta ao menu de variáveis
    return this.variablesMenu(interaction, user, flowId, {
      successMsg:
        `${this._e('festa')} **Variável \`${name}\` criada!** Use com \`{var:${name}}\` nas ações.\n` +
        `Escopo: ${scope === 'user' ? '👤 por usuário' : '🌐 do fluxo'} • Tipo: ${type} • Valor inicial: \`${defLabel}\``
    });
  }

  /* ═══════════════════════════════════════════
     MENU: CONFIGURAÇÕES
     ═══════════════════════════════════════════ */

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

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `⚙️ Configurações do Fluxo ${this._e('sria')}`,
        description:
          (successMsg ? `${successMsg}\n\n` : ``) +
          `**Nome:** ${flow.name}\n` +
          `**Descrição:** ${flow.description || '_Sem descrição_'}\n` +
          `**Modo de execução:** ${flow.executionMode === 'parallel' ? '🔀 Paralelo (ações ao mesmo tempo)' : '➡️ Sequencial (ações em ordem)'}\n` +
          `**Cooldown:** ${flow.cooldown > 0 ? `${formatDuration(flow.cooldown)} por usuário` : 'Nenhum'}\n` +
          `**Criado por:** ${flow.createdBy ? `<@${flow.createdBy}>` : 'N/A'}`,
        color:  COLOR.dark,
        footer: { text: `📖 Acesse o guia • ${GUIDE_URL}` }
      }],
      components: [
        this.ui.row(btnCooldown, btnMode, btnRename),
        this.ui.row(btnLogs, btnBack, this._guideButton())
      ]
    });
  }

  async _setCooldown(interaction, user, flowId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    const current = flow?.cooldown > 0 ? formatDuration(flow.cooldown) : '';

    const modal = this.client.interactions.createModal({
      user,
      title: '⏱️ Definir Cooldown',
      components: [
        this.ui.modalText('duration', 'Cooldown (ex: 24h, 22h 10m, 1d 5h, 0)', {
          required:    true,
          maxLength:   30,
          placeholder: 'Ex: 24h • 22h 10m • 1d 5h 30m • 90m • 0 (sem cooldown)',
          value:       current
        })
      ],
      funcao: async (modalInteraction, client, fields) => {
        const raw = fields.duration?.trim() || '0';
        const ms  = raw === '0' ? 0 : parseDuration(raw);

        if (raw !== '0' && ms === 0) {
          return DiscordRequest(
            `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
            { method: 'POST', body: { type: 4, data: {
              content: `❌ Não entendi essa duração! ${this._e('emduvida')}\nUse algo como \`24h\`, \`22h 10m\`, \`1d 5h\` ou \`0\` para remover o cooldown.`,
              flags: 64
            } } }
          );
        }

        await this.client.logicEngine.updateFlow(flowId, modalInteraction.guild_id, { cooldown: ms });

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

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

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

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

    return this.ui.editOriginal(interaction, {
      embeds: [{
        title:       `📊 Últimas Execuções ${this._e('emduvida')}`,
        description: lines,
        color:       COLOR.main,
        footer:      { text: 'Logs são mantidos por 7 dias' }
      }],
      components: [this.ui.row(btnBack)]
    });
  }

  /* ═══════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════ */

  async _getFlow(guildId, flowId) {
    return FlowModel.findOne({ flowId, guildId }).lean();
  }

  _uid() {
    return randomUUID().slice(0, 8);
  }

  _paramLabel(p) {
    const labels = {
      content:       'Mensagem (suporta {user}, {user_mention}...)',
      roleId:        'Cargo',
      channelId:     'Canal',
      userId:        'ID do usuário (vazio = autor da mensagem)',
      text:          'Texto a verificar',
      percent:       'Porcentagem (0 a 100)',
      days:          'Número de dias',
      length:        'Tamanho em caracteres',
      pattern:       'Padrão regex (ex: ^olá)',
      name:          'Nome da variável',
      value:         'Valor',
      min:           'Valor mínimo',
      max:           'Valor máximo',
      seconds:       'Segundos',
      minutes:       'Minutos',
      duration:      'Duração em minutos',
      emoji:         'Emoji (ex: 👍 ou :nome:)',
      url:           'URL (endereço web)',
      method:        'Método HTTP (GET, POST, PUT...)',
      nickname:      'Novo nickname',
      reason:        'Motivo (opcional)',
      flowId:        'ID do fluxo',
      eventType:     'Nome do evento customizado',
      from:          'De (data ou horário)',
      to:            'Até (data ou horário)',
      date:          'Data (AAAA-MM-DD)',
      time:          'Horário (HH:MM)',
      permission:    'Permissão (ex: MANAGE_GUILD)',
      categoryId:    'Categoria de canais',
      hour:          'Hora (0 a 23)',
      minute:        'Minuto (0 a 59)',
      saveAs:        'Salvar resultado em variável',
      args:          'Argumentos do comando',
      ephemeral:     'Visível só para quem usou? (true/false)',
      varName:       'Nome da variável',
      title:         'Título do ranking',
      embed:         'Embed (JSON — veja o guia para exemplos)',
      targetUserId:  'ID do usuário (vazio = quem disparou)',
      cancelMessage: 'Mensagem se o usuário cancelar',
      timeout:       'Tempo limite em segundos',
      currentValue:    'Valor Atual (número ou {var:nome})',
      progressionBase: 'Base de Progressão (número ou {var:nome})',
      baseValue:       'Valor Base — multiplicador (padrão: 1000)'
    };
    return labels[p] || p;
  }

  _paramPlaceholder(p) {
    const ph = {
      content:       'Olá {user_mention}! Bem-vindo ao {guild}.',
      percent:       '30',
      days:          '7',
      length:        '100',
      pattern:       '^olá',
      name:          'contador',
      value:         '0',
      min:           '1',
      max:           '100',
      seconds:       '5',
      minutes:       '1',
      duration:      '60',
      emoji:         '👍',
      url:           'https://...',
      method:        'POST',
      time:          '18:00',
      date:          '2025-12-31',
      from:          '08:00',
      to:            '22:00',
      eventType:     'meu_evento',
      hour:          '18',
      minute:        '30',
      saveAs:        'resultado',
      args:          '{arg0} {arg1}...',
      ephemeral:     'false',
      varName:       'money',
      title:         '🏆 Ranking de Pontos',
      embed:         '{"title":"Exemplo"}',
      targetUserId:  '{arg0} ou @menção ou ID — deixe vazio p/ autor',
      cancelMessage: '❌ Operação cancelada.',
      timeout:       '30',
      reason:        'Motivo opcional...',
      nickname:      'Novo apelido',
      permission:    'MANAGE_GUILD',
      currentValue:    '{var:xp}',
      progressionBase: '{var:level}',
      baseValue:       '1000'
    };
    return ph[p] || '';
  }
}

module.exports = FlowBuilder;