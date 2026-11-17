// Public website-widget API. POST { text?, sessionId? } → { sessionId, reply }
// No text → starts a new chat and returns the greeting.
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { startWebChat, webChatTurn } from "@/lib/agent/web-agent";
import { clientIp, overDailyCap, rateLimited } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";


const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = clientIp(req);
  if (await rateLimited(`chat:${slug}:${ip}`, 30, 60)) return NextResponse.json({ error: "Too many messages, slow down." }, { status: 429, headers: CORS });

  const { data: salon } = await adminClient().from("salons").select("id, widget_enabled, timezone, daily_chat_cap").eq("slug", slug).maybeSingle();
  if (!salon || !salon.widget_enabled) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });

  const body = (await req.json().catch(() => ({}))) as { text?: string; sessionId?: string };
  const text = (body.text ?? "").toString().slice(0, 1000).trim();

  // Daily budget per branch: protects AI credits from abuse.
  if (text && (await overDailyCap(salon.id, "chat", salon.daily_chat_cap, salon.timezone))) {
    await logEvent(salon.id, "cap_reached", { kind: "chat", cap: salon.daily_chat_cap });
    return NextResponse.json({ error: "Our online assistant is very busy today. Please call the studio and we'll be happy to help." }, { status: 429, headers: CORS });
  }

  try {
    if (!body.sessionId || !text) {
      const started = await startWebChat(salon.id);
      return NextResponse.json(started, { headers: CORS });
    }
    const { reply } = await webChatTurn(salon.id, body.sessionId, text);
    return NextResponse.json({ sessionId: body.sessionId, reply }, { headers: CORS });
  } catch (e) {
    console.error("[widget]", e);
    await logEvent(salon.id, "tool_error", { where: "website chat", message: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Our assistant is unavailable right now. Please call the studio." }, { status: 500, headers: CORS });
  }
}
