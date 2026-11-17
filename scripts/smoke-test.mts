// End-to-end check against a running app (npm run dev) and the real Supabase project.
// Simulates a full Vapi phone call: assistant-request → check availability → book →
// double-book attempt → reschedule → cancel → end-of-call report. Cleans up after itself.
//   npm run smoke            (phone flow, no OpenAI key needed)
//   npm run smoke -- --web   (also runs one website-widget chat turn; needs OPENAI_API_KEY)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const APP = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const SALON = "11111111-1111-1111-1111-111111111111";
const secret = get("VAPI_WEBHOOK_SECRET");
const db = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
// HydraFacial from the standard Lumière catalogue at the flagship branch
const { data: hydra } = await db.from("services").select("id").eq("salon_id", "11111111-1111-1111-1111-111111111111").eq("code", "FAC003").single();
const HYDRA = hydra!.id as string;

const callId = `smoke-${Date.now()}`;
const caller = "+919000012345";
const call = { id: callId, phoneNumberId: "smoke-test-number", customer: { number: caller } };
let ok = 0;
const pass = (m: string) => { ok++; console.log(`  ✓ ${m}`); };
const fail = (m: string, extra?: unknown) => { console.error(`  ✗ ${m}`, extra ?? ""); process.exitCode = 1; };

async function vapi(message: Record<string, unknown>, query = "") {
  const r = await fetch(`${APP}/api/vapi${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "x-vapi-secret": secret } : {}) },
    body: JSON.stringify({ message: { call, ...message } }),
  });
  return { status: r.status, body: await r.json() };
}
async function tool(name: string, args: Record<string, unknown>) {
  const { body } = await vapi({ type: "tool-calls", toolCallList: [{ id: `t-${name}`, type: "function", function: { name, arguments: args } }] }, `?salon=${SALON}`);
  return JSON.parse(body.results?.[0]?.result ?? "{}");
}

// next Wednesday (all three therapists' pattern makes Wed a full day for facials)
const d = new Date();
d.setDate(d.getDate() + (((3 - d.getDay() + 7) % 7) || 7));
const DATE = d.toISOString().slice(0, 10);

console.log(`Smoke test against ${APP} for ${DATE}`);
const { data: before } = await db.from("salons").select("vapi_phone_number_id").eq("id", SALON).single();
await db.from("salons").update({ vapi_phone_number_id: "smoke-test-number" }).eq("id", SALON);

async function run() {
  // 1. Incoming call → assistant config
  const a = await vapi({ type: "assistant-request" });
  if (a.body.assistant?.model?.messages?.[0]?.content?.includes("Lumière")) pass("assistant-request returns the salon's live assistant");
  else fail("assistant-request", a);
  if (a.body.assistant?.model?.tools?.length >= 6) pass(`assistant has ${a.body.assistant.model.tools.length} tools`);

  // 2. Availability
  const av = await tool("check_availability", { service_id: HYDRA, date: DATE, preferred_time: "17:00" });
  const slot = av.available?.[0]?.time ?? av.next_available?.[0]?.time;
  const slotDate = av.available?.length ? DATE : av.next_available_date;
  if (slot) pass(`availability: ${av.available?.map((x: { time: string }) => x.time).join(", ") || `next ${slotDate}`}`);
  else return fail("no availability returned", av);

  // 3. Book with caller's number (no phone given → uses caller ID)
  const b = await tool("book_appointment", { service_id: HYDRA, date: slotDate, time: slot, customer_name: "Smoke Test Guest", notes: "automated test" });
  if (b.success && b.reference) pass(`booked ${b.reference} with ${b.therapist} at ${b.time}`);
  else return fail("booking failed", b);

  // 4. Fill every therapist at that time, then confirm the next attempt is refused
  const refs = [b.reference];
  for (let i = 0; i < 3; i++) {
    const extra = await tool("book_appointment", { service_id: HYDRA, date: slotDate, time: slot, customer_name: `Filler ${i}`, phone: `90000000${10 + i}` });
    if (extra.reference) refs.push(extra.reference);
    else {
      if (extra.error) pass(`slot full → refused ("${extra.error}"), offered ${extra.alternatives?.length ?? 0} alternatives`);
      break;
    }
  }

  // 5. Find by caller ID, reschedule, cancel
  const f = await tool("find_appointments", {});
  if (f.appointments?.some((x: { reference: string }) => x.reference === b.reference)) pass("find_appointments by caller ID");
  else fail("find_appointments", f);

  const wrong = await tool("cancel_appointment", { reference: b.reference, phone: "9111111111" });
  if (wrong.error) pass("cancel refused for a different phone number");
  else fail("ownership check", wrong);

  const av2 = await tool("check_availability", { service_id: HYDRA, date: slotDate, preferred_time: "12:00" });
  const t2 = av2.available?.find((x: { time: string }) => x.time !== slot)?.time;
  if (t2) {
    const r = await tool("reschedule_appointment", { reference: b.reference, new_date: slotDate, new_time: t2 });
    if (r.success) pass(`rescheduled to ${t2}`);
    else fail("reschedule", r);
  }
  const c = await tool("cancel_appointment", { reference: b.reference, reason: "smoke test" });
  if (c.success) pass("cancelled");
  else fail("cancel", c);

  const cb = await tool("request_callback", { reason: "Smoke test: guest wants a bridal package quote" });
  if (cb.success) pass("call-back request saved");

  // 6. End of call report
  await vapi({ type: "end-of-call-report", endedReason: "customer-ended-call", startedAt: new Date(Date.now() - 95_000).toISOString(), endedAt: new Date().toISOString(), cost: 0.12, analysis: { summary: "Smoke test call." }, artifact: { transcript: "AI: Hello\nUser: Book a HydraFacial" } }, `?salon=${SALON}`);
  const { data: row } = await db.from("calls").select("id, summary, duration_seconds, outcome").eq("external_id", callId).single();
  if (row?.summary === "Smoke test call." && row.duration_seconds) pass(`call logged: ${row.duration_seconds}s, outcome ${row.outcome}`);
  else fail("end-of-call-report", row);

  // 7. Optional website chat turn
  if (process.argv.includes("--web")) {
    const s = await (await fetch(`${APP}/api/widget/lumiere`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json();
    const t = await (await fetch(`${APP}/api/widget/lumiere`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: s.sessionId, text: `What times do you have for a HydraFacial on ${DATE}?` }) })).json();
    if (t.reply && !t.error) pass(`website chat replied: "${t.reply.slice(0, 120)}"`);
    else fail("website chat", t);
    await db.from("calls").delete().eq("id", s.sessionId);
  }

  // cleanup
  const { data: rows } = await db.from("bookings").select("id").eq("salon_id", SALON).in("reference", refs);
  await db.from("bookings").delete().in("id", (rows ?? []).map((r) => r.id));
  await db.from("callbacks").delete().eq("call_id", row?.id ?? "");
  await db.from("calls").delete().eq("external_id", callId);
  await db.from("customers").delete().eq("salon_id", SALON).in("phone", ["919000012345", "919000000010", "919000000011", "919000000012"]);
}

try {
  await run();
} finally {
  await db.from("salons").update({ vapi_phone_number_id: before?.vapi_phone_number_id ?? null }).eq("id", SALON);
  console.log(process.exitCode ? "\nSome checks failed." : `\nAll ${ok} checks passed. Test data cleaned up.`);
}
