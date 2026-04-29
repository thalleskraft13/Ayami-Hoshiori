const fs = require('fs');
const path = require('path');
const { WebSocketManager, WebSocketShardEvents } = require('@discordjs/ws');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const connectMongo = require('./ConnectMongo.js');
const InteractionManager = require("./InteractionManager.js");
const NextMessageCollector = require("./MessageCollectorManager.js");
const TicketSystem = require("./Manager/TicketSetup.js");
const TaskManager = require("./TaskManager.js");

class DiscordGatewayClient {

    constructor(options = {}) {

        this._validateEnv();

        this.token = process.env.DISCORD_TOKEN;
        this.clientId = process.env.CLIENT_ID;

        this.commands = new Map();

        this.rest = new REST({ version: '10' }).setToken(this.token);

        this.manager = new WebSocketManager({
            token: this.token,
            intents: options.intents ?? 0,
            
            presence: {
        status: "online",
        activities: [
            { name: "🌙 Lua Carmesin", type: 0 }
        ],
        afk: false
    },
  rest: this.rest,  
        });

        this.interactions = new InteractionManager(this);
        this.NextMessageCollector = new NextMessageCollector(this);
        this.ticketSystem = new TicketSystem(this);
        this.TaskManager = new TaskManager(this);

        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 10;
        this._isReconnecting = false;

        this._loadCommands();
        this._registerEvents();
        this._setupAntiCrash();
    }

    _validateEnv() {

        if (!process.env.DISCORD_TOKEN)
            throw new Error('DISCORD_TOKEN is not defined.');

        if (!process.env.CLIENT_ID)
            throw new Error('CLIENT_ID is not defined.');

        if (!process.env.MONGO_URI)
            throw new Error('MONGO_URI is not defined.');
    }
    
    async setPresence({ status = "online", name = "Arlecchino Bot", type = 0 }) {
    this.manager.updatePresence({
        status,
        activities: [
            {
                name,
                type
            }
        ],
        afk: false
    });
}
    _loadCommands() {

        const basePath = path.join(process.cwd(), 'src', 'Commands');
        if (!fs.existsSync(basePath)) return;

        const folders = fs.readdirSync(basePath);

        for (const folder of folders) {

            const folderPath = path.join(basePath, folder);
            const files = fs.readdirSync(folderPath)
                .filter(file => file.endsWith('.js'));

            for (const file of files) {

                try {

                    const command = require(path.join(folderPath, file));

                    if (!command.data || !command.execute) continue;

                    if (!command.info)
                        command.info = {};

                    this.commands.set(command.data.name, command);

                } catch (err) {
                    console.error(`Erro ao carregar comando ${file}:`, err);
                }
            }
        }
    }

    _registerEvents() {

        this.manager.on(WebSocketShardEvents.Dispatch, async (payload) => {

            try {

                this.NextMessageCollector.handle(payload);

                if (payload.t === "READY") {

                    console.log("Gateway conectado!");
                    

                    try {
                        await connectMongo();
                        console.log("Mongo conectado!");
                    } catch (err) {
                        console.error("Erro ao conectar Mongo:", err);
                    }

                    try {
                        await this.TaskManager.start();
                        console.log("TaskManager iniciado!");
                    } catch (err) {
                        console.error("Erro ao iniciar TaskManager:", err);
                    }
                }

                if (payload.t !== 'INTERACTION_CREATE') return;

                const interaction = payload.d;

                if (interaction.type === 3)
                    return this.interactions.handleComponent(interaction);

                if (interaction.type === 5)
                    return this.interactions.handleModal(interaction);

                if (interaction.type !== 2) return;

                const command = this.commands.get(interaction.data.name);
                if (!command) return;

                try {
                    await command.execute(interaction, this);
                } catch (error) {
                    console.error("Erro ao executar comando:", error);
                }

            } catch (error) {
                console.error("Erro no Dispatch:", error);
            }
        });

        
        this.manager.on(WebSocketShardEvents.Error, (error) => {
            console.error("WebSocket Error:", error);
            this._handleReconnect();
        });

        
        this.manager.on(WebSocketShardEvents.Close, (event) => {
            console.warn("WebSocket Fechado:", event?.code);
            this._handleReconnect();
        });
    }

    async connect() {

        try {

            console.log("Conectando ao Gateway...");
            await this.manager.connect();

            this._reconnectAttempts = 0;
            console.log("Conectado com sucesso!");

        } catch (err) {

            console.error("Erro ao conectar Gateway:", err);
            this._handleReconnect();
        }
    }

    async _handleReconnect() {

        if (this._isReconnecting) return;

        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.error("Máximo de tentativas de reconexão atingido.");
            return;
        }

        this._isReconnecting = true;
        this._reconnectAttempts++;

        const delay = Math.min(5000 * this._reconnectAttempts, 30000);

        console.log(
            `Reconectando em ${delay / 1000}s... (Tentativa ${this._reconnectAttempts})`
        );

        setTimeout(async () => {

            try {

                await this.manager.connect();

                console.log("Reconectado com sucesso!");
                this._reconnectAttempts = 0;

            } catch (err) {

                console.error("Falha ao reconectar:", err);
                this._isReconnecting = false;
                return this._handleReconnect();
            }

            this._isReconnecting = false;

        }, delay);
    }

    _setupAntiCrash() {

        process.on("unhandledRejection", (reason) => {
            console.error("Unhandled Rejection:", reason);
        });

        process.on("uncaughtException", (err) => {
            console.error("Uncaught Exception:", err);
        });

        process.on("uncaughtExceptionMonitor", (err) => {
            console.error("Uncaught Exception Monitor:", err);
        });

        process.on("warning", (warn) => {
            console.warn("Warning:", warn);
        });
    }

    async registerSlashCommands() {

        const localCommands = [...this.commands.values()].map(cmd => cmd.data);

        const apiCommands = await this.rest.get(
            Routes.applicationCommands(this.clientId)
        );

        const apiMap = new Map(
            apiCommands.map(cmd => [cmd.name, cmd])
        );

        for (const apiCmd of apiCommands) {

            if (!this.commands.has(apiCmd.name)) {
                await this.rest.delete(
                    Routes.applicationCommand(this.clientId, apiCmd.id)
                );
            }
        }

        for (const localCmd of localCommands) {

            const existing = apiMap.get(localCmd.name);

            if (!existing) {

                await this.rest.post(
                    Routes.applicationCommands(this.clientId),
                    { body: localCmd }
                );

                continue;
            }

            const localString = JSON.stringify(localCmd);

            const apiComparable = {
                name: existing.name,
                description: existing.description,
                options: existing.options ?? []
            };

            const apiString = JSON.stringify(apiComparable);

            if (localString !== apiString) {

                await this.rest.patch(
                    Routes.applicationCommand(this.clientId, existing.id),
                    { body: localCmd }
                );
            }
        }
    }
}

module.exports = DiscordGatewayClient;