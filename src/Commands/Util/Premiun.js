
'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js");

module.exports = {
  data: {
    name: "premium",
    description: "Sistema Premium Lua Carmesim",
    options: [
      {
        type: 1,
        name: "visualizar",
        description: "Visualizar seu premium"
      },
      {
        type: 1,
        name: "comprar",
        description: "Comprar premium"
      },
      {
        type: 1,
        name: "resgatar",
        description: "Resgatar uma key",
        options: [
          {
            type: 3,
            name: "codigo",
            description: "Código da key",
            required: true
          }
        ]
      }
    ]
  },

  async execute(interaction, client) {

    const sub = interaction.data.options?.[0]?.name;
    const userId = interaction.member.user.id;

    switch (sub) {

      case "visualizar":
        return renderPanel(interaction, client, userId);

      case "comprar":
        return renderBuy(interaction);

      case "resgatar": {

        const codigo =
          interaction.data.options?.[0]?.options?.find(
            o => o.name === "codigo"
          )?.value;

        const result = await PremiumManager.redeemKey(
          userId,
          interaction.guild_id,
          codigo
        );

        const embed = new MessageEmbed()
          .setTitle("🌙 Resgate de Premium")
          .setDescription(
            result.status
              ? `✅ Key resgatada com sucesso.\n\nCódigo: \`${codigo}\``
              : `❌ ${result.motivo}`
          )
          .randomColor()
          .build();

        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                flags: 64,
                embeds: [embed]
              }
            }
          }
        );
      }
    }
  }
};

async function renderBuy(interaction) {

  const embed = new MessageEmbed()
    .setTitle("🌙 Lua Carmesim")
    .setDescription(`
**A Assinatura Oficial da Arlecchino**

🗓 Mensal — R$ 8,99
📆 Trimestral — R$ 24,99
📅 Semestral — R$ 44,99

━━━━━━━━━━━━━━━━━━

🔥 Daily Aprimorado
⚔️ XP aumentado
🏅 Emblema exclusivo
🎲 Mais sorteios
🌟 Personagem T5 grátis
🩸 Descontos exclusivos

━━━━━━━━━━━━━━━━━━

*A Lua Carmesim não é sobre preço.
É sobre posição.*
`)
    .randomColor()
    .build();

  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    {
      method: "POST",
      body: {
        type: 4,
        data: {
          flags: 64,
          embeds: [embed],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: "Comprar Agora",
                  url: "https://discord.gg/wfaRZw5pGn"
                }
              ]
            }
          ]
        }
      }
    }
  );
}

async function renderPanel(
  interaction,
  client,
  userId,
  edit = false
) {

  const guildId = interaction.guild_id;

  const userPremium =
    await PremiumManager.getUserPremium(userId);

  const guildPremium =
    await PremiumManager.getGuildPremium(guildId);

  const guilds =
    await PremiumManager.listUserGuilds(userId);

  const user = interaction.member.user;

  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const formatTempo = (ms) => {

    const s =
      Math.floor(ms / 1000) % 60;

    const m =
      Math.floor(ms / (1000 * 60)) % 60;

    const h =
      Math.floor(ms / (1000 * 60 * 60)) % 24;

    const d =
      Math.floor(ms / (1000 * 60 * 60 * 24));

    return `${d}d ${h}h ${m}m ${s}s`;
  };

  if (!userPremium.status) {

    const embed = new MessageEmbed()
      .setTitle("🌙 Lua Carmesim")
      .setDescription(`
Você não possui Premium ativo.

Use:

\`/premium comprar\`

para adquirir sua assinatura.
`)
      .setThumbnail(avatar)
      .randomColor()
      .build();

    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: edit ? 7 : 4,
          data: {
            flags: 64,
            embeds: [embed]
          }
        }
      }
    );
  }

  const totalSlots =
    guilds.length +
    Math.max(
      0,
      (guildPremium.status &&
      guildPremium.userId === userId &&
      !guilds.find(g => g.guildId === guildId))
        ? 1
        : 0
    );

  let desc = "";

  desc += `👤 Usuário: <@${userId}>\n`;
  desc += `🌙 Status: Ativo\n`;
  desc += `⏳ Restante: ${formatTempo(userPremium.tempo)}\n\n`;

  desc += `🏠 Servidores Premium: ${guilds.length}\n\n`;

  if (guilds.length) {

    desc += `**Servidores vinculados:**\n`;

    for (const g of guilds) {
      desc += `• ${g.guildId}\n`;
    }

    desc += "\n";
  }

  desc += `**Servidor Atual**\n`;

  if (guildPremium.status) {

    desc +=
      `✅ Premium ativo\n` +
      `⏳ ${formatTempo(guildPremium.tempo)}`;

  } else {

    desc +=
      `❌ Sem premium`;
  }

  const embed = new MessageEmbed()
    .setTitle("🌙 Painel Premium")
    .setDescription(desc)
    .setThumbnail(avatar)
    .randomColor()
    .build();

  const components = [];

  if (
    userPremium.status &&
    !guildPremium.status
  ) {

    const btnAdd =
      client.interactions.createButton({
        user: userId,
        data: {
          label: "Ativar neste Servidor",
          style: 1
        },
        funcao: async (btn) => {

          await PremiumManager.addGuildPremium(
            guildId,
            userId
          );

          return renderPanel(
            btn,
            client,
            userId,
            true
          );
        }
      });

    components.push({
      type: 1,
      components: [btnAdd]
    });

  }

  if (
    guildPremium.status &&
    guildPremium.userId === userId
  ) {

    const btnRemove =
      client.interactions.createButton({
        user: userId,
        data: {
          label: "Remover deste Servidor",
          style: 4
        },
        funcao: async (btn) => {

          await PremiumManager.removeGuildPremium(
            guildId,
            userId
          );

          return renderPanel(
            btn,
            client,
            userId,
            true
          );
        }
      });

    components.push({
      type: 1,
      components: [btnRemove]
    });
  }

  components.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 5,
        label: "Comprar Premium",
        url: "https://discord.gg/wfaRZw5pGn"
      }
    ]
  });

  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    {
      method: "POST",
      body: {
        type: edit ? 7 : 4,
        data: {
          flags: 64,
          embeds: [embed],
          components
        }
      }
    }
  );
}