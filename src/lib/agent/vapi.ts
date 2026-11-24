// Shanaya on Vapi: ONE saved assistant in the Vapi dashboard (VAPI_ASSISTANT_ID). The owner edits her voice,
// model, greeting and personality there; every call (phone or website) uses that same assistant, and this
// server only adds live knowledge + a SIGNED branch id (assistantOverrides.variableValues).
import type { SalonContext } from "./context";
import { brandName, buildKnowledge, personaPrompt, type ConversationMode } from "./prompt";
import { toolDefs } from "./tool-defs";
import { signSalon } from "./call-signature";
import { returningGreeting, type ReturningGuest } from "./returning-guest";
import { transcriberFor } from "./transcriber";

export function appUrl() {
  return (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export type VoiceChannel = "phone" | "web";

function serverConfig() {
  const server: Record<string, unknown> = { url: `${appUrl()}/api/vapi`, timeoutSeconds: 20 };
  if (process.env.VAPI_CREDENTIAL_ID) server.credentialId = process.env.VAPI_CREDENTIAL_ID;
  return server;
}

/**
 * Said only if a tool is still running after a few seconds, so a slow lookup never sounds like a dropped call.
 * (Shanaya already says her own short line before each tool, so there is deliberately no "request-start" message:
 * the guest would hear both.)
 */
export const SLOW_TOOL_LINES: Record<string, string> = {
  check_availability: "I'm just looking through the diary for you, one moment.",
  book_appointment: "Nearly done, I'm just confirming that booking.",
  reschedule_appointment: "Just a moment, I'm moving that for you.",
  cancel_appointment: "One moment, I'm just taking care of that.",
  find_appointments: "Just a second, I'm pulling up your appointments.",
  guest_history: "One moment, I'm just looking at your past visits.",
  check_gift_card: "Just checking the card for you.",
  request_callback: "One moment, I'm just passing that to the team.",
};
const SLOW_TOOL_AFTER_MS = 3500;

const functionTools = () =>
  toolDefs.map((t) => ({
    type: "function",
    async: false,
    function: { name: t.name, description: t.description, parameters: t.parameters },
    ...(SLOW_TOOL_LINES[t.name] ? { messages: [{ type: "request-response-delayed", timingMilliseconds: SLOW_TOOL_AFTER_MS, content: SLOW_TOOL_LINES[t.name] }] } : {}),
  }));

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

/** Vapi's default browser messages (per its API docs) plus tool results for the on-screen cards. */
export const WEB_CLIENT_MESSAGES = [
  "conversation-update", "function-call", "hang", "model-output", "speech-update", "status-update", "transfer-update",
  "transcript", "tool-calls", "user-interrupted", "voice-input", "workflow.node.started", "assistant.started", "tool-calls-result",
];

/** Human-feel settings for the saved assistant. */
const conversationSettings = {
  // Every call overrides this with transcriberFor(ctx) (adds the brand's keyterms); kept in step for new assistants.
  transcriber: { provider: "deepgram", model: "nova-3", language: "multi" },
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
      // REQUIRED for tools: OpenAI's chat API rejects function tools for GPT-5.x reasoning models unless reasoning is
      // "none" ("Function tools with reasoning_effort are not supported… set reasoning_effort to 'none'"). Without it
      // Shanaya keeps talking but can never check times or book (seen on a live call, 24 Nov 2026). Also faster.
      reasoningEffort: "none",
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
export function vapiCallConfig(ctx: SalonContext, callerPhone: string | null, channel: VoiceChannel = "phone", guest: ReturningGuest | null = null) {
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  if (!assistantId) throw new Error("VAPI_ASSISTANT_ID is not set: create Shanaya once with `npm run vapi:assistant -- create --url <app url>`.");
  const mode: ConversationMode = channel === "phone" ? "phone" : "web-voice";
  // Recognised phone callers get a "welcome back" greeting (website calls have no trustworthy caller ID).
  const known = channel === "phone" && callerPhone ? guest : null;
  const greeting = known ? returningGreeting(known, brandName(ctx), ctx.salon.agent_name || "Shanaya") : null;
  return {
    assistantId,
    assistantOverrides: {
      ...(greeting ? { firstMessage: escapeLiquid(greeting) } : {}),
      // Hears Hindi-English mixing, and listens for this brand's names (treatments, therapists, areas).
      transcriber: transcriberFor(ctx),
      // Website calls also receive tool results, to show time slots and the booking card on screen. This list
      // REPLACES Vapi's defaults, so it repeats them all and adds "tool-calls-result".
      ...(channel === "web" ? { clientMessages: WEB_CLIENT_MESSAGES } : {}),
      variableValues: {
        knowledge: escapeLiquid(buildKnowledge(ctx, { callerPhone, mode, guest: known })),
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
