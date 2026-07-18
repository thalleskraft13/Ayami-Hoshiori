const DiscordRequest = require("../../function/DiscordRequest.js");
const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const UserEconomy = require("../../function/Gacha/Economy.js");
const UserGlobal = require("../../Mongodb/userglobal.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js")

// URL principal do site — o daily também pode ser resgatado por lá.
const SITE_URL = "https://ayami-hoshiori.discloud.app";

function MS(time) {
  const value = parseInt(time);
  const unit = time.replace(value, "").toLowerCase();

  const units = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000
  };

  return value * (units[unit] || 1);
}

// Emojis da Ayami
const ayami = {
  default:    "<:ayami:1513904360407695370>",
  animada:    "<:ayamianimada:1513895694824378408>",
  assustada:  "<:ayamiassustada:1513895638809579720>",
  brava:      "<:ayamibrava:1513895453912076420>",
  carinho:    "<:ayamicarinho:1513903963240530121>",
  chorando:   "<:ayamichorando:1513895575026663575>",
  chorando2:  "<:ayamichorando2:1513904145193766912>",
  corao:      "<:ayamicorao:1513895869420929094>",
  curtida:    "<:ayamicurtida:1513904205306400930>",
  emburrada:  "<:ayamiemburrada:1513904309480456374>",
  emduvida:   "<:ayamiemduvida:1513904029556670546>",
  escondida:  "<:ayamiescondida:1513904510387355818>",
  feliz:      "<:ayamifeliz:1513904597649981561>",
  festa:      "<:ayamifesta:1513895771676737746>",
  pensando:   "<:ayamipensando:1513891183036989533>",
  rindo:      "<:ayamirindo:1513886810806157382>",
  sonolenta:  "<:ayamisonolenta:1513895512997367980>",
  sria:       "<:ayamisria:1513904083969380372>"
};

// Cores da Ayami
const cores = {
  azulCabelo:    0xA9D6FF,
  azulSecundario: 0x7C8FFF,
  azulEscuro:    0x243B7A,
  dourado:       0xFFD966,
  branco:        0xFFFFFF,
  prata:         0xC6CDD8,
  pele:          0xFFE8D9
};

