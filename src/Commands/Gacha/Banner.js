const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const ComponentBuilder = require("../../function/Messages/ComponentBuilder.js");

const GachaSystem = require("../../function/Gacha/Banners.js");
const config = require("../../function/Gacha/personagens.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");

const gacha = new GachaSystem(config);
const COST = 160;

const gifs = {
  "t31giro": "https://files.catbox.moe/hlkrkx.gif",
  "t41giro": "https://files.catbox.moe/f5r71d.gif",
  "t51giro": "https://files.catbox.moe/1lesvg.gif",
  "t410giros": "https://files.catbox.moe/fnb04r.gif",
  "t510giros": "https://files.catbox.moe/5fyt7i.gif"
};

function getGif(results, amount) {
  const maior = results.reduce((max, r) => 
    Math.max(max, r.tipo), 3
  );

  const key = `t${maior}${amount}${amount === 10 ? "giros" : "giro"}`;
  return gifs[key] ?? gifs.t31giro;
}

module.exports = {
  data: {
    name: "banner",
    description: "Gire nos banners",
    options: [
      {
        name: "tipo",
        description: "Escolha o banner",
        type: 3,
        required: true,
        choices: [
          { name: "Banner 1", value: "0" },
          { name: "Banner 2", value: "1" },
          { name: "Mochileiro", value: "2" }
        ]
      }
    ]
  },

  async execute(interaction, client) {

    const userId = interaction.member.user.id;
    const bannerId = Number(interaction.data.options[0].value);

    let user = await UserGlobalDb.findOne({ userId });
    if (!user)
      user = await UserGlobalDb.create({ userId });

    let pity = 0;
    let url;

    if (bannerId === 0)
      url = "https://files.catbox.moe/v2thvp.jpg"

    if (bannerId === 1)
      url = "https://files.catbox.moe/matx17.jpeg";

    if (bannerId === 2)
      url = "https://static.wikia.nocookie.net/genshin-impact/images/7/7c/Ora%C3%A7%C3%A3o_Invoca%C3%A7%C3%A3o_do_Mochileiro_11-11-2020.png/revision/latest?cb=20220530024332&path-prefix=pt-br";

    if (bannerId === 0 || bannerId === 1)
      pity = user.primogemas.bannerlimitado.pityt5;

    if (bannerId === 2)
      pity = user.primogemas.mochileiro.pityt5;

    const embed = new MessageEmbed()
      .setTitle("Banner Selecionado")
      .setDescription(
        `Primogemas: ${user.primogemas.atm}\nPity: ${pity}/90\nGarantido: ${user.primogemas.bannerlimitado.garantidot5 ? "Sim" : "Não"}\n\nO banner se encerra<t:1782065760:R>`
      )
      .randomColor()
      .setImage(url)
      .build();

    const btn1 = client.interactions.createButton({
      user: userId,
      data: { label: "1", style: 1 },
      funcao: async (btn) => executarPull(btn, bannerId, 1)
    });

    const btn10 = client.interactions.createButton({
      user: userId,
      data: { label: "10", style: 3 },
      funcao: async (btn) => executarPull(btn, bannerId, 10)
    });

    const components = [
      {
        type: 1,
        components: [btn1, btn10]
      }
    ];

    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: 4,
          data: {
            embeds: [embed],
            components
          }
        }
      }
    );
  }
};

async function executarPull(interaction, bannerId, amount) {

  await DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    {
      method: "POST",
      body: { type: 6 }
    }
  );

  const userId = interaction.member.user.id;
  let user = await UserGlobalDb.findOne({ userId });
  if (!user)
    user = await UserGlobalDb.create({ userId });

  const custo = COST * amount;

  if (user.primogemas.atm < custo) {

    const embed = new MessageEmbed()
      .setTitle("Primogemas insuficientes")
      .setDescription(
        `Precisa: ${custo}\nVocê tem: ${user.primogemas.atm}`
      )
      .randomColor()
      .build();

    return await DiscordRequest(
      `/webhooks/${process.env.CLIENT_ID}/${interaction.token}/messages/@original`,
      {
        method: "PATCH",
        body: {
          embeds: [embed]
        }
      }
    );
  }

  user.primogemas.atm -= custo;

  if (!Array.isArray(user.primogemas.transacoes))
    user.primogemas.transacoes = [];

  user.primogemas.transacoes.push({
    type: "banner_pull",
    value: custo,
    amount,
    banner: bannerId,
    banner_name:
      bannerId === 2
        ? "Mochileiro"
        : config.banners.atual.t5[bannerId],
    date: Date.now()
  });

  let results = amount === 1
    ? [gacha.pull(user, bannerId)]
    : await gacha.multi(user, bannerId, 10);

  await user.save();

  const gif = getGif(results, amount);

  await DiscordRequest(
    `/webhooks/${process.env.CLIENT_ID}/${interaction.token}/messages/@original`,
    {
      method: "PATCH",
      body: {
        embeds: [
          new MessageEmbed()
            .setTitle("Girando...")
            .setImage(gif)
            .randomColor()
            .build()
        ],
        components: []
      }
    }
  );

  const texto = results.map(r => {

    let extra = "";

    if (r.inventario) {
      if (r.inventario.novo) extra = "Novo";
      else if (r.inventario.constelacao)
        extra = `C${r.inventario.constelacao}`;
    }

    return `- ${r.tipo}⭐ | ${r.item} ${extra}`;
  }).join("\n");

  const embed = new MessageEmbed()
    .setTitle("Resultado")
    .setDescription(
      `Gasto: ${custo}\nRestante: ${user.primogemas.atm}\n\n${texto}`
    )
    .randomColor()
    .build();

  setTimeout(async () => {

    await DiscordRequest(
      `/webhooks/${process.env.CLIENT_ID}/${interaction.token}/messages/@original`,
      {
        method: "PATCH",
        body: {
          embeds: [embed]
        }
      }
    );

  }, 5000);
}