'use strict';

const crypto         = require('crypto');
const DiscordRequest = require('../DiscordRequest.js');
const { localeCtx }  = require('../Utils/ctxLocale.js');
const ms             = require('ms');



const DEFAULT_TTL_MS       = ms('10min');
const CACHE_SWEEP_INTERVAL = ms('5min');


const CALLBACK_TYPE = Object.freeze({
    REPLY:        4,
    DEFER_UPDATE: 6,
    MODAL:        9,
});


const FLAGS = Object.freeze({
    EPHEMERAL: 64,
});



class InteractionManager {


    constructor(client) {
        this.client = client;

        this._cache = new Map();

        this._states = new Map();

        this._startCacheSweep();
    }


    createButton({ user, tempo = DEFAULT_TTL_MS, funcao, data = {} }) {
        const id = this._register({ user, funcao }, tempo);

        return {
            type:      2,
            style:     data.style  ?? 1,
            label:     data.label  ?? 'Botao',
            custom_id: id,
        };
    }

    createSelect({ user, tempo = DEFAULT_TTL_MS, funcao, data = {} }) {
        const id = this._register({ user, funcao }, tempo);

        return {
            type:        3,
            custom_id:   id,
            placeholder: data.placeholder ?? 'Escolha uma opcao',
            min_values:  data.min_values  ?? 1,
            max_values:  data.max_values  ?? 1,
            options:     data.options     ?? [],
        };
    }

    createUserSelect({ user, tempo = DEFAULT_TTL_MS, funcao, data = {} }) {
        const id = this._register({ user, funcao }, tempo);

        return {
            type:        5,
            custom_id:   id,
            placeholder: data.placeholder ?? 'Selecione um membro',
            min_values:  data.min_values  ?? 1,
            max_values:  data.max_values  ?? 1,
        };
    }

    createRoleSelect({ user, tempo = DEFAULT_TTL_MS, funcao, data = {} }) {
        const id = this._register({ user, funcao }, tempo);

        return {
            type:        6,
            custom_id:   id,
            placeholder: data.placeholder ?? 'Selecione um cargo',
            min_values:  data.min_values  ?? 1,
            max_values:  data.max_values  ?? 1,
        };
    }

    createChannelSelect({ user, tempo = DEFAULT_TTL_MS, funcao, data = {} }) {
        const id = this._register({ user, funcao }, tempo);

        const component = {
            type:        8,
            custom_id:   id,
            placeholder: data.placeholder ?? 'Selecione um canal',
            min_values:  data.min_values  ?? 1,
            max_values:  data.max_values  ?? 1,
        };

        if (data.channel_types?.length) {
            component.channel_types = data.channel_types;
        }

        return component;
    }

    createModal({ user, tempo = DEFAULT_TTL_MS, title, components, funcao }) {
        const id = this._register({ user, funcao, modal: true }, tempo);

        return {
            custom_id: id,
            title,
            components,
        };
    }



    async showModal(interaction, modalData) {
        await this._callback(interaction, {
            type: CALLBACK_TYPE.MODAL,
            data: modalData,
        });
    }

    async defer(interaction) {
        const state = this._getState(interaction.id);
        if (state.replied || state.deferred) return;

        await this._callback(interaction, { type: CALLBACK_TYPE.DEFER_UPDATE });
        state.deferred = true;
    }



