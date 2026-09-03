import crypto from "crypto";

type LineTextMessage = {
  type: "text";
  text: string;
};

function getLineChannelSecret() {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error("LINE_CHANNEL_SECRET is required");
  }
  return secret;
}

function getLineAccessToken() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is required");
  }
  return token;
}

export function getLineGroupId() {
  return process.env.LINE_GROUP_ID || "";
}

export function verifyLineSignature(body: string, signature: string | null) {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", getLineChannelSecret())
    .update(body)
    .digest("base64");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export async function replyLineMessage(replyToken: string, messages: LineTextMessage[]) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getLineAccessToken()}`
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status}`);
  }
}

export async function pushLineMessage(to: string, messages: LineTextMessage[]) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getLineAccessToken()}`
    },
    body: JSON.stringify({
      to,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`LINE push failed: ${response.status}`);
  }
}


