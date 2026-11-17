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
const juhuRefs: string[] = [];
const caller = "+919000012345";
const call = { id: callId, phoneNumberId: "smoke-test-number", customer: { number: caller } };
let ok = 0;
const pass = (m: string) => { ok++; console.log(`  ✓ ${m}`); };
const fail = (m: string, extra?: unknown) => { console.error(`  ✗ ${m}`, extra ?? ""); process.exitCode = 1; };

async function vapi(message: Record<string, unknown>, query = "") {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(`${APP}/api/vapi${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secret ? { "x-vapi-secret": secret } : {}) },
        body: JSON.stringify({ message: { call, ...message } }),
      });
      return { status: r.status, body: await r.json() };
    } catch (e) {
      // flaky networks drop connections; read-only checks and idempotent retries are safe here
      if (attempt >= 3) throw e;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}
let seq = 0;
/** Each tool call gets a unique id, like Vapi does. Pass `id` to replay the same call (a retry). */
async function tool(name: string, args: Record<string, unknown>, id = `${callId}-t${++seq}`) {
  const { body } = await vapi({ type: "tool-calls", toolCallList: [{ id, type: "function", function: { name, arguments: args } }] }, `?salon=${SALON}`);
  return JSON.parse(body.results?.[0]?.result ?? "{}");
}

// next Wednesday in India time (every therapist role works Wednesdays at the flagship)
const { todayIn, addDays, weekdayOf } = await import("../src/lib/time");
const todayIST = todayIn("Asia/Kolkata");
const DATE = addDays(todayIST, ((3 - weekdayOf(todayIST) + 7) % 7) || 7);

console.log(`Smoke test against ${APP} for ${DATE}`);
const { data: before } = await db.from("salons").select("vapi_phone_number_id").eq("id", SALON).single();
await db.from("salons").update({ vapi_phone_number_id: "smoke-test-number" }).eq("id", SALON);

async function run() {
  // 1. Incoming call → assistant config
  const a = await vapi({ type: "assistant-request" });
  const knowledge: string = a.body.assistantOverrides?.variableValues?.knowledge ?? a.body.assistant?.model?.messages?.[0]?.content ?? "";
  if (a.body.assistantId) pass("assistant-request returns the saved Vapi assistant + live knowledge overrides");
  else if (a.body.assistant) pass("assistant-request returns a transient assistant (no VAPI_ASSISTANT_ID)");
  else fail("assistant-request", a);
  const branchCount = (knowledge.match(/branch_id:/g) ?? []).length;
  if (knowledge.includes("Lumière") && branchCount > 1) pass(`knowledge covers ${branchCount} branches`);
  else fail("knowledge missing branches", branchCount);

  // Book at ANOTHER branch (Juhu) from the Bandra line, using the shared service code
  const { data: juhu } = await db.from("salons").select("id").eq("branch_code", "MUM-JUH").single();
  const avJ = await tool("check_availability", { branch_id: juhu!.id, service: "FAC001", date: DATE });
  const tJ = avJ.available?.[0]?.time ?? avJ.next_available?.[0]?.time;
  const dJ = avJ.available?.length ? DATE : avJ.next_available_date;
  const bookArgs = { branch_id: juhu!.id, service: "FAC001", date: dJ, time: tJ, customer_name: "Smoke Juhu Guest" };
  const retryId = `${callId}-retry`;
  const bJ = tJ ? await tool("book_appointment", bookArgs, retryId) : avJ;
  if (bJ.success && /Juhu/.test(bJ.branch)) {
    pass(`cross-branch booking from the Bandra line at ${bJ.branch} (${bJ.reference})`);
    juhuRefs.push(bJ.reference);
  }
  else fail("cross-branch booking", bJ);

  // Vapi retries a tool call after a timeout → must return the SAME booking, not create a second one
  if (bJ.reference) {
    const again = await tool("book_appointment", bookArgs, retryId);
    const { count } = await db.from("bookings").select("*", { count: "exact", head: true }).eq("salon_id", juhu!.id).eq("source", "phone").eq("starts_at", (await db.from("bookings").select("starts_at").eq("reference", bJ.reference).single()).data!.starts_at).neq("status", "cancelled");
    if (again.reference === bJ.reference && count === 1) pass("retried tool call returned the same booking (no double booking)");
    else fail("retry created a duplicate", { again, count });
  }

  // Transfer to a person: branch has no team number set → refused, so Shanaya takes a call-back
  const tr = await vapi({ type: "transfer-destination-request" }, `?salon=${SALON}`);
  const { data: s0 } = await db.from("salons").select("transfer_phone").eq("id", SALON).single();
  if (s0?.transfer_phone ? tr.body.destination?.number : tr.body.error) pass(`transfer request handled (${tr.body.destination ? "connects to the branch team" : "no team number → call-back"})`);
  else fail("transfer-destination-request", tr.body);

  // ── The path REAL calls take: no ?salon= in the URL, branch from SIGNED variableValues ──
  const live = await (await fetch(`${APP}/api/widget/lumiere/voice`)).json();
  const vv = live.assistantOverrides?.variableValues;
  if (vv?.salon_sig && vv?.salon_id === SALON) pass("live call config carries a signed branch id");
  else fail("live call config not signed", live);
  const webCall = (vars: Record<string, unknown>) => ({ id: `${callId}-web`, type: "webCall", assistantOverrides: { variableValues: vars } });
  const viaCall = async (callObj: unknown, name: string, args: Record<string, unknown>, id = `${callId}-v${++seq}`) => {
    const { body } = await vapi({ type: "tool-calls", call: callObj, toolCallList: [{ id, type: "function", function: { name, arguments: args } }] });
    return JSON.parse(body.results?.[0]?.result ?? "{}");
  };
  if (vv) {
    const ok = await viaCall(webCall(vv), "check_availability", { branch_id: SALON, service: "FAC005", date: DATE });
    if (Array.isArray(ok.available)) pass("tool call WITHOUT ?salon= works via the signed branch id (production path)");
    else fail("production-path tool call", ok);

    const forged = await viaCall(webCall({ ...vv, salon_id: juhu!.id }), "check_availability", { service: "FAC005", date: DATE });
    if (forged.error) pass("forged branch id (bad signature) is rejected");
    else fail("forged signature accepted!", forged);

    // Website privacy: a phone number alone must not reveal someone's bookings
    const peek = await viaCall(webCall(vv), "find_appointments", { phone: "9000000010" });
    if (peek.error && !peek.appointments) pass("website can't list bookings from a phone number alone");
    else fail("website leaked bookings", peek);

    // Two identical tool calls at the SAME time (Vapi retry while the first is still running) → one booking
    const avC = await viaCall(webCall(vv), "check_availability", { branch_id: SALON, service: "FAC005", date: DATE, preferred_time: "12:00" });
    const tC = avC.available?.[0]?.time;
    if (tC) {
      const args = { branch_id: SALON, service: "FAC005", date: DATE, time: tC, customer_name: "Smoke Concurrent Guest", phone: "9000000013" };
      const sameId = `${callId}-concurrent`;
      const [r1, r2] = await Promise.all([viaCall(webCall(vv), "book_appointment", args, sameId), viaCall(webCall(vv), "book_appointment", args, sameId)]);
      const refs = [r1.reference, r2.reference].filter(Boolean);
      const { count } = await db.from("bookings").select("*, customer:customer_id!inner (phone)", { count: "exact", head: true }).eq("customer.phone", "919000000013").neq("status", "cancelled");
      juhuRefs.push(...refs);
      if (count === 1 && refs.length === 2 && refs[0] === refs[1]) pass("two simultaneous identical tool calls → exactly one booking");
      else fail("concurrent retry", { r1, r2, count });
    }
  }

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

  // 8. Rate limit works across serverless instances: 35 quick "open chat" requests → some get 429
  if (process.argv.includes("--limits")) {
    const codes = await Promise.all(
      Array.from({ length: 35 }, () => fetch(`${APP}/api/widget/lumiere`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.status).catch(() => 0)),
    );
    const blocked = codes.filter((c) => c === 429).length;
    if (blocked > 0) pass(`rate limit: ${blocked} of 35 rapid requests blocked (429)`);
    else fail("rate limit never triggered", codes);
  }

  // cleanup
  const { data: rows } = await db.from("bookings").select("id").in("reference", [...refs, ...juhuRefs]);
  await db.from("bookings").delete().in("id", (rows ?? []).map((r) => r.id));
  await db.from("callbacks").delete().eq("call_id", row?.id ?? "");
  await db.from("calls").delete().eq("external_id", callId);
  await db.from("customers").delete().in("phone", ["919000012345", "919000000010", "919000000011", "919000000012", "919000000013"]);
  await db.from("tool_call_log").delete().like("tool_call_id", `${callId}%`);
}

try {
  await run();
} finally {
  await db.from("salons").update({ vapi_phone_number_id: before?.vapi_phone_number_id ?? null }).eq("id", SALON);
  console.log(process.exitCode ? "\nSome checks failed." : `\nAll ${ok} checks passed. Test data cleaned up.`);
}
