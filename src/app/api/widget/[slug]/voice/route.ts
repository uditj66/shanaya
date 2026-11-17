// Website "Talk" button: returns Shanaya's voice assistant for this salon.
// Built by the SAME buildVapiAssistant() as phone calls, so the voice is identical.
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { loadSalonContext } from "@/lib/agent/context";
import { buildVapiAssistant } from "@/lib/agent/vapi";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (rateLimited(`voice:${slug}:${clientIp(req)}`, 10)) return NextResponse.json({ error: "Too many calls, please wait a minute." }, { status: 429 });
  if (!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) return NextResponse.json({ error: "Voice calls are not set up yet." }, { status: 503 });

  const db = adminClient();
  const { data: salon } = await db.from("salons").select("id, widget_enabled").eq("slug", slug).maybeSingle();
  if (!salon || !salon.widget_enabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ctx = await loadSalonContext(db, salon.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ assistant: buildVapiAssistant(ctx, null, "web") }, { headers: { "Cache-Control": "no-store" } });
}
