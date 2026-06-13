'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js");

module.exports = {
  data: {
    name: "premium",
    description: "Sistema Constellation — Ayami Hoshiori",
    options: [
      {
        type: 1,
        name: "visualizar",
        description: "Visualize sua assinatura Constellation"
      },
      {
        type: 1,
        name: "comprar",
        description: "Conheça os planos Constellation"
      },
      {
        type: 1,
        name: "resgatar",
        description: "Resgatar um código Constellation",
        options: [
          {
            type: 3,
            name: "codigo",
            description: "Seu código de resgate",
            required: true
          }
        ]
      }
    ]
  },

  async execute(interaction, client) {

    const sub = interaction.data.options?.[0]?.name;
    const userId = interaction.member.user.id;
    const emoji = client.emoji;

    switch (sub) {

      case "visualizar":
        return renderPanel(interaction, client, userId);

      case "comprar":
        return renderBuy(interaction, emoji);

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
          .setTitle(`${emoji.animada} Resgate de Constellation`)
          .setDescription(
            result.status
              ? `${emoji.festa} Key resgatada com sucesso!\n\nCódigo: \`${codigo}\`\n\nBem-vinda à Constellation~ ${emoji.corao}`
              : `${emoji.chorando} Ops! ${result.motivo}`
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

// ──────────────────────────────────────────
//  COMPRAR
// ──────────────────────────────────────────

async function renderBuy(interaction, emoji) {

  const embed = new MessageEmbed()
    .setTitle(`${emoji.feliz} Constellation — Ayami Hoshiori`)
    .setDescription(`
${emoji.animada} **A assinatura oficial da Ayami chegou!**

✨ Escolha seu plano:

> 🗓 **Mensal** — R$ 7,99
> 📆 **Trimestral** — R$ 21,99
> 📅 **Semestral** — R$ 39,99

${emoji.curtida} **Ou adquira um Código Constellation**
> 🔑 Key avulsa — R$ 8,50

━━━━━━━━━━━━━━━━━━━━━━

${emoji.corao} **Benefícios exclusivos:**

🏅 Cargo exclusivo no Servidor Oficial
⭐ Mais chances ao obter Personagens 5 Estrelas
💎 Bônus de Primogemas no Daily
⚙️ Configurações avançadas nos sistemas
　*(Tipo de Chat, Form Sequencial, Form por Modal,*
　*Cargos Temporários, Ticket Setup e muito mais)*
🔗 Uso de Webhook em Sistemas
📌 Botão Fixo + Webhook no Sistema de Aniversário

━━━━━━━━━━━━━━━━━━━━━━

${emoji.pensando} *Constellation não é só um plano.*
*É o seu lugar entre as estrelas.* ${emoji.sria}
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
                  label: "✨ Assinar Constellation",
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

// ──────────────────────────────────────────
//  PAINEL
// ──────────────────────────────────────────

async function renderPanel(interaction, client, userId, edit = false) {

  const guildId = interaction.guild_id;
  const emoji = client.emoji;

  const [userPremium, guildPremium, guilds] = await Promise.all([
    PremiumManager.getUserPremium(userId),
    PremiumManager.getGuildPremium(guildId),
    PremiumManager.listUserGuilds(userId)
  ]);

  const user = interaction.member.user;

  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const formatTempo = (ms) => {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / (1000 * 60)) % 60;
    const h = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  // ── Sem premium ──
  if (!userPremium.status) {

    const embed = new MessageEmbed()
      .setTitle(`${emoji.emduvida} Constellation`)
      .setDescription(`
${emoji.emburrada} Você ainda não possui a Constellation ativa...

Use \`/premium comprar\` para conhecer os planos
ou \`/premium resgatar\` se já tiver um código!

${emoji.carinho} *Venha brilhar com a Ayami~*
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

  // ── Buscar nomes dos servidores vinculados ──
  const guildNames = await Promise.all(
    guilds.map(async (g) => {
      try {
        const data = await DiscordRequest(`/guilds/${g.guildId}`, {
          method: "GET"
        });
        return { guildId: g.guildId, name: data?.name ?? g.guildId };
      } catch {
        return { guildId: g.guildId, name: g.guildId };
      }
    })
  );

  // ── Montar descrição ──
  let desc = "";

  desc += `${emoji.animada} **Assinante:** <@${userId}>\n`;
  desc += `✨ **Status:** Constellation Ativa\n`;
  desc += `⏳ **Expira em:** \`${formatTempo(userPremium.tempo)}\`\n\n`;

  desc += `🏠 **Servidores com Constellation:** ${guilds.length}\n`;

  if (guildNames.length) {
    desc += `\n**Servidores vinculados:**\n`;
    for (const g of guildNames) {
      desc += `${emoji.curtida} **${g.name}** \`(${g.guildId})\`\n`;
    }
    desc += "\n";
  }

  desc += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  desc += `**Servidor Atual**\n`;

  if (guildPremium.status) {
    desc +=
      `${emoji.feliz} Constellation **ativa** aqui!\n` +
      `⏳ \`${formatTempo(guildPremium.tempo)}\``;
  } else {
    desc +=
      `${emoji.emburrada} Constellation **não ativa** neste servidor.\n` +
      `Use o botão abaixo para ativar!`;
  }

  const embed = new MessageEmbed()
    .setTitle(`${emoji.festa} Painel Constellation`)
    .setDescription(desc)
    .setThumbnail(avatar)
    .randomColor()
    .build();

  const components = [];

  // Botão: Ativar
  if (userPremium.status && !guildPremium.status) {

    const btnAdd = client.interactions.createButton({
      user: userId,
      data: {
        label: "✨ Ativar neste Servidor",
        style: 1
      },
      funcao: async (btn) => {
        await PremiumManager.addGuildPremium(guildId, userId);
        return renderPanel(btn, client, userId, true);
      }
    });

    components.push({ type: 1, components: [btnAdd] });
  }

  // Botão: Remover
  if (guildPremium.status && guildPremium.userId === userId) {

    const btnRemove = client.interactions.createButton({
      user: userId,
      data: {
        label: "🗑️ Remover deste Servidor",
        style: 4
      },
      funcao: async (btn) => {
        await PremiumManager.removeGuildPremium(guildId, userId);
        return renderPanel(btn, client, userId, true);
      }
    });

    components.push({ type: 1, components: [btnRemove] });
  }

  // Botão: Comprar (link)
  components.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 5,
        label: "✨ Ver Planos Constellation",
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
