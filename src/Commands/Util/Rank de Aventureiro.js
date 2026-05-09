const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");
const ComponentBuilder = require("../../function/Messages/ComponentBuilder.js");

module.exports = {
  data: {
    name: "rank-de-aventureiro",
    description: "Comandos relacionados ao Rank de Aventureiro",
    type: 1,
    options: [{
      name: "ver",
      description: "Veja seu Rank de Aventureiro atual",
      type: 1,
      options: [{
        name: "usuario",
        description: "Mencione ou Insira o ID",
        type: 6,
        required: false
      }]
    },{
      name: "placar",
      description: "Veja os maiores aventureiros",
      type: 1
    }]
  },
  
  async execute(interaction, client) {

    const subcommand = interaction.data.options[0];
    const authorId = interaction.member.user.id;
    
    if (subcommand.name === "ver"){
      const mentionedUser = subcommand.options?.[0]?.value;
      const targetId = mentionedUser || authorId;
      
      let userdb = await db.findOne({
        userId: targetId
      });
      
      if (!userdb){
        let newuser = new db({
          userId: targetId
        });
        
        await newuser.save();
        
        userdb = await db.findOne({
          userId: targetId
        });
      };
      
      let Ar = userdb.rankaventureiro.nivelAtual;
      let xpAtual = userdb.rankaventureiro.xpTotal;
      let xpRestante = userdb.rankaventureiro.xpRestante;
      let user = await DiscordRequest(`/users/${targetId}`, {
        method: 'GET'
      });
      
      let texto;
      if (targetId === authorId) {
        texto = `Você está atualmente no **Rank de Aventureiro ${Ar} \`(${xpAtual}XP)\`** e resta apenas ${xpRestante}XP para atingir o proximo rank.\n\n-# Continue crescendo. Eu observo cada passo seu… e espero progresso.`
      } else {
        texto = `O usuario [${user.global_name ? user.global_name : user.username}](https://discord.com/users/${targetId}) está atualmente no **Rank de Aventureiro ${Ar} \`(${xpAtual}XP)\`** e resta apenas ${xpRestante}XP para atingir o proximo rank.\n\n-# Continue crescendo. Eu observo cada passo seu… e espero progresso.`
      }
      
     


//32768

await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`,{
        method: "POST",
        body: {
            "type": 4,
            "data": {
              flags: 32768,
              components: [
    {
        "type": 17,
        "accent_color": 5763719,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": getAvatarURL(user)
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Rank de Aventureiro"
                    }
                ]
            },
            {
                "type": 10,
                "content": texto
            }
        ]
    }
]
            }
        }
      })


      
    } else if (subcommand.name === "placar") {

  const pageSize = 10;
  let page = 0;

  const users = await db.find({
    "rankaventureiro.nivelAtual": { $gt: 0 }
  }).sort({
    "rankaventureiro.nivelAtual": -1
  });

  if (!users.length) {
    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: "POST",
      body: {
        type: 4,
        data: {
          content: "Ainda não há aventureiros no ranking.",
          flags: 64
        }
      }
    });
  }

  const totalPages = Math.ceil(users.length / pageSize);

  const generateDescription = async (pageIndex) => {

    const start = pageIndex * pageSize;
    const current = users.slice(start, start + pageSize);

    const lines = [];

    for (let index = 0; index < current.length; index++) {

      const u = current[index];
      const position = start + index + 1;

      let user;
      try {
        user = await DiscordRequest(`/users/${u.userId}`, {
          method: "GET"
        });
      } catch {
        user = { username: "Usuário desconhecido" };
      }

      const name = user.global_name || user.username;

      lines.push(
        `**#${position}** [${name}](https://discord.com/users/${u.userId}) • Rank ${u.rankaventureiro.nivelAtual} \`(${u.rankaventureiro.xpTotal} XP)\``
      );
    }

    return lines.join("\n");
  };

  const updateMessage = async (interaction, newPage) => {

    if (newPage < 0) newPage = 0;
    if (newPage >= totalPages) newPage = totalPages - 1;

    const prevBtn = client.interactions.createButton({
      user: interaction.member.user.id,
      funcao: async (btnInt) => {
        await updateMessage(btnInt, newPage - 1);
      },
      data: {
        label: "⬅️",
        style: 2
      }
    });

    const nextBtn = client.interactions.createButton({
      user: interaction.member.user.id,
      funcao: async (btnInt) => {
        await updateMessage(btnInt, newPage + 1);
      },
      data: {
        label: "➡️",
        style: 2
      }
    });

    const embed = {
      title: "🏆 Ranking de Aventureiros",
      description: await generateDescription(newPage),
      color: 5763719,
      footer: {
        text: `Página ${newPage + 1} de ${totalPages}`
      }
    };

    const row = {
      type: 1,
      components: [
        { ...prevBtn, disabled: newPage === 0 },
        { ...nextBtn, disabled: newPage === totalPages - 1 }
      ]
    };

    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: interaction.type === 3 ? 7 : 4,
          data: {
            embeds: [embed],
            components: [row]
          }
        }
      }
    );
  };

  await updateMessage(interaction, page);
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