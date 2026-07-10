'use strict';

const LISTASHARDS = [0, 3, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57, 62, 67, 72, 77, 82, 87, 92, 97]
const { parentPort } = require('worker_threads');
const MaintenanceMode = require('./Utils/MaintenanceMode.js');
const fs   = require('fs');
const path = require('path');
const { WebSocketManager, WebSocketShardEvents } = require('@discordjs/ws');
const { REST }    = require('@discordjs/rest');
const { Routes }  = require('discord-api-types/v10');

const DiscordRequest       = require('./DiscordRequest.js');
const connectMongo         = require('./ConnectMongo.js');
const InteractionManager   = require('./Manager/InteractionManager.js');
const NextMessageCollector = require('./Manager/MessageCollectorManager.js');
const GuildManager = require('./Manager/GuildManager.js');
const BlacklistManager     = require('./Manager/BlacklistManager.js');
const CommandLogManager    = require('./Manager/CommandLogManager.js');
const TicketSystem         = require('./System/Ticket/index.js');
const UidSystem            = require('./System/UidManager.js');
const TaskManager          = require('./Manager/TaskManager.js');
const UserGlobalDb         = require('../Mongodb/userglobal.js');
const sendDm               = require('./Utils/sendDm.js');
const MessageEmbed         = require('./Messages/EmbedBuild.js');
const GenshinLeaksManager  = require('./System/GenshinLeaksManager.js');
const LogicEngine = require('./System/LogicBuilder/LogicEngine.js')
const FlowUI = require('./System/LogicBuilder/Flow.js');
const BirthdayManager = require("./System/BirthdayManager.js");
const LibraryManager = require("./System/LogicBuilder/LibraryManager.js");
const MissionManager = require('./System/MissionManager.js');
const SecuritySystem = require("./System/SecuritySystem.js")
const GiveawaySystem   = require('./System/Giveaway/GiveawaySystem.js');
const GiveawayScheduler = require('./System/Giveaway/Utils/GiveawayScheduler.js');
const {GiveawayMessageTracker} = require("./System/Giveaway/Utils/GiveawayMessageTracker.js")
const { LanguageManager } = require('./Manager/LanguageManager');
const { ScriptRunner }    = require('./System/LogicScript/ScriptRunner.js');
const { startInternalApi } = require('./System/LogicScript/InternalApi.js');
const MediaManager = require('./Manager/MediaManager');

const EventEmitter = require('events');





const MAX_ADVENTURE_LEVEL  = 60;
const XP_PER_INTERACTION   = 10;
const ROLLS_PER_LEVEL      = 5;
const PRIMOGEMAS_PER_ROLL  = 160;

const INTERACTION_TYPE = Object.freeze({
    APPLICATION_COMMAND: 2,
    MESSAGE_COMPONENT:   3,
    MODAL_SUBMIT:        5,
});

const RECONNECT_BASE_DELAY_MS = 5_000;
const RECONNECT_MAX_DELAY_MS  = 30_000;
const RECONNECT_MAX_ATTEMPTS  = 10;


class DiscordGatewayClient extends EventEmitter {



