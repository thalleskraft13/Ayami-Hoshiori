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

        /**
         * In-memory component/modal cache.
         * key   → custom_id (temp_<hex>)
         * value → { user, funcao, modal?, expires }
         * @type {Map<string, CacheEntry>}
         */
        this._cache = new Map();

        /**
         * Tracks which interactions have already received a callback,
         * preventing "Unknown Interaction" / "Interaction already replied" errors.
         * key   → interaction.id
         * value → { replied, deferred }
         * @type {Map<string, InteractionState>}
         */
        this._states = new Map();

        this._startCacheSweep();
    }


    /**
     * Build a button component object and register its handler in cache.
     *
     * @param {{ user?: string, tempo?: number, funcao: Function, data?: object }} opts
     * @returns {object} Discord button component object
     */
    createButton({ user, tempo = DEFAULT_TTL_MS, funcao, data = {} }) {
        const id = this._register({ user, funcao }, tempo);

        return {
            type:      2,
            style:     data.style  ?? 1,
            label:     data.label  ?? 'Botao',
            custom_id: id,
        };
    }

    /**
     * Build a select menu component object and register its handler in cache.
     *
     * @param {{ user?: string, tempo?: number, funcao: Function, data?: object }} opts
     * @returns {object} Discord select menu component object
     */
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

    /**
     * Build a User Select component (type 5) and register its handler in cache.
     * Options are populated automatically by Discord based on server members.
     *
     * @param {{ user?: string, tempo?: number, funcao: Function, data?: object }} opts
     * @returns {object} Discord user select component object
     */
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

    /**
     * Build a Role Select component (type 6) and register its handler in cache.
     * Options are populated automatically by Discord based on server roles.
     *
     * @param {{ user?: string, tempo?: number, funcao: Function, data?: object }} opts
     * @returns {object} Discord role select component object
     */
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

    /**
     * Build a Channel Select component (type 8) and register its handler in cache.
     * Options are populated automatically by Discord based on server channels.
     *
     * @param {{ user?: string, tempo?: number, funcao: Function, data?: object }} opts
     * @returns {object} Discord channel select component object
     */
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

    /**
     * Build a modal data object and register its handler in cache.
     *
     * @param {{ user?: string, tempo?: number, title: string, components: object[], funcao: Function }} opts
     * @returns {object} Discord modal data object
     */
    createModal({ user, tempo = DEFAULT_TTL_MS, title, components, funcao }) {
        const id = this._register({ user, funcao, modal: true }, tempo);

        return {
            custom_id: id,
            title,
            components,
        };
    }



    /**
     * Open a modal in response to an interaction.
     * Marks the interaction as replied to prevent double-callback errors.
     *
     * @param {object} interaction
     * @param {object} modalData
     */
    async showModal(interaction, modalData) {
        await this._callback(interaction, {
            type: CALLBACK_TYPE.MODAL,
            data: modalData,
        });
    }

    /**
     * Acknowledge a component interaction without sending a visible reply.
     * Marks the interaction as deferred.
     *
     * @param {object} interaction
     */
    async defer(interaction) {
        const state = this._getState(interaction.id);
        if (state.replied || state.deferred) return;

        await this._callback(interaction, { type: CALLBACK_TYPE.DEFER_UPDATE });
        state.deferred = true;
    }



    /**
     * Handle a MESSAGE_COMPONENT interaction (buttons and select menus).
     * Preserves full compatibility with the JSON custom_id routing system.
     *
     * @param {object} interaction
     */
    async handleComponent(interaction) {
      //console.log(interaction)
        const customId = interaction.data?.custom_id;
        if (!customId) return;

        // Seção "Modals no LogicScript": um botão PERMANENTE do LogicScript
        // (Button().setCustomId(...)) não fica registrado em lugar nenhum
        // aqui — é tratado só dentro de on(buttonClick), que roda ANTES
        // deste método (ver DiscordGatewayClient#_handleDispatch). Sem essa
        // checagem, todo clique nesse tipo de botão caía no fallback lá
        // embaixo (_replyUnavailable) tentando responder uma interação que
        // o script já tinha respondido — sempre falhando em silêncio, só
        // gastando uma chamada à API do Discord à toa a cada clique.
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

            // ── Sistema de Tickets V2 (Components V2) ──
            // Botão único: custom_id = {"t":"create_ticket_select","p":panelId}
            if (parsed?.t === 'create_ticket_select' && parsed?.p) {
                return await this.client.ticketSystem.createFromButton(interaction)
                    .catch((err) => this._replyError(interaction, err, 'Ticket V2 Create (Button)'));
            }

            // Select Hub: custom_id = {"t":"ticket_select_hub","p":panelId}, e o
            // VALOR escolhido pelo usuário é o optionId puro (não precisa ser JSON).
            if (parsed?.t === 'ticket_select_hub' && parsed?.p) {
                return await this.client.ticketSystem.createFromSelect(interaction)
                    .catch((err) => this._replyError(interaction, err, 'Ticket V2 Create (Select)'));
            }

            // Fechar ticket: custom_id = {"t":"close_ticket_v2","p":panelId,"ch":channelId,"u":ownerId}
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

// Botão de fluxo do CV2
if (parsed?.t === 'flow_trigger' && parsed?.f) {
  // verifica se realmente tem um flowId válido
  if (typeof parsed.f !== 'string' || !parsed.f.length) return;
  
  return await this.client.logicEngine.runById(parsed.f, {
    guildId:     interaction.guild_id,
    channelId:   interaction.channel_id,
    userId:      interaction.member?.user?.id,
    interaction
  }).catch((err) => this._replyError(interaction, err, 'CV2 Flow Button'));
}

// Select Menu do CV2
if (parsed?.t === 'cv2_select') {
  const selectedValue = interaction.data?.values?.[0];
  if (!selectedValue) return;
  let valueParsed;
  try { valueParsed = JSON.parse(selectedValue); } catch { return; }
 // console.log(valueParsed)
  
  //console.log(selectedValue, valueParsed)
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

    /**
     * Handle a MODAL_SUBMIT interaction.
     *
     * @param {object} interaction
     */
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



    /**
     * Register a handler in the cache and return its generated id.
     *
     * @param {{ user?: string, funcao: Function, modal?: boolean }} data
     * @param {number} ttl — time-to-live in milliseconds
     * @returns {string} custom_id
     */
    _register(data, ttl) {
        const id      = this._generateId();
        const expires = Date.now() + ttl;

        this._cache.set(id, { ...data, expires });

        // Belt-and-suspenders: individual expiry timeout for exact cleanup.
        setTimeout(() => this._cache.delete(id), ttl);

        return id;
    }

    /**
     * Periodic sweep to remove stale entries that individual timeouts may
     * have missed (e.g. clock drift, process suspension).
     * Prevents long-running memory growth without blocking the event loop.
     */
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



    /**
     * Retrieve (or create) the state record for an interaction.
     * State is cleaned up automatically after Discord's 15-minute window.
     *
     * @param {string} interactionId
     * @returns {{ replied: boolean, deferred: boolean }}
     */
    _getState(interactionId) {
        if (!this._states.has(interactionId)) {
            this._states.set(interactionId, { replied: false, deferred: false });

            
            setTimeout(() => this._states.delete(interactionId), ms('15min')).unref();
        }

        return this._states.get(interactionId);
    }



    /**
     * Send an interaction callback to Discord.
     * Marks the interaction as replied and guards against double-callbacks.
     *
     * @param {object} interaction
     * @param {object} body — callback payload
     */
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

    /**
     * Send an ephemeral text reply.
     * Falls back to a follow-up message when the interaction was already
     * acknowledged (prevents "Unknown Interaction" errors).
     *
     * @param {object} interaction
     * @param {string} content
     */
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


    /**
     * Indica se um custom_id já pertence a um sistema interno (tickets,
     * giveaway, flows CV2, aniversário, ou componentes TEMPORÁRIOS do
     * próprio LogicScript registrados via _register/cache "temp_...").
     *
     * Usado pelo ScriptRunner para decidir se deve ou não disparar
     * on(buttonClick)/on(selectMenu) pro LogicScript: se o id for
     * "reservado", quem trata é o próprio InteractionManager (ou outro
     * subsistema), então o script não deve rodar de novo por cima.
     *
     * Custom ids PERMANENTES criados por Button().setCustomId(...) no
     * LogicScript (ex: "botlist_add_bot") NÃO são reservados — eles
     * precisam continuar disparando on(buttonClick) normalmente.
     *
     * @param {string} customId
     * @returns {boolean}
     */
    isReservedCustomId(customId) {
        if (!customId) return false;

        // Componentes temporários do próprio LogicScript (Button().onClick(),
        // SelectMenu().onClick(), Modal()) — já resolvidos via cache.
        if (customId.startsWith('temp_')) return true;

        // Ids fixos usados por outros subsistemas internos.
        if (customId === 'close_ticket') return true;
        if (customId === 'birthday_register_btn') return true;

        // Ids em formato JSON usados por outros subsistemas internos.
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

    /**
     * Returns true when the interacting user matches the registered owner,
     * or when no owner restriction was set.
     */
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

    /**
     * Attempt to JSON.parse a string without throwing.
     * Returns the parsed object or null on failure.
     *
     * @param {string} str
     * @returns {object|null}
     */
    _tryParseJson(str) {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    /**
     * Extract modal field values into a flat key→value map.
     *
     * @param {object} interaction
     * @returns {Record<string, string>}
     */
    /**
     * Extrai os valores enviados em um modal submit.
     * Suporta dois formatos de wrapper:
     *   - Action Row (type 1)  — formato legado, usado para Text Input
     *   - Label (type 18)      — formato novo, usado para Text Input OU Select dentro de modal
     * E dois tipos de componente:
     *   - Text Input (type 4)   → retorna `.value` (string)
     *   - String/Role/Channel/User Select (type 3/5/6/7/8) → retorna `.values` (array),
     *     normalizado aqui para string (primeiro valor) já que modais não suportam multi-select
     */
    _parseModalFields(interaction) {
        const fields = {};

        const readComponent = (comp) => {
            if (!comp?.custom_id) return;

            if (Array.isArray(comp.values)) {
                // Select Menu dentro de modal (type 18 → component type 3/5/6/7/8)
                fields[comp.custom_id] = comp.values[0] ?? '';
                fields[comp.custom_id + '_all'] = comp.values; // valores completos, se precisar de multi-select
            } else {
                // Text Input (type 4) — legado (Action Row) ou novo (Label)
                fields[comp.custom_id] = comp.value ?? '';
            }
        };

        for (const item of interaction.data?.components ?? []) {
            if (item.type === 18 && item.component) {
                // Label wrapper — o componente real está em item.component
                readComponent(item.component);
            } else if (Array.isArray(item.components)) {
                // Action Row legado — itera os componentes filhos
                for (const comp of item.components) readComponent(comp);
            } else {
                // Componente direto sem wrapper (raro, mas defensivo)
                readComponent(item);
            }
        }

        return fields;
    }
}

module.exports = InteractionManager;
