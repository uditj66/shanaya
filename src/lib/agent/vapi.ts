// Shanaya on Vapi: ONE saved assistant in the Vapi dashboard (VAPI_ASSISTANT_ID). The owner edits her voice,
// model, greeting and personality there; every call (phone or website) uses that same assistant, and this
// server only adds live knowledge + a SIGNED branch id (assistantOverrides.variableValues).
import type { SalonContext } from "./context";
import { brandName, buildKnowledge, personaPrompt, type ConversationMode } from "./prompt";
import { toolDefs } from "./tool-defs";
import { signSalon } from "./call-signature";

export function appUrl() {
  return (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export type VoiceChannel = "phone" | "web";

function serverConfig() {
  const server: Record<string, unknown> = { url: `${appUrl()}/api/vapi`, timeoutSeconds: 20 };
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

/**
 * Messages Vapi sends to our server. This list REPLACES Vapi's defaults, so every message the
 * webhook handles must be here (a missing entry fails silently, e.g. transfers never reach us).
 */
export const SERVER_MESSAGES = ["tool-calls", "end-of-call-report", "transfer-destination-request"];

/** Human-feel settings for the saved assistant. */
const conversationSettings = {
  transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
  startSpeakingPlan: { smartEndpointingPlan: { provider: "livekit", waitFunction: "20 + 500 * sqrt(x) + 2500 * x^3" } },
  stopSpeakingPlan: { numWords: 0, voiceSeconds: 0.2, backoffSeconds: 1 },
  backgroundSound: "off",
  serverMessages: SERVER_MESSAGES,
  endCallFunctionEnabled: true,
  silenceTimeoutSeconds: 30,
  maxDurationSeconds: 900,
};

/** The saved assistant as first created in Vapi. After that, the owner edits it in the Vapi dashboard. */
export function savedAssistantDefinition() {
  return {
    name: "Shanaya · AI receptionist",
    // {{agent_name}} / {{brand_name}} come from each salon's Settings, so a rename applies to voice too.
    firstMessage:
      "Hello, thank you for calling {{brand_name}}. This is {{agent_name}}. This call may be recorded for quality and booking purposes. How may I pamper you today?",
    model: {
      provider: "openai",
      model: "gpt-5.6-terra",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `${personaPrompt("voice", "{{agent_name}}", "{{brand_name}}")}\n\n# KNOWLEDGE (live, filled in by the Shanaya app on every call; do not edit)\n{{knowledge}}`,
        },
      ],
      tools: [...functionTools(), transferTool()],
    },
    voice: { provider: "vapi", voiceId: "Naina" },
    endCallMessage: "Thank you for calling {{brand_name}}. Have a lovely day.",
    server: serverConfig(),
    ...conversationSettings,
  };
}

/** Vapi renders variableValues with Liquid; owner-written text must not be able to inject template code. */
export const escapeLiquid = (s: string) => s.replace(/\{\{/g, "{ {").replace(/\}\}/g, "} }").replace(/\{%/g, "{ %").replace(/%\}/g, "% }");

/** What every call (phone or web) sends to Vapi for this branch's line. */
export function vapiCallConfig(ctx: SalonContext, callerPhone: string | null, channel: VoiceChannel = "phone") {
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  if (!assistantId) throw new Error("VAPI_ASSISTANT_ID is not set: create Shanaya once with `npm run vapi:assistant -- create --url <app url>`.");
  const mode: ConversationMode = channel === "phone" ? "phone" : "web-voice";
  return {
    assistantId,
    assistantOverrides: {
      variableValues: {
        knowledge: escapeLiquid(buildKnowledge(ctx, { callerPhone, mode })),
        brand_name: escapeLiquid(brandName(ctx)),
        agent_name: escapeLiquid(ctx.salon.agent_name || "Shanaya"),
        entry_branch: escapeLiquid(ctx.salon.area ?? ctx.salon.name),
        salon_id: ctx.salon.id,
        channel,
        ...signSalon(ctx.salon.id),
      },
      // No server override here: Vapi only applies the webhook secret (credentialId) from the saved
      // assistant's own server setting. The webhook finds the branch from the SIGNED variableValues.
      metadata: { salonId: ctx.salon.id, channel },
    },
  };
}
