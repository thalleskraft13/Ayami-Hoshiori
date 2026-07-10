'use strict';

const DiscordRequest = require('../../DiscordRequest.js');

/**
 * ActionRunner
 *
 * Executa as ações de um fluxo contra um ExecutionContext.
 * Ações são executadas na ordem definida pelo campo `order`.
 * Respeita ctx.shouldStop() — para imediatamente se o fluxo for cancelado.
 *
 * Categorias implementadas:
 *   message, embed, user, economy, variable,
 *   inventory, channel, voice, time, system, discord
 *
 * HTTP/Webhook NÃO fazem parte do Logic Builder — ficam exclusivos
 * do Logic Script (function/System/LogicScript/Interpreter.js),
 * que já tem o SafeHttp (rate limit, timeout, bloqueio de IP
 * privado) e a checagem de plano premium.
 */
class ActionRunner {

  constructor(client) {
    this.client = client;
  }

  /* ═══════════════════════════════════════════
     ENTRY POINT
     ═══════════════════════════════════════════ */

  /**
   * Executa todas as ações do fluxo.
   *
   * @param {object[]}         actions  — array de actionSchema, já ordenados
   * @param {ExecutionContext}  ctx
   * @param {'sequential'|'parallel'} mode
   */
  async run(actions, ctx, mode = 'sequential') {
    const sorted = [...actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (mode === 'parallel') {
      await Promise.all(sorted.map(a => this._runOne(a, ctx)));
      return;
    }

    for (const action of sorted) {
      if (ctx.shouldStop()) break;
      await this._runOne(action, ctx);
    }
  }

  /* ═══════════════════════════════════════════
     EXECUÇÃO INDIVIDUAL
     ═══════════════════════════════════════════ */

  async _runOne(action, ctx) {
    try {
      const params = await ctx.interpolateParams(action.params || {});
      await this._dispatch(action.category, action.type, params, ctx);
    } catch (err) {
      console.error(`[ActionRunner] Erro na ação ${action.category}/${action.type}:`, err);
    }
  }

  async _dispatch(category, type, params, ctx) {
    switch (category) {
      case 'message':   return this._message(type, params, ctx);
      case 'embed':     return this._embed(type, params, ctx);
      case 'user':      return this._user(type, params, ctx);
      case 'economy':   return this._economy(type, params, ctx);
      case 'variable':  return this._variable(type, params, ctx);
      case 'inventory': return this._inventory(type, params, ctx);
      case 'channel':   return this._channel(type, params, ctx);
      case 'thread':    return this._thread(type, params, ctx);
      case 'voice':     return this._voice(type, params, ctx);
      case 'time':      return this._time(type, params, ctx);
      case 'system':    return this._system(type, params, ctx);
      case 'discord':   return this._discord(type, params, ctx);
      default:
        console.warn(`[ActionRunner] Categoria desconhecida: ${category}`);
    }
  }

  /* ═══════════════════════════════════════════
     MESSAGE ACTIONS
     ═══════════════════════════════════════════ */

  async _message(type, p, ctx) {
    const channelId = p.channelId || ctx.discord.channelId;
    // valida se o canal pertence ao mesmo servidor
    if (channelId) {
      try {
        const ch = await DiscordRequest(`/channels/${channelId}`);
        if (ch?.guild_id && ch.guild_id !== ctx.discord.guildId) {
          console.warn(`[ActionRunner] Canal ${channelId} pertence a outro servidor — bloqueado.`);
          return;
        }
      } catch {
        return;
      }
    }

    switch (type) {

      case 'send_message': {
        const body = await this._buildMessageBody(p, ctx);
        const msg  = await DiscordRequest(`/channels/${channelId}/messages`, {
          method: 'POST',
          body
        });
        if (msg?.id) {
          ctx.lastMessageId = msg.id;
          ctx.lastChannelId = channelId;
        }
        break;
      }

      case 'edit_message': {
        const targetId = p.messageId || ctx.lastMessageId;
        if (!targetId) break;
        const body = await this._buildMessageBody(p, ctx);
        await DiscordRequest(`/channels/${channelId}/messages/${targetId}`, {
          method: 'PATCH',
          body
        });
        break;
      }

      case 'delete_message': {
        const targetId = p.messageId || ctx.discord.message?.id;
        if (!targetId) break;
        await DiscordRequest(`/channels/${channelId}/messages/${targetId}`, {
          method: 'DELETE'
        });
        break;
      }

      case 'reply_message': {
        const ephemeral = p.ephemeral === true || p.ephemeral === 'true';
        const flags     = ephemeral ? 64 : undefined;

        if (ctx.discord.interaction) {
          const interaction = ctx.discord.interaction;
          const state       = this.client.interactions._getState?.(interaction.id);
          const body        = await this._buildMessageBody(p, ctx);
          if (flags) body.flags = flags;

          if (state && !state.replied && !state.deferred) {
            await DiscordRequest(
              `/interactions/${interaction.id}/${interaction.token}/callback`,
              { method: 'POST', body: { type: 4, data: body } }
            );
          } else {
            await DiscordRequest(
              `/webhooks/${this.client.clientId}/${interaction.token}`,
              { method: 'POST', body }
            );
          }
          break;
        }

        const refId = p.messageId || ctx.discord.message?.id;
        const body  = { ...(await this._buildMessageBody(p, ctx)) };
        if (refId) body.message_reference = { message_id: refId };
        if (flags) body.flags = flags;

        const msg = await DiscordRequest(`/channels/${channelId}/messages`, {
          method: 'POST',
          body
        });
        if (msg?.id) ctx.lastMessageId = msg.id;
        break;
      }

      case 'send_dm': {
        const targetUserId = p.userId || ctx.discord.userId;
        if (!targetUserId) break;
        const dm = await DiscordRequest('/users/@me/channels', {
          method: 'POST',
          body:   { recipient_id: targetUserId }
        });
        if (!dm?.id) break;
        await DiscordRequest(`/channels/${dm.id}/messages`, {
          method: 'POST',
          body:   await this._buildMessageBody(p, ctx)
        });
        break;
      }

      // ── Editar a mensagem original onde o botão/select foi clicado ──
      // Só funciona quando a ação está num fluxo disparado por uma interação
      // de componente (trigger: button_clicked / select_used / modal_submitted).
      case 'edit_interaction_message': {
        const interaction = ctx.discord.interaction;
        if (!interaction) {
          console.warn('[ActionRunner] edit_interaction_message: nenhuma interação de componente disponível neste fluxo.');
          break;
        }

        const removeComponents = p.removeComponents !== 'false'; // padrão: true (remove)

        const body = {};

        // content vazio = mantém o atual (não envia o campo, Discord preserva)
        if (p.content && p.content.trim() !== '') {
          body.content = p.content;
        }

        // embedObj presente = substitui a(s) embed(s) atual(is)
        if (p.embedObj && typeof p.embedObj === 'object') {
          body.embeds = [this._buildEmbed(p.embedObj)];
        }

        // components: [] remove tudo; omitir o campo mantém os atuais
        if (removeComponents) {
          body.components = [];
        }

        // Se a interação ainda não foi respondida (nenhum deferUpdate/update
        // anterior), precisa dar o acknowledge primeiro (type 6 = silencioso,
        // não mostra "pensando..."), senão o Discord marca a interação como
        // falha mesmo que o PATCH @original funcione depois.
        const state = this.client.interactions._getState?.(interaction.id);
        if (!state || (!state.replied && !state.deferred)) {
          await DiscordRequest(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            { method: 'POST', body: { type: 6 } }
          ).catch(() => null);
        }

        await DiscordRequest(
          `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
          { method: 'PATCH', body }
        );
        break;
      }

      case 'delete_bot_message': {
        const cid = p.channelId || ctx.lastChannelId || ctx.discord.channelId;
        const mid = p.messageId || ctx.lastMessageId;
        if (!cid || !mid) break;
        try {
          const msg   = await DiscordRequest(`/channels/${cid}/messages/${mid}`);
          const botId = process.env.CLIENT_ID;
          if (msg?.author?.id !== botId) break;
          await DiscordRequest(`/channels/${cid}/messages/${mid}`, { method: 'DELETE' });
        } catch { break; }
        break;
      }
    }
  }

  async _buildMessageBody(p, ctx) {
    const body = {};
    if (p.content) body.content = p.content;

    // embedObj = objeto estruturado do Embed Builder visual (preferencial)
    if (p.embedObj && typeof p.embedObj === 'object') {
      body.embeds = [this._buildEmbed(p.embedObj)];
    } else if (p.embed) {
      // embed = fallback legado (JSON string ou objeto plano)
      try {
        const raw = typeof p.embed === 'string' ? JSON.parse(p.embed) : p.embed;
        body.embeds = [this._buildEmbed(raw)];
      } catch {
        console.warn('[ActionRunner] Embed JSON inválido — ignorado.');
      }
    }

    // interactionObj = botão ou select vinculado a outro fluxo, configurado
    // direto no painel do FlowBuilder (ver _askInteractionOrFinish)
    if (p.interactionObj && typeof p.interactionObj === 'object') {
      const comp = await this._buildInteractionComponent(p.interactionObj, ctx);
      if (comp) body.components = [{ type: 1, components: [comp] }];
    }

    return body;
  }

  /**
   * Constrói o componente (botão ou select) que dispara outro fluxo,
   * a partir do que foi configurado no painel "Adicionar Interação?".
   *
   * Botões podem ser:
   *   - Permanentes (padrão): custom_id é o JSON {t:'flow_trigger', f: flowId} direto.
   *     Nunca expira, funciona para sempre, qualquer pessoa pode clicar.
   *   - Temporários: registrados no InteractionManager (createButton), que tem TTL
   *     e expira automaticamente do cache após um tempo. Útil para confirmações
   *     pontuais, ações sensíveis a tempo, etc.
   */
  async _buildInteractionComponent(io, ctx) {
    if (io.kind === 'button') {
      const isPermanent = io.permanent !== false; // padrão: permanente

      if (!isPermanent && ctx?.client?.interactions?.createButton) {
        // Temporário — registra no InteractionManager, expira via TTL padrão
        return ctx.client.interactions.createButton({
          user: undefined, // qualquer pessoa pode clicar (não é dono-específico)
          data: {
            label: io.label || 'Clique aqui',
            style: Number(io.style) || 1,
          },
          funcao: async (interaction) => {
            const engine = ctx.client.logicEngine;
            if (!engine) return;
            await engine.runById(io.flowId, {
              guildId:     interaction.guild_id,
              channelId:   interaction.channel_id,
              userId:      interaction.member?.user?.id,
              interaction
            });
          }
        });
      }

      // Permanente — custom_id fixo, reconhecido direto pelo handleComponent
      return {
        type:      2,
        style:     Number(io.style) || 1,
        label:     io.label || 'Clique aqui',
        emoji:     io.emoji ? this._parseEmoji(io.emoji) : undefined,
        custom_id: JSON.stringify({ t: 'flow_trigger', f: io.flowId })
      };
    }

    if (io.kind === 'select' && Array.isArray(io.options) && io.options.length) {
      return {
        type:        3,
        custom_id:   JSON.stringify({ t: 'cv2_select', id: io.id || 'fb_select' }),
        placeholder: io.placeholder || 'Escolha uma opção',
        options:     io.options.map(o => ({
          label:       o.label || 'Opção',
          description: o.description || undefined,
          emoji:       o.emoji ? this._parseEmoji(o.emoji) : undefined,
          value:       JSON.stringify({ t: 'flow_trigger', f: o.flowId })
        }))
      };
    }

    return null;
  }

  _parseEmoji(raw) {
    const custom = raw.match(/^<a?:(\w+):(\d+)>$/);
    if (custom) return { name: custom[1], id: custom[2], animated: raw.startsWith('<a:') };
    return { name: raw };
  }

  /**
   * Normaliza um objeto de embed para o formato da Discord API.
   * Suporta tanto o formato do Embed Builder (objetos aninhados completos)
   * quanto o formato legado simplificado (strings planas).
   */
  _buildEmbed(e) {
    if (!e || typeof e !== 'object') return {};
    const embed = {};

    if (e.title)       embed.title       = e.title;
    if (e.description) embed.description = e.description;
    if (e.url)         embed.url         = e.url;

    // color: aceita número ou string hex
    if (e.color != null) {
      embed.color = typeof e.color === 'string'
        ? parseInt(e.color.replace('#', ''), 16)
        : e.color;
    }

    // footer: aceita { text, icon_url } (builder) ou string (legado)
    if (e.footer) {
      embed.footer = typeof e.footer === 'string'
        ? { text: e.footer }
        : { text: e.footer.text, ...(e.footer.icon_url ? { icon_url: e.footer.icon_url } : {}) };
    }

    // image: aceita { url } (builder) ou string (legado)
    if (e.image) {
      embed.image = typeof e.image === 'string'
        ? { url: e.image }
        : (e.image.url ? { url: e.image.url } : undefined);
    }

    // thumbnail: aceita { url } (builder) ou string (legado)
    if (e.thumbnail) {
      embed.thumbnail = typeof e.thumbnail === 'string'
        ? { url: e.thumbnail }
        : (e.thumbnail.url ? { url: e.thumbnail.url } : undefined);
    }

    // author: aceita { name, icon_url, url } (builder) ou string (legado)
    if (e.author) {
      if (typeof e.author === 'string') {
        embed.author = { name: e.author };
      } else if (e.author.name) {
        embed.author = { name: e.author.name };
        if (e.author.icon_url) embed.author.icon_url = e.author.icon_url;
        if (e.author.url)      embed.author.url      = e.author.url;
      }
    }

    // fields: array de { name, value, inline }
    if (Array.isArray(e.fields) && e.fields.length) {
      embed.fields = e.fields.map(f => ({
        name:   f.name  || '​',
        value:  f.value || '​',
        inline: !!f.inline
      }));
    }

    return embed;
  }

  /* ═══════════════════════════════════════════
     EMBED ACTIONS (alias de message)
     ═══════════════════════════════════════════ */

  async _embed(type, p, ctx) {
    switch (type) {
      case 'send_embed': return this._message('send_message', p, ctx);
      case 'edit_embed': return this._message('edit_message', p, ctx);
    }
  }

  /* ═══════════════════════════════════════════
     USER ACTIONS
     ═══════════════════════════════════════════ */

  async _user(type, p, ctx) {
    const guildId = ctx.discord.guildId;
    const userId  = p.userId || ctx.discord.userId;

    switch (type) {

      case 'give_role':
        await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${p.roleId}`, { method: 'PUT' });
        break;

      case 'remove_role':
        await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${p.roleId}`, { method: 'DELETE' });
        break;

      case 'give_temp_role': {
        await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${p.roleId}`, { method: 'PUT' });
        const durationMs = (Number(p.duration) || 60) * 60_000;
        if (this.client.taskManager) {
          await this.client.taskManager.create({
            tipo:  'remove_role',
            delay: durationMs,
            dados: { guildId, userId, roleId: p.roleId }
          });
        }
        break;
      }

      case 'toggle_role': {
        const roleId = p.roleId;
        if (!roleId) break;
        const member  = await DiscordRequest(`/guilds/${guildId}/members/${userId}`);
        if (!member) break;
        const hasRole = member.roles?.includes(roleId);
        await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
          method: hasRole ? 'DELETE' : 'PUT'
        });
        break;
      }

      case 'ban':
        await DiscordRequest(`/guilds/${guildId}/bans/${userId}`, {
          method: 'PUT',
          body:   { reason: p.reason || 'Automação Logic Builder' }
        });
        break;

      case 'kick':
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' });
        break;

      case 'timeout': {
        const until = new Date(Date.now() + (Number(p.duration) || 60) * 1000).toISOString();
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
          method: 'PATCH',
          body:   { communication_disabled_until: until }
        });
        break;
      }

      case 'remove_timeout':
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
          method: 'PATCH',
          body:   { communication_disabled_until: null }
        });
        break;

      case 'change_nickname':
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
          method: 'PATCH',
          body:   { nick: p.nickname || null }
        });
        break;
    }
  }

  /* ═══════════════════════════════════════════
     ECONOMY ACTIONS
     ═══════════════════════════════════════════ */

  async _economy(type, p, ctx) {
    const eco = this.client.economyManager;
    if (!eco) return;

    const userId  = p.userId || ctx.discord.userId;
    const guildId = ctx.discord.guildId;
    const amount  = Number(p.amount) || 0;

    switch (type) {
      case 'add_coins':    await eco.addBalance(guildId, userId, amount); break;
      case 'remove_coins': await eco.removeBalance(guildId, userId, amount); break;
      case 'set_balance':  await eco.setBalance(guildId, userId, amount); break;
    }
  }

  /* ═══════════════════════════════════════════
     VARIABLE ACTIONS
     ═══════════════════════════════════════════ */

  /**
   * Todas as operações de variável aceitam o param opcional `targetUserId`.
   * Se a variável for de escopo "user" e targetUserId for informado (ID puro
   * ou menção @usuário), a operação afeta a variável DESSE usuário.
   * Se vazio/omitido, afeta o autor que disparou o fluxo (comportamento padrão).
   * Para variáveis de escopo "flow", targetUserId é ignorado.
   */
  async _variable(type, p, ctx) {
    const target = p.targetUserId;

    switch (type) {
      case 'set':
        await ctx.withTargetVar(p.name, target, () => p.value);
        break;

      case 'add':
        await ctx.withTargetVar(p.name, target, (cur) => (Number(cur) || 0) + Number(p.value));
        break;

      case 'sub':
        await ctx.withTargetVar(p.name, target, (cur) => (Number(cur) || 0) - Number(p.value));
        break;

      case 'mul':
        await ctx.withTargetVar(p.name, target, (cur) => (Number(cur) || 0) * Number(p.value));
        break;

      case 'div':
        await ctx.withTargetVar(p.name, target, (cur) => {
          const divisor = Number(p.value);
          if (divisor === 0) return Number(cur) || 0;
          return (Number(cur) || 0) / divisor;
        });
        break;

      case 'random':
        await ctx.withTargetVar(p.name, target, () => {
          const min = Number(p.min) || 0;
          const max = Number(p.max) || 100;
          return Math.floor(Math.random() * (max - min + 1)) + min;
        });
        break;

      case 'create':
        await ctx.withTargetVar(p.name, target, () => p.defaultValue ?? null);
        break;

      case 'push':
        await ctx.withTargetVar(p.name, target, (cur) => {
          const list = Array.isArray(cur) ? [...cur] : [];
          list.push(p.value);
          return list;
        });
        break;

      case 'remove_item':
        await ctx.withTargetVar(p.name, target, (cur) => {
          if (!Array.isArray(cur)) return cur;
          const list = [...cur];
          const idx  = list.indexOf(p.value);
          if (idx !== -1) list.splice(idx, 1);
          return list;
        });
        break;

      case 'remove_index':
        await ctx.withTargetVar(p.name, target, (cur) => {
          if (!Array.isArray(cur)) return cur;
          const list = [...cur];
          list.splice(Number(p.value), 1);
          return list;
        });
        break;

      case 'random_from': {
        let picked = null;
        await ctx.withTargetVar(p.name, target, (cur) => {
          if (Array.isArray(cur) && cur.length) {
            picked = cur[Math.floor(Math.random() * cur.length)];
          }
          return cur; // não modifica a lista original
        });
        // saveAs sempre fica no escopo padrão (autor atual), pois é só o resultado sorteado
        ctx.setVar(p.saveAs || p.name + '_random', picked);
        break;
      }

      case 'show_ranking':
        await this._showRanking(p, ctx);
        break;

      case 'set_user_var': {
        // Ação legada — mantida por compatibilidade. Use 'set' com targetUserId no lugar.
        const { UserVarModel } = require('../../../Mongodb/flow.js');
        const guildId = ctx.discord.guildId;
        const targetUserId = ctx.resolveTargetUserId(p.targetUserId);

        await UserVarModel.findOneAndUpdate(
          { guildId, userId: targetUserId, name: p.name },
          { value: p.value, updatedAt: new Date() },
          { upsert: true, returnDocument: 'after' }
        );
        break;
      }
    }
  }

  /* ═══════════════════════════════════════════
     INVENTORY ACTIONS
     ═══════════════════════════════════════════ */

  async _inventory(type, p, ctx) {
    const inv = this.client.inventoryManager;
    if (!inv) return;

    const userId  = p.userId || ctx.discord.userId;
    const guildId = ctx.discord.guildId;

    switch (type) {
      case 'give_item':    await inv.giveItem(guildId, userId, p.itemId, Number(p.quantity) || 1); break;
      case 'remove_item':  await inv.removeItem(guildId, userId, p.itemId, Number(p.quantity) || 1); break;
      case 'consume_item': await inv.consumeItem(guildId, userId, p.itemId); break;
    }
  }

  /* ═══════════════════════════════════════════
     CHANNEL ACTIONS
     ═══════════════════════════════════════════ */

  async _channel(type, p, ctx) {
    const guildId = ctx.discord.guildId;

    switch (type) {

      case 'create_channel':
        await DiscordRequest(`/guilds/${guildId}/channels`, {
          method: 'POST',
          body:   { name: p.name, type: p.type ?? 0, parent_id: p.categoryId || undefined }
        });
        break;

      case 'delete_channel': {
        const cid = p.channelId || ctx.discord.channelId;
        await DiscordRequest(`/channels/${cid}`, { method: 'DELETE' });
        break;
      }

      case 'rename_channel': {
        const cid = p.channelId || ctx.discord.channelId;
        await DiscordRequest(`/channels/${cid}`, {
          method: 'PATCH',
          body:   { name: p.name }
        });
        break;
      }

      case 'edit_permissions': {
        const cid = p.channelId || ctx.discord.channelId;
        await DiscordRequest(`/channels/${cid}/permissions/${p.targetId}`, {
          method: 'PUT',
          body:   { allow: p.allow || '0', deny: p.deny || '0', type: p.targetType ?? 1 }
        });
        break;
      }

      case 'lock_channel': {
        const cid    = p.channelId;
        const target = p.roleId || ctx.discord.guildId;
        if (!cid) break;
        await DiscordRequest(`/channels/${cid}/permissions/${target}`, {
          method: 'PUT',
          body:   { allow: '0', deny: '2048', type: 0 }
        });
        break;
      }

      case 'unlock_channel': {
        const cid    = p.channelId;
        const target = p.roleId || ctx.discord.guildId;
        if (!cid) break;
        await DiscordRequest(`/channels/${cid}/permissions/${target}`, {
          method: 'PUT',
          body:   { allow: '2048', deny: '0', type: 0 }
        });
        break;
      }
    }
  }

  /* ═══════════════════════════════════════════
     THREAD ACTIONS
     ═══════════════════════════════════════════ */

  async _thread(type, p, ctx) {
    switch (type) {

      // ── Criar tópico público (type 11) ────────────────────────
      case 'create_public_thread': {
        const cid = p.channelId || ctx.discord.channelId;
        if (!cid) break;
        const thread = await DiscordRequest(`/channels/${cid}/threads`, {
          method: 'POST',
          body: {
            name: p.name || 'Novo Tópico',
            type: 11, // PUBLIC_THREAD
            auto_archive_duration: 1440
          }
        }).catch(() => null);
        if (thread?.id) ctx.lastChannelId = thread.id;
        break;
      }

      // ── Criar tópico privado (type 12) ────────────────────────
      case 'create_private_thread': {
        const cid = p.channelId || ctx.discord.channelId;
        if (!cid) break;
        const thread = await DiscordRequest(`/channels/${cid}/threads`, {
          method: 'POST',
          body: {
            name: p.name || 'Novo Tópico Privado',
            type: 12, // PRIVATE_THREAD
            invitable: true,
            auto_archive_duration: 1440
          }
        }).catch(() => null);
        if (thread?.id) ctx.lastChannelId = thread.id;
        break;
      }

      // ── Adicionar usuário ou cargo ao tópico atual ────────────
      case 'add_thread_member': {
        const threadId = ctx.lastChannelId || ctx.discord.channelId;
        if (!threadId) break;

        if (p.threadTargetType === 'role') {
          // Adiciona todos os membros do servidor que têm esse cargo
          const guildId = ctx.discord.guildId;
          const members = await DiscordRequest(`/guilds/${guildId}/members?limit=1000`).catch(() => []);
          const targets = (members || []).filter(m => m.roles?.includes(p.roleId));
          for (const m of targets) {
            await DiscordRequest(`/channels/${threadId}/thread-members/${m.user.id}`, { method: 'PUT' }).catch(() => null);
          }
        } else {
          const targetUserId = ctx.resolveTargetUserId(p.targetUserId);
          if (targetUserId) {
            await DiscordRequest(`/channels/${threadId}/thread-members/${targetUserId}`, { method: 'PUT' }).catch(() => null);
          }
        }
        break;
      }

      // ── Fechar/arquivar o tópico atual ─────────────────────────
      case 'close_thread': {
        const threadId = ctx.lastChannelId || ctx.discord.channelId;
        if (!threadId) break;
        await DiscordRequest(`/channels/${threadId}`, {
          method: 'PATCH',
          body:   { archived: true, locked: true }
        }).catch(() => null);
        break;
      }
    }
  }

  /* ═══════════════════════════════════════════
     VOICE ACTIONS
     ═══════════════════════════════════════════ */

  async _voice(type, p, ctx) {
    const guildId = ctx.discord.guildId;
    const userId  = p.userId || ctx.discord.userId;

    switch (type) {

      case 'move_user':
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
          method: 'PATCH',
          body:   { channel_id: p.channelId }
        });
        break;

      case 'disconnect_user':
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
          method: 'PATCH',
          body:   { channel_id: null }
        });
        break;

      case 'create_voice':
        await DiscordRequest(`/guilds/${guildId}/channels`, {
          method: 'POST',
          body:   { name: p.name || 'call', type: 2, parent_id: p.categoryId || undefined }
        });
        break;

      case 'delete_voice': {
        const cid = p.channelId;
        if (!cid) break;
        await DiscordRequest(`/channels/${cid}`, { method: 'DELETE' });
        break;
      }
    }
  }

  /* ═══════════════════════════════════════════
     TIME ACTIONS
     ═══════════════════════════════════════════ */

  async _time(type, p, ctx) {
    switch (type) {

      case 'wait_seconds':
        await this._sleep(Number(p.seconds) * 1000);
        break;

      case 'wait_minutes':
        await this._sleep(Number(p.minutes) * 60_000);
        break;

      case 'schedule': {
        if (!this.client.taskManager) break;
        await this.client.taskManager.create({
          tipo:  'run_flow',
          delay: Number(p.delayMs) || 60_000,
          dados: { flowId: ctx.flow.flowId, discordCtx: ctx.discord }
        });
        break;
      }
    }
  }

  /* ═══════════════════════════════════════════
     SYSTEM ACTIONS
     ═══════════════════════════════════════════ */

  async _system(type, p, ctx) {
    switch (type) {

      case 'run_flow': {
        const engine = this.client.logicEngine;
        if (!engine) break;

        // ── CORREÇÃO: salva variáveis persistentes ANTES de rodar o fluxo filho
        // Garante que o filho leia os valores já atualizados do banco
        await ctx.savePersistent();

        await engine.runById(p.flowId, ctx.discord);
        break;
      }

      case 'emit_event': {
        const engine = this.client.logicEngine;
        if (!engine) break;

        // ── CORREÇÃO: salva variáveis persistentes ANTES de emitir o evento
        // O fluxo ouvinte do evento vai carregar do banco — precisa estar salvo
        await ctx.savePersistent();

        const interpolatedData = await ctx.interpolateParams(p.data || {});

        engine.triggerRegistry.emit('internal', {
          eventType: p.eventType,
          guildId:   ctx.discord.guildId,
          data:      interpolatedData
        });
        break;
      }

      case 'cancel_flow':
        ctx.cancel();
        break;

      case 'stop_execution':
        ctx.stop();
        break;
        
        case 'ask_confirm': {
          await this._askConfirm(p, ctx);
          break;
        }
    }
  }

  /* ═══════════════════════════════════════════
     DISCORD ACTIONS
     ═══════════════════════════════════════════ */

  async _discord(type, p, ctx) {
    const channelId = p.channelId || ctx.discord.channelId;
    const messageId = p.messageId || ctx.discord.message?.id;

    switch (type) {

      case 'add_reaction':
        if (!messageId) break;
        await DiscordRequest(
          `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(p.emoji)}/@me`,
          { method: 'PUT' }
        );
        break;

      case 'remove_reaction':
        if (!messageId) break;
        await DiscordRequest(
          `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(p.emoji)}/@me`,
          { method: 'DELETE' }
        );
        break;

      case 'pin_message':
        if (!messageId) break;
        await DiscordRequest(`/channels/${channelId}/pins/${messageId}`, { method: 'PUT' });
        break;

      case 'unpin_message':
        if (!messageId) break;
        await DiscordRequest(`/channels/${channelId}/pins/${messageId}`, { method: 'DELETE' });
        break;
    }
  }

  /* ═══════════════════════════════════════════
     (HTTP/Webhook removidos daqui — ficam exclusivos do Logic
     Script, com rate limit/timeout/bloqueio de IP privado/limite
     de plano. Ver function/System/LogicScript/Interpreter.js +
     function/Utils/SafeHttp.js)
     ═══════════════════════════════════════════ */

  /* ═══════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════ */

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _showRanking(p, ctx) {
    const { UserVarModel } = require('../../../Mongodb/flow.js');
    const guildId   = ctx.discord.guildId;
    const channelId = ctx.discord.channelId;
    const varName   = p.varName  || 'money';
    const title     = p.title    || '🏆 Ranking';
    const ephemeral = p.ephemeral === 'true' || p.ephemeral === true;
    const flags     = ephemeral ? 64 : undefined;

    const docs = await UserVarModel.find({ guildId, name: varName })
      .lean()
      .sort({ value: -1 })
      .limit(100);

    if (!docs.length) {
      const msg         = '❌ Nenhum dado encontrado para este ranking.';
      const interaction = ctx.discord.interaction;
      if (interaction) {
        await DiscordRequest(`/webhooks/${this.client.clientId}/${interaction.token}`, {
          method: 'POST', body: { content: msg, flags: 64 }
        });
      } else if (channelId) {
        await DiscordRequest(`/channels/${channelId}/messages`, {
          method: 'POST', body: { content: msg }
        });
      }
      return;
    }

    const PER_PAGE   = 10;
    const totalPages = Math.ceil(docs.length / PER_PAGE);
    const medals     = ['🥇', '🥈', '🥉'];

    function buildEmbed(page) {
      const start   = page * PER_PAGE;
      const entries = docs.slice(start, start + PER_PAGE);
      const desc    = entries.map((doc, idx) => {
        const pos   = start + idx + 1;
        const medal = medals[pos - 1] || `**${pos}.**`;
        return `${medal} <@${doc.userId}> — \`${doc.value}\``;
      }).join('\n');
      return {
        title,
        description: desc,
        color:  0x5865F2,
        footer: { text: `Página ${page + 1} de ${totalPages} • ${docs.length} usuários` }
      };
    }

    function buildComponents(page) {
      const buttons = [];
      if (page > 0)
        buttons.push({ type: 2, style: 2, label: '◀ Anterior', custom_id: `rank_prev_${page}` });
      if (page < totalPages - 1)
        buttons.push({ type: 2, style: 2, label: 'Próxima ▶',  custom_id: `rank_next_${page}` });
      return buttons.length ? [{ type: 1, components: buttons }] : [];
    }

    const interaction = ctx.discord.interaction;
    let messageId;

    if (interaction) {
      const msg = await DiscordRequest(`/webhooks/${this.client.clientId}/${interaction.token}`, {
        method: 'POST',
        body: { embeds: [buildEmbed(0)], components: buildComponents(0), flags }
      });
      messageId = msg?.id;
    } else if (channelId) {
      const msg = await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: { embeds: [buildEmbed(0)], components: buildComponents(0) }
      });
      messageId = msg?.id;
    }

    if (!messageId || totalPages <= 1) return;

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        this.client.interactions._cache.set(`rank_prev_${page}`, {
          expires: Date.now() + 10 * 60_000,
          funcao: async (i) => {
            const newPage = page - 1;
            await DiscordRequest(`/interactions/${i.id}/${i.token}/callback`, {
              method: 'POST',
              body: { type: 7, data: { embeds: [buildEmbed(newPage)], components: buildComponents(newPage) } }
            });
          }
        });
      }
      if (page < totalPages - 1) {
        this.client.interactions._cache.set(`rank_next_${page}`, {
          expires: Date.now() + 10 * 60_000,
          funcao: async (i) => {
            const newPage = page + 1;
            await DiscordRequest(`/interactions/${i.id}/${i.token}/callback`, {
              method: 'POST',
              body: { type: 7, data: { embeds: [buildEmbed(newPage)], components: buildComponents(newPage) } }
            });
          }
        });
      }
    }
  }
  
  async _askConfirm(p, ctx) {
  const channelId = ctx.discord.channelId;
  if (!channelId) return;

  // resolve o userId alvo — pode ser {arg0} já interpolado
  let targetUserId = p.targetUserId?.trim() || '';
  const mentionMatch = targetUserId.match(/^<@!?(\d{17,20})>$/);
  if (mentionMatch) targetUserId = mentionMatch[1];
  if (!targetUserId || !/^\d{17,20}$/.test(targetUserId)) {
    targetUserId = ctx.discord.userId;
  }

  const timeoutSec = Number(p.timeout) || 30;
  const cancelMsg  = p.cancelMessage || '❌ Operação cancelada.';
  const content    = p.content || '❓ Confirmar a operação?';

  return new Promise(async (resolve) => {
    let resolved = false;

    const btnConfirm = this.client.interactions.createButton({
      user: targetUserId,
      tempo: timeoutSec * 1000,
      data:  { label: '✅ Confirmar', style: 3 },
      funcao: async (i) => {
        if (resolved) return;
        resolved = true;
        await DiscordRequest(`/interactions/${i.id}/${i.token}/callback`, {
          method: 'POST',
          body:   { type: 7, data: { components: [] } }
        });
        resolve(true);
      }
    });

    const btnCancel = this.client.interactions.createButton({
      user: targetUserId,
      tempo: timeoutSec * 1000,
      data:  { label: '❌ Cancelar', style: 4 },
      funcao: async (i) => {
        if (resolved) return;
        resolved = true;
        await DiscordRequest(`/interactions/${i.id}/${i.token}/callback`, {
          method: 'POST',
          body:   { type: 7, data: { content: cancelMsg, components: [], embeds: [] } }
        });
        resolve(false);
      }
    });

    // envia a mensagem de confirmação
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        content,
        components: [{ type: 1, components: [btnConfirm, btnCancel] }]
      }
    });

    // timeout — se não responder, cancela
    setTimeout(async () => {
      if (resolved) return;
      resolved = true;
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body:   { content: `⏱️ Tempo esgotado. ${cancelMsg}` }
      });
      resolve(false);
    }, timeoutSec * 1000);

  }).then(confirmed => {
    if (!confirmed) ctx.cancel();
  });
}
}

module.exports = ActionRunner;