    constructor(options = {}) {
      super()
        this._validateEnv();

        this.token    = process.env.DISCORD_TOKEN;
        this.clientId = process.env.CLIENT_ID;
        this.options  = options;
        this.CLUSTERS_NAME = ["Azure Dream", "Sweet Night"];

        this.commands = new Map();


        this.rest = new REST({ version: '10' }).setToken(this.token);

        this.manager = new WebSocketManager({
            token:    this.token,
            intents:  options.intents ?? 0,
            rest:     this.rest,
            presence: this._buildDefaultPresence(),
            shardIds:    options.shards      ?? undefined,
            shardCount:  options.totalShards ?? undefined,
        });


        this.interactions      = new InteractionManager(this);
        this.NextMessageCollector = new NextMessageCollector(this);
        this.ticketSystem      = new TicketSystem(this);
        this.taskManager       = new TaskManager(this);
        this.UidManager        = new UidSystem(this);
        this.GenshinLeaksManager = new GenshinLeaksManager(this);
        this.logicEngine = new LogicEngine(this);
        this.logicUI = new FlowUI(this);
        this.libraryManager = new LibraryManager(this);
        this.birthdayManager = new BirthdayManager(this);
        this.missionManager = new MissionManager(this);
        this.security = new SecuritySystem(this);
        this.giveaway   = new GiveawaySystem(this);
        this.gScheduler = new GiveawayScheduler(this);
        this.giveaway.messageTracker = new GiveawayMessageTracker();
        this.logicScriptRunner = new ScriptRunner(this);
        
        this.languageManager = new LanguageManager({
            systemsPath:    path.resolve(process.cwd(), 'src', 'systems'),
            fallbackLocale: 'pt-BR',
            shardId:        process.env.CLUSTER_ID ?? '0',
        });

        
        this.t        = (key, ctx) => this.languageManager.translate(key, ctx);
        this.language = this.t;


        
        this.guilds = new GuildManager(this);
        this.blacklist = new BlacklistManager(this); // seção 3 — carregado após o Mongo conectar (ver _connectMongo)
        this.emoji = require("../public/emojis.js")
        this.MediaManager = MediaManager;

        this._reconnectAttempts = 0;
        this._isReconnecting    = false;
        this._reconnectTimer    = null;
        this._mongoConnected  = false;
        this._mongoConnecting = false;
        
     //   this._loadCommands();
        this._registerGatewayEvents();
        this._registerAntiCrash();
        
    }


    async connect() {
      console.log("\n\n|————————————————————————|\n")
        try {
            console.log('[Gateway] Connecting…');
            await this.manager.connect();
            this._resetReconnect();
            console.log('[Gateway] Connected.');
        } catch (err) {
            console.error('[Gateway] Connection error:', err);
            this._scheduleReconnect();
        }

        // Aguarda MongoDB conectar antes de subir a Internal API
        const waitMongo = async (retries = 20) => {
            if (this._mongoConnected) return true;
            if (retries <= 0) return false;
            await new Promise(r => setTimeout(r, 1500));
            return waitMongo(retries - 1);
        };

        waitMongo().then(async (ok) => {
            if (!ok) {
                console.warn('[LogicScript] MongoDB nao conectou a tempo. Internal API nao iniciada.');
                return;
            }
            await this.logicScriptRunner.start();
            startInternalApi(this);
        });
    }

    /**
     * Sync slash commands with the Discord API.
     * Registers new, updates changed, deletes removed commands.
     */
    async registerSlashCommands() {
      //  console.log('[Deploy] Starting slash command sync…');

        const localCommands = [...this.commands.values()].map(c => c.data);
        const apiCommands   = await this.rest.get(Routes.applicationCommands(this.clientId));

        const apiMap   = new Map(apiCommands.map(c => [c.name, c]));
        const localMap = new Map(localCommands.map(c => [c.name, c]));

        const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };
        


        for (const apiCmd of apiCommands) {
            if (!localMap.has(apiCmd.name)) {
                await this.rest.delete(Routes.applicationCommand(this.clientId, apiCmd.id));
            //    console.log(`[Deploy] Deleted: /${apiCmd.name}`);
                stats.deleted++;
            }
        }


        for (const localCmd of localCommands) {
            const existing = apiMap.get(localCmd.name);

            if (!existing) {
                await this.rest.post(Routes.applicationCommands(this.clientId), { body: localCmd });
           //     console.log(`[Deploy] Created: /${localCmd.name}`);
                stats.created++;
                continue;
            }

            if (this._commandHasChanged(localCmd, existing)) {
                await this.rest.patch(
                    Routes.applicationCommand(this.clientId, existing.id),
                    { body: localCmd }
                );
           //     console.log(`[Deploy] Updated: /${localCmd.name}`);
                stats.updated++;
            } else {
                stats.skipped++;
            }
        }

