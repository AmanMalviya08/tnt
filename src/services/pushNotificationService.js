const axios = require("axios");

const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";

async function sendPushToToken(token, payload = {}) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || !token) {
    return { success: false, reason: "missing_server_key_or_token" };
  }

  const requestPayload = {
    to: token,
    priority: "high",
    notification: {
      title: payload.title || "Notification",
      body: payload.message || "",
    },
    data: {
      type: payload.type || "admin",
      redirectScreen: payload.redirectScreen || "",
      redirectParams: JSON.stringify(payload.redirectParams || {}),
      ...(payload.meta || {}),
    },
  };

  try {
    const response = await axios.post(FCM_ENDPOINT, requestPayload, {
      headers: {
        Authorization: `key=${serverKey}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      reason: error?.response?.data || error.message || "push_failed",
    };
  }
}

async function sendPushToMany(tokens = [], payload = {}) {
  const cleanedTokens = [...new Set((tokens || []).filter(Boolean))];
  if (!cleanedTokens.length) {
    return { success: true, sent: 0, failed: 0, results: [] };
  }

  const settled = await Promise.allSettled(
    cleanedTokens.map((token) => sendPushToToken(token, payload))
  );

  const results = settled.map((entry, idx) => ({
    token: cleanedTokens[idx],
    ...(entry.status === "fulfilled"
      ? entry.value
      : { success: false, reason: entry.reason?.message || "unknown_error" }),
  }));

  const sent = results.filter((item) => item.success).length;
  const failed = results.length - sent;

  return { success: failed === 0, sent, failed, results };
}

module.exports = {
  sendPushToToken,
  sendPushToMany,
};
