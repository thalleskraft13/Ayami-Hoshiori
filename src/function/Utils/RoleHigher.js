const DiscordRequest = require("../DiscordRequest.js");

async function roleHigher({
  guildId,
  roleId,
  bot = false,
  userId = null
}) {

  const targetId = bot
    ? (await DiscordRequest('/users/@me')).id
    : userId;

  const member = await DiscordRequest(
    `/guilds/${guildId}/members/${targetId}`
  );

  const roles = await DiscordRequest(
    `/guilds/${guildId}/roles`
  );

  const targetRole = roles.find(r => r.id === roleId);

  if (!targetRole) return false;

  let highestPosition = -1;

  for (const memberRoleId of member.roles) {
    const role = roles.find(r => r.id === memberRoleId);

    if (role && role.position > highestPosition) {
      highestPosition = role.position;
    }
  }

  return highestPosition > targetRole.position;
}

module.exports = roleHigher;