    //    console.log(
    //        `[Deploy] Done — created: ${stats.created}, updated: ${stats.updated}, ` +
   //         `deleted: ${stats.deleted}, skipped: ${stats.skipped}.`
   //     );

        return stats;
    }

    /** Update the bot's presence/activity on all shards. */
    setPresence(shardId, opts = {}) {
    const payload = {
        op: 3,
        d: {
            since:      opts.since  ?? null,
            activities: [{
                name:    opts.name  ?? `🌙 Constellation | Cluster ${process.env.CLUSTER_ID ?? 0}`,
                type:    opts.type  ?? 0,
                url:     opts.url,
                state:   opts.state,
                details: opts.details,
            }],
            status: opts.status ?? 'online',
            afk:    opts.afk    ?? false,
        },
    };
    
   if (shardId === "all"){
   const shards = process.env.SHARD_LIST?.split(',').map(Number) ?? [0];

    for (const shardId of shards) {
        this.manager.send(shardId, payload);
    }
   } else {
    this.manager.send(shardId, payload);
   }
  }

    _validateEnv() {
        for (const key of ['DISCORD_TOKEN', 'CLIENT_ID', 'MONGO_URI']) {
            if (!process.env[key])
                throw new Error(`[DiscordGatewayClient] Missing env variable: ${key}`);
        }
    }

    _buildDefaultPresence() {
        return {
            status:   'online',
            activity: { name: '🌙 Lua Carmesin', type: 0 },
            afk:      false,
        };
    }


    _loadCommands() {
        const basePath = path.join(process.cwd(), 'src', 'Commands');
        if (!fs.existsSync(basePath)) return;

        let loaded = 0;

        for (const folder of fs.readdirSync(basePath)) {
            const folderPath = path.join(basePath, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;

            for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
                try {
                    const command = require(path.join(folderPath, file));
                    if (!command?.data || !command?.execute) continue;
                    if (!command.info) command.info = {};
                    this.commands.set(command.data.name, command);
                    loaded++;
                } catch (err) {
                    console.error(`[Commands] Failed to load ${file}:`, err);
                }
            }
        }

        console.log(`[Commands] Loaded ${loaded} commands.`);
    }


    _registerGatewayEvents() {
        this.manager.on(WebSocketShardEvents.Dispatch, (payload) =>
            this._handleDispatch(payload)
        );

        this.manager.on(WebSocketShardEvents.Error, (err) => {
            console.error('[Gateway] Error:', err);
            this._scheduleReconnect();
        });

        this.manager.on(WebSocketShardEvents.Close, (event) => {
            console.warn('[Gateway] Closed — code:', event?.code);
            this._scheduleReconnect();
        });
    }



    _registerAntiCrash() {
        process.on('unhandledRejection',        (r)   => console.error('[AntiCrash] Unhandled Rejection:', r));
        process.on('uncaughtException',         (err) => console.error('[AntiCrash] Uncaught Exception:', err));
        process.on('uncaughtExceptionMonitor',  (err) => console.error('[AntiCrash] Exception Monitor:', err));
        process.on('warning', (w) => {

    if (
        w.code === 'MONGOOSE' &&
        w.message?.includes('new option')
    ) {
        return;
    }

    console.warn('[AntiCrash] Warning:', w);
});
    }


    _resetReconnect() {
        this._reconnectAttempts = 0;
        this._isReconnecting    = false;
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }

    _scheduleReconnect() {
        if (this._isReconnecting) return;

        if (this._reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
            console.error('[Reconnect] Maximum attempts reached. Giving up.');
            return;
        }

        this._isReconnecting = true;
        this._reconnectAttempts++;

        const delay = Math.min(
            RECONNECT_BASE_DELAY_MS * this._reconnectAttempts,
            RECONNECT_MAX_DELAY_MS
        );

        console.log(
            `[Reconnect] Retrying in ${delay / 1000}s… ` +
            `(attempt ${this._reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS})`
        );

        this._reconnectTimer = setTimeout(() => this._attemptReconnect(), delay);
    }

    async _attemptReconnect() {
        try {
            await this.manager.connect();
            console.log('[Reconnect] Reconnected successfully.');
            this._resetReconnect();
        } catch (err) {
            console.error('[Reconnect] Attempt failed:', err);
            this._isReconnecting = false;
            this._scheduleReconnect();
        }
    }


    async _handleDispatch(payload) {
        try {
            this.NextMessageCollector.handle(payload);
            this.guilds.handleDispatch(payload);
            await this.logicEngine.handleGateway(payload);
            
            await this.logicScriptRunner.handleGateway(payload).catch(() => {});
            
            if (payload.t === 'MESSAGE_CREATE') return await this._onMessage(payload.d);

            if (payload.t === 'READY')             return await this._onReady(payload.d);
            if (payload.t === 'INTERACTION_CREATE') return await this._onInteraction(payload.d);
            
            if (payload.t === 'VOICE_STATE_UPDATE')   return await this._onVoiceStateUpdate(payload.d);   
        if (payload.t === 'MESSAGE_REACTION_ADD') return await this._onReactionAdd(payload.d);        
        if (payload.t === 'GUILD_MEMBER_ADD')    return await this._onMemberAdd(payload.d);
if (payload.t === 'GUILD_ROLE_CREATE')   return await this._onRoleCreate(payload.d);
if (payload.t === 'CHANNEL_CREATE')      return await this._onChannelCreate(payload.d);
if (payload.t === 'GUILD_MEMBER_UPDATE') return await this._onMemberUpdate(payload.d);
if (payload.t === 'WEBHOOKS_UPDATE')     return await this._onWebhooksUpdate(payload.d);

        } catch (err) {
            console.error('[Dispatch] Unhandled error:', err);
        }
    }
    
    async _onMessage(data) {
  await this.security.handleMessage(data);
  await this.giveaway.messageTracker.onMessage(data)
}
    
    async _onMemberAdd(data) {
  await this.security.handleMemberJoin(data);
}

