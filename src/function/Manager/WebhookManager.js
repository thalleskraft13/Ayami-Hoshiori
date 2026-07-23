"use strict";

const DiscordRequest = require("../DiscordRequest.js");

const IS_COMPONENTS_V2 = 1 << 15;

const WEBHOOK_DEAD_CODES = new Set([401, 403, 404, 10015]);

function isWebhookDead(err) {
  if (!err) return false;
  const code = err.status ?? err.httpStatus ?? err.code;
  if (WEBHOOK_DEAD_CODES.has(Number(code))) return true;
  const msg = String(err?.message ?? "");
  return msg.includes("10015") || msg.includes("Unknown Webhook");
}

async function ensureWebhook(channelId, cachedWebhook) {
  if (cachedWebhook?.id && cachedWebhook?.token) {
    try {
      await DiscordRequest(`/webhooks/${cachedWebhook.id}/${cachedWebhook.token}`, {
        method: "GET"
      });
      return cachedWebhook; 
    } catch (err) {
      if (!isWebhookDead(err)) throw err; 
      // fall through → recreate
    }
  }

  const created = await DiscordRequest(`/channels/${channelId}/webhooks`, {
    method: "POST",
    body  : { name: "Message Studio" }
  });

  return { id: created.id, token: created.token };
}

async function sendViaWebhook(webhook, payload, isCV2 = false, profile = null) {
  const qs = isCV2 ? "?wait=true&with_components=true" : "?wait=true";

  const body = { ...payload };
  if (profile?.username)  body.username   = profile.username;
  if (profile?.avatarUrl) body.avatar_url = profile.avatarUrl;

  const res = await DiscordRequest(`/webhooks/${webhook.id}/${webhook.token}${qs}`, {
    method: "POST",
    body
  });
  return { ok: true, messageId: res?.id ?? null };
}

async function sendViaBot(channelId, payload) {
  const safePayload = { ...payload };
  if (safePayload.flags !== undefined) {
    safePayload.flags = safePayload.flags & ~IS_COMPONENTS_V2;
    if (safePayload.flags === 0) delete safePayload.flags;
  }

  const res = await DiscordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body  : safePayload
  });
  return { ok: true, messageId: res?.id ?? null };
}

async function editViaWebhook(webhook, messageId, payload, isCV2 = false) {
  const qs = isCV2 ? "?with_components=true" : "";
  await DiscordRequest(
    `/webhooks/${webhook.id}/${webhook.token}/messages/${messageId}${qs}`,
    { method: "PATCH", body: payload }
  );
  return { ok: true };
}

async function editViaBot(channelId, messageId, payload) {
  const safePayload = { ...payload };
  if (safePayload.flags !== undefined) {
    safePayload.flags = safePayload.flags & ~IS_COMPONENTS_V2;
    if (safePayload.flags === 0) delete safePayload.flags;
  }
  await DiscordRequest(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body  : safePayload
  });
  return { ok: true };
}

async function sendMessage({ channelId, payload, isCV2, cachedWebhook, profile = null }) {
  let webhook      = null;
  let usedFallback = false;
  let sendError    = null;
  let messageId    = null;

  try {
    webhook = await ensureWebhook(channelId, cachedWebhook);
  } catch (err) {
    sendError = `Webhook create failed: ${err?.message ?? err}`;
  }

  if (webhook) {
    try {
      const result = await sendViaWebhook(webhook, payload, isCV2, profile);
      messageId = result.messageId;
      return { webhook, messageId, usedFallback: false, sendError: null };
    } catch (err) {
      sendError = `Webhook send failed: ${err?.message ?? err}`;

      if (isWebhookDead(err)) {
        try {
          webhook = await ensureWebhook(channelId, null); 
          const retry = await sendViaWebhook(webhook, payload, isCV2, profile);
          messageId = retry.messageId;
          return { webhook, messageId, usedFallback: false, sendError: null };
        } catch (err2) {
          sendError = `Webhook retry failed: ${err2?.message ?? err2}`;
        }
      }
    }
  }

  try {
    const result = await sendViaBot(channelId, payload);
    messageId    = result.messageId;
    usedFallback = true;
    return { webhook, messageId, usedFallback, sendError };
  } catch (err) {
    sendError = `Bot fallback also failed: ${err?.message ?? err}`;
    return { webhook, messageId: null, usedFallback: true, sendError };
  }
}

async function editMessage({ channelId, messageId, payload, isCV2, cachedWebhook }) {
  if (cachedWebhook?.id && cachedWebhook?.token && messageId) {
    try {
      await editViaWebhook(cachedWebhook, messageId, payload, isCV2);
      return { ok: true, usedFallback: false, sendError: null };
    } catch (err) {
      if (!isWebhookDead(err)) {
        // Non-dead error → fall through to bot
      }
    }
  }

  try {
    await editViaBot(channelId, messageId, payload);
    return { ok: true, usedFallback: true, sendError: null };
  } catch (err) {
    return {
      ok          : false,
      usedFallback: true,
      sendError   : `Edit failed: ${err?.message ?? err}`
    };
  }
}

module.exports = {
  ensureWebhook,
  sendMessage,
  editMessage,
  isWebhookDead
};
