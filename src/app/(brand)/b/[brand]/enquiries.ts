"use server";
// Website enquiries: gift cards, careers and contact. Validated, rate limited and stored for the team (dashboard, Phase 4).
import { headers } from "next/headers";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/time";

export type EnquiryState = null | { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const phone = z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a 10-digit Indian mobile number");
const name = z.string().trim().min(2, "Please tell us your name").max(80);
const consent = z.literal("on", { errorMap: () => ({ message: "Please agree so we can contact you" }) });
const optEmail = z.string().trim().email("Check your email address").max(120).optional().or(z.literal(""));

const schemas = {
  gift: z.object({
    amount: z.coerce.number().int().min(1000, "Gift cards start at ₹1,000").max(100000),
    sender_name: name,
    sender_phone: phone,
    sender_email: optEmail,
    recipient_name: z.string().trim().min(2, "Who is it for?").max(80),
    message: z.string().trim().max(300).optional(),
    studio: z.string().optional(),
    consent,
  }),
  careers: z.object({
    role: z.string().trim().min(2, "Choose a role").max(80),
    city: z.string().trim().min(2, "Choose a city").max(60),
    name,
    phone,
    email: z.string().trim().email("Check your email address").max(120),
    experience_years: z.coerce.number().int().min(0).max(50).optional(),
    message: z.string().trim().max(1000).optional(),
    consent,
  }),
  contact: z.object({
    name,
    phone,
    email: optEmail,
    studio: z.string().optional(),
    message: z.string().trim().min(5, "How can we help?").max(1000),
    consent,
  }),
};
export type EnquiryKind = keyof typeof schemas;

export async function submitEnquiry(_prev: EnquiryState, form: FormData): Promise<EnquiryState> {
  const result = await submit(form);
  // React resets the form after an action; return the typed text so an error never loses it.
  if (result && !result.ok) {
    const values: Record<string, string> = {};
    for (const [k, v] of form) if (typeof v === "string" && !["kind", "brand", "website", "consent"].includes(k)) values[k] = v;
    return { ...result, values };
  }
  return result;
}

async function submit(form: FormData): Promise<EnquiryState> {
  const kind = String(form.get("kind")) as EnquiryKind;
  const brandSlug = String(form.get("brand") ?? "");
  if (!(kind in schemas) || form.get("website")) return { ok: false, error: "Something went wrong. Please try again." };

  const parsed = schemas[kind].safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (await rateLimited(`enquiry:${kind}:${ip}`, 5, 600)) return { ok: false, error: "Too many requests. Please try again in a few minutes." };

  const db = adminClient();
  const { data: brand } = await db.from("brands").select("id").eq("slug", brandSlug).maybeSingle();
  if (!brand) return { ok: false, error: "Something went wrong. Please try again." };
  const studioId = async (slug?: string) =>
    slug ? ((await db.from("salons").select("id").eq("brand_id", brand.id).eq("studio_slug", slug).maybeSingle()).data?.id ?? null) : null;
  const consent_at = new Date().toISOString();

  let error: { message: string } | null = null;
  if (kind === "gift") {
    const v = schemas.gift.parse(Object.fromEntries(form));
    ({ error } = await db.from("gift_card_requests").insert({
      brand_id: brand.id, salon_id: await studioId(v.studio), amount: v.amount, sender_name: v.sender_name,
      sender_phone: normalizePhone(v.sender_phone), sender_email: v.sender_email || null, recipient_name: v.recipient_name,
      message: v.message ?? "", consent_at,
    }));
    if (!error) return { ok: true, message: `Thank you. We'll call you to complete your ₹${v.amount.toLocaleString("en-IN")} gift card for ${v.recipient_name}.` };
  } else if (kind === "careers") {
    const v = schemas.careers.parse(Object.fromEntries(form));
    ({ error } = await db.from("job_applications").insert({
      brand_id: brand.id, role: v.role, city: v.city, name: v.name, phone: normalizePhone(v.phone), email: v.email,
      experience_years: v.experience_years ?? null, message: v.message ?? "", consent_at,
    }));
    if (!error) return { ok: true, message: `Thank you, ${v.name.split(" ")[0]}. Our team will be in touch if there's a fit.` };
  } else {
    const v = schemas.contact.parse(Object.fromEntries(form));
    ({ error } = await db.from("leads").insert({
      brand_id: brand.id, salon_id: await studioId(v.studio), kind: "contact", name: v.name, phone: normalizePhone(v.phone),
      email: v.email || null, message: v.message, consent_at,
    }));
    if (!error) return { ok: true, message: "Thank you. The studio team will get back to you." };
  }
  console.error("[enquiry]", kind, error?.message);
  return { ok: false, error: "We couldn't send that just now. Please try again." };
}
