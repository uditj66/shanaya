// Shanaya on Vapi.
// Preferred setup: ONE saved assistant in the Vapi dashboard (VAPI_ASSISTANT_ID). The owner edits her voice,
// model, greeting and personality there; every call (phone or website) uses that same assistant, and this
// server only adds live knowledge + which branch's line was reached (assistantOverrides).
// Fallback (no saved assistant): a full transient assistant built here.
import type { SalonContext } from "./context";
import { brandName, buildKnowledge, buildPrompt, greeting, personaPrompt } from "./prompt";
import { toolDefs } from "./tool-defs";
import { buildVoice } from "./voices";

export function appUrl() {
  return (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export type VoiceChannel = "phone" | "web";

function serverConfig(salonId?: string) {
  const server: Record<string, unknown> = { url: `${appUrl()}/api/vapi${salonId ? `?salon=${salonId}` : ""}`, timeoutSeconds: 20 };
  if (process.env.VAPI_CREDENTIAL_ID) server.credentialId = process.env.VAPI_CREDENTIAL_ID;
  return server;
}

const functionTools = () =>
  toolDefs.map((t) => ({ type: "function", async: false, function: { name: t.name, description: t.description, parameters: t.parameters } }));

/** Dynamic transfer: Vapi asks our server (transfer-destination-request) for the branch's front-desk number. */
const transferTool = () => ({
  type: "transferCall",
  destinations: [],
  function: {
    name: "transfer_to_team",
    description: "Phone calls only: connect the caller to the branch's front-desk team when she asks for a person, is upset, or needs something you cannot do.",
    parameters: { type: "object", properties: { reason: { type: "string", description: "Why she needs a person" } }, required: [] },
  },
  messages: [
    { type: "request-start", content: "Of course, one moment while I check who can take your call." },
    { type: "request-failed", content: "I'm so sorry, I can't connect you right now, but I can have our team call you back." },
  ],
});

/** Human-feel settings shared by the saved and the transient assistant. */
const conversationSettings = {
  transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
  startSpeakingPlan: { smartEndpointingPlan: { provider: "livekit", waitFunction: "20 + 500 * sqrt(x) + 2500 * x^3" } },
  stopSpeakingPlan: { numWords: 0, voiceSeconds: 0.2, backoffSeconds: 1 },
  backgroundSound: "off",
  serverMessages: ["tool-calls", "end-of-call-report"],
  endCallFunctionEnabled: true,
  silenceTimeoutSeconds: 30,
  maxDurationSeconds: 900,
};

/** The saved assistant as first created in Vapi. After that, the owner edits it in the Vapi dashboard. */
export function savedAssistantDefinition(agentName = "Shanaya", brand = "Lumière Facial Studio & Spa") {
  return {
    name: `${agentName} · ${brand}`.slice(0, 40),
    firstMessage: `Hello, thank you for calling {{brand_name}}. This is ${agentName}. This call may be recorded for quality and booking purposes. How may I pamper you today?`,
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.6,
      messages: [{ role: "system", content: `${personaPrompt("voice", agentName, brand)}\n\n# KNOWLEDGE (live, filled in by the Shanaya app on every call; do not edit)\n{{knowledge}}` }],
      tools: [...functionTools(), transferTool()],
    },
    voice: { provider: "vapi", voiceId: "Naina" },
    endCallMessage: `Thank you for calling {{brand_name}}. Have a lovely day.`,
    server: serverConfig(),
    ...conversationSettings,
  };
}

/** What every call (phone or web) sends to Vapi for this branch's line. */
export function vapiCallConfig(ctx: SalonContext, callerPhone: string | null, channel: VoiceChannel = "phone") {
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  if (!assistantId) return { assistant: buildVapiAssistant(ctx, callerPhone, channel) };
  return {
    assistantId,
    assistantOverrides: {
      variableValues: {
        knowledge: buildKnowledge(ctx, { callerPhone }),
        brand_name: brandName(ctx),
        entry_branch: ctx.salon.area ?? ctx.salon.name,
        salon_id: ctx.salon.id,
      },
      // tool calls and the end-of-call report come back to this server, tagged with the entry branch
      server: serverConfig(ctx.salon.id),
      metadata: { salonId: ctx.salon.id, channel },
    },
  };
}

/** Fallback: a complete transient assistant (used only when VAPI_ASSISTANT_ID is not set). */
export function buildVapiAssistant(ctx: SalonContext, callerPhone: string | null, channel: VoiceChannel = "phone") {
  const { salon } = ctx;
  const tools: Record<string, unknown>[] = functionTools();
  if (channel === "phone") tools.push(transferTool());
  return {
    name: salon.name.slice(0, 40),
    firstMessage: greeting(ctx),
    model: {
      provider: "openai",
      model: salon.phone_llm_model || "gpt-4o",
      messages: [{ role: "system", content: buildPrompt(ctx, { channel: "phone", callerPhone }) }],
      tools,
    },
    voice: buildVoice(salon),
    endCallMessage: `Thank you for calling ${brandName(ctx)}. Have a lovely day.`,
    server: serverConfig(salon.id),
    metadata: { salonId: salon.id, channel },
    ...conversationSettings,
  };
}
