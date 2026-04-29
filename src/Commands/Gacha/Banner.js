const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const ComponentBuilder = require("../../function/Messages/ComponentBuilder.js");

const GachaSystem = require("../../function/Gacha/Banners.js");
const config = require("../../function/Gacha/personagens.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");

const gacha = new GachaSystem(config);
const COST = 160;

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
          { name: "Banner 0 (Arlecchino)", value: "0" },
          { name: "Banner 1 (Clorinde)", value: "1" },
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

    const nomeBanner =
      bannerId === 2
        ? "Mochileiro"
        : `Banner ${bannerId} (${config.banners.atual.t5[bannerId]})`;

    const embed = new MessageEmbed()
      .setTitle("Banner Selecionado")
      .setDescription(
        `**${nomeBanner}**\n\nPrimogemas: **${user.primogemas.atm}**\n\nEscolha:`
      )
      .randomColor()
      .build();

    const btn1 = client.interactions.createButton({
      user: userId,
      data: { label: "1", style: 1 },
      funcao: async (btn) => executarPull(btn, user, bannerId, 1)
    });

    const btn10 = client.interactions.createButton({
      user: userId,
      data: { label: "10", style: 3 },
      funcao: async (btn) => executarPull(btn, user, bannerId, 10)
    });

    const components = [
      {
        type: 1,
        components: [btn1, btn10] 
      }
    ];

    await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: "POST",
      body: {
        type: 4,
        data: {
          embeds: [embed],
          components
        }
      }
    });
  }
};

/* ===============================
   EXECUTAR PULL
=============================== */
async function executarPull(interaction, user, bannerId, amount) {

  const custo = COST * amount;

  if (user.primogemas.atm < custo) {

    const embed = new MessageEmbed()
      .setTitle("Primogemas insuficientes")
      .setDescription(
        `Precisa: **${custo}**\nVocê tem: **${user.primogemas.atm}**`
      )
      .randomColor()
      .build();

    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: "POST",
      body: {
        type: 4,
        data: { embeds: [embed], flags: 64 }
      }
    });
  }

  user.primogemas.atm -= custo;

  let results = amount === 1
    ? [gacha.pull(user, bannerId)]
    : gacha.multi(user, bannerId, 10);

  await user.save();

  const texto = results.map(r => {

    let extra = "";

    if (r.inventario) {
      if (r.inventario.novo) extra = "Novo";
      else if (r.inventario.constelacao)
        extra = `C${r.inventario.constelacao}`;
    }

    return `- ${r.tipo} | ${r.item} ${extra}`;
  }).join("\n");

  const embed = new MessageEmbed()
    .setTitle("Resultado")
    .setDescription(
      `Gasto: **${custo}**\nRestante: **${user.primogemas.atm}**\n\n${texto}`
    )
    .randomColor()
    .build();

  await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: {
      type: 4,
      data: {
        embeds: [embed],
        flags: 64
      }
    }
  });
}