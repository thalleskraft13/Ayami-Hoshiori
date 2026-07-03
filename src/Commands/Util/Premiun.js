'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js");

/* ═══════════════════════════════════════════════════════════
   HELPERS COMPONENTS V2
   (mesmo padrão usado no Logic Builder / Biblioteca / Missões)
   ═══════════════════════════════════════════════════════════ */

function cv2Text(content) {
  return { type: 10, content };
}

function cv2Divider(spacing = 1) {
  return { type: 14, divider: true, spacing };
}

/**
 * Section (type 9) com accessory de Thumbnail (type 11).
 * Substitui o antigo `.setThumbnail(avatar)` do embed clássico —
 * em CV2 a miniatura fica ao lado do texto via Section, não
 * "flutuando" no canto do embed.
 */
function cv2SectionThumb(content, thumbUrl) {
  return {
    type: 9,
    accessory: { type: 11, media: { url: thumbUrl } },
    components: [cv2Text(content)]
  };
}

function cv2Container(blocks, opts = {}) {
  return {
    type:         17,
    accent_color: opts.accentColor ?? 0x7C8FFF,
    spoiler:      opts.spoiler ?? false,
    components:   blocks
  };
}

function cv2Flags(ephemeral = true) {
  return ephemeral ? 32768 | 64 : 32768;
}

function cv2Payload(blocks, opts = {}) {
  return {
    flags:      cv2Flags(opts.ephemeral ?? true),
    components: [cv2Container(blocks, opts)]
  };
}

function row(...components) {
  return { type: 1, components };
}

/** Paleta aleatória "estilo Constellation" — mantém a ideia do antigo .randomColor(). */
const RANDOM_COLORS = [0x7C8FFF, 0xA9D6FF, 0xFFD966, 0xFFB6C8, 0x243B7A, 0xC6CDD8];
function randomColor() {
  return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
}

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

        const blocks = [
          cv2Text(
            `# ${emoji.animada} Resgate de Constellation\n` +
            (result.status
              ? `${emoji.festa} Key resgatada com sucesso!\n\nCódigo: \`${codigo}\`\n\nBem-vinda à Constellation~ ${emoji.corao}`
              : `${emoji.chorando} Ops! ${result.motivo}`)
          ),
        ];

        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: cv2Payload(blocks, { accentColor: randomColor(), ephemeral: true })
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

  const blocks = [
    cv2Text(
      `# ${emoji.feliz} Constellation — Ayami Hoshiori\n` +
      `${emoji.animada} **A assinatura oficial da Ayami chegou!**`
    ),
    cv2Divider(),
    cv2Text(
      `✨ **Escolha seu plano:**\n\n` +
      `> 🗓 **Mensal** — R$ 7,99\n` +
      `> 📆 **Trimestral** — R$ 21,99\n` +
      `> 📅 **Semestral** — R$ 39,99\n\n` +
      `${emoji.curtida} **Ou adquira um Código Constellation**\n` +
      `> 🔑 Key avulsa — R$ 8,50`
    ),
    cv2Divider(),
    cv2Text(
      `${emoji.corao} **Benefícios exclusivos:**\n\n` +
      `🏅 Cargo exclusivo no Servidor Oficial\n` +
      `⭐ Mais chances ao obter Personagens 5 Estrelas\n` +
      `💎 Bônus de Primogemas no Daily\n` +
      `⚙️ Configurações avançadas nos sistemas\n` +
      `　*(Tipo de Chat, Form Sequencial, Form por Modal,*\n` +
      `　*Cargos Temporários, Ticket Setup e muito mais)*\n` +
      `🔗 Uso de Webhook em Sistemas\n` +
      `📌 Botão Fixo + Webhook no Sistema de Aniversário`
    ),
    cv2Divider(),
    cv2Text(
      `${emoji.pensando} *Constellation não é só um plano.*\n` +
      `*É o seu lugar entre as estrelas.* ${emoji.sria}`
    ),
    cv2Divider(),
    row({
      type: 2,
      style: 5,
      label: "✨ Assinar Constellation",
      url: "https://discord.gg/wfaRZw5pGn"
    }),
  ];

  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    {
      method: "POST",
      body: {
        type: 4,
        data: cv2Payload(blocks, { accentColor: randomColor(), ephemeral: true })
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

    const blocks = [
      cv2SectionThumb(
        `# ${emoji.emduvida} Constellation\n` +
        `${emoji.emburrada} Você ainda não possui a Constellation ativa...\n\n` +
        `Use \`/premium comprar\` para conhecer os planos\n` +
        `ou \`/premium resgatar\` se já tiver um código!\n\n` +
        `${emoji.carinho} *Venha brilhar com a Ayami~*`,
        avatar
      ),
    ];

    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: edit ? 7 : 4,
          data: cv2Payload(blocks, { accentColor: randomColor(), ephemeral: true })
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

  // ── Montar bloco principal (substitui a "desc" do embed clássico) ──
  let mainText = "";
  mainText += `# ${emoji.festa} Painel Constellation\n`;
  mainText += `${emoji.animada} **Assinante:** <@${userId}>\n`;
  mainText += `✨ **Status:** Constellation Ativa\n`;
  mainText += `⏳ **Expira em:** \`${formatTempo(userPremium.tempo)}\`\n\n`;
  mainText += `🏠 **Servidores com Constellation:** ${guilds.length}`;

  const blocks = [
    cv2SectionThumb(mainText, avatar),
  ];

  if (guildNames.length) {
    const listaServidores = guildNames
      .map(g => `${emoji.curtida} **${g.name}** \`(${g.guildId})\``)
      .join('\n');

    blocks.push(cv2Divider());
    blocks.push(cv2Text(`**Servidores vinculados:**\n${listaServidores}`));
  }

  blocks.push(cv2Divider());

  const servidorAtualText = guildPremium.status
    ? `${emoji.feliz} Constellation **ativa** aqui!\n⏳ \`${formatTempo(guildPremium.tempo)}\``
    : `${emoji.emburrada} Constellation **não ativa** neste servidor.\nUse o botão abaixo para ativar!`;

  blocks.push(cv2Text(`**Servidor Atual**\n${servidorAtualText}`));

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

    components.push(btnAdd);
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

    components.push(btnRemove);
  }

  // Botão: Comprar (link)
  components.push({
    type: 2,
    style: 5,
    label: "✨ Ver Planos Constellation",
    url: "https://discord.gg/wfaRZw5pGn"
  });

  blocks.push(cv2Divider());
  blocks.push(row(...components));

  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    {
      method: "POST",
      body: {
        type: edit ? 7 : 4,
        data: cv2Payload(blocks, { accentColor: randomColor(), ephemeral: true })
      }
    }
  );
}
