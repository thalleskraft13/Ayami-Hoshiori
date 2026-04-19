const BASE_URL = "https://discord.com/api/v10";

/**
 * Generic Discord API request helper (no discord.js REST)
 * @param {string} route - ex: /users/123
 * @param {Object} options - { method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', body?: any }
 */
async function DiscordRequest(route, options = {}) {

  if (!process.env.DISCORD_TOKEN)
    throw new Error("DISCORD_TOKEN is not defined.");

  if (!route.startsWith("/"))
    route = `/${route}`;

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

  try {

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Discord API Error ${response.status}: ${JSON.stringify(error)}`
      );
    }

    if (response.status === 204)
      return null;

    return await response.json();

  } catch (error) {
    console.error("DiscordRequest Error:", error);
    throw error;
  }
}

module.exports = DiscordRequest;