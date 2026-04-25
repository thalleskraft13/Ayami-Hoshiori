const getPerm = require("../../function/Utils/GetPerm");
const DiscordRequest = require("../../function/DiscordRequest");

module.exports = {

  data: {
    name: "configurar-ticket",
    description: "Configurar sistema de tickets"
  },

  info: {
    perm: ["MANAGE_GUILD"] // só organização/admin
  },

  async execute(interaction, client) {

    const guildId = interaction.guild_id;
    const userId = interaction.member.user.id;

    /* =========================================
       PERMISSÃO
    ========================================= */

    
    /* =========================================
       INICIAR SETUP
    ========================================= */
   

    // 🔥 PRIMEIRA RESPOSTA (OBRIGATÓRIA)
    await client.ticketSystem.reply(interaction, {
      content: "⚙️ Configurando...",
      components: []
    });

    // 🔥 AGORA PODE EDITAR NORMAL
    return client.ticketSystem.startSetup(interaction);
  }
};