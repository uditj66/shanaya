// Vapi webhook: one endpoint for every salon.
//  • assistant-request  → which salon owns the dialled number? return its live assistant config
//  • tool-calls         → run booking tools against that salon
//  • end-of-call-report → save transcript, summary, recording, cost for the dashboard
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { loadSalonContext } from "@/lib/agent/context";
import { vapiCallConfig } from "@/lib/agent/vapi";
import { runTool } from "@/lib/agent/tools";
import { normalizePhone } from "@/lib/time";
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

async function salonIdFor(req: NextRequest, msg: VapiMessage) {
  const fromQuery = req.nextUrl.searchParams.get("salon");
  if (fromQuery) return fromQuery;
  const fromCall = msg.call?.assistantOverrides?.variableValues?.salon_id ?? msg.call?.assistantOverrides?.metadata?.salonId;
  if (fromCall) return String(fromCall);
  const phoneNumberId = msg.call?.phoneNumberId ?? msg.phoneNumber?.id;
  if (!phoneNumberId) return null;
  const { data } = await adminClient().from("salons").select("id").eq("vapi_phone_number_id", phoneNumberId).maybeSingle();
  return data?.id ?? null;
}

/** Website "Talk" calls arrive as Vapi web calls; phone calls as inbound/outbound phone calls. */
const isWebCall = (msg: VapiMessage) =>
  msg.call?.type === "webCall" ||
  msg.call?.assistantOverrides?.metadata?.channel === "web" ||
  msg.call?.assistant?.metadata?.channel === "web" ||
  msg.assistant?.metadata?.channel === "web";

async function callRowId(salonId: string, msg: VapiMessage) {
  const externalId = msg.call?.id;
  if (!externalId) return null;
  const db = adminClient();
  const { data } = await db.from("calls").select("id").eq("external_id", externalId).eq("salon_id", salonId).maybeSingle();
  if (data) return data.id;
  const { data: created } = await db
    .from("calls")
    .upsert(
      {
        salon_id: salonId,
        channel: isWebCall(msg) ? "web" : "phone",
        external_id: externalId,
        customer_phone: msg.call?.customer?.number ?? null,
        started_at: new Date().toISOString(),
      },
      { onConflict: "external_id" },
    )
    .select("id")
    .single();
  return created?.id ?? null;
}

/** Vapi retries tool calls on timeouts: return the stored result instead of running a booking twice. */
async function runOnce(toolCallId: string | undefined, salonId: string, name: string, run: () => Promise<unknown>) {
  const db = adminClient();
  if (toolCallId) {
    const { data: done } = await db.from("tool_call_log").select("result").eq("tool_call_id", toolCallId).maybeSingle();
    if (done) return done.result;
  }
  const result = await run();
  if (toolCallId) {
    await db.from("tool_call_log").upsert(
      { tool_call_id: toolCallId, salon_id: salonId, tool: name, result: JSON.parse(JSON.stringify(result ?? null)) },
      { onConflict: "tool_call_id", ignoreDuplicates: true },
    );
  }
  return result;
}

const CALL_ERROR = /error|fault|failed|pipeline|unavailable/i;

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    // record a few failures per hour (not every bot hit) so the owner sees misconfiguration
    if (!(await rateLimited("log:webhook_auth", 20, 3600))) {
      await logEvent(req.nextUrl.searchParams.get("salon"), "webhook_auth", { ip: req.headers.get("x-forwarded-for") ?? null });
    }
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const msg: VapiMessage | undefined = body?.message;
  if (!msg?.type) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const salonId = await salonIdFor(req, msg);
  const db = adminClient();

  switch (msg.type) {
    case "assistant-request": {
      if (!salonId) return NextResponse.json({ error: "Sorry, this number is not set up yet. Please try again later." });
      const ctx = await loadSalonContext(db, salonId);
      if (!ctx) return NextResponse.json({ error: "Sorry, this number is not set up yet." });
      await callRowId(salonId, msg);
      const caller = msg.call?.customer?.number ?? null;
      // Saved "Shanaya" assistant from the Vapi dashboard + this branch's live knowledge.
      return NextResponse.json(vapiCallConfig(ctx, caller, "phone"));
    }

    case "tool-calls": {
      if (!salonId) return NextResponse.json({ error: "Unknown salon" });
      const ctx = await loadSalonContext(db, salonId);
      if (!ctx) return NextResponse.json({ error: "Unknown salon" });
      const callId = await callRowId(salonId, msg);
      const callerRaw = msg.call?.customer?.number;
      const toolCtx = {
        ctx,
        channel: isWebCall(msg) ? ("web" as const) : ("phone" as const),
        callId,
        callerPhone: callerRaw ? normalizePhone(callerRaw) : null,
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
        const { data: existing } = await db.from("calls").select("outcome").eq("id", callId).single();
        await db
          .from("calls")
          .update({
            started_at: started ?? undefined,
            ended_at: ended,
            duration_seconds: started ? Math.round((Date.parse(ended) - Date.parse(started)) / 1000) : null,
            ended_reason: msg.endedReason ?? null,
            summary: msg.analysis?.summary ?? msg.summary ?? null,
            transcript: msg.artifact?.transcript ?? msg.transcript ?? null,
            recording_url: msg.artifact?.recording?.mono?.combinedUrl ?? msg.artifact?.recordingUrl ?? msg.recordingUrl ?? null,
            cost: typeof msg.cost === "number" ? msg.cost : (msg.call?.cost ?? null),
            outcome: existing?.outcome ?? "info",
          })
          .eq("id", callId);
      }
      if (msg.endedReason && CALL_ERROR.test(msg.endedReason)) {
        await logEvent(salonId, "call_error", { endedReason: msg.endedReason, call: msg.call?.id ?? null });
      }
      return NextResponse.json({ ok: true });
    }

    case "transfer-destination-request": {
      // Phone calls only: connect the guest to the branch's front desk.
      if (!salonId) return NextResponse.json({ error: "No team number is set up for this line." });
      const { data: salon } = await db.from("salons").select("transfer_phone, area").eq("id", salonId).maybeSingle();
      const digits = (salon?.transfer_phone ?? "").replace(/\D/g, "");
      if (isWebCall(msg) || digits.length < 10) {
        return NextResponse.json({
          error: "A live transfer isn't available right now. Take her name and mobile number and use request_callback so the team calls her back.",
        });
      }
      const number = `+${digits.length === 10 ? `91${digits}` : digits}`;
      return NextResponse.json({
        destination: { type: "number", number, message: `Of course. I'm connecting you to our ${salon?.area ?? ""} team now.`.replace("  ", " ") },
      });
    }

    default:
      return NextResponse.json({ ok: true });
  }
}
