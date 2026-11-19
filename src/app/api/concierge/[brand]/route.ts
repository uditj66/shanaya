// Shanaya concierge for the brand website: streaming chat with tools (Vercel AI SDK).
//   POST { id, message, page } → UI message stream.   GET ?id= → the saved conversation (to restore after a reload).
// The server is the source of truth for the conversation: the browser sends only its newest message, and the history is
// loaded from the calls table (channel "web"), so past turns and tool results can't be forged from the client.
import { NextResponse, type NextRequest } from "next/server";
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, createIdGenerator, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, validateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { loadSalonContext } from "@/lib/agent/context";
import { buildPrompt, greeting } from "@/lib/agent/prompt";
import { getMenu, getStudios } from "@/lib/brand/data";
import { conciergeAddendum, type PageContext } from "@/lib/concierge/prompt";
import { conciergeTools } from "@/lib/concierge/tools";
import { clientIp, overDailyCap, rateLimited } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

const MAX_TURNS = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug = z.string().regex(/^[a-z0-9-]{2,80}$/);

const Body = z.object({
  id: z.string().regex(UUID),
  message: z.object({
    id: z.string().max(100),
    role: z.literal("user"),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string().min(1).max(1000) })).min(1).max(1),
  }),
  page: z
    .object({ kind: z.enum(["home", "service", "studio", "booking", "other"]), service: slug.optional(), studio: slug.optional() })
    .optional(),
});

type State = { ui?: UIMessage[]; turns?: number };

/** Resolve the brand, the entry branch (studio page → that studio, else the flagship) and a trusted page context. */
async function resolve(brand: string, page?: z.infer<typeof Body>["page"]) {
  const studios = await getStudios(brand);
  if (!studios.length) return null;
  const pageStudio = page?.studio ? studios.find((s) => s.slug === page.studio) : undefined;
  const entry = pageStudio ?? studios.find((s) => s.isFlagship) ?? studios[0];
  let ctxPage: PageContext | null = page ? { kind: page.kind } : null;
  if (page?.kind === "service" && page.service) {
    const t = (await getMenu(brand)).find((m) => m.slug === page.service);
    if (t) ctxPage = { kind: "service", name: t.name, code: t.code };
  }
  if (pageStudio) ctxPage = { kind: "studio", name: `${pageStudio.area}, ${pageStudio.city}` };
  return { studios, entry, page: ctxPage };
}

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();

export async function POST(req: NextRequest, { params }: RouteContext<"/api/concierge/[brand]">) {
  const { brand } = await params;
  const ip = clientIp(req);
  if (await rateLimited(`concierge:${ip}`, 20, 60)) return NextResponse.json({ error: "You're typing faster than I can read. Give me a moment." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !slug.safeParse(brand).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id, message, page } = parsed.data;

  const r = await resolve(brand, page);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = adminClient();
  const ctx = await loadSalonContext(db, r.entry.id);
  if (!ctx || !ctx.salon.widget_enabled) return NextResponse.json({ error: "Chat is not available right now." }, { status: 404 });

  // Daily budget per brand entry branch (protects AI credits from abuse).
  if (await overDailyCap(ctx.salon.id, "chat", ctx.salon.daily_chat_cap, ctx.salon.timezone)) {
    await logEvent(ctx.salon.id, "cap_reached", { kind: "chat", cap: ctx.salon.daily_chat_cap });
    return NextResponse.json({ error: "I'm very busy today. Please call the studio and the team will be happy to help." }, { status: 429 });
  }

  // Load (or start) this conversation. A conversation belongs to one brand and is never shared with the phone channel.
  const brandIds = new Set(r.studios.map((s) => s.id));
  let { data: call } = await db.from("calls").select("id, salon_id, channel, agent_state, transcript").eq("id", id).maybeSingle();
  if (call && (call.channel !== "web" || !brandIds.has(call.salon_id))) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  if (!call) {
    const { data, error } = await db
      .from("calls")
      .insert({ id, salon_id: ctx.salon.id, channel: "web", started_at: new Date().toISOString(), transcript: `AI: ${greeting(ctx, "chat")}` })
      .select("id, salon_id, channel, agent_state, transcript")
      .single();
    if (error) return NextResponse.json({ error: "Couldn't start the chat. Please try again." }, { status: 500 });
    call = data;
  }
  const state = (call.agent_state ?? {}) as State;
  if ((state.turns ?? 0) >= MAX_TURNS) {
    return NextResponse.json({ error: "This chat has reached its limit. Please call the studio and the team will be glad to help." }, { status: 429 });
  }

  const tools = conciergeTools(brand, { ctx, channel: "web", callId: call.id, callerPhone: null });
  const history = await validateUIMessages({ messages: [...(state.ui ?? []), message as UIMessage], tools }).catch(() => [message as UIMessage]);

  const result = streamText({
    model: openai(ctx.salon.llm_model || process.env.OPENAI_MODEL || "gpt-5.4-mini"),
    instructions: `${buildPrompt(ctx, { mode: "chat" })}\n\n${conciergeAddendum(r.page, ctx.salon.brand_name ?? ctx.salon.name)}`,
    messages: await convertToModelMessages(history),
    tools,
    stopWhen: isStepCount(6),
    abortSignal: req.signal,
    onError: async ({ error }) => {
      console.error("[concierge]", error);
      await logEvent(ctx.salon.id, "call_error", { channel: "web-chat", message: error instanceof Error ? error.message : String(error) });
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: history,
      // Server-side ids, so saved and restored messages each keep a unique, stable id.
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onError: () => "Sorry, I lost my train of thought for a moment. Could you say that again?",
      onEnd: async ({ messages }) => {
        const last = messages[messages.length - 1];
        const reply = last?.role === "assistant" ? textOf(last) : "";
        await db
          .from("calls")
          .update({
            agent_state: { ...state, ui: messages.slice(-60), turns: (state.turns ?? 0) + 1 } as unknown as Json,
            transcript: `${call.transcript ?? ""}\nGuest: ${textOf(message as UIMessage)}${reply ? `\nAI: ${reply}` : ""}`.trim(),
            ended_at: new Date().toISOString(),
          })
          .eq("id", call.id);
      },
    }),
  });
}

/** Restore a conversation after a page reload (the browser keeps only the conversation id). */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/concierge/[brand]">) {
  const { brand } = await params;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID.test(id) || !slug.safeParse(brand).success) return NextResponse.json({ messages: [] });
  if (await rateLimited(`concierge-get:${clientIp(req)}`, 30, 60)) return NextResponse.json({ messages: [] }, { status: 429 });
  const studios = await getStudios(brand);
  const { data: call } = await adminClient().from("calls").select("salon_id, channel, agent_state").eq("id", id).maybeSingle();
  if (!call || call.channel !== "web" || !studios.some((s) => s.id === call.salon_id)) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: ((call.agent_state ?? {}) as State).ui ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