    async handleComponent(interaction) {
        const customId = interaction.data?.custom_id;
        if (!customId) return;

        if (interaction._lsResponded) return;

        try {

            const parsed = this._tryParseJson(customId);
           
console.log(parsed)
if (parsed?.t === 'giveaway_join')  return this.client.giveaway.join(interaction);
if (parsed?.t === 'auth_approve')   return this.client.giveaway.handleAuthResponse(interaction, true);
if (parsed?.t === 'auth_deny')      return this.client.giveaway.handleAuthResponse(interaction, false);
if (parsed?.t === 'ayami_profile_approve') return this.client.ayamiProfile.handleApprove(interaction, parsed.id)
    .catch((err) => this._replyError(interaction, err, 'Ayami Profile Approve'));
if (parsed?.t === 'ayami_profile_reject')  return this.client.ayamiProfile.handleReject(interaction, parsed.id)
    .catch((err) => this._replyError(interaction, err, 'Ayami Profile Reject'));

            if (parsed?.t === 'create_ticket') {
                interaction.data.panelId = parsed.p;
                return await this.client.ticketSystem.create(interaction)
                    .catch((err) => this._replyError(interaction, err, 'Ticket Create'));
            }

            if (customId === 'close_ticket') {
                return await this.client.ticketSystem.close(interaction)
                    .catch((err) => this._replyError(interaction, err, 'Ticket Close'));
            }

            if (parsed?.t === 'create_ticket_select' && parsed?.p) {
                return await this.client.ticketSystem.createFromButton(interaction)
                    .catch((err) => this._replyError(interaction, err, 'Ticket V2 Create (Button)'));
            }

            if (parsed?.t === 'ticket_select_hub' && parsed?.p) {
                return await this.client.ticketSystem.createFromSelect(interaction)
                    .catch((err) => this._replyError(interaction, err, 'Ticket V2 Create (Select)'));
            }

            if (parsed?.t === 'close_ticket_v2') {
                return await this.client.ticketSystem.closeTicket(interaction)
                    .catch((err) => this._replyError(interaction, err, 'Ticket V2 Close'));
            }

            if (parsed?.t === 'hub_select') {
  const selectedValue = interaction.data?.values?.[0];
  if (!selectedValue) return;

  let valueParsed;
  try { valueParsed = JSON.parse(selectedValue); }
  catch { return; }

  if (valueParsed?.t === 'create_ticket') {
    interaction.data.custom_id = selectedValue;
    return await this.client.ticketSystem.create(interaction)
      .catch((err) => this._replyError(interaction, err, 'Hub Select Ticket Create'));
  }
  return;
}

if (parsed?.t === 'flow_trigger' && parsed?.f) {
  if (typeof parsed.f !== 'string' || !parsed.f.length) return;
  
  return await this.client.logicEngine.runById(parsed.f, {
    guildId:     interaction.guild_id,
    channelId:   interaction.channel_id,
    userId:      interaction.member?.user?.id,
    interaction
  }).catch((err) => this._replyError(interaction, err, 'CV2 Flow Button'));
}

if (parsed?.t === 'cv2_select') {
  const selectedValue = interaction.data?.values?.[0];
  if (!selectedValue) return;
  let valueParsed;
  try { valueParsed = JSON.parse(selectedValue); } catch { return; }
  
  if (valueParsed?.t === 'flow_trigger') {
    return await this.client.logicEngine.runById(valueParsed.f, {
      guildId:     interaction.guild_id,
      channelId:   interaction.channel_id,
      userId:      interaction.member?.user?.id,
      interaction
    }).catch((err) => this._replyError(interaction, err, 'CV2 Select Flow'));
  }
  return;
}

if (interaction.data?.custom_id === "birthday_register_btn") {
  return this.client.birthdayManager.handleButtonRegister(interaction);
}


            const entry = this._cache.get(customId);

            if (!entry || this._isExpired(entry)) {
                this._cache.delete(customId);
                return this._replyUnavailable(interaction);
            }

            if (!this._isAuthorized(interaction, entry.user)) {
                return this._replyUnauthorized(interaction);
            }

            await entry.funcao(interaction, this.client);

        } catch (err) {
            await this._replyError(interaction, err, 'Component Handler');
        }
    }

    async handleModal(interaction) {
        const customId = interaction.data?.custom_id;
        if (!customId?.startsWith('temp_')) return;

        const entry = this._cache.get(customId);

        if (!entry?.modal || this._isExpired(entry)) {
            this._cache.delete(customId);
            return this._replyExpired(interaction);
        }

        if (!this._isAuthorized(interaction, entry.user)) {
            return this._replyUnauthorizedModal(interaction);
        }

        try {
            const fields = this._parseModalFields(interaction);
            await entry.funcao(interaction, this.client, fields);
        } catch (err) {
            await this._replyError(interaction, err, 'Modal Handler');
        }
    }



    _register(data, ttl) {
        const id      = this._generateId();
        const expires = Date.now() + ttl;

        this._cache.set(id, { ...data, expires });

        setTimeout(() => this._cache.delete(id), ttl);

        return id;
    }

    _startCacheSweep() {
        setInterval(() => {
            const now = Date.now();
            let removed = 0;

            for (const [key, entry] of this._cache) {
                if (now > entry.expires) {
                    this._cache.delete(key);
                    removed++;
                }
            }

            if (removed > 0)
                console.debug(`[InteractionManager] Cache sweep removed ${removed} expired entries.`);

        }, CACHE_SWEEP_INTERVAL).unref(); 
    }



