const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");

module.exports = {
  data: {
    name: "notificações",
    description: "Ative ou Desative as notificações por DM",
    type: 1
  },
  
  async execute(interaction,client){
    
    const authorId = interaction.member.user.id;
    
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
      })
    };
    
    await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`,{
      method: "POST",
      body: {
        type: 4,
        data: {
          content: userdb.dmNotificacoes ? `Você desativou suas notificações por DM.` : `Você ativou suas notificações por DM.`
        }
      }
    })
    
    if (userdb.dmNotificacoes) {
      userdb.dmNotificacoes = false;
    } else {
      userdb.dmNotificacoes = true;
    }
    
    await userdb.save();
    
  }
}