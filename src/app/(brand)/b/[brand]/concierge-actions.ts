"use server";
// Contact details shared through the concierge's in-chat form. Consent is explicit (the tick box) and recorded.
// Saved as a lead for the brand and as a call-back for the studio team (so it shows in today's dashboard too).
import { headers } from "next/headers";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/time";

const Input = z.object({
  brand: z.string().regex(/^[a-z0-9-]{2,40}$/),
  chatId: z.string().uuid(),
  reason: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  phone: z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a 10-digit Indian mobile number"),
  email: z.string().trim().email("Check your email address").max(120).optional().or(z.literal("")),
  consent: z.boolean().refine((v) => v, "Please agree so the team can contact you"),
});

export type LeadResult = { ok: true; name: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveChatLead(input: z.input<typeof Input>): Promise<LeadResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  const v = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (await rateLimited(`chat-lead:${ip}`, 5, 600)) return { ok: false, error: "Too many requests. Please try again in a few minutes." };

  const db = adminClient();
  const [{ data: brand }, { data: call }] = await Promise.all([
    db.from("brands").select("id").eq("slug", v.brand).maybeSingle(),
    db.from("calls").select("id, salon_id, channel").eq("id", v.chatId).maybeSingle(),
  ]);
  if (!brand || !call || call.channel !== "web") return { ok: false, error: "Something went wrong. Please try again." };
  const phone = normalizePhone(v.phone);

  const [lead, callback] = await Promise.all([
    db.from("leads").insert({
      brand_id: brand.id,
      salon_id: call.salon_id,
      kind: "chat",
      name: v.name,
      phone,
      email: v.email || null,
      message: `${v.reason} (from the website chat)`,
      consent_at: new Date().toISOString(),
    }),
    db.from("callbacks").insert({ salon_id: call.salon_id, reason: `Website chat: ${v.reason}${v.email ? ` · email ${v.email}` : ""}`, customer_name: v.name, phone, call_id: call.id }),
  ]);
  if (lead.error || callback.error) return { ok: false, error: "We couldn't save that just now. Please try again." };
  await db.from("calls").update({ outcome: "callback" }).eq("id", call.id);
  return { ok: true, name: v.name.split(" ")[0] };
}