module.exports = {
  data: {
    name: 'primogemas',
    description: 'Comandos relacionados às Primogemas ⭐',
    name_localizations: { 'en-US': 'primogems', 'en-GB': 'primogems', 'es-ES': 'primogemas' },
    description_localizations: {
      'en-US': 'Commands related to Primogems ⭐',
      'en-GB': 'Commands related to Primogems ⭐',
      'es-ES': 'Comandos relacionados con los Primogemas ⭐',
    },
    type: 1,
    options: [
      {
        name: "saldo",
        name_localizations: { 'en-US': "balance", 'en-GB': "balance", 'es-ES': "saldo" },
        description: "Veja quantas primogemas você (ou alguém) tem!",
        description_localizations: { 'en-US': "See how many primogems you (or someone) have!", 'en-GB': "See how many primogems you (or someone) have!", 'es-ES': "¡Consulta cuantos primogemas tienes tu (o alguien)!" },
        type: 1,
        options: [{
          name: "user",
          name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
          description: "Mencione ou insira o ID do usuário",
          description_localizations: { 'en-US': "Mention or enter the user's ID", 'en-GB': "Mention or enter the user's ID", 'es-ES': "Menciona o ingresa el ID del usuario" },
          type: 6,
          required: false
        }]
      },
      {
        name: "daily",
        name_localizations: { 'en-US': "daily", 'en-GB': "daily", 'es-ES': "diario" },
        description: "Resgate suas primogemas diárias e encha o bolso! ✨",
        description_localizations: { 'en-US': "Claim your daily primogems and fill your pockets! ✨", 'en-GB': "Claim your daily primogems and fill your pockets! ✨", 'es-ES': "¡Reclama tus primogemas diarios y llena tu bolsillo! ✨" },
        type: 1
      },
      {
        name: "placar",
        name_localizations: { 'en-US': "leaderboard", 'en-GB': "leaderboard", 'es-ES': "clasificacion" },
        description: "Veja os aventureiros mais ricos em primogemas! 🏆",
        description_localizations: { 'en-US': "See the richest adventurers in primogems! 🏆", 'en-GB': "See the richest adventurers in primogems! 🏆", 'es-ES': "¡Consulta a los aventureros mas ricos en primogemas! 🏆" },
        type: 1
      },
      {
        name: "pagar",
        name_localizations: { 'en-US': "pay", 'en-GB': "pay", 'es-ES': "pagar" },
        description: "Envie primogemas para um amiguinho~ 💸",
        description_localizations: { 'en-US': "Send primogems to a friend~ 💸", 'en-GB': "Send primogems to a friend~ 💸", 'es-ES': "Envia primogemas a un amiguito~ 💸" },
        type: 1,
        options: [{
          name: "usuario",
          name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
          description: "Mencione ou insira o ID",
          description_localizations: { 'en-US': "Mention or enter the ID", 'en-GB': "Mention or enter the ID", 'es-ES': "Menciona o ingresa el ID" },
          type: 6,
          required: true
        },{
          name: "quantidade",
          name_localizations: { 'en-US': "amount", 'en-GB': "amount", 'es-ES': "cantidad" },
          description: "Quanto você quer enviar?",
          description_localizations: { 'en-US': "How much do you want to send?", 'en-GB': "How much do you want to send?", 'es-ES': "¿Cuanto quieres enviar?" },
          type: 3,
          required: true
        }]
      },
      {
        name: "transferências",
        name_localizations: { 'en-US': "transfers", 'en-GB': "transfers", 'es-ES': "transferencias" },
        description: "Veja todo o seu histórico de primogemas! 📜",
        description_localizations: { 'en-US': "See your entire primogem history! 📜", 'en-GB': "See your entire primogem history! 📜", 'es-ES': "¡Consulta todo tu historial de primogemas! 📜" },
        type: 1
      }
    ]
  },

  async execute(interaction, client) {

    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: { type: 5 }
      }
    );

    const subcommand = interaction.data.options[0];
    const authorId = interaction.member.user.id;

    /* =========================
       SALDO
    ========================== */
    if (subcommand.name === "saldo") {

      const mentionedUser = subcommand.options?.[0]?.value;
      const targetId = mentionedUser || authorId;

      const economy = new UserEconomy(targetId);
      const data = await economy.getTotal();
      const saldo = data.currentBalance;

      const embed = new MessageEmbed()
        .setTitle(`${ayami.feliz} Saldo de Primogemas`)
        .setColor(cores.azulCabelo)
        .setDescription(
          targetId === authorId
            ? `⭐ **Você tem ${saldo.toLocaleString()} primogemas!** ${ayami.animada}\nContinue invocando e conquistando tudo!`
            : `⭐ <@${targetId}> tem **${saldo.toLocaleString()} primogemas!** ${ayami.curtida}`
        )
        .setTimestamp()
        .build();

      return await DiscordRequest(
        `/webhooks/${interaction.application_id}/${interaction.token}`,
        { method: "POST", body: { embeds: [embed] } }
      );
    }

    /* =========================
       DAILY
    ========================== */
    if (subcommand.name === "daily") {

      const baseReward = 160;
      const now = Date.now();

      let user = await UserGlobal.findOne({ userId: authorId });

      if (!user) {
        user = await UserGlobal.create({ userId: authorId });
      }

      const expiresAt = user.primogemas.daily_tempo || 0;

      const button = client.interactions.createButton({
        user: authorId,
        tempo: MS("24h"),
        data: {
          label: "✨ Resgatar Daily!",
          style: 3
        },
        funcao: async (i) => {

          const nowClick = Date.now();
          const freshUser = await UserGlobal.findOne({ userId: authorId });
          const expires = freshUser.primogemas.daily_tempo || 0;

          /* Cooldown */
          if (nowClick < expires) {

            const remaining = expires - nowClick;
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);

            const embedCooldown = new MessageEmbed()
              .setTitle(`${ayami.sonolenta} Calma, calma...`)
              .setColor(cores.azulSecundario)
              .setDescription(
                `Você já resgatou hoje! ${ayami.emburrada}\nVolte em **${hours}h ${minutes}m** e eu te dou mais primogemas, prometo! ⭐`
              )
              .setTimestamp()
              .build();

            return await DiscordRequest(
              `/interactions/${i.id}/${i.token}/callback`,
              {
                method: "POST",
                body: {
                  type: 7,
                  data: {
                    embeds: [embedCooldown],
                    components: []
                  }
                }
              }
            );
          }

          /* Recompensa */
          const premium = await PremiumManager.getUserPlan(authorId);

          // Seção 2: o bônus agora escala com o PLANO (catálogo estático),
          // não é mais um valor flat igual pra qualquer premium.
          const multiplier = premium.status ? premium.plan.dailyMultiplier : 1;
          const min = Math.round(10 * multiplier);
          const max = Math.round(20 * multiplier);

          const giros = Math.floor(Math.random() * (max - min + 1)) + min;
          const totalReward = giros * baseReward;
          const newExpire = nowClick + MS("24h");

          const updated = await UserGlobal.findOneAndUpdate(
            { userId: authorId },
            {
              $inc: { "primogemas.atm": totalReward },
              $set: { "primogemas.daily_tempo": newExpire },
              $push: {
                "primogemas.transacoes": {
                  $each: [{
                    type: "daily",
                    value: totalReward,
                    giros: giros,
                    premium: premium.status,
                    date: nowClick
                  }],
                  $slice: -100 // seção 8: teto do array, senão cresce pra sempre
                }
              }
            },
            { new: true }
          );

          // Seção 8: daily fazia $inc/$push direto no Mongo, sem passar pelo
          // Economy.js — nenhum log era gerado. Agora loga via o helper
          // estático (só documenta a mudança, o saldo já foi alterado acima).
          await UserEconomy.log({
            userId:   authorId,
            action:   "daily",
            previous: updated.primogemas.atm - totalReward,
            amount:   totalReward,
            current:  updated.primogemas.atm
          }).catch(err => console.error("[Primogemas] Falha ao logar daily:", err));

          await client.missionManager.trackEvent(authorId, 'do_daily', 1, interaction.guild_id);

          const embedSuccess = new MessageEmbed()
            .setTitle(`${ayami.festa} Daily Resgatado!`)
            .setColor(cores.dourado)
            .setDescription(
              `Uhuuu! Chegaram mais primogemas pra você! ${ayami.animada}\n\n` +
              `🎰 Giros Obtidos: **${giros}**\n` +
              `⭐ Recompensa: **${totalReward.toLocaleString()} primogemas**\n` +
              (premium.status
                ? `✨ Bônus de assinatura aplicado! Você é incrível~ ${ayami.corao}\n\n`
                : `\n`) +
              `💙 Saldo atual: **${updated.primogemas.atm.toLocaleString()}**`
            )
            .setTimestamp()
            .build();

          return await DiscordRequest(
            `/interactions/${i.id}/${i.token}/callback`,
            {
              method: "POST",
              body: {
                type: 7,
                data: {
                  embeds: [embedSuccess],
                  components: []
                }
              }
            }
          );
        }
      });

      const embed = new MessageEmbed()
        .setTitle(`${ayami.feliz} Daily de Primogemas`)
        .setColor(cores.azulCabelo)
        .setDescription(
          `Oi! Clique no botão e resgate suas primogemas do dia! ${ayami.animada}\n\n` +
          `🎰 Sistema de giros:\n` +
          `• Usuário normal: **10–20 giros**\n` +
          `• Com assinatura: **20–50 giros** ✨\n\n` +
          `Cada giro vale **${baseReward} primogemas**~ ⭐\n\n` +
          `🌐 -# Também dá pra resgatar pelo nosso site!`
        )
        .setTimestamp()
        .build();

      const siteButton = {
        type: 2,
        style: 5,
        label: "🌐 Resgatar pelo Site",
        url: `${SITE_URL}/dashboard/daily`
      };

      return await DiscordRequest(
        `/webhooks/${interaction.application_id}/${interaction.token}`,
        {
          method: "POST",
          body: {
            embeds: [embed],
            components: [
              {
                type: 1,
                components: [button, siteButton]
              }
            ]
          }
        }
      );

    /* =========================
       PLACAR
    ========================== */
    } else if (subcommand.name === "placar") {

      const PAGE_SIZE = 10;
      let page = 0;

      const users = await UserGlobal.find({
        "primogemas.atm": { $gt: 0 }
      }).sort({ "primogemas.atm": -1 });

      if (!users.length) {
        return await DiscordRequest(
          `/webhooks/${interaction.application_id}/${interaction.token}`,
          {
            method: "POST",
            body: { content: `${ayami.emduvida} Ainda não há aventureiros ricos em primogemas... Vai ser o primeiro? ⭐` }
          }
        );
      }

      const totalPages = Math.ceil(users.length / PAGE_SIZE);

      const generateEmbed = async (page) => {

        const start = page * PAGE_SIZE;
        const slice = users.slice(start, start + PAGE_SIZE);

        const medals = ["🥇", "🥈", "🥉"];
        let description = "";

        for (let i = 0; i < slice.length; i++) {

          const userDb = slice[i];
          const position = start + i + 1;
          let userData;

          try {
            userData = await DiscordRequest(
              `/users/${userDb.userId}`,
              { method: "GET" }
            );
          } catch {
            continue;
          }

          const name =
            userData.global_name ||
            userData.username ||
            "Aventureiro";

          const profileUrl = `https://discord.com/users/${userDb.userId}`;
          const medal = medals[position - 1] || `**#${position}**`;

          description +=
            `${medal} [${name}](${profileUrl}) — ⭐ **${userDb.primogemas.atm.toLocaleString()}**\n`;
        }

        return {
          title: `${ayami.festa} Placar de Primogemas`,
          color: cores.dourado,
          description: description || "Sem dados nesta página.",
          footer: {
            text: `Página ${page + 1} de ${totalPages} • Quem será o próximo? ⭐`
          },
          timestamp: new Date().toISOString()
        };
      };

      const buildComponents = () => [{
        type: 1,
        components: [
          client.interactions.createButton({
            user: interaction.member.user.id,
            tempo: MS("5min"),
            data: {
              label: "⬅️",
              style: 2,
              disabled: page === 0
            },
            funcao: async (i) => {
              if (page > 0) page--;
              const embed = await generateEmbed(page);
              return await DiscordRequest(
                `/interactions/${i.id}/${i.token}/callback`,
                {
                  method: "POST",
                  body: {
                    type: 7,
                    data: { embeds: [embed], components: buildComponents() }
                  }
                }
              );
            }
          }),
          client.interactions.createButton({
            user: interaction.member.user.id,
            tempo: MS("5min"),
            data: {
              label: "➡️",
              style: 2,
              disabled: page >= totalPages - 1
            },
            funcao: async (i) => {
              if (page < totalPages - 1) page++;
              const embed = await generateEmbed(page);
              return await DiscordRequest(
                `/interactions/${i.id}/${i.token}/callback`,
                {
                  method: "POST",
                  body: {
                    type: 7,
                    data: { embeds: [embed], components: buildComponents() }
                  }
                }
              );
            }
          })
        ]
      }];

      const firstEmbed = await generateEmbed(page);

      return await DiscordRequest(
        `/webhooks/${interaction.application_id}/${interaction.token}`,
        {
          method: "POST",
          body: {
            embeds: [firstEmbed],
            components: buildComponents()
          }
        }
      );

    /* =========================
       PAGAR
    ========================== */
    } else if (subcommand.name === "pagar") {

      const targetId = subcommand.options[0].value;
      const amountInput = subcommand.options[1].value;

      if (targetId === authorId) {
        return await DiscordRequest(
          `/webhooks/${interaction.application_id}/${interaction.token}`,
          {
            method: "POST",
            body: {
              content: `${ayami.rindo} Hehe, você não pode enviar primogemas pra si mesmo! Que tentativa criativa...`
            }
          }
        );
      }

      let input = amountInput.toLowerCase().replace(/\s/g, "");
      const match = input.match(/^(\d+(?:\.\d+)?)(k|kk|m)?$/);

      if (!match) {
        return await DiscordRequest(
          `/webhooks/${interaction.application_id}/${interaction.token}`,
          {
            method: "POST",
            body: {
              content: `${ayami.emduvida} Hmm, esse valor não parece certo... Use algo como \`100\`, \`2k\`, \`5kk\` ou \`1m\`!`
            }
          }
        );
      }

      let amount = parseFloat(match[1]);
      const suffix = match[2];

      if (suffix === "k")  amount *= 1_000;
      if (suffix === "kk") amount *= 1_000_000;
      if (suffix === "m")  amount *= 1_000_000;

      amount = Math.floor(amount);

      if (amount < 1) {
        return await DiscordRequest(
          `/webhooks/${interaction.application_id}/${interaction.token}`,
          {
            method: "POST",
            body: {
              content: `${ayami.emburrada} O valor precisa ser maior que zero, hein!`
            }
          }
        );
      }

      let sender   = await UserGlobal.findOne({ userId: authorId });
      let receiver = await UserGlobal.findOne({ userId: targetId });

      if (!receiver) receiver = await UserGlobal.create({ userId: targetId });
      if (!sender)   sender   = await UserGlobal.create({ userId: authorId });

      /* Envio para o bot */
      if (targetId === process.env.CLIENT_ID) {

        if (sender.primogemas.atm < amount) {
          return await DiscordRequest(
            `/webhooks/${interaction.application_id}/${interaction.token}`,
            {
              method: "POST",
              body: {
                content: `${ayami.chorando} Você não tem primogemas suficientes pra isso... ${ayami.emduvida}`
              }
            }
          );
        }

        await UserGlobal.updateOne(
          { userId: authorId },
          { $inc: { "primogemas.atm": -amount } }
        );

        // Seção 8: essa doação pro bot também bypassava o Economy.js.
        UserEconomy.log({
          userId:   authorId,
          action:   "remove",
          previous: sender.primogemas.atm,
          amount:   amount,
          current:  sender.primogemas.atm - amount
        }).catch(err => console.error("[Primogemas] Falha ao logar doação:", err));

        return await DiscordRequest(
          `/webhooks/${interaction.application_id}/${interaction.token}`,
          {
            method: "POST",
            body: {
              content:
                `${ayami.corao} Obrigada pela sua contribuição!\n\n` +
                `⭐ **${amount.toLocaleString()} Primogemas** foram recebidas com carinho.\n\n` +
                `⚖️ Lembrete importante:\n` +
                `• Primogemas não possuem valor real.\n` +
                `• Não podem ser vendidas ou trocadas por dinheiro.\n` +
                `• São apenas recursos virtuais deste sistema.`
            }
          }
        );
      }

      if (authorId !== process.env.CLIENT_ID) {
        if (sender.primogemas.atm < amount) {
          return await DiscordRequest(
            `/webhooks/${interaction.application_id}/${interaction.token}`,
            {
              method: "POST",
              body: {
                content: `${ayami.chorando} Ops! Você não tem primogemas suficientes para essa transferência. ${ayami.emduvida}`
              }
            }
          );
        }
      }

      let confirmations = [];

      const confirmButton = client.interactions.createButton({
        tempo: MS("5m"),
        data: {
          label: "⭐ Confirmar Transferência",
          style: 3
        },
        funcao: async (i) => {

          const clickUserId =
            i.user?.id ||
            i.member?.user?.id ||
            i.author?.id ||
            i.data?.member?.user?.id;

          if (!clickUserId) return;

          if (![authorId, targetId].includes(clickUserId)) {
            return await DiscordRequest(
              `/interactions/${i.id}/${i.token}/callback`,
              {
                method: "POST",
                body: {
                  type: 4,
                  data: {
                    content: `${ayami.emburrada} Ei, essa transferência não é com você!`,
                    flags: 64
                  }
                }
              }
            );
          }

          if (confirmations.includes(clickUserId)) {
            return await DiscordRequest(
              `/interactions/${i.id}/${i.token}/callback`,
              {
                method: "POST",
                body: {
                  type: 4,
                  data: {
                    content: `${ayami.rindo} Você já confirmou, pode relaxar!`,
                    flags: 64
                  }
                }
              }
            );
          }

          confirmations.push(clickUserId);

          if (confirmations.length < 2) {
            return await DiscordRequest(
              `/interactions/${i.id}/${i.token}/callback`,
              {
                method: "POST",
                body: {
                  type: 7,
                  data: {
                    content:
                      `${ayami.animada} **Transferência de Primogemas** ${ayami.animada}\n\n` +
                      `⭐ Valor: **${amount.toLocaleString()} Primogemas**\n` +
                      `👤 Remetente: <@${authorId}>\n` +
                      `🎯 Destinatário: <@${targetId}>\n\n` +
                      `✅ Confirmações: (${confirmations.length}/2)\n\n` +
                      `Aguardando a confirmação de ambas as partes~ ${ayami.pensando}\n\n` +
                      `⚖️ Lembrete:\n` +
                      `• Primogemas não possuem valor real.\n` +
                      `• Não podem ser vendidas ou trocadas por dinheiro.\n` +
                      `• São apenas recursos virtuais deste sistema.`,
                    components: [
                      {
                        type: 1,
                        components: [confirmButton]
                      }
                    ]
                  }
                }
              }
            );
          }

          /* Executa transferência */
          await UserGlobal.updateOne(
            { userId: authorId },
            { $inc: { "primogemas.atm": -amount } }
          );

          await UserGlobal.updateOne(
            { userId: targetId },
            { $inc: { "primogemas.atm": amount } }
          );

          await UserGlobal.updateOne(
            { userId: authorId },
            {
              $push: {
                "primogemas.transacoes": {
                  $each: [{
                    type: "transfer_send",
                    to: targetId,
                    value: amount,
                    date: Date.now()
                  }],
                  $slice: -100 // seção 8: teto do array
                }
              }
            }
          );

          await UserGlobal.updateOne(
            { userId: targetId },
            {
              $push: {
                "primogemas.transacoes": {
                  $each: [{
                    type: "transfer_receive",
                    from: authorId,
                    value: amount,
                    date: Date.now()
                  }],
                  $slice: -100
                }
              }
            }
          );

          // Seção 8: transferência entre usuários também bypassava o
          // Economy.js — nenhum log era gerado nem persistido. Loga os dois
          // lados (quem enviou e quem recebeu).
          UserEconomy.log({
            userId:   authorId,
            action:   "transfer_send",
            previous: sender.primogemas.atm,
            amount,
            current:  sender.primogemas.atm - amount
          }).catch(err => console.error("[Primogemas] Falha ao logar transferência (envio):", err));

          UserEconomy.log({
            userId:   targetId,
            action:   "transfer_receive",
            previous: receiver.primogemas.atm,
            amount,
            current:  receiver.primogemas.atm + amount
          }).catch(err => console.error("[Primogemas] Falha ao logar transferência (recebimento):", err));

          return await DiscordRequest(
            `/interactions/${i.id}/${i.token}/callback`,
            {
              method: "POST",
              body: {
                type: 7,
                data: {
                  content:
                    `${ayami.festa} **Transferência Concluída!** ${ayami.corao}\n\n` +
                    `⭐ **${amount.toLocaleString()} Primogemas** foram enviadas para <@${targetId}>!\n\n` +
                    `✅ Confirmações: (2/2) — Tudo certo!\n\n` +
                    `⚖️ Primogemas não possuem valor real.`,
                  components: []
                }
              }
            }
          );
        }
      });

      return await DiscordRequest(
        `/webhooks/${interaction.application_id}/${interaction.token}`,
        {
          method: "POST",
          body: {
            content:
              `${ayami.animada} **Transferência de Primogemas** ${ayami.animada}\n\n` +
              `⭐ Valor: **${amount.toLocaleString()} Primogemas**\n` +
              `👤 Remetente: <@${authorId}>\n` +
              `🎯 Destinatário: <@${targetId}>\n\n` +
              `✅ Confirmações: (0/2)\n\n` +
              `Ambas as partes precisam confirmar para a transferência acontecer~ ${ayami.pensando}\n\n` +
              `⚖️ Lembrete:\n` +
              `• Primogemas não possuem valor real.\n` +
              `• Não podem ser vendidas ou trocadas por dinheiro.\n` +
              `• São apenas recursos virtuais deste sistema.`,
            components: [
              {
                type: 1,
                components: [confirmButton]
              }
            ]
          }
        }
      );

    /* =========================
       TRANSFERÊNCIAS
    ========================== */
    } else if (subcommand.name === "transferências") {

      const PAGE_SIZE = 20;
      let page = 0;

      let user = await UserGlobal.findOne({ userId: authorId });

      if (!user) {
        user = await UserGlobal.create({ userId: authorId });
      }

      const transactions =
        (user.primogemas?.transacoes || [])
          .filter(t => t && (t.date || t.value || t.amount || t.type))
          .sort((a, b) => (b.date || 0) - (a.date || 0));

      if (!transactions.length) {
        return await DiscordRequest(
          `/webhooks/${interaction.application_id}/${interaction.token}`,
          {
            method: "POST",
            body: {
              content: `${ayami.emduvida} Você ainda não tem nenhuma transação... Que tal resgatar seu daily? ⭐`
            }
          }
        );
      }

      const totalPages = Math.ceil(transactions.length / PAGE_SIZE);

      const generateEmbed = async (page) => {

        const start = page * PAGE_SIZE;
        const slice = transactions.slice(start, start + PAGE_SIZE);

        let description = "";

        for (const transaction of slice) {

          const date = transaction.date
            ? Math.floor(new Date(transaction.date).getTime() / 1000)
            : Math.floor(Date.now() / 1000);

          if (transaction.type === "daily") {
            description +=
              `${ayami.festa} **Daily Resgatado**\n` +
              `⭐ ${Number(transaction.value || 0).toLocaleString()} Primogemas\n` +
              `🎰 ${transaction.giros || 0} giros\n` +
              `${transaction.premium ? `✨ Bônus de assinatura!\n` : ""}` +
              `🕒 <t:${date}:R>\n\n`;

          } else if (transaction.type === "transfer_send") {

            let userName = "Aventureiro";
            let profileUrl = `https://discord.com/users/${transaction.to}`;

            try {
              const userData = await DiscordRequest(`/users/${transaction.to}`, { method: "GET" });
              userName = userData.global_name || userData.username || "Aventureiro";
            } catch {}

            description +=
              `📤 **Primogemas Enviadas**\n` +
              `👤 Para: [${userName}](${profileUrl})\n` +
              `⭐ ${Number(transaction.value || 0).toLocaleString()} Primogemas\n` +
              `🕒 <t:${date}:R>\n\n`;

          } else if (transaction.type === "transfer_receive") {

            let userName = "Aventureiro";
            let profileUrl = `https://discord.com/users/${transaction.from}`;

            try {
              const userData = await DiscordRequest(`/users/${transaction.from}`, { method: "GET" });
              userName = userData.global_name || userData.username || "Aventureiro";
            } catch {}

            description +=
              `📥 **Primogemas Recebidas**\n` +
              `👤 De: [${userName}](${profileUrl})\n` +
              `⭐ ${Number(transaction.value || 0).toLocaleString()} Primogemas\n` +
              `🕒 <t:${date}:R>\n\n`;

          } else if (transaction.type === "banner_pull") {

            description +=
              `✨ **Invocação Realizada**\n` +
              `🎴 Banner: ${transaction.banner_name || "Desconhecido"}\n` +
              `🎰 Giros: ${transaction.amount || 0}\n` +
              `⭐ Gasto: ${Number(transaction.value || 0).toLocaleString()} Primogemas\n` +
              `🕒 <t:${date}:R>\n\n`;

          } else if (transaction.type === "adventure_rank_reward") {

            description +=
              `📌 **Recompensa de Rank**\n` +
              `🏅 Rank: #${transaction.old_level || 0} → #${transaction.new_level || 0}\n` +
              `🎰 Giros Recebidos: ${transaction.rolls || 0}\n` +
              `⭐ ${Number(transaction.value || 0).toLocaleString()} Primogemas\n` +
              `🕒 <t:${date}:R>\n\n`;

          } else {

            description +=
              `📜 **${transaction.type || "Desconhecido"}**\n` +
              `⭐ ${Number(transaction.value || 0).toLocaleString()} Primogemas\n` +
              `🕒 <t:${date}:R>\n\n`;
          }
        }

        return {
          title: `${ayami.curtida} Histórico de Transações`,
          color: cores.azulSecundario,
          description: description || "Sem registros nesta página.",
          footer: {
            text: `Página ${page + 1} de ${totalPages} • ${transactions.length} registros no total ⭐`
          },
          timestamp: new Date().toISOString()
        };
      };

      const buildComponents = () => [{
        type: 1,
        components: [
          client.interactions.createButton({
            user: authorId,
            tempo: MS("10m"),
            data: {
              label: "⬅️",
              style: 2,
              disabled: page === 0
            },
            funcao: async (i) => {
              if (page > 0) page--;
              const embed = await generateEmbed(page);
              return await DiscordRequest(
                `/interactions/${i.id}/${i.token}/callback`,
                {
                  method: "POST",
                  body: {
                    type: 7,
                    data: { embeds: [embed], components: buildComponents() }
                  }
                }
              );
            }
          }),
          client.interactions.createButton({
            user: authorId,
            tempo: MS("10m"),
            data: {
              label: "➡️",
              style: 2,
              disabled: page >= totalPages - 1
            },
            funcao: async (i) => {
              if (page < totalPages - 1) page++;
              const embed = await generateEmbed(page);
              return await DiscordRequest(
                `/interactions/${i.id}/${i.token}/callback`,
                {
                  method: "POST",
                  body: {
                    type: 7,
                    data: { embeds: [embed], components: buildComponents() }
                  }
                }
              );
            }
          })
        ]
      }];

      const firstEmbed = await generateEmbed(page);

      return await DiscordRequest(
        `/webhooks/${interaction.application_id}/${interaction.token}`,
        {
          method: "POST",
          body: {
            embeds: [firstEmbed],
            components: buildComponents()
          }
        }
      );
    }
  }
}