    _getState(interactionId) {
        if (!this._states.has(interactionId)) {
            this._states.set(interactionId, { replied: false, deferred: false });

            
            setTimeout(() => this._states.delete(interactionId), ms('15min')).unref();
        }

        return this._states.get(interactionId);
    }



    async _callback(interaction, body) {
        const state = this._getState(interaction.id);

        if (state.replied) {
            
            return;
        }

        await DiscordRequest(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            { method: 'POST', body }
        );

        state.replied = true;
    }

    async _reply(interaction, content) {
        const state = this._getState(interaction.id);

        if (!state.replied && !state.deferred) {
            
            return this._callback(interaction, {
                type: CALLBACK_TYPE.REPLY,
                data: { content, flags: FLAGS.EPHEMERAL },
            });
        }

        
        return DiscordRequest(
            `/webhooks/${this.client.clientId}/${interaction.token}`,
            {
                method: 'POST',
                body:   { content, flags: FLAGS.EPHEMERAL },
            }
        );
    }



    _replyUnavailable(interaction) {
    const emoji = this.client.emoji;
    const ctx = localeCtx(interaction, { emoji: emoji.chorando });
    return this._reply(
        interaction,
        this.client.t('interactionmanager.unavailable', ctx)
    );
}

_replyExpired(interaction) {
    const emoji = this.client.emoji;
    const ctx = localeCtx(interaction, { emoji: emoji.emburrada });
    return this._reply(
        interaction,
        this.client.t('interactionmanager.expired', ctx)
    );
}

_replyUnauthorized(interaction) {
    const emoji = this.client.emoji;
    const ctx = localeCtx(interaction, { emoji: emoji.brava });
    return this._reply(interaction, this.client.t('interactionmanager.unauthorized', ctx));
}

_replyUnauthorizedModal(interaction) {
    const emoji = this.client.emoji;
    const ctx = localeCtx(interaction, { emoji: emoji.brava });
    return this._reply(interaction, this.client.t('interactionmanager.unauthorized_modal', ctx));
}

async _replyError(interaction, err, context = 'Erro interno') {
    const emoji = this.client.emoji;
    const errorId = this._errorId();

    console.error(`[InteractionManager] [${errorId}] ${context}`, err);

    const ctx = localeCtx(interaction, { emoji: emoji.assustada });
    const detail = err?.message ?? this.client.t('interactionmanager.error_unknown_detail', ctx);
    const message = this.client.t('interactionmanager.error_message', { ...ctx, context, errorId, detail });

    try {
        await this._reply(interaction, message);
    } catch (replyErr) {
        console.error(`[InteractionManager] [${errorId}] Failed to send error reply:`, replyErr);
    }
}


    isReservedCustomId(customId) {
        if (!customId) return false;

        if (customId.startsWith('temp_')) return true;

        if (customId === 'close_ticket') return true;
        if (customId === 'birthday_register_btn') return true;

        const parsed = this._tryParseJson(customId);
        if (parsed?.t) {
            const reservedTypes = [
                'giveaway_join',
                'auth_approve',
                'auth_deny',
                'create_ticket',
                'create_ticket_select',
                'ticket_select_hub',
                'close_ticket_v2',
                'hub_select',
                'flow_trigger',
                'cv2_select',
                'ayami_profile_approve',
                'ayami_profile_reject',
            ];
            if (reservedTypes.includes(parsed.t)) return true;
        }

        return false;
    }

    _isExpired(entry) {
        return Date.now() > entry.expires;
    }

    _isAuthorized(interaction, expectedUserId) {
        if (!expectedUserId) return true;
        return interaction.member?.user?.id === expectedUserId;
    }


    _generateId() {
        return 'temp_' + crypto.randomBytes(6).toString('hex');
    }

    
    _errorId() {
        return crypto.randomBytes(4).toString('hex');
    }

    _tryParseJson(str) {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    _parseModalFields(interaction) {
        const fields = {};

        const readComponent = (comp) => {
            if (!comp?.custom_id) return;

            if (Array.isArray(comp.values)) {
                fields[comp.custom_id] = comp.values[0] ?? '';
                fields[comp.custom_id + '_all'] = comp.values; 
            } else {
                fields[comp.custom_id] = comp.value ?? '';
            }
        };

        for (const item of interaction.data?.components ?? []) {
            if (item.type === 18 && item.component) {
                readComponent(item.component);
            } else if (Array.isArray(item.components)) {
                for (const comp of item.components) readComponent(comp);
            } else {
                readComponent(item);
            }
        }

        return fields;
    }
}

module.exports = InteractionManager;
