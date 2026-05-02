const BASE_URL = "https://discord.com/api/v10";
const LOG_CHANNEL_ID = "1500087209536000190";

function sanitizeRoute(route) {
  return route
    .replace(/interactions\/(\d+)\/([^/]+)/, "interactions/$1/[TOKEN]")
    .replace(/webhooks\/(\d+)\/([^/]+)/, "webhooks/$1/[TOKEN]");
}

function getMethodColor(method) {
  switch (method) {
    case "GET": return 0x57F287;      // verde
    case "POST": return 0x5865F2;     // azul
    case "PATCH": return 0xFEE75C;    // amarelo/laranja
    case "PUT": return 0xEB459E;      // rosa
    case "DELETE": return 0xED4245;   // vermelho
    default: return 0x95A5A6;         // cinza
  }
}

async function sendLogEmbed(embed) {
  try {
    await fetch(`${BASE_URL}/channels/${LOG_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${process.env.DISCORD_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (err) {
    console.error("Erro ao enviar log:", err.message);
  }
}

async function DiscordRequest(route, options = {}) {

  if (!process.env.DISCORD_TOKEN)
    throw new Error("DISCORD_TOKEN is not defined.");

  if (!route.startsWith("/"))
    route = `/${route}`;

  const safeRoute = sanitizeRoute(route);
  const url = BASE_URL + route;
  const method = options.method?.toUpperCase() || "GET";

  const config = {
    method,
    headers: {
      "Authorization": `Bot ${process.env.DISCORD_TOKEN}`,
      "Content-Type": "application/json"
    }
  };

  if (options.body)
    config.body = JSON.stringify(options.body);

  const start = Date.now();

  try {

    const response = await fetch(url, config);
    const time = Date.now() - start;

    const embed = {
      title: `Discord API • ${method}`,
      color: getMethodColor(method),
      fields: [
        { name: "Status", value: String(response.status), inline: true },
        { name: "Tempo", value: `${time}ms`, inline: true },
        { name: "Rota", value: `\`${safeRoute}\`` }
      ],
      timestamp: new Date().toISOString()
    };

    if (!response.ok) {
      embed.title = `Discord API ERROR • ${method}`;
      embed.color = 0xED4245;
      await sendLogEmbed(embed);

      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Discord API Error ${response.status}: ${JSON.stringify(error)}`
      );
    }

    await sendLogEmbed(embed);

    if (response.status === 204)
      return null;

    return await response.json();

  } catch (error) {

    const time = Date.now() - start;

    await sendLogEmbed({
      title: `Internal Error • ${method}`,
      color: 0x992D22,
      fields: [
        { name: "Tempo", value: `${time}ms`, inline: true },
        { name: "Rota", value: `\`${safeRoute}\`` },
        { name: "Erro", value: error.message }
      ],
      timestamp: new Date().toISOString()
    });

    console.error("DiscordRequest Error:", error);
    throw error;
  }
}

module.exports = DiscordRequest;