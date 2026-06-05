require('dotenv').config();
const DiscordGatewayClient = require('./src/function/DiscordGatewayClient.js');

const start = async () => {
    const client = new DiscordGatewayClient({
        intents: 53608447
    });

    await client.registerSlashCommands();
    await client.connect();
}

start()