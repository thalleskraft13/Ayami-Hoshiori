const DiscordRequest = require("../../function/DiscordRequest.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

module.exports = {
    data: {
        name: 'lembrete',
        description: 'Receba um lembrete',
        name_localizations: { 'en-US': 'reminder', 'en-GB': 'reminder', 'es-ES': 'recordatorio' },
        description_localizations: {
            'en-US': 'Get a reminder',
            'en-GB': 'Get a reminder',
            'es-ES': 'Recibe un recordatorio',
        },
        options: [
            {
                name: "tempo",
                description: "Tempo do lembrete (ex: 10s, 5m, 1h30m, 2d)",
                type: 3,
                required: true
            },
            {
                name: "mensagem",
                description: "Mensagem do lembrete",
                type: 3,
                required: true
            }
        ]
    },

    async execute(interaction, client) {
      
      await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`,{
        method: "POST",
        body: {
            "type": 5
        }
      })

        const ctx = localeCtx(interaction);
        const tempoInput = interaction.data.options.find(o => o.name === "tempo")?.value;
        const mensagem = interaction.data.options.find(o => o.name === "mensagem")?.value;

        function parseTime(input) {

            if (!input) return null;

            const regex = /(\d+)([smhd])/g;
            let total = 0;

            let match;

            while ((match = regex.exec(input)) !== null) {

                const value = parseInt(match[1]);
                const unit = match[2];

                switch (unit) {
                    case "s": total += value * 1000; break;
                    case "m": total += value * 60000; break;
                    case "h": total += value * 3600000; break;
                    case "d": total += value * 86400000; break;
                }
            }

            return total || null;
        }

        const delay = parseTime(tempoInput);

        if (!delay) {
            return await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
                method: "POST",
                body: { 
                   content: client.t("lembrete.invalid_time", ctx),
                  }
               });
            
            
        }

        await client.taskManager.create({
            tipo: "lembrete",
            delay,
            dados: {
                userId: interaction.member.user.id,
                channelId: interaction.channel_id,
                mensagem,
                locale: interaction.locale
            }
        });
        
        return await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
                method: "POST",
                body: { 
                   content: client.t("lembrete.created", { ...ctx, tempo: tempoInput })
                  }
               });

    }
};