async _onRoleCreate(data) {
  await this.security.handleRoleCreate(data);
}

async _onChannelCreate(data) {
  await this.security.handleChannelCreate(data);
}

async _onMemberUpdate(data) {
  await this.security.handleMemberUpdate(data);
}

async _onWebhooksUpdate(data) {
  await this.security.handleWebhookCreate(data);
}
    
    
    _onVoiceStateUpdate(d) {
    if (!d.user_id || d.user_id === this.clientId) return;

    if (!this._voiceSessions) this._voiceSessions = new Map();

    const key     = d.user_id;
    const guildId = d.guild_id;

    const wasInVoice = this._voiceSessions.has(key);
    const isInVoice  = !!d.channel_id;

    // Entrou em call
    if (!wasInVoice && isInVoice) {
        this._voiceSessions.set(key, { guildId, joinedAt: Date.now() });

        // Missão: entrar em call (goal = 1)
        this.missionManager.trackEvent(d.user_id, 'join_voice', 1, guildId).catch(() => {});
        return;
    }

    // Saiu ou trocou de canal — calcula minutos
    if (wasInVoice && !isInVoice) {
        const session = this._voiceSessions.get(key);
        this._voiceSessions.delete(key);

        const minutes = Math.floor((Date.now() - session.joinedAt) / 60_000);
        if (minutes > 0) {
            this.missionManager.trackEvent(d.user_id, 'voice_minutes', minutes, session.guildId).catch(() => {});
        }
    }

    // Trocou de canal (saiu de um e entrou em outro) — reinicia sessão
    if (wasInVoice && isInVoice) {
        const session = this._voiceSessions.get(key);
        const minutes = Math.floor((Date.now() - session.joinedAt) / 60_000);
        if (minutes > 0) {
            this.missionManager.trackEvent(d.user_id, 'voice_minutes', minutes, session.guildId).catch(() => {});
        }
        // Reinicia com o novo canal
        this._voiceSessions.set(key, { guildId, joinedAt: Date.now() });
    }
}

