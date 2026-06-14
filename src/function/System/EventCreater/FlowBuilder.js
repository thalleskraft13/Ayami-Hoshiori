'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const { FlowModel }  = require('../../../Mongodb/flow.js');
const { randomUUID } = require('crypto');
const getPerm        = require('../../Utils/GetPerm.js');
const holeHighter    = require('../../Utils/RoleHigher.js');

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
  { category: 'internal',  type: 'custom_event',            label: '⚡ Evento customizado',      description: 'Disparado por outro fluxo' }
];

const CONDITION_CATALOG = [
  { category: 'user',        type: 'has_role',          label: '👤 Possui cargo',              params: ['roleId'] },
  { category: 'user',        type: 'not_has_role',       label: '👤 Não possui cargo',          params: ['roleId'] },
  { category: 'user',        type: 'is_bot',             label: '🤖 É bot',                     params: [] },
  { category: 'user',        type: 'not_bot',            label: '🧑 Não é bot',                 params: [] },
  { category: 'user',        type: 'in_voice',           label: '🔊 Está em call',              params: [] },
  { category: 'user',        type: 'account_age_gt',     label: '📅 Conta criada há +X dias',   params: ['days'] },
  { category: 'user',        type: 'joined_gt',          label: '📅 Entrou há +X dias',         params: ['days'] },
  { category: 'channel',     type: 'is_channel',         label: '📌 Canal específico',          params: ['channelId'] },
  { category: 'channel',     type: 'not_channel',        label: '📌 Não é este canal',          params: ['channelId'] },
  { category: 'channel',     type: 'is_category',        label: '📂 Categoria específica',      params: ['categoryId'] },
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
  { category: 'probability', type: 'chance',             label: '🎲 Chance %',                  params: ['percent'] },
  { category: 'date',        type: 'before',             label: '📅 Antes de data',             params: ['date'] },
  { category: 'date',        type: 'after',              label: '📅 Depois de data',            params: ['date'] },
  { category: 'date',        type: 'between',            label: '📅 Entre datas',               params: ['from', 'to'] },
  { category: 'time',        type: 'before',             label: '⏰ Antes de horário',          params: ['time'] },
  { category: 'time',        type: 'after',              label: '⏰ Depois de horário',         params: ['time'] },
  { category: 'time',        type: 'between',            label: '⏰ Entre horários',            params: ['from', 'to'] },
  { category: 'permission',  type: 'is_admin',           label: '🛡️ É administrador',           params: [] },
  { category: 'permission',  type: 'has_permission',     label: '🛡️ Tem permissão',             params: ['permission'] },
];

const ACTION_CATALOG = [
  { category: 'message',  type: 'send_message',        label: '💬 Enviar mensagem',               params: ['content', 'channelId', 'embed'] },
  { category: 'message',  type: 'send_dm',             label: '📩 Enviar DM',                     params: ['content', 'embed'] },
  { category: 'message',  type: 'reply_message',       label: '↩️ Responder mensagem',            params: ['content', 'ephemeral', 'embed'] },
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
  { category: 'variable', type: 'set',                 label: '📦 Definir variável',             params: ['name', 'value'] },
  { category: 'variable', type: 'set_user_var',        label: '📦 Definir var de usuário',       params: ['name', 'value', 'targetUserId'] },
  { category: 'variable', type: 'add',                 label: '➕ Somar variável',               params: ['name', 'value'] },
  { category: 'variable', type: 'sub',                 label: '➖ Subtrair variável',            params: ['name', 'value'] },
  { category: 'variable', type: 'mul',                 label: '✖️ Multiplicar variável',         params: ['name', 'value'] },
  { category: 'variable', type: 'random',              label: '🎲 Valor aleatório',              params: ['name', 'min', 'max'] },
  { category: 'variable', type: 'push',                label: '➕ Adicionar à lista',            params: ['name', 'value'] },
  { category: 'variable', type: 'remove_item',         label: '➖ Remover da lista (por valor)', params: ['name', 'value'] },
  { category: 'variable', type: 'remove_index',        label: '🗑️ Remover da lista (por índice)',params: ['name', 'value'] },
  { category: 'variable', type: 'random_from',         label: '🎲 Aleatório da lista',           params: ['name', 'saveAs'] },
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
  'ephemeral', 'saveAs', 'messageId', 'embed',
  'targetUserId', 'timeout', 'cancelMessage'
];

