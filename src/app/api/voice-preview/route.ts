// Settings → "Talk to Shanaya": the signed-in owner hears exactly what callers hear.
// Membership is checked with the user's session; the call itself is built with the same service-role data
// as real calls (so a single-branch manager still hears every sister branch, like a guest would).
import { NextResponse } from "next/server";
import { requireSalon } from "@/lib/session";
import { adminClient } from "@/lib/supabase/admin";
import { loadSalonContext } from "@/lib/agent/context";
import { vapiCallConfig } from "@/lib/agent/vapi";
import { rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const { salon, user } = await requireSalon();
  if (!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) return NextResponse.json({ error: "Add NEXT_PUBLIC_VAPI_PUBLIC_KEY to enable voice." }, { status: 503 });
  if (await rateLimited(`preview:${user.id}`, 10, 3600)) return NextResponse.json({ error: "That's a lot of test calls. Please try again later." }, { status: 429 });
  const ctx = await loadSalonContext(adminClient(), salon.id);
  if (!ctx) return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  return NextResponse.json(vapiCallConfig(ctx, null, "web"), { headers: { "Cache-Control": "no-store" } });
}
