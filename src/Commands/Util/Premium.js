'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

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
    name_localizations: { 'en-US': 'premium', 'en-GB': 'premium', 'es-ES': 'premium' },
    description_localizations: {
      'en-US': 'Constellation System — Ayami Hoshiori',
      'en-GB': 'Constellation System — Ayami Hoshiori',
      'es-ES': 'Sistema Constellation — Ayami Hoshiori',
    },
    options: [
      {
        type: 1,
        name: "visualizar",
        name_localizations: { 'en-US': "view", 'en-GB': "view", 'es-ES': "ver" },
        description: "Visualize sua assinatura Constellation",
        description_localizations: { 'en-US': "View your Constellation subscription", 'en-GB': "View your Constellation subscription", 'es-ES': "Visualiza tu suscripcion Constellation" }
      },
      {
        type: 1,
        name: "comprar",
        name_localizations: { 'en-US': "buy", 'en-GB': "buy", 'es-ES': "comprar" },
        description: "Conheça os planos Constellation",
        description_localizations: { 'en-US': "Learn about the Constellation plans", 'en-GB': "Learn about the Constellation plans", 'es-ES': "Conoce los planes Constellation" }
      },
      {
        type: 1,
        name: "resgatar",
        name_localizations: { 'en-US': "redeem", 'en-GB': "redeem", 'es-ES': "canjear" },
        description: "Resgatar um código Constellation",
        description_localizations: { 'en-US': "Redeem a Constellation code", 'en-GB': "Redeem a Constellation code", 'es-ES': "Canjear un codigo Constellation" },
        options: [
          {
            type: 3,
            name: "codigo",
            name_localizations: { 'en-US': "code", 'en-GB': "code", 'es-ES': "codigo" },
            description: "Seu código de resgate",
            description_localizations: { 'en-US': "Your redemption code", 'en-GB': "Your redemption code", 'es-ES': "Tu codigo de canje" },
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
        return renderBuy(interaction, client, emoji);

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

        const ctx = localeCtx(interaction, {
          eAnimada: emoji.animada,
          eFesta: emoji.festa,
          eChorando: emoji.chorando,
          codigo,
          motivo: result.motivo,
        });

        const blocks = [
          cv2Text(
            `${client.t("premium.redeem_title", ctx)}\n` +
            (result.status
              ? client.t("premium.redeem_success", ctx)
              : client.t("premium.redeem_fail", ctx))
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

async function renderBuy(interaction, client, emoji) {

  const ctx = localeCtx(interaction, {
    eFeliz: emoji.feliz,
    eAnimada: emoji.animada,
    eCurtida: emoji.curtida,
    eCorao: emoji.corao,
    ePensando: emoji.pensando,
    eSria: emoji.sria,
  });

  const blocks = [
    cv2Text(client.t("premium.buy_title", ctx)),
    cv2Divider(),
    cv2Text(client.t("premium.buy_plans", ctx)),
    cv2Divider(),
    cv2Text(client.t("premium.buy_comparison", ctx)),
    cv2Divider(),
    cv2Text(client.t("premium.buy_benefits", ctx)),
    cv2Divider(),
    cv2Text(client.t("premium.buy_footer", ctx)),
    cv2Divider(),
    row({
      type: 2,
      style: 5,
      label: client.t("premium.buy_button", ctx),
      url: "https://discord.gg/WjeVXJPn5p" // Servidor Oficial — é onde a compra/geração da key acontece
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

  const ctx = localeCtx(interaction, {
    eEmduvida: emoji.emduvida,
    eEmburrada: emoji.emburrada,
    eCarinho: emoji.carinho,
    eFesta: emoji.festa,
    eAnimada: emoji.animada,
    eFeliz: emoji.feliz,
    eCurtida: emoji.curtida,
  });

  // ── Sem premium ──
  if (!userPremium.status) {

    const blocks = [
      cv2SectionThumb(
        client.t("premium.panel_no_premium", ctx),
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
  const mainText = client.t("premium.panel_header", {
    ...ctx,
    userId,
    planEmoji: userPremium.plan.emoji,
    planName: userPremium.plan.name,
    tempo: formatTempo(userPremium.tempo),
    count: guilds.length,
    limit: userPremium.plan.guildLimit === Infinity ? '∞' : userPremium.plan.guildLimit,
  });

  const blocks = [
    cv2SectionThumb(mainText, avatar),
  ];

  if (guildNames.length) {
    const listaServidores = guildNames
      .map(g => client.t("premium.server_line", { ...ctx, name: g.name, guildId: g.guildId }))
      .join('\n');

    blocks.push(cv2Divider());
    blocks.push(cv2Text(client.t("premium.linked_servers_label", { ...ctx, lista: listaServidores })));
  }

  blocks.push(cv2Divider());

  const servidorAtualText = guildPremium.status
    ? client.t("premium.current_active", { ...ctx, tempo: formatTempo(guildPremium.tempo) })
    : client.t("premium.current_inactive", ctx);

  blocks.push(cv2Text(client.t("premium.current_server_label", { ...ctx, status: servidorAtualText })));

  const components = [];

  // Botão: Ativar
  if (userPremium.status && !guildPremium.status) {

    const btnAdd = client.interactions.createButton({
      user: userId,
      data: {
        label: client.t("premium.btn_activate", ctx),
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
        label: client.t("premium.btn_remove", ctx),
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
    label: client.t("premium.btn_view_plans", ctx),
    url: "https://discord.gg/WjeVXJPn5p"
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
