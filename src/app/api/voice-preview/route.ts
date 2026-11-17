// Settings → "Talk to Shanaya": the signed-in owner hears exactly what callers hear (same builder, same salon row).
import { NextResponse } from "next/server";
import { requireSalon } from "@/lib/session";
import { loadSalonContext } from "@/lib/agent/context";
import { buildVapiAssistant } from "@/lib/agent/vapi";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, salon } = await requireSalon();
  if (!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) return NextResponse.json({ error: "Add NEXT_PUBLIC_VAPI_PUBLIC_KEY to enable voice." }, { status: 503 });
  const ctx = await loadSalonContext(supabase, salon.id);
  if (!ctx) return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  return NextResponse.json({ assistant: buildVapiAssistant(ctx, null, "web") }, { headers: { "Cache-Control": "no-store" } });
}