/* ─────────────────────────────────────────────
   Params que NÃO entram no modal (resolvidos via select)
   ───────────────────────────────────────────── */
const SKIP_IN_MODAL = [...NEEDS_CHANNEL_SELECT, ...NEEDS_ROLE_SELECT];

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

  async _triggerFilters(interaction, user, flowId) {
    const flow = await this._getFlow(interaction.guild_id, flowId);
    if (!flow) return;

    const category = flow.trigger?.category;
    let filterHint = '';
    if (category === 'message')   filterHint = 'channelId — limitar a um canal\ntext — texto específico';
    if (category === 'member')    filterHint = 'roleId — limitar a usuários com cargo';
    if (category === 'component') filterHint = 'customId — ID do botão/select específico';
    if (category === 'reaction')  filterHint = 'emoji — emoji específico\nchannelId — canal específico';
    if (category === 'time')      filterHint = 'hour — hora (0-23)\nminute — minuto (0-59, opcional)';

    const modal = this.client.interactions.createModal({
      user,
      title: '🔧 Filtros do Trigger',
      components: [{
        type: 1,
        components: [{
          type:        4,
          custom_id:   'filters_json',
          label:       'Filtros (JSON)',
          style:       2,
          required:    false,
          max_length:  500,
          placeholder: filterHint ? `Disponíveis:\n${filterHint}` : '{ "channelId": "123456" }',
          value: (() => {
            const f = { ...flow.trigger.filters };
            delete f.taskId;
            return Object.keys(f).length ? JSON.stringify(f, null, 2) : '';
          })()
        }]
      }],
      funcao: async (modalInteraction, client, fields) => {
        let filters = {};
        if (fields.filters_json?.trim()) {
          try { filters = JSON.parse(fields.filters_json); }
          catch {
            return DiscordRequest(
              `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
              { method: 'POST', body: { type: 4, data: { content: `❌ JSON inválido! ${this._e('brava')}`, flags: 64 } } }
            );
          }
        }

        await this.client.logicEngine.updateFlow(flowId, modalInteraction.guild_id, {
          'trigger.filters': filters
        });

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this.triggerMenu(modalInteraction, user, flowId, { successMsg: `${this._e('feliz')} Filtros salvos!` });
      }
    });

    return this.client.interactions.showModal(interaction, modal);
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
          await this.ui.deferUpdate(i);
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
        label:       this._paramLabel(p),
        style:       p === 'content' || p === 'reason' ? 2 : 1,
        required:    !OPTIONAL_PARAMS.includes(p),
        max_length:  200,
        placeholder: this._paramPlaceholder(p)
      }]
    }));

    // Campo de operador AND/OR
    components.push({
      type: 1,
      components: [{
        type:        4,
        custom_id:   '_meta',
        label:       'Operador (AND ou OR)',
        style:       1,
        required:    false,
        max_length:  10,
        placeholder: 'AND'
      }]
    });

    const modal = this.client.interactions.createModal({
      user,
      title: `Condição: ${meta.label.slice(0, 40)}`,
      components,
      funcao: async (modalInteraction, client, fields) => {
        const params = {};
        for (const p of modalParams) {
          if (fields[p] !== undefined) params[p] = fields[p];
        }

        const metaRaw  = (fields._meta || 'AND').toUpperCase();
        const negate   = metaRaw.startsWith('NOT');
        const operator = negate ? metaRaw.replace('NOT ', '') : metaRaw;
        params._operator = ['AND', 'OR'].includes(operator) ? operator : 'AND';
        params._negate   = negate;

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
        label:       this._paramLabel(p),
        style:       p === 'content' || p === 'reason' ? 2 : 1,
        required:    false,
        max_length:  200,
        placeholder: this._paramPlaceholder(p),
        value:       String(cond.params?.[p] ?? '')
      }]
    }));

    components.push({
      type: 1,
      components: [{
        type:        4,
        custom_id:   '_meta',
        label:       'Operador (AND ou OR)',
        style:       1,
        required:    false,
        max_length:  10,
        placeholder: 'AND',
        value:       cond.operator || 'AND'
      }]
    });

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
        const metaRaw  = (fields._meta || cond.operator || 'AND').toUpperCase();
        const negate   = metaRaw.startsWith('NOT');
        const operator = negate ? metaRaw.replace('NOT ', '') : metaRaw;

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        const needsSelect = meta.params.some(p => SKIP_IN_MODAL.includes(p));
        if (needsSelect) {
          params._condId    = cond.id;
          params._operator  = ['AND', 'OR'].includes(operator) ? operator : 'AND';
          params._negate    = negate;
          return this._resolveSelectParams(modalInteraction, user, flowId, meta, params, 'condition_edit');
        }

        return this._applyConditionEdit(modalInteraction, user, flowId, cond.id, params, ['AND', 'OR'].includes(operator) ? operator : 'AND', negate);
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
          await this.ui.deferUpdate(i);
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

    // Params que vão no modal (sem canal/cargo)
    const modalParams = meta.params.filter(p => !SKIP_IN_MODAL.includes(p) && p !== 'embed');
    const hasEmbed    = meta.params.includes('embed');
    const needsSelect = meta.params.some(p => SKIP_IN_MODAL.includes(p));

    // Modal com os params de texto
    if (modalParams.length > 0 || hasEmbed) {
      return this._openActionModal(interaction, user, flowId, meta, null, modalParams, hasEmbed, needsSelect);
    }

    // Só precisa de canal/cargo — vai direto pro select
    await this.ui.deferUpdate(interaction);
    return this._resolveSelectParams(interaction, user, flowId, meta, {}, 'action');
  }

  async _openActionModal(interaction, user, flowId, meta, existingAction, modalParams, hasEmbed, needsSelect) {
    const isEdit     = !!existingAction;
    const components = [];

    // Params textuais
    for (const p of modalParams.slice(0, hasEmbed ? 3 : 4)) {
      components.push({
        type: 1,
        components: [{
          type:        4,
          custom_id:   p,
          label:       this._paramLabel(p),
          style:       p === 'content' || p === 'reason' ? 2 : 1,
          required:    !OPTIONAL_PARAMS.includes(p),
          max_length:  p === 'content' ? 4000 : 200,
          placeholder: this._paramPlaceholder(p),
          value:       isEdit ? String(existingAction.params?.[p] ?? '') : undefined
        }]
      });
    }

    // Campo de embed separado (JSON completo)
    if (hasEmbed) {
      components.push({
        type: 1,
        components: [{
          type:        4,
          custom_id:   'embed',
          label:       '📋 Embed (JSON — opcional)',
          style:       2,
          required:    false,
          max_length:  4000,
          placeholder: '{"title":"Título","description":"Texto","color":5765120,"fields":[{"name":"Campo","value":"Valor"}]}',
          value:       isEdit ? (existingAction.params?.embed || '') : undefined
        }]
      });
    }

    const modal = this.client.interactions.createModal({
      user,
      title: `${isEdit ? '✏️ Editar' : '➕'} Ação: ${meta.label.slice(0, 35)}`,
      components,
      funcao: async (modalInteraction, client, fields) => {
        const params = isEdit ? { ...existingAction.params } : {};

        for (const p of [...modalParams, ...(hasEmbed ? ['embed'] : [])]) {
          const val = fields[p];
          if (val === undefined) continue;
          if (p === 'embed') {
            if (val.trim()) {
              // Valida JSON do embed
              try { JSON.parse(val.trim()); params.embed = val.trim(); }
              catch {
                return DiscordRequest(
                  `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
                  { method: 'POST', body: { type: 4, data: { content: `❌ JSON do embed inválido! ${this._e('brava')}\nVerifique a estrutura e tente novamente.`, flags: 64 } } }
                );
              }
            }
          } else {
            if (isEdit && val.trim() === '' && OPTIONAL_PARAMS.includes(p)) continue;
            params[p] = val;
          }
        }

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

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
    actions.push({ id: this._uid(), category, type, params, order: actions.length });
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

    const modalParams = (meta?.params || []).filter(p => !SKIP_IN_MODAL.includes(p) && p !== 'embed');
    const hasEmbed    = meta?.params?.includes('embed');
    const needsSelect = meta?.params?.some(p => SKIP_IN_MODAL.includes(p));

    if (!modalParams.length && !hasEmbed && !needsSelect) {
      return this.actionsMenu(interaction, user, flowId, { successMsg: `${this._e('emduvida')} Esta ação não tem parâmetros para editar!` });
    }

    if (!modalParams.length && !hasEmbed && needsSelect) {
      action._actionId = action.id;
      return this._resolveSelectParams(interaction, user, flowId, meta, { ...action.params, _actionId: action.id }, 'action_edit');
    }

    return this._openActionModal(interaction, user, flowId, meta, action, modalParams, hasEmbed, needsSelect);
  }

  async _applyActionEdit(interaction, user, flowId, actionId, params) {
    const flow    = await this._getFlow(interaction.guild_id, flowId);
    const actions = (flow?.actions || []).map(a => {
      if (a.id !== actionId) return a;
      return { ...a, params };
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
    const needsChannel = meta.params.some(p => NEEDS_CHANNEL_SELECT.includes(p));
    const needsRole    = meta.params.some(p => NEEDS_ROLE_SELECT.includes(p));

    if (needsChannel) {
      return this._showChannelSelect(interaction, user, flowId, meta, params, mode);
    }
    if (needsRole) {
      return this._showRoleSelect(interaction, user, flowId, meta, params, mode);
    }

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

        const needsRole = meta.params.some(p => NEEDS_ROLE_SELECT.includes(p));
        if (needsRole) {
          return this._showRoleSelect(i, user, flowId, meta, params, mode);
        }

        return this._finalizeSave(i, user, flowId, meta, params, mode);
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
        return this._finalizeSave(i, user, flowId, meta, params, mode);
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
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'name',
            label:       'Nome da variável (sem espaços)',
            style:       1,
            required:    true,
            max_length:  50,
            placeholder: 'contador, pontos, status, xp_usuario...'
          }]
        },
        {
          type: 1,
          components: [{
            type:        4,
            custom_id:   'persistent',
            label:       'Salvar após o fluxo terminar? (sim/não)',
            style:       1,
            required:    false,
            max_length:  3,
            placeholder: 'não'
          }]
        }
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

        const persistent = ['sim', 'yes', 's', 'true'].includes(fields.persistent?.toLowerCase());

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

  async settingsMenu(interaction, user, flowId) {
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
          `**Nome:** ${flow.name}\n` +
          `**Descrição:** ${flow.description || '_Sem descrição_'}\n` +
          `**Modo de execução:** ${flow.executionMode === 'parallel' ? '🔀 Paralelo (ações ao mesmo tempo)' : '➡️ Sequencial (ações em ordem)'}\n` +
          `**Cooldown:** ${flow.cooldown > 0 ? `${flow.cooldown / 1000}s por usuário` : 'Nenhum'}\n` +
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
    const modal = this.client.interactions.createModal({
      user,
      title: '⏱️ Definir Cooldown',
      components: [{
        type: 1,
        components: [{
          type:        4,
          custom_id:   'seconds',
          label:       'Cooldown em segundos (0 = sem cooldown)',
          style:       1,
          required:    true,
          max_length:  10,
          placeholder: '60'
        }]
      }],
      funcao: async (modalInteraction, client, fields) => {
        const secs = Number(fields.seconds) || 0;
        await this.client.logicEngine.updateFlow(flowId, modalInteraction.guild_id, { cooldown: secs * 1000 });

        await DiscordRequest(
          `/interactions/${modalInteraction.id}/${modalInteraction.token}/callback`,
          { method: 'POST', body: { type: 6 } }
        );

        return this.settingsMenu(modalInteraction, user, flowId);
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
      targetUserId:  'ID do usuário alvo (ou {arg0})',
      cancelMessage: 'Mensagem se o usuário cancelar',
      timeout:       'Tempo limite em segundos'
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
      targetUserId:  '{arg0} ou 123456789012345678',
      cancelMessage: '❌ Operação cancelada.',
      timeout:       '30',
      reason:        'Motivo opcional...',
      nickname:      'Novo apelido',
      permission:    'MANAGE_GUILD'
    };
    return ph[p] || '';
  }
}

module.exports = FlowBuilder;