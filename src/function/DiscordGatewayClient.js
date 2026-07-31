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
const { localeCtx }        = require('./Utils/ctxLocale.js');
const connectMongo         = require('./ConnectMongo.js');
const InteractionManager   = require('./Manager/InteractionManager.js');
const NextMessageCollector = require('./Manager/MessageCollectorManager.js');
const GuildManager = require('./Manager/GuildManager.js');
const UserManager   = require('./Manager/UserManager.js');
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
const Missions = require("./Estrelas/Missions.js");
const MessageLibraryManager = require("./System/MessageLibrary/LibraryManager.js");
const MissionManager = require('./System/MissionManager.js');
const SecuritySystem = require("./System/SecuritySystem.js")
const ActivityAnalyticsSystem = require("./System/Activity/ActivityAnalyticsSystem.js")
const EconomyPanelSystem = require("./System/Economia/EconomyPanelSystem.js")
const PrefixEconomyManager = require("./System/Economia/PrefixEconomyManager.js")
const HouseSystem = require("./System/House/index.js")
const GiveawaySystem   = require('./System/Giveaway/GiveawaySystem.js');
const GiveawayScheduler = require('./System/Giveaway/Utils/GiveawayScheduler.js');
const {GiveawayMessageTracker} = require("./System/Giveaway/Utils/GiveawayMessageTracker.js")
const { LanguageManager } = require('./Manager/LanguageManager');
const { ScriptRunner }    = require('./System/LogicScript/ScriptRunner.js');
const EndpointManager     = require('./Manager/EndpointManager.js');
const MediaManager = require('./Manager/MediaManager');
const AyamiProfileManager = require('./System/AyamiProfile/AyamiProfileManager.js');
const { FeatureManager }  = require('./System/FeatureFlags/FeatureManager.js');
const TwitchConfigSystem  = require('./System/Twitch/TwitchConfigSystem.js');
const TwitchMonitorService = require('./System/Twitch/TwitchMonitorService.js');
const YouTubeConfigSystem = require('./System/YouTube/YouTubeConfigSystem.js');
const YouTubeManager      = require('./System/YouTube/YouTubeManager.js');
const CreatorsMenuSystem  = require('./System/Creators/CreatorsMenuSystem.js');
const Economy = require('./Estrelas/Economy.js');

const EventEmitter = require('events');

const MAX_ADVENTURE_LEVEL  = 60;
const XP_PER_INTERACTION   = 10;
const ESTRELAS_PER_LEVEL   = 800;

const INTERACTION_TYPE = Object.freeze({
    APPLICATION_COMMAND:              2,
    MESSAGE_COMPONENT:                3,
    APPLICATION_COMMAND_AUTOCOMPLETE: 4,
    MODAL_SUBMIT:                     5,
});

