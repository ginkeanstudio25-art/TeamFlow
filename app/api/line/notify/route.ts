import { NextResponse } from "next/server";
import { getLineGroupId, pushLineMessage } from "@/lib/server/line";
import { createSupabaseAdminClient, createSupabaseUserClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

type NotifyBody =
  | {
      kind: "task";
      taskId: string;
    }
  | {
      kind: "request";
      requestId: string;
    };

async function getCurrentUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return null;
  }

  const userClient = createSupabaseUserClient(accessToken);
  const { data, error } = await userClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function POST(request: Request) {
  const lineGroupId = getLineGroupId();
  if (!lineGroupId) {
    return NextResponse.json({ ok: true, skipped: "LINE_GROUP_ID is not configured" });
  }

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as NotifyBody;
  const admin = createSupabaseAdminClient();

  if (body.kind === "task") {
    const { data, error } = await admin
      .from("tasks")
      .select("id,assigned_to,created_by")
      .eq("id", body.taskId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Task not found" }, { status: 404 });
    }

    if (data.created_by !== user.id && data.assigned_to !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pushLineMessage(lineGroupId, [
      {
        type: "text",
        text: "TeamFlow: มีงานใหม่ในระบบ\nเปิดเว็บ TeamFlow เพื่อดูรายละเอียด"
      }
    ]);
    return NextResponse.json({ ok: true });
  }

  if (body.kind === "request") {
    const { data, error } = await admin
      .from("requests")
      .select("id,sender,recipient")
      .eq("id", body.requestId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Request not found" }, { status: 404 });
    }

    if (data.sender !== user.id && data.recipient !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pushLineMessage(lineGroupId, [
      {
        type: "text",
        text: "TeamFlow: มีคำขอใหม่ในระบบ\nเปิดเว็บ TeamFlow เพื่อดูรายละเอียด"
      }
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported notification kind" }, { status: 400 });
}