// ── Reação ───────────────────────────────────────────────
async _onReactionAdd(d) {
    const userId  = d.user_id;
    const guildId = d.guild_id;

    // Ignora bots
    if (!userId || !guildId) return;

    await this.missionManager.trackEvent(userId, 'add_reaction', 1, guildId).catch(() => {});
}



    async _onReady(d) {
    console.log(`\n----------> SHARD: ${d.shard[0]}`)

    // Seção 5 (correção): marca ANTES de qualquer outra coisa, não depende
    // de Mongo. `d.guilds` é a lista (parcial/unavailable) de guilds que
    // esse shard já tinha antes desse READY — GUILD_CREATE pra uma dessas
    // logo em seguida é resync, não entrada nova.
    this.guilds.markSessionGuilds((d.guilds ?? []).map(g => g.id));
     await this.MediaManager.init()
    await this._loadCommands();
    await this.registerSlashCommands()
  //  await this._connectMongo(); // todos conectam
    const shards = process.env.SHARD_LIST?.split(',').map(Number) ?? [0];
    

    if (LISTASHARDS.includes(d.shard[0])) {
        await this._connectMongo()
        await this._startTaskManager();
        await this.gScheduler.boot();
        await this.logicEngine.start();
        await this.libraryManager.start()
        await this.registerSlashCommands();
        console.log("\n|————————————————————————|")
        await this.emit('ready')
    }
   

    // Seção 6: se alguém já definiu uma presence customizada via comando,
    // ela foi persistida no Mongo — usa ela em vez do texto hardcoded, senão
    // todo restart desfaria a mudança.
    let customPresence = null;
    try {
        const BotConfig = require('../Mongodb/botConfig.js');
        const cfg = await BotConfig.findOne({ key: 'global' }).lean();
        if (cfg?.presence?.name) customPresence = cfg.presence;
    } catch { /* Mongo pode não estar pronto ainda nesse ponto — usa o default */ }

    // Sistema de Atualização Programada — carrega o estado persistido
    // (se a Staff já tiver ativado antes de um restart, por exemplo).
    await require('./Utils/MaintenanceMode.js').loadFromDb();

    this.setPresence(d.shard[0], customPresence ?? {
      name: `🌙 Assinatura "Constellation" por R$7,99 | Cluster ${this.CLUSTERS_NAME[process.env.CLUSTER_ID ?? 0]}, Shard: ${d.shard[0]}/4`
    });
    

}

    async _connectMongo() {
        if (this._mongoConnected || this._mongoConnecting) return;

        this._mongoConnecting = true;
        try {
            await connectMongo();
            this._mongoConnected  = true;
            this._mongoConnecting = false;
            console.log('[Ready] MongoDB connected.');

            // Seção 3: carrega a blacklist pra memória e começa a sincronizar
            // com os outros clusters (Mongo Change Streams — seção 1.3).
            this.blacklist.start().catch(err =>
                console.error('[Blacklist] Falha ao iniciar:', err)
            );
        } catch (err) {
            this._mongoConnecting = false;
            console.error('[Ready] MongoDB connection failed:', err);
        }
    }

    async _startTaskManager() {
        try {
            await this.taskManager.start();
            console.log('[Ready] TaskManager started.');
        } catch (err) {
            console.error('[Ready] TaskManager failed to start:', err);
        }
    }



    async _onInteraction(interaction) {
        // Seção 3: blacklist global — checagem síncrona (cache em memória),
        // ANTES de qualquer processamento (XP, comando, componente, modal).
        const userId = interaction.member?.user?.id ?? interaction.user?.id;
        if (userId && this.blacklist?.isBanned(userId)) {
            return this._replyBlacklisted(interaction, userId);
        }

        // Sistema de Atualização Programada — checagem síncrona (cache em
        // memória), centralizada aqui pra cobrir TODAS as interações
        // (comandos, botões, selects, modais) sem duplicar a verificação em
        // cada handler. Nunca bloqueia a interação — só avisa, em paralelo
        // (fire-and-forget), e o processamento normal continua embaixo.
        if (MaintenanceMode.isActive()) {
            // Pequeno atraso: o followup só é aceito pela API depois que a
            // interação foi respondida (type 4/5/6/9) — o handler do
            // comando/componente/modal faz isso quase sempre nos primeiros
            // milissegundos, então esse atraso garante a ordem sem
            // precisar acoplar este aviso ao fluxo de cada handler.
            setTimeout(() => this._warnMaintenance(interaction), 1500);
        }

        // Always process XP first, regardless of interaction type
        await this._processAdventureRankXp(interaction);

        switch (interaction.type) {
            case INTERACTION_TYPE.APPLICATION_COMMAND:
                return this._executeCommand(interaction);
            case INTERACTION_TYPE.MESSAGE_COMPONENT:
                return this.interactions.handleComponent(interaction);
            case INTERACTION_TYPE.MODAL_SUBMIT:
                return this.interactions.handleModal(interaction);
        }
    }

    /**
     * Avisa sobre a Atualização Programada como um followup efêmero,
     * em paralelo ao processamento normal (nunca await'ado no caminho
     * principal) — por isso nunca atrasa nem impede a interação em si.
     */
    _warnMaintenance(interaction) {
        DiscordRequest(
            `/webhooks/${this.clientId}/${interaction.token}`,
            { method: 'POST', body: { content: MaintenanceMode.getMessage(), flags: 64 } }
        ).catch(() => { /* token pode já ter expirado/sido consumido — ignora */ });
    }

    async _replyBlacklisted(interaction, userId) {
        const entry = this.blacklist.getEntry(userId);
        try {
            await DiscordRequest(
                `/interactions/${interaction.id}/${interaction.token}/callback`,
                {
                    method: 'POST',
                    body: {
                        type: 4,
                        data: {
                            flags: 64, // efêmera — só o usuário banido vê
                            embeds: [{
                                title: '⛔ Você está banido da Ayami',
                                description: 'Você não pode usar a Ayami em nenhum servidor enquanto estiver na blacklist global.',
                                fields: [
                                    { name: 'Staff responsável', value: entry?.staffId ? `<@${entry.staffId}>` : 'Desconhecido', inline: true },
                                    { name: 'Quando', value: entry?.appliedAt ? `<t:${Math.floor(entry.appliedAt / 1000)}:R>` : 'Desconhecido', inline: true },
                                    { name: 'Motivo', value: entry?.motivo ?? 'Não especificado', inline: false },
                                ],
                                color: 0xED4245,
                            }],
                        },
                    },
                }
            );
        } catch (err) {
            console.error('[Blacklist] Falha ao responder usuário banido:', err);
        }
    }

    async _executeCommand(interaction) {
        const command = this.commands.get(interaction.data.name);
        if (!command) return;

        // Seção 4: log de comandos — fire-and-forget, nunca atrasa a resposta real.
        this._logCommand(interaction);

        try {
            await command.execute(interaction, this);
        } catch (err) {
            console.error(`[Command] Error executing /${interaction.data.name}:`, err);
        }
    }

    /**
     * Seção 4 — log de TODOS os comandos (⚠️ ASSUMIDO no prompt original: não
     * só staff/moderação, já que um canal específico foi definido só pra
     * isso). Webhook em tempo real pro canal de log + persistência no banco
     * com TTL, pra consulta histórica depois. Sempre fire-and-forget.
     */
    _logCommand(interaction) {
        try {
            const LOG_CHANNEL_ID = '1522177449440448613';

            const topLevelOption = interaction.data.options?.[0];
            const isSubcommand   = topLevelOption?.type === 1 || topLevelOption?.type === 2;
            const subcommandName = isSubcommand ? topLevelOption.name : null;
            const optionsSource  = isSubcommand ? (topLevelOption.options ?? []) : (interaction.data.options ?? []);

            const optionsMap = {};
            for (const opt of optionsSource) {
                if (opt?.name !== undefined) optionsMap[opt.name] = opt.value;
            }

            const guildId   = interaction.guild_id ?? null;
            const guildName = guildId ? (this.guilds.get(guildId)?.name ?? null) : null;
            const user      = interaction.member?.user ?? interaction.user ?? {};

            CommandLogManager.log(this, {
                commandName:    interaction.data.name,
                subcommandName,
                options:        optionsMap,
                guildId,
                guildName,
                userId:         user.id,
                username:       user.username ?? null,
            });
        } catch (err) {
            console.error('[CommandLog] Falha ao preparar log de comando:', err);
        }
    }



    async _processAdventureRankXp(interaction) {
        const userId = interaction.member?.user?.id;
        if (!userId) return;

        try {
            const user = await this._getOrCreateUser(userId);

            const levelBefore = user.rankaventureiro.nivelAtual;

            this._awardXp(user);
            this._recalculateLevel(user);

            const levelAfter   = user.rankaventureiro.nivelAtual;
            const levelsGained = levelAfter - levelBefore;

            if (levelsGained > 0) {
                this._applyLevelUpRewards(user, levelBefore, levelAfter);
            }

            this._updateXpRemaining(user);

            await user.save();

            if (levelsGained > 0 && user.dmNotificacoes) {
                await this._sendLevelUpDm(userId, user, levelBefore, levelAfter);
            }
        } catch (err) {
            console.error('[AdventureRank] Error processing XP:', err);
        }
    }

    async _getOrCreateUser(userId) {
        let user = await UserGlobalDb.findOne({ userId });

        if (!user) {
            user = await UserGlobalDb.create({
                userId,
                rankaventureiro: { nivelAtual: 0, xpTotal: 0, xpRestante: 1000 },
            });
        }

        if (!user.rankaventureiro) {
            user.rankaventureiro = { nivelAtual: 0, xpTotal: 0, xpRestante: 1000 };
        }

        return user;
    }

    _awardXp(user) {
        user.rankaventureiro.xpTotal += XP_PER_INTERACTION;
    }

    _recalculateLevel(user) {
        let { nivelAtual, xpTotal } = user.rankaventureiro;

        while (nivelAtual < MAX_ADVENTURE_LEVEL) {
            if (xpTotal >= (nivelAtual + 1) * 1000) {
                nivelAtual++;
            } else {
                break;
            }
        }

        user.rankaventureiro.nivelAtual = Math.min(nivelAtual, MAX_ADVENTURE_LEVEL);
    }

    _applyLevelUpRewards(user, levelBefore, levelAfter) {
        const levelsGained = levelAfter - levelBefore;
        const rolls        = levelsGained * ROLLS_PER_LEVEL;
        const primogemas   = rolls * PRIMOGEMAS_PER_ROLL;

        user.primogemas.atm += primogemas;

        if (!Array.isArray(user.primogemas.transacoes)) {
            user.primogemas.transacoes = [];
        }

        user.primogemas.transacoes.push({
            type:      'adventure_rank_reward',
            value:     primogemas,
            rolls,
            old_level: levelBefore,
            new_level: levelAfter,
            date:      Date.now(),
        });
    }

    _updateXpRemaining(user) {
        const { nivelAtual, xpTotal } = user.r