const AUTOCOMPLETE_CALLBACK_TYPE = 8;

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
        this.isPrimary = options.isPrimary ?? false;
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
        this.messageLibraryManager = new MessageLibraryManager(this);
        this.birthdayManager = new BirthdayManager(this);
        this.missionManager = new MissionManager(this);
        this.security = new SecuritySystem(this);
        this.activityAnalytics = new ActivityAnalyticsSystem(this);
        this.economyPanel = new EconomyPanelSystem(this);
        this.prefixEconomy = new PrefixEconomyManager(this);
        this.houseSystem = new HouseSystem(this);
        this.giveaway   = new GiveawaySystem(this);
        this.gScheduler = new GiveawayScheduler(this);
        this.giveaway.messageTracker = new GiveawayMessageTracker();
        this.logicScriptRunner = new ScriptRunner(this);
        this.endpointManager   = new EndpointManager(this);
        this.ayamiProfile = new AyamiProfileManager(this);
        this.featureManager = new FeatureManager(this);
        this.twitchConfig = new TwitchConfigSystem(this);
        this.twitchMonitor = new TwitchMonitorService(this);
        this.youtubeConfig = new YouTubeConfigSystem(this);
        this.youtubeMonitor = new YouTubeManager(this);
        this.creatorsMenu = new CreatorsMenuSystem(this);

        this.languageManager = new LanguageManager({
            systemsPath:    path.resolve(process.cwd(), 'src', 'systems'),
            fallbackLocale: 'pt-BR',
            shardId:        process.env.CLUSTER_ID ?? '0',
        });

        this.t        = (key, ctx) => this.languageManager.translate(key, ctx);
        this.language = this.t;

        this.guilds = new GuildManager(this);
        this.users  = new UserManager(this);
        this.blacklist = new BlacklistManager(this);
        this.emoji = require("../public/emojis.js")
        this.MediaManager = MediaManager;

        this._reconnectAttempts = 0;
        this._isReconnecting    = false;
        this._reconnectTimer    = null;
        this._mongoConnected  = false;
        this._mongoConnecting = false;

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

        const waitMongo = async (retries = 20) => {
            if (this._mongoConnected) return true;
            if (retries <= 0) return false;
            await new Promise(r => setTimeout(r, 1500));
            return waitMongo(retries - 1);
        };

        waitMongo().then(async (ok) => {
            if (!ok) {
                console.warn('[LogicScript] MongoDB nao conectou a tempo.');
                return;
            }
            await this.logicScriptRunner.start();
            await this.endpointManager.start();
        });
    }

    async registerSlashCommands() {

        const localCommands = [...this.commands.values()].map(c => c.data);
        const apiCommands   = await this.rest.get(Routes.applicationCommands(this.clientId));

        const apiMap   = new Map(apiCommands.map(c => [c.name, c]));
        const localMap = new Map(localCommands.map(c => [c.name, c]));

        const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };

        for (const apiCmd of apiCommands) {
            if (!localMap.has(apiCmd.name)) {
                await this.rest.delete(Routes.applicationCommand(this.clientId, apiCmd.id));
                stats.deleted++;
            }
        }

        for (const localCmd of localCommands) {
            const existing = apiMap.get(localCmd.name);

            if (!existing) {
                await this.rest.post(Routes.applicationCommands(this.clientId), { body: localCmd });
                stats.created++;
                continue;
            }

            if (this._commandHasChanged(localCmd, existing)) {
                await this.rest.patch(
                    Routes.applicationCommand(this.clientId, existing.id),
                    { body: localCmd }
                );
                stats.updated++;
            } else {
                stats.skipped++;
            }
        }

        return stats;
    }

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

            if (payload.t === 'INTERACTION_CREATE') {
                await this._onInteraction(payload.d);
            }

            await this.logicEngine.handleGateway(payload);

            await this.logicScriptRunner.handleGateway(payload).catch(() => {});

            if (payload.t === 'MESSAGE_CREATE') return await this._onMessage(payload.d);

            if (payload.t === 'READY')             return await this._onReady(payload.d);

            if (payload.t === 'VOICE_STATE_UPDATE')   return await this._onVoiceStateUpdate(payload.d);
        if (payload.t === 'MESSAGE_REACTION_ADD') return await this._onReactionAdd(payload.d);
        if (payload.t === 'GUILD_MEMBER_ADD')    return await this._onMemberAdd(payload.d);
        if (payload.t === 'GUILD_MEMBER_REMOVE') return await this._onMemberRemove(payload.d);
if (payload.t === 'GUILD_ROLE_CREATE')   return await this._onRoleCreate(payload.d);
if (payload.t === 'CHANNEL_CREATE')      return await this._onChannelCreate(payload.d);
if (payload.t === 'GUILD_MEMBER_UPDATE') return await this._onMemberUpdate(payload.d);
if (payload.t === 'USER_UPDATE')         return await this._onUserUpdate(payload.d);
if (payload.t === 'WEBHOOKS_UPDATE')     return await this._onWebhooksUpdate(payload.d);
if (payload.t === 'AUTO_MODERATION_ACTION_EXECUTION') return await this._onAutoModExecution(payload.d);
if (payload.t === 'THREAD_CREATE') return await this._onThreadCreate(payload.d);
if (payload.t === 'GUILD_SCHEDULED_EVENT_USER_ADD') return await this._onScheduledEventUserAdd(payload.d);

        } catch (err) {
            console.error('[Dispatch] Unhandled error:', err);
        }
    }

    async _onMessage(data) {
  if (data.author?.id) this.users.set(data.author);
  if (data.guild_id && data.member) this.guilds.setMember(data.guild_id, { ...data.member, user: data.author });

  await this.security.handleMessage(data);
  await this.activityAnalytics.handleMessage(data);
  await this.giveaway.messageTracker.onMessage(data)
  await this.prefixEconomy.handleMessage(data).catch(err => console.error('[PrefixEconomyManager]', err));

  if (data.guild_id && data.author?.id && !data.author?.bot) {
    Missions.progress(data.author.id, { client: this, guildId: data.guild_id, actor: data.author }, 'enviar_mensagens', 1);
  }
}

    async _onMemberAdd(data) {
  await this.security.handleMemberJoin(data);
  await this.activityAnalytics.handleMemberAdd(data);
  await this.houseSystem.handleMemberJoin(data);
}

async _onMemberRemove(data) {
  await this.activityAnalytics.handleMemberRemove(data);
  await this.houseSystem.handleMemberRemove(data);
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

async _onUserUpdate(data) {
  this.users.set(data);
}

async _onWebhooksUpdate(data) {
  await this.security.handleWebhookCreate(data);
}

async _onAutoModExecution(data) {
  await this.security.handleAutoModExecution(data);
}

    _onVoiceStateUpdate(d) {
    if (!d.user_id || d.user_id === this.clientId) return;

    if (!this._voiceSessions) this._voiceSessions = new Map();

    const key     = d.user_id;
    const guildId = d.guild_id;

    const wasInVoice = this._voiceSessions.has(key);
    const isInVoice  = !!d.channel_id;

    if (!wasInVoice && isInVoice) {
        this._voiceSessions.set(key, { guildId, joinedAt: Date.now() });

        this.missionManager.trackEvent(d.user_id, 'join_voice', 1, guildId).catch(() => {});
        if (guildId) Missions.progress(d.user_id, { client: this, guildId }, 'entrar_voz', 1);
        return;
    }

    if (wasInVoice && !isInVoice) {
        const session = this._voiceSessions.get(key);
        this._voiceSessions.delete(key);

        const minutes = Math.floor((Date.now() - session.joinedAt) / 60_000);
        if (minutes > 0) {
            this.missionManager.trackEvent(d.user_id, 'voice_minutes', minutes, session.guildId).catch(() => {});
            Missions.progress(d.user_id, { client: this, guildId: session.guildId }, 'permanecer_voz', minutes);
        }
    }

    if (wasInVoice && isInVoice) {
        const session = this._voiceSessions.get(key);
        const minutes = Math.floor((Date.now() - session.joinedAt) / 60_000);
        if (minutes > 0) {
            this.missionManager.trackEvent(d.user_id, 'voice_minutes', minutes, session.guildId).catch(() => {});
            Missions.progress(d.user_id, { client: this, guildId: session.guildId }, 'permanecer_voz', minutes);
        }
        this._voiceSessions.set(key, { guildId, joinedAt: Date.now() });
    }
}

async _onReactionAdd(d) {
    const userId  = d.user_id;
    const guildId = d.guild_id;

    if (!userId || !guildId) return;

    await this.activityAnalytics.handleReactionAdd(d).catch(() => {});
    await this.missionManager.trackEvent(userId, 'add_reaction', 1, guildId).catch(() => {});
    Missions.progress(userId, { client: this, guildId }, 'reagir_mensagem', 1);
}

async _onThreadCreate(data) {
    const guildId = data.guild_id;
    const userId  = data.owner_id;
    if (!guildId || !userId) return;

    Missions.progress(userId, { client: this, guildId }, 'criar_topico', 1);
}

async _onScheduledEventUserAdd(data) {
    const guildId = data.guild_id;
    const userId  = data.user_id;
    if (!guildId || !userId) return;

    Missions.progress(userId, { client: this, guildId }, 'participar_evento', 1);
}

    async _onReady(d) {
    console.log(`\n----------> SHARD: ${d.shard[0]}`)

    this.guilds.markSessionGuilds((d.guilds ?? []).map(g => g.id));
     await this.MediaManager.init()
    if (!this._commandsLoaded) {
        this._commandsLoaded = true;
        await this._loadCommands();
    }

    if (this.isPrimary && !this._commandsRegistered) {
        this._commandsRegistered = true;
        await this.registerSlashCommands();
    }

    const shards = process.env.SHARD_LIST?.split(',').map(Number) ?? [0];

    if (LISTASHARDS.includes(d.shard[0])) {
        await this._connectMongo()
        await this._startTaskManager();
        await this.gScheduler.boot();
        await this.twitchMonitor.boot();
        await this.youtubeMonitor.boot();
        await this.logicEngine.start();
        await this.libraryManager.start()
        await this.messageLibraryManager.start()
        console.log("\n|————————————————————————|")
        await this.emit('ready')
    }

    let customPresence = null;
    try {
        const BotConfig = require('../Mongodb/botConfig.js');
        const cfg = await BotConfig.findOne({ key: 'global' }).lean();
        if (cfg?.presence?.name) customPresence = cfg.presence;
    } catch {  }

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
        const userId = interaction.member?.user?.id ?? interaction.user?.id;
        if (userId && this.blacklist?.isBanned(userId)) {
            return this._replyBlacklisted(interaction, userId);
        }

        if (MaintenanceMode.isActive()) {
            setTimeout(() => this._warnMaintenance(interaction), 1500);
        }

        this._processAdventureRankXp(interaction).catch(err =>
            console.error('[AdventureRank] Falha ao processar XP (não bloqueante):', err)
        );

        switch (interaction.type) {
            case INTERACTION_TYPE.APPLICATION_COMMAND:
                return this._executeCommand(interaction);
            case INTERACTION_TYPE.APPLICATION_COMMAND_AUTOCOMPLETE:
                return this._executeAutocomplete(interaction);
            case INTERACTION_TYPE.MESSAGE_COMPONENT:
                return this.interactions.handleComponent(interaction);
            case INTERACTION_TYPE.MODAL_SUBMIT:
                return this.interactions.handleModal(interaction);
        }
    }

    async _executeAutocomplete(interaction) {
        const command = this.commands.get(interaction.data.name);

        let choices = [];
        try {
            if (command?.autocomplete) {
                choices = (await command.autocomplete(interaction, this)) ?? [];
            }
        } catch (err) {
            console.error(`[Autocomplete] Error resolving /${interaction.data.name}:`, err);
            choices = [];
        }

        try {
            await DiscordRequest(
                `/interactions/${interaction.id}/${interaction.token}/callback`,
                {
                    method: 'POST',
                    body: {
                        type: AUTOCOMPLETE_CALLBACK_TYPE,
                        data: { choices: choices.slice(0, 25) },
                    },
                }
            );
        } catch (err) {
            console.error(`[Autocomplete] Failed to respond to /${interaction.data.name}:`, err);
        }
    }

    _warnMaintenance(interaction) {
        DiscordRequest(
            `/webhooks/${this.clientId}/${interaction.token}`,
            { method: 'POST', body: { content: MaintenanceMode.getMessage(), flags: 64 } }
        ).catch(() => {  });
    }

    async _replyBlacklisted(interaction, userId) {
        const entry = this.blacklist.getEntry(userId);
        const ctx = localeCtx(interaction);
        try {
            await DiscordRequest(
                `/interactions/${interaction.id}/${interaction.token}/callback`,
                {
                    method: 'POST',
                    body: {
                        type: 4,
                        data: {
                            flags: 64,
                            embeds: [{
                                title: this.t('blacklist.banned_title', ctx),
                                description: this.t('blacklist.banned_description', ctx),
                                fields: [
                                    { name: this.t('blacklist.banned_field_staff', ctx), value: entry?.staffId ? `<@${entry.staffId}>` : this.t('blacklist.banned_unknown', ctx), inline: true },
                                    { name: this.t('blacklist.banned_field_when', ctx), value: entry?.appliedAt ? `<t:${Math.floor(entry.appliedAt / 1000)}:R>` : this.t('blacklist.banned_unknown', ctx), inline: true },
                                    { name: this.t('blacklist.banned_field_reason', ctx), value: entry?.motivo ?? this.t('blacklist.banned_no_reason', ctx), inline: false },
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

        if (command.feature && !(await this.featureManager.guardInteraction(interaction, command.feature))) {
            return;
        }

        this._logCommand(interaction);

        try {
            await command.execute(interaction, this);

            const guildId = interaction.guild_id;
            const userId  = interaction.member?.user?.id ?? interaction.user?.id;
            if (guildId && userId) {
                Missions.progress(userId, { client: this, guildId }, 'usar_comando', 1);
            }
        } catch (err) {
            console.error(`[Command] Error executing /${interaction.data.name}:`, err);
        }
    }

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

            this._updateXpRemaining(user);

            await user.save();

            if (levelsGained > 0) {
                const estrelas = levelsGained * ESTRELAS_PER_LEVEL;

                await new Economy(userId, {
                    client:  this,
                    guildId: interaction.guild_id ?? null,
                    actor:   interaction.member?.user ?? interaction.user
                }).add(estrelas, {
                    action: 'level_reward',
                    metadata: { old_level: levelBefore, new_level: levelAfter }
                }).catch(err => console.error('[AdventureRank] Falha ao creditar Estrelas:', err));
            }

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

    _updateXpRemaining(user) {
        const { nivelAtual, xpTotal } = user.rankaventureiro;

        if (nivelAtual >= MAX_ADVENTURE_LEVEL) {
            user.rankaventureiro.xpRestante = 0;
            return;
        }

        user.rankaventureiro.xpRestante = ((nivelAtual + 1) * 1000) - xpTotal;
    }

    async _sendLevelUpDm(userId, user, levelBefore, levelAfter) {
        try {
            const levelsGained = levelAfter - levelBefore;
            const estrelas      = levelsGained * ESTRELAS_PER_LEVEL;

            const userData = await this.users.getUser(userId);

            const embed = new MessageEmbed()
                .setTitle('Novo Rank de Aventureiro!')
                .setColor('Red')
                .setThumbnail(this._getAvatarUrl(userData))
                .setDescription(this._buildLevelUpDescription({
                    levelBefore,
                    levelAfter,
                    estrelas,
                    xpTotal:    user.rankaventureiro.xpTotal,
                    xpRestante: user.rankaventureiro.xpRestante,
                }));

            await sendDm(userId, { embeds: [embed.build()] });
        } catch (err) {
            console.error('[DM] Failed to send level-up DM:', err);
        }
    }

    _getAvatarUrl(user) {
        if (!user.avatar) return 'https://cdn.discordapp.com/embed/avatars/0.png';
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=1024`;
    }

    _buildLevelUpDescription({ levelBefore, levelAfter, estrelas, xpTotal, xpRestante }) {
        return (
`${this.emoji.animada} Uau, você subiu de rank!! Do **#${levelBefore}** pro **#${levelAfter}**, que incrível!!

Fico tão feliz em ver você crescendo assim! ${this.emoji.corao}

⭐ Recompensa recebida:
**${estrelas.toLocaleString()} Estrelas**

${this.emoji.festa} Aproveita bem, tá?! Cada estrela conta~

Sua experiência atual é **${xpTotal} XP**!
Faltam só **${xpRestante} XP** pro Rank **#${levelAfter + 1}**!

${this.emoji.carinho} Você consegue, eu acredito em você!!
Continua assim e logo logo você vai estar no topo~

Torço muito por você! ${this.emoji.feliz}`
)
    }

    _commandHasChanged(local, api) {
        const normalize = (cmd) => JSON.stringify({
            name:                       cmd.name,
            description:                cmd.description                ?? '',
            options:                    cmd.options                    ?? [],
            default_member_permissions: cmd.default_member_permissions ?? null,
            dm_permission:              cmd.dm_permission              ?? true,
            nsfw:                       cmd.nsfw                       ?? false,
        });

        return normalize(local) !== normalize(api);
    }

getShardId(guildId) {
    const totalShards = parseInt(process.env.TOTAL_SHARDS ?? '1');
    return Number(BigInt(guildId) >> 22n) % totalShards;
}

getShards() {
    return process.env.SHARD_LIST?.split(',').map(Number) ?? [0];
}

getClusterId() {
    return parseInt(process.env.CLUSTER_ID ?? '0');
}

async getShardPing(shardId) {
    try {
        const start = Date.now();
        await DiscordRequest(`/gateway`, { method: 'GET' });
        return Date.now() - start;
    } catch {
        return -1;
    }
}

async getClusterInfo() {
    const shards  = this.getShards();
    const cluster = this.getClusterId();

    const shardInfos = await Promise.all(
        shards.map(async (shardId) => ({
            shardId,
            ping: await this.getShardPing(shardId),
        }))
    );

    const guilds = Array.from(this.guilds.values()).map(g => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
    }));

    return {
        clusterId: cluster,
        shards:    shardInfos,
        totalShards: parseInt(process.env.TOTAL_SHARDS ?? '1'),
        uptime:    process.uptime(),
        memory:    process.memoryUsage().heapUsed,
        guilds,
    };
}

getCacheStats() {
    const userStats   = this.users.getStats();
    const memberStats = this.guilds.getMemberStats();

    return {
        clusterId:         this.getClusterId(),
        users:              userStats.count,
        members:            memberStats.count,
        guilds:             memberStats.guildCount,
        approxMemoryBytes:  userStats.approxBytes + memberStats.approxBytes,
    };
}

requestAllCacheStats() {
    return new Promise((resolve, reject) => {
        const requestId = `cachestats_${Date.now()}`;
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10_000);

        this.once('all_cache_stats_response', (msg) => {
            if (msg.requestId !== requestId) return;
            clearTimeout(timeout);
            resolve(msg.data);
        });

        parentPort.postMessage({ type: 'GET_ALL_CACHE_STATS', requestId });
    });
}

async getGlobalCacheStats() {
    const perCluster = await this.requestAllCacheStats();

    const total = perCluster.reduce((acc, cluster) => {
        if (cluster.error) return acc;
        acc.users             += cluster.users             ?? 0;
        acc.members           += cluster.members           ?? 0;
        acc.guilds            += cluster.guilds            ?? 0;
        acc.approxMemoryBytes += cluster.approxMemoryBytes ?? 0;
        return acc;
    }, { users: 0, members: 0, guilds: 0, approxMemoryBytes: 0 });

    return { total, perCluster };
}

requestAllStats() {
    return new Promise((resolve, reject) => {
        const requestId = `allstats_${Date.now()}`;
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10_000);

        this.once('all_stats_response', (msg) => {
            if (msg.requestId !== requestId) return;
            clearTimeout(timeout);
            resolve(msg.data);
        });

        parentPort.postMessage({ type: 'GET_ALL_STATS', requestId });
    });
}

async getAllGuilds() {
    const allStats = await this.requestAllStats();
    const seen = new Map();
    for (const cluster of allStats) {
        for (const g of cluster.guilds ?? []) {
            seen.set(g.id, g);
        }
    }
    return Array.from(seen.values());
}

async setPresenceAllClusters(opts) {
    const BotConfig = require('../Mongodb/botConfig.js');
    await BotConfig.findOneAndUpdate(
        { key: 'global' },
        { key: 'global', presence: opts },
        { upsert: true }
    );
    parentPort.postMessage({ type: 'REQUEST_SET_PRESENCE', opts });
}

broadcastMaintenanceMode(state) {
    parentPort.postMessage({ type: 'REQUEST_SET_MAINTENANCE', state });
}

}

module.exports = DiscordGatewayClient;
