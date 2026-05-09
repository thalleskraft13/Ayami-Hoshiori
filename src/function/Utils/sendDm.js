const DiscordRequest = require("../DiscordRequest.js")
const dmCache = new Map();

async function sendDM(userId, messageData) {
  try {

    let channelId;

    if (dmCache.has(userId)) {
      channelId = dmCache.get(userId);
    } else {

      const channel = await DiscordRequest("/users/@me/channels", {
        method: "POST",
        body: {
          recipient_id: userId
        }
      });

      if (!channel?.id)
        throw new Error("Não foi possível criar canal DM.");

      channelId = channel.id;
      dmCache.set(userId, channelId);
    }

   
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: messageData
    });

    return { success: true };

  } catch (error) {

    
    dmCache.delete(userId);

    return {
      success: false,
      error: error.message
    };
  }
}


module.exports = sendDM;