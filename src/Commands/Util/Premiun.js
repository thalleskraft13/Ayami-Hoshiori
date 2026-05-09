const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js");

module.exports = {
  data: {
    name: "premium",
    description: "Painel de premium"
  },

  async execute(interaction, client) {
    const userId = interaction.member.user.id;
    return renderMain(interaction, client, userId);
  }
};

async function renderMain(interaction, client, userId, edit = false) {

  const guildId = interaction.guild_id;
  const userPremium = await PremiumManager.getUserPremium(userId);
  const guildPremium = await PremiumManager.getGuildPremium(guildId);
  const guilds = await PremiumManager.listUserGuilds(userId);

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



  if (!userPremium.status) {

    const desc = `
**A Assinatura Oficial da Arlecchino Bot**

Nem todos nasceram para o comum.
Alguns escolhem o poder.

Ao ativar a **Lua Carmesim**, você desbloqueia:

🔥 Daily Aprimorado — Recompensas superiores todos os dias.
⚔️ XP Aumentado no Rank de Aventureiro — Evolua mais rápido.
🕯️ Sistemas Personalizados Exclusivos — Recursos ocultos para seu servidor.
🏅 Emblema Oficial de Assinante — Um símbolo de autoridade.
🎲 Mais chances em Sorteios Oficiais — A probabilidade favorece a elite.
🌟 1 Personagem T5 Grátis ao ativar — Poder imediato.
🩸 Desconto Especial na Loja Oficial — Benefícios estratégicos.

━━━━━━━━━━━━━━━━━━

🌙 **Planos Oficiais da Lua Carmesim**

🗓 **Mensal — R$ 8,99**
30 dias completos sob a influência da Lua.

📆 **Trimestral — R$ 24,99**
90 dias (3 meses) de vantagem contínua.

📅 **Semestral — R$ 44,99**
180 dias (6 meses) de poder consolidado.

━━━━━━━━━━━━━━━━━━

*A Lua Carmesim não é sobre preço.
É sobre posição.*
`;

    const embed = new MessageEmbed()
      .setTitle("🌙 Assinatura Lua Carmesim")
      .setDescription(desc)
      .setThumbnail(avatar)
      .randomColor()
      .build();

    const btnBuy = client.interactions.createButton({
      user: userId,
      data: {
        label: "Adquirir Premium",
        style: 5,
        url: "https://discord.gg/wfaRZw5pGn"
      }
    });

    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: "POST",
      body: {
        type: edit ? 7 : 4,
        data: {
          flags: 64,
          embeds: [embed],
          components: [
            { type: 1, components: [{
  "type": 2,
  "label": "Adquirir Premium",
  "style": 5,
  "url": "https://discord.gg/wfaRZw5pGn"
}] }
          ]
        }
      }
    });
  }



  let desc = "";

  desc += `Usuário: <@${userId}>\n`;
  desc += `Status: Ativo\n`;
  desc += `Tempo restante: ${formatTempo(userPremium.tempo)}\n`;

  desc += `\nServidores ativos: ${guilds.length}\n`;

  desc += `\nServidor atual:\n`;
  desc += guildPremium.status
    ? `Premium ativo (${formatTempo(guildPremium.tempo)})`
    : "Sem premium";

  const embed = new MessageEmbed()
    .setTitle("Painel Premium")
    .setDescription(desc)
    .setThumbnail(avatar)
    .randomColor()
    .build();

  const components = [];

  const btnKey = client.interactions.createButton({
    user: userId,
    data: { label: "Resgatar Key", style: 2 },
    funcao: async () => {}
  });

  if (userPremium.status && !guildPremium.status) {

    const btnAdd = client.interactions.createButton({
      user: userId,
      data: { label: "Ativar neste servidor", style: 1 },
      funcao: async (btn) => {

        await PremiumManager.addGuildPremium(guildId, userId);
        return renderMain(btn, client, userId, true);
      }
    });

    components.push({ type: 1, components: [btnAdd, btnKey] });

  } else {
    components.push({ type: 1, components: [btnKey] });
  }

  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: {
      type: edit ? 7 : 4,
      data: {
        embeds: [embed],
        components
      }
    }
  });
}