// Website "Talk" button: returns the call config for Shanaya (same saved Vapi assistant as phone calls).
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { loadSalonContext } from "@/lib/agent/context";
import { vapiCallConfig } from "@/lib/agent/vapi";
import { clientIp, overDailyCap, rateLimited } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";


export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // per visitor: at most 5 voice calls per 10 minutes
  if (await rateLimited(`voice:${slug}:${clientIp(req)}`, 5, 600)) return NextResponse.json({ error: "Too many calls, please wait a few minutes." }, { status: 429 });
  if (!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) return NextResponse.json({ error: "Voice calls are not set up yet." }, { status: 503 });

  const db = adminClient();
  const { data: salon } = await db.from("salons").select("id, widget_enabled, timezone, daily_web_voice_cap").eq("slug", slug).maybeSingle();
  if (!salon || !salon.widget_enabled) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // per branch: daily budget of website voice calls (protects Vapi credits)
  if (await overDailyCap(salon.id, "web_voice", salon.daily_web_voice_cap, salon.timezone)) {
    await logEvent(salon.id, "cap_reached", { kind: "web_voice", cap: salon.daily_web_voice_cap });
    return NextResponse.json({ error: "Voice calls are very busy today. Please type your question or call the studio." }, { status: 429 });
  }

  const ctx = await loadSalonContext(db, salon.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(vapiCallConfig(ctx, null, "web"), { headers: { "Cache-Control": "no-store" } });
}
