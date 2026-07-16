const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const ComponentBuilder = require("../../function/Messages/ComponentBuilder.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

module.exports = {
  info: {
    name: 'usuario avatar',
    description: 'Mostra o avatar do usuario',
    options: [{
      value: 0,
      tipo: "mention",
    }]
  },
    data: {
        name: 'usuario',
       description: 'Lista de Comandos sobre Usuarios',
       name_localizations: { 'en-US': 'user', 'en-GB': 'user', 'es-ES': 'usuario' },
       description_localizations: {
         'en-US': 'List of user-related commands',
         'en-GB': 'List of user-related commands',
         'es-ES': 'Lista de comandos sobre usuarios',
       },
       type: 1,
       options: [{
         name: "avatar",
         name_localizations: { 'en-US': "avatar", 'en-GB': "avatar", 'es-ES': "avatar" },
         description: "Mostre o avatar do usuario mencionado",
         description_localizations: { 'en-US': "Shows the mentioned user's avatar", 'en-GB': "Shows the mentioned user's avatar", 'es-ES': "Muestra el avatar del usuario mencionado" },
         type: 1,
         options: [{
           name: "user",
           name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
           description: "Mencione ou insira o ID do usuario",
           description_localizations: { 'en-US': "Mention or enter the user's ID", 'en-GB': "Mention or enter the user's ID", 'es-ES': "Menciona o ingresa el ID del usuario" },
           type: 6,
           required: true
         }]
       }]
    },

    async execute(interaction, client) {
      let options = interaction.data.options;
      let userId = options[0].options[0].value; //user
      
      let user = await DiscordRequest(`/users/${userId}`, {
        method: 'GET'
      });

      const ctx = localeCtx(interaction, { name: user.global_name ? user.global_name : user.username });

      let embed = new MessageEmbed()
      .setTitle(client.t("avatar.title", ctx))
      .setImage(getAvatarURL(user))
      .randomColor()
      .build();
      
    let botaoLink = new ComponentBuilder()
       .newRow()
       .addButton({
           label: client.t("avatar.download_button", ctx),
           style: 5,
           url: getAvatarURL(user)
         })
        .build();
      
      await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`,{
        method: "POST",
        body: {
            "type": 5
        }
      })
      
      await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
                method: "POST",
                body: { 
                   content: `<@${interaction.member.user.id}>`,
                   embeds: [embed],
                   components: botaoLink
                  }
               });
     
      
    }
};

function getAvatarURL(user) {

  if (!user.avatar)
    return `https://cdn.discordapp.com/embed/avatars/0.png`;

  const isGif = user.avatar.startsWith("a_");
  const extension = isGif ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=1024`;
}