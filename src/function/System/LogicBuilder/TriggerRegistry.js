'use strict';

const { EventEmitter } = require('events');

class TriggerRegistry extends EventEmitter {

  constructor(client) {
    super();
    this.client = client;
    this.setMaxListeners(200);

    this._boostCache = new Map();
  }


 async handle(payload) {
    const { t: event, d: data } = payload;
    if (!event || !data) return;

    switch (event) {
      case 'MESSAGE_CREATE':   return this._onMessageCreate(data);
      case 'MESSAGE_UPDATE':   return this._onMessageUpdate(data);
      case 'MESSAGE_DELETE':   return this._onMessageDelete(data);

      case 'MESSAGE_REACTION_ADD':    return this._onReactionAdd(data);
      case 'MESSAGE_REACTION_REMOVE': return this._onReactionRemove(data);

      case 'GUILD_MEMBER_ADD':    return this._onMemberJoin(data);
      case 'GUILD_MEMBER_REMOVE': return this._onMemberLeave(data);
      case 'GUILD_MEMBER_UPDATE': return this._onMemberUpdate(data);
      case 'GUILD_BAN_ADD':       return this._onBanAdd(data);
      case 'GUILD_BAN_REMOVE':    return this._onBanRemove(data);

      case 'CHANNEL_CREATE': return this._onChannelCreate(data);
      case 'CHANNEL_DELETE': return this._onChannelDelete(data);
      case 'CHANNEL_UPDATE': return this._onChannelUpdate(data);

      case 'THREAD_CREATE': return this._onThreadCreate(data);
      case 'THREAD_DELETE': return this._onThreadDelete(data);
      case 'THREAD_UPDATE': return this._onThreadUpdate(data);

      case 'VOICE_STATE_UPDATE': return this._onVoiceStateUpdate(data);

      case 'INTERACTION_CREATE': return await this._onInteraction(data);
    }
  }


  _onMessageCreate(data) {
    if (!data.guild_id) return; 
    if (data.author?.bot) return;

    const ctx = this._msgCtx(data);

    this._emit('message', 'message_created', ctx);

    if (data.content) {
      this._emit('message', 'message_contains_text', ctx);
    }

    if (/https?:\/\/\S+/.test(data.content)) {
      this._emit('message', 'message_contains_link', ctx);
    }

    if (data.attachments?.some(a => /\.(png|jpg|jpeg|gif|webp)/i.test(a.filename))) {
      this._emit('message', 'message_contains_image', ctx);
    }

    if (data.attachments?.length > 0) {
      this._emit('message', 'message_contains_file', ctx);
    }

    if (/<@[!&]?\d+>/.test(data.content)) {
      this._emit('message', 'message_contains_mention', ctx);
    }

    if (/\p{Emoji}/u.test(data.content)) {
      this._emit('message', 'message_contains_emoji', ctx);
    }

    if (data.sticker_items?.length) {
      this._emit('message', 'message_contains_sticker', ctx);
    }
  }

  _onMessageUpdate(data) {
    if (!data.guild_id || data.author?.bot) return;
    this._emit('message', 'message_edited', this._msgCtx(data));
  }

  _onMessageDelete(data) {
    if (!data.guild_id) return;
    this._emit('message', 'message_deleted', {
      guildId:   data.guild_id,
      channelId: data.channel_id,
      userId:    null,
      message:   { id: data.id }
    });
  }


  _onReactionAdd(data) {
    if (!data.guild_id) return;
    this._emit('reaction', 'reaction_added', {
      guildId:   data.guild_id,
      channelId: data.channel_id,
      userId:    data.user_id,
      message:   { id: data.message_id },
      customData: { emoji: data.emoji }
    });
  }

  _onReactionRemove(data) {
    if (!data.guild_id) return;
    this._emit('reaction', 'reaction_removed', {
      guildId:   data.guild_id,
      channelId: data.channel_id,
      userId:    data.user_id,
      message:   { id: data.message_id },
      customData: { emoji: data.emoji }
    });
  }


  _onMemberJoin(data) {
    this._emit('member', 'member_joined', {
      guildId:   data.guild_id,
      channelId: null,
      userId:    data.user?.id,
      member:    data
    });
  }

  _onMemberLeave(data) {
    this._emit('member', 'member_left', {
      guildId:   data.guild_id,
      channelId: null,
      userId:    data.user?.id,
      member:    { user: data.user }
    });
  }

  _onMemberUpdate(data) {
    const guildId = data.guild_id;
    const userId  = data.user?.id;
    const base    = { guildId, channelId: null, userId, member: data };

    this._emit('member', 'member_updated', base);

    if ('nick' in data) {
      this._emit('member', 'member_nick_changed', { ...base, customData: { nick: data.nick } });
    }

    if (userId) {
      const cacheKey     = `${guildId}:${userId}`;
      const isBoostingNow = !!data.premium_since;

      if (!this._boostCache.has(cacheKey)) {
        this._boostCache.set(cacheKey, isBoostingNow);
      } else {
        const wasBoosting = this._boostCache.get(cacheKey);

        if (!wasBoosting && isBoostingNow) {
          this._emit('member', 'boost_added', { ...base, customData: { premium_since: data.premium_since } });
        } else if (wasBoosting && !isBoostingNow) {
          this._emit('member', 'boost_removed', base);
        }

        this._boostCache.set(cacheKey, isBoostingNow);
      }
    }
  }

  _onBanAdd(data) {
    this._emit('member', 'member_banned', {
      guildId:   data.guild_id,
      channelId: null,
      userId:    data.user?.id,
      member:    { user: data.user }
    });
  }

  _onBanRemove(data) {
    this._emit('member', 'member_unbanned', {
      guildId:   data.guild_id,
      channelId: null,
      userId:    data.user?.id
    });
  }


  _onChannelCreate(data) {
    if (!data.guild_id) return;
    this._emit('channel', 'channel_created', this._channelCtx(data));
  }

  _onChannelDelete(data) {
    if (!data.guild_id) return;
    this._emit('channel', 'channel_deleted', this._channelCtx(data));
  }

  _onChannelUpdate(data) {
    if (!data.guild_id) return;
    this._emit('channel', 'channel_updated', this._channelCtx(data));
  }


  _onThreadCreate(data) {
    if (!data.guild_id) return;
    if (data.newly_created === false) return;

    this._emit('thread', 'thread_created', {
      guildId:    data.guild_id,
      channelId:  data.id,
      categoryId: data.parent_id || null,
      userId:     data.owner_id || null,
      customData: { thread: data, isPrivate: data.type === 12 }
    });
  }

  _onThreadDelete(data) {
    if (!data.guild_id) return;
    this._emit('thread', 'thread_deleted', {
      guildId:    data.guild_id,
      channelId:  data.id,
      categoryId: data.parent_id || null,
      userId:     null,
      customData: { reason: 'deleted' }
    });
  }

  _onThreadUpdate(data) {
    if (!data.guild_id) return;

    if (data.thread_metadata?.archived) {
      this._emit('thread', 'thread_deleted', {
        guildId:    data.guild_id,
        channelId:  data.id,
        categoryId: data.parent_id || null,
        userId:     null,
        customData: { reason: 'archived', locked: !!data.thread_metadata?.locked }
      });
    }
  }


  _onVoiceStateUpdate(data) {
    if (!data.guild_id) return;

    const ctx = {
      guildId:    data.guild_id,
      channelId:  data.channel_id,
      userId:     data.user_id,
      voiceState: data
    };

    const hadChannel = !!data._previousChannelId;  
    const hasChannel = !!data.channel_id;

    if (!hadChannel && hasChannel) {
      this._emit('voice', 'voice_joined', ctx);
    } else if (hadChannel && !hasChannel) {
      this._emit('voice', 'voice_left', ctx);
    } else if (hadChannel && hasChannel) {
      this._emit('voice', 'voice_moved', ctx);
    }

    if (data.self_video)    this._emit('voice', 'camera_on',   ctx);
    if (!data.self_video)   this._emit('voice', 'camera_off',  ctx);
    if (data.self_stream)   this._emit('voice', 'screen_share_start', ctx);
    if (!data.self_stream)  this._emit('voice', 'screen_share_stop',  ctx);
  }


  async _onInteraction(data) {
  if (!data.guild_id) return;

  const base = {
    guildId:     data.guild_id,
    channelId:   data.channel_id,
    userId:      data.member?.user?.id,
    member:      data.member,
    interaction: data
  };
  
  

  if (data.type === 3) {
    const componentType = data.data?.component_type;
    const cid           = data.data?.custom_id || '';

    const isInternal = cid.startsWith('temp_')
      || cid === 'close_ticket'
      || cid === 'ticket_atender'
      || cid === 'ticket_atendido';

    const parsed        = this._tryParseJson(cid);
    const isSystemJson  = parsed?.t && ['create_ticket', 'hub_select', 'flow_trigger', 'cv2_select'].includes(parsed.t);

    if (componentType === 2 && !isInternal && !isSystemJson) {
      this._emit('component', 'button_clicked', {
        ...base,
        customData: { customId: cid }
      });
    }
    

    if (componentType === 3 && !isInternal && !isSystemJson) {
      
  const customId = interaction.data?.custom_id;
  console.log('[handleComponent] customId:', customId);
  console.log('[handleComponent] parsed:', this._tryParseJson(customId));
      this._emit('component', 'select_used', {
        ...base,
        customData: { customId: cid, values: data.data.values }
      });
    }
  }

  if (data.type === 5) {
    const fields = {};
    for (const row of data.data?.components || []) {
      for (const comp of row.components || []) {
        fields[comp.custom_id] = comp.value;
      }
    }
    this._emit('component', 'modal_submitted', {
      ...base,
      customData: { customId: data.data.custom_id, fields }
    });
  }
}

_tryParseJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}


  emit(category, ctx) {
    if (category === 'internal') {
      super.emit('trigger', {
        triggerCategory: 'internal',
        triggerType:     ctx.eventType || 'custom_event',
        guildId:         ctx.guildId,
        discordCtx: {
          guildId:    ctx.guildId,
          channelId:  null,
          userId:     null,
          customData: ctx.data
        }
      });
      return;
    }
    super.emit(category, ctx);
  }

  emitExternal(triggerCategory, triggerType, discordCtx) {
    this._emit(triggerCategory, triggerType, discordCtx);
  }


  _emit(triggerCategory, triggerType, discordCtx) {
    super.emit('trigger', {
      triggerCategory,
      triggerType,
      guildId: discordCtx.guildId,
      discordCtx
    });
  }

  _msgCtx(data) {
    return {
      guildId:     data.guild_id,
      channelId:   data.channel_id,
      categoryId:  data.channel?.parent_id || null,
      channelName: data.channel?.name || null,
      userId:      data.author?.id,
      member:      data.member,
      message: {
        id:          data.id,
        content:     data.content,
        attachments: data.attachments || [],
        embeds:      data.embeds || [],
        sticker_items: data.sticker_items || []
      }
    };
  }

  _channelCtx(data) {
    return {
      guildId:    data.guild_id,
      channelId:  data.id,
      categoryId: data.parent_id || null,
      userId:     null,
      customData: { channel: data }
    };
  }
}

module.exports = TriggerRegistry;
