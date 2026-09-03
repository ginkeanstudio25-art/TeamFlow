import { NextResponse } from "next/server";
import { replyLineMessage, verifyLineSignature } from "@/lib/server/line";

export const runtime = "nodejs";

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    groupId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

type LineWebhookPayload = {
  events?: LineWebhookEvent[];
};

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  try {
    if (!verifyLineSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid LINE signature" }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "LINE is not configured" },
      { status: 500 }
    );
  }

  const payload = JSON.parse(body) as LineWebhookPayload;

  for (const event of payload.events || []) {
    const groupId = event.source?.groupId;
    const text = event.message?.text?.trim().toLowerCase();

    if (event.type === "join" && event.replyToken && groupId) {
      await replyLineMessage(event.replyToken, [
        {
          type: "text",
          text: `เชื่อม TeamFlow กับกลุ่มนี้ได้แล้ว\nนำค่านี้ไปใส่ใน Vercel Environment Variables:\nLINE_GROUP_ID=${groupId}`
        }
      ]);
    }

    if (
      event.type === "message" &&
      event.replyToken &&
      groupId &&
      event.message?.type === "text" &&
      (text === "groupid" || text === "ไอดีกลุ่ม")
    ) {
      await replyLineMessage(event.replyToken, [
        {
          type: "text",
          text: `LINE_GROUP_ID=${groupId}`
        }
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}
