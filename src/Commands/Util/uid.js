const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");
const MessageEmbed = require("../../function/Messages/EmbedBuild.js");

module.exports = {
  data: {
    name: "uid",
    description: "Comandos relacionados a Uid",
    type: 1,
    options: [{
      name: "salvar",
      description: "Salve seu Uid para todos visualizar",
      type: 1,
      options: [{
        name: "uid",
        description: "Insira seu Uid do jogo",
        type: 10,
        max_length: 15,
        min_length: 7,
        required: true
      },{
        name: "servidor",
        description: "Coloque qual servidor você usa",
        type: 3,
        required: true,
        choices: [{
          name: "America Server",
          value: "1"
        },{
          name: "Europa Server",
          value: "2"
        },{
          name: "Asia Server",
          value: "3"
        }]
      }]
    },{
      name: "ver",
      description: "Veja o Uid de algum membro",
      type: 1,
      options: [{
        name: "usuario",
        description: "Mencione ou insira o ID do usuario",
        type: 6,
        required: true
      }]
    }]
  },
  
  async execute(interaction, client){
    const subcommand = interaction.data.options[0];
    const authorId = interaction.member.user.id;
    
    if (subcommand.name === "salvar"){
      let uid = subcommand.options?.[0]?.value;
      let server = subcommand.options?.[1]?.value;
      let servidores = {
        "1": "America Server",
        "2": "Europa Server",
        "3": "Asia Server"
      };
      
      let userdb = await db.findOne({
        userId: authorId
      });
      
      if (!userdb){
        let newuser = new db({
          userId: authorId
        });
        
        await newuser.save();
        
        userdb = await db.findOne({
          userId: authorId
        });
      };
      
      userdb.uidGenshin = uid;
      userdb.server = servidores[server];
      await userdb.save();
      
      await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`,{
        method: "POST",
        body: {
          type: 4,
          data: {
            content: `✨ | Seu UID foi salvo para **${uid} \`(${servidores[server]})\`** com sucesso.`
          }
        }
      })
    } else if (subcommand.name === "ver"){
      
      let userID = subcommand.options?.[0]?.value;
      let embed = new MessageEmbed();
      let userdb = await db.findOne({
        userId: userID
      })
      
      if (!userdb){
        let newuser = new db({
          userId: userID
        });
        
        await newuser.save();
        
        userdb = await db.findOne({
          userId: userID
        });
      };
      
      let user = await DiscordRequest(`/users/${userID}`, {
        method: 'GET'
      });
      
      if (userdb.uidGenshin === null || userdb.uidGenshin === 0){
        
        embed.setTitle("Uid não encontrado...");
        embed.setDescription(`[${user.global_name ? user.global_name : user.username}](https://discord.com/users/${userID}) não tem um UID salvo.`);
        embed.setColor("Red")
        
        
        return await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`,{
        method: "POST",
        body: {
          type: 4,
          data: {
            content: `<@${authorId}>`,
            embeds: [embed.build()]
          }
        }
      })
      } else {
        
        embed.setTitle(`Uid de ${user.global_name ? user.global_name : user.username}`);
        embed.setDescription(`O UID de  [${user.global_name ? user.global_name : user.username}](https://discord.com/users/${userID}) é **${userdb.uidGenshin} \`(${userdb.server}\`**.`);
        embed.setColor("Blue");
        embed.setThumbnail(getAvatarURL(user));
        
      
      await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`,{
        method: "POST",
        body: {
          type: 4,
          data: {
            content: `<@${authorId}>`,
            embeds: [embed.build()]
          }
        }
      })
      };
      
    }
  }
}


function getAvatarURL(user) {

  if (!user.avatar)
    return `https://cdn.discordapp.com/embed/avatars/0.png`;

  const isGif = user.avatar.startsWith("a_");
  const extension = isGif ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=1024`;
}