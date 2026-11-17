// Website widget brain: OpenAI Responses API + our booking tools.
// Conversation state lives in OpenAI (store: true + previous_response_id), so the server stays stateless.
// A conversation is only saved once the visitor actually sends a message (no empty "visitor opened the widget" rows).
import "server-only";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { adminClient } from "../supabase/admin";
import { loadSalonContext } from "./context";
import { buildPrompt, greeting } from "./prompt";
import { runTool, toolDefs } from "./tools";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI()); // reads OPENAI_API_KEY on first use
const MAX_TURNS = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tools = toolDefs.map((t) => ({
  type: "function" as const,
  name: t.name,
  description: t.description,
  parameters: t.parameters,
  strict: false,
}));

type State = { previous_response_id?: string; turns?: number };

const webGreeting = (g: string) => g.replace(/calling/i, "contacting");

export async function startWebChat(salonId: string) {
  const ctx = await loadSalonContext(adminClient(), salonId);
  if (!ctx) throw new Error("Salon not found");
  return { sessionId: randomUUID(), reply: webGreeting(greeting(ctx)) };
}

export async function webChatTurn(salonId: string, sessionId: string, text: string) {
  if (!UUID.test(sessionId)) throw new Error("Invalid session");
  const db = adminClient();
  const ctx = await loadSalonContext(db, salonId);
  if (!ctx) throw new Error("Salon not found");

  let { data: call } = await db
    .from("calls")
    .select("id, salon_id, channel, agent_state, transcript")
    .eq("id", sessionId)
    .maybeSingle();
  if (call && (call.salon_id !== salonId || call.channel !== "web")) throw new Error("Session not found");
  if (!call) {
    // first message of this chat → create the conversation record now
    const { data, error } = await db
      .from("calls")
      .insert({ id: sessionId, salon_id: salonId, channel: "web", started_at: new Date().toISOString(), transcript: `AI: ${webGreeting(greeting(ctx))}` })
      .select("id, salon_id, channel, agent_state, transcript")
      .single();
    if (error) throw error;
    call = data;
  }

  const state = (call.agent_state ?? {}) as State;
  if ((state.turns ?? 0) >= MAX_TURNS) return { reply: "This chat has reached its limit. Please call the studio and we'll be happy to help." };

  const instructions = buildPrompt(ctx, { channel: "web" });
  const toolCtx = { ctx, channel: "web" as const, callId: call.id, callerPhone: null };

  let input: OpenAI.Responses.ResponseInput = [{ role: "user", content: text }];
  let previous = state.previous_response_id;
  let reply = "";

  for (let i = 0; i < 6; i++) {
    const response = await openai().responses.create({
      model: ctx.salon.llm_model || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions,
      input,
      tools,
      previous_response_id: previous,
      store: true,
    });
    previous = response.id;
    const calls = response.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === "function_call");
    if (!calls.length) {
      // Use only the final assistant message (some models return more than one message item).
      const messages = response.output.filter((o): o is OpenAI.Responses.ResponseOutputMessage => o.type === "message");
      const last = messages[messages.length - 1];
      reply = (last?.content ?? []).map((c) => (c.type === "output_text" ? c.text : "")).join("").trim() || response.output_text?.trim() || "";
      break;
    }
    input = await Promise.all(
      calls.map(async (c) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.arguments || "{}");
        } catch {
          /* model sent invalid JSON; tool will report missing fields */
        }
        const result = await runTool(toolCtx, c.name, args);
        return { type: "function_call_output" as const, call_id: c.call_id, output: JSON.stringify(result) };
      }),
    );
  }

  reply ||= "Sorry, I didn't catch that. Could you say it another way?";
  await db
    .from("calls")
    .update({
      agent_state: { previous_response_id: previous, turns: (state.turns ?? 0) + 1 },
      transcript: `${call.transcript ?? ""}\nGuest: ${text}\nAI: ${reply}`.trim(),
      ended_at: new Date().toISOString(),
    })
    .eq("id", call.id);
  return { reply };
}
