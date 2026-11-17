// Vapi webhook: one endpoint for every salon.
//  • assistant-request            → which salon owns the dialled number? return its live call config
//  • tool-calls                   → run booking tools for the (signed) branch of the call
//  • end-of-call-report           → save transcript, summary, recording, cost for the dashboard
//  • transfer-destination-request → the branch's front-desk number for "transfer to a person"
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { loadSalonContext } from "@/lib/agent/context";
import { vapiCallConfig } from "@/lib/agent/vapi";
import { verifySalon } from "@/lib/agent/call-signature";
import { runTool } from "@/lib/agent/tools";
import { countryCodeFor, normalizePhone } from "@/lib/time";
import { rateLimited } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
type VapiMessage = { type: string; call?: any; phoneNumber?: any; toolCallList?: any[]; [k: string]: any };

function authorised(req: NextRequest) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // must be set in production
  return req.headers.get("x-vapi-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

const vars = (msg: VapiMessage) => msg?.call?.assistantOverrides?.variableValues ?? {};

/**
 * Which branch does this message belong to?
 *  1. ?salon= in the server URL (only set by our own transient fallback and phone-number config)
 *  2. variableValues.salon_id, ONLY if its signature (made by our server) is valid. The browser starts
 *     website calls itself, so an unsigned salon_id could point tools at any branch.
 *  3. the Vapi phone number the guest dialled.
 */
async function salonIdFor(req: NextRequest, msg: VapiMessage): Promise<{ salonId: string | null; forged: boolean }> {
  const fromQuery = req.nextUrl.searchParams.get("salon");
  if (fromQuery) return { salonId: fromQuery, forged: false };
  const v = vars(msg);
  if (v.salon_id) {
    if (verifySalon(v.salon_id, v.salon_sig, v.sig_exp)) return { salonId: String(v.salon_id), forged: false };
    return { salonId: null, forged: true };
  }
  const phoneNumberId = msg.call?.phoneNumberId ?? msg.phoneNumber?.id;
  if (!phoneNumberId) return { salonId: null, forged: false };
  const { data } = await adminClient().from("salons").select("id").eq("vapi_phone_number_id", phoneNumberId).maybeSingle();
  return { salonId: data?.id ?? null, forged: false };
}

/** Website "Talk" calls arrive as Vapi web calls; phone calls as inbound/outbound phone calls. */
const isWebCall = (msg: VapiMessage) =>
  msg.call?.type === "webCall" ||
  vars(msg).channel === "web" ||
  msg.call?.assistantOverrides?.metadata?.channel === "web" ||
  msg.call?.assistant?.metadata?.channel === "web" ||
  msg.assistant?.metadata?.channel === "web";

/** Our calls row for this Vapi call. Never overwrites an existing row (branch, channel or start time). */
async function callRowId(salonId: string, msg: VapiMessage) {
  const externalId = msg.call?.id;
  if (!externalId) return null;
  const db = adminClient();
  await db.from("calls").upsert(
    {
      salon_id: salonId,
      channel: isWebCall(msg) ? "web" : "phone",
      external_id: externalId,
      customer_phone: msg.call?.customer?.number ?? null,
      started_at: new Date().toISOString(),
    },
    { onConflict: "external_id", ignoreDuplicates: true },
  );
  const { data } = await db.from("calls").select("id").eq("external_id", externalId).maybeSingle();
  return data?.id ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Vapi retries a tool call when the first attempt is slow. Claim the tool_call_id BEFORE running, so a retry
 * that arrives while the first attempt is still working waits for its result instead of booking again.
 */
async function runOnce(toolCallId: string | undefined, salonId: string, name: string, run: () => Promise<unknown>) {
  if (!toolCallId) return run();
  const db = adminClient();
  const { data: claimed } = await db
    .from("tool_call_log")
    .upsert({ tool_call_id: toolCallId, salon_id: salonId, tool: name, result: { pending: true } }, { onConflict: "tool_call_id", ignoreDuplicates: true })
    .select("tool_call_id");
  if (claimed?.length) {
    const result = await run();
    await db.from("tool_call_log").update({ result: JSON.parse(JSON.stringify(result ?? null)) }).eq("tool_call_id", toolCallId);
    return result;
  }
  // Someone else (the first attempt) owns this call: wait for its result.
  for (let i = 0; i < 15; i++) {
    const { data } = await db.from("tool_call_log").select("result").eq("tool_call_id", toolCallId).maybeSingle();
    const r = data?.result as { pending?: boolean } | null;
    if (r && !r.pending) return r;
    await sleep(1000);
  }
  return { error: "Still processing the previous request. Use find_appointments or check again in a moment before trying to book again." };
}

const CALL_ERROR = /error|fault|failed|pipeline|unavailable/i;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const msg: VapiMessage | undefined = body?.message;

  if (!authorised(req)) {
    // record a few failures per hour (not every bot hit) so the owner sees misconfiguration
    if (!(await rateLimited("log:webhook_auth", 20, 3600))) {
      // header NAMES only (never values) so a misconfigured credential is easy to spot
      const authHeaders = [...req.headers.keys()].filter((h) => /secret|auth|signature|vapi/i.test(h));
      const v = vars(msg as VapiMessage);
      const branch = req.nextUrl.searchParams.get("salon") ?? (verifySalon(v.salon_id, v.salon_sig, v.sig_exp) ? String(v.salon_id) : null);
      await logEvent(branch, "webhook_auth", { ip: req.headers.get("x-forwarded-for") ?? null, authHeaders, message: msg?.type ?? null });
    }
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  if (!msg?.type) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { salonId, forged } = await salonIdFor(req, msg);
  const db = adminClient();
  if (forged) await logEvent(null, "webhook_auth", { reason: "unsigned or invalid branch signature", message: msg.type, call: msg.call?.id ?? null });

  switch (msg.type) {
    case "assistant-request": {
      if (!salonId) return NextResponse.json({ error: "Sorry, this number is not set up yet. Please try again later." });
      const ctx = await loadSalonContext(db, salonId);
      if (!ctx) return NextResponse.json({ error: "Sorry, this number is not set up yet." });
      await callRowId(salonId, msg);
      const caller = msg.call?.customer?.number ?? null;
      // Saved "Shanaya" assistant from the Vapi dashboard + this branch's live knowledge (signed).
      return NextResponse.json(vapiCallConfig(ctx, caller, "phone"));
    }

    case "tool-calls": {
      const fail = (error: string) =>
        NextResponse.json({ results: (msg.toolCallList ?? []).map((c) => ({ toolCallId: c.id, result: JSON.stringify({ error }) })) });
      if (!salonId) return fail("This conversation isn't linked to a studio. Apologise and ask her to call the studio directly.");
      const ctx = await loadSalonContext(db, salonId);
      if (!ctx) return fail("Unknown studio.");
      const callId = await callRowId(salonId, msg);
      const callerRaw = msg.call?.customer?.number;
      const web = isWebCall(msg);
      const toolCtx = {
        ctx,
        channel: web ? ("web" as const) : ("phone" as const),
        callId,
        // website calls have no trustworthy caller ID
        callerPhone: !web && callerRaw ? normalizePhone(callerRaw, countryCodeFor(ctx.salon.currency)) : null,
      };
      const results = await Promise.all(
        (msg.toolCallList ?? []).map(async (call) => {
          let args = call.function?.arguments ?? call.arguments ?? {};
          if (typeof args === "string") {
            try {
              args = JSON.parse(args);
            } catch {
              args = {};
            }
          }
          const name = call.function?.name ?? call.name;
          const result = await runOnce(call.id, salonId, name, () => runTool(toolCtx, name, args));
          return { toolCallId: call.id, result: JSON.stringify(result) };
        }),
      );
      return NextResponse.json({ results });
    }

    case "end-of-call-report": {
      if (!salonId) return NextResponse.json({ ok: true });
      const callId = await callRowId(salonId, msg);
      if (callId) {
        const started = msg.startedAt ?? msg.call?.startedAt;
        const ended = msg.endedAt ?? msg.call?.endedAt ?? new Date().toISOString();
        const secs = started ? Math.round((Date.parse(ended) - Date.parse(started)) / 1000) : NaN;
        const { data: existing } = await db.from("calls").select("outcome").eq("id", callId).single();
        const { error } = await db
          .from("calls")
          .update({
            started_at: started && !Number.isNaN(Date.parse(started)) ? started : undefined,
            ended_at: ended,
            duration_seconds: Number.isFinite(secs) && secs >= 0 ? secs : null,
            ended_reason: msg.endedReason ?? null,
            summary: msg.analysis?.summary ?? msg.summary ?? null,
            transcript: msg.artifact?.transcript ?? msg.transcript ?? null,
            recording_url: msg.artifact?.recording?.mono?.combinedUrl ?? msg.artifact?.recordingUrl ?? msg.recordingUrl ?? null,
            cost: typeof msg.cost === "number" ? msg.cost : typeof msg.call?.cost === "number" ? msg.call.cost : null,
            outcome: existing?.outcome ?? "info",
          })
          .eq("id", callId);
        if (error) await logEvent(salonId, "call_error", { reason: "could not save call report", message: error.message, call: msg.call?.id ?? null });
      }
      if (msg.endedReason && CALL_ERROR.test(msg.endedReason)) {
        await logEvent(salonId, "call_error", { endedReason: msg.endedReason, call: msg.call?.id ?? null });
      }
      return NextResponse.json({ ok: true });
    }

    case "transfer-destination-request": {
      // Phone calls only: connect the guest to the branch's front desk.
      if (!salonId) return NextResponse.json({ error: "No team number is set up for this line." });
      const { data: salon } = await db.from("salons").select("transfer_phone, area, currency").eq("id", salonId).maybeSingle();
      const digits = normalizePhone(salon?.transfer_phone ?? "", countryCodeFor(salon?.currency ?? "INR"));
      if (isWebCall(msg) || digits.length < 11) {
        return NextResponse.json({
          error: "A live transfer isn't available right now. Take her name and mobile number and use request_callback so the team calls her back.",
        });
      }
      const team = salon?.area ? `our ${salon.area} team` : "our team";
      return NextResponse.json({ destination: { type: "number", number: `+${digits}`, message: `Of course. I'm connecting you to ${team} now.` } });
    }

    default:
      return NextResponse.json({ ok: true });
  }
}
