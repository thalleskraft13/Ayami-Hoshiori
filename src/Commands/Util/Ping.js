const { Routes } = require('discord-api-types/v10');

module.exports = {
  info: {
    name: 'ping',
    description: 'Mostra o ping do bot'
  },
    data: {
        name: 'ping',
        description: 'Mostra o ping do bot'
    },

    async execute(interaction, client) {

        const wsPing = client.getPing() ?? 'Calculando...';

        await client.rest.post(
            Routes.interactionCallback(interaction.id, interaction.token),
            {
                body: {
                    type: 4,
                    data: {
                        content: `🏓 Pong!`
                    }
                }
            }
        );
    }
};