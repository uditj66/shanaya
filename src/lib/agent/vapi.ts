// Builds Shanaya's voice assistant for Vapi.
// THE single source of truth for voice: phone calls (assistant-request), website voice calls and the
// Settings preview all call buildVapiAssistant(), so the voice, greeting, personality and tools are identical.
import type { SalonContext } from "./context";
import { buildPrompt, greeting } from "./prompt";
import { toolDefs } from "./tool-defs";
import { buildVoice } from "./voices";

export function appUrl() {
  return (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function serverConfig(salonId: string) {
  const server: Record<string, unknown> = { url: `${appUrl()}/api/vapi?salon=${salonId}`, timeoutSeconds: 20 };
  if (process.env.VAPI_CREDENTIAL_ID) server.credentialId = process.env.VAPI_CREDENTIAL_ID;
  return server;
}

export type VoiceChannel = "phone" | "web";

export function buildVapiAssistant(ctx: SalonContext, callerPhone: string | null, channel: VoiceChannel = "phone") {
  const { salon } = ctx;
  const server = serverConfig(salon.id);

  const tools: Record<string, unknown>[] = toolDefs.map((t) => ({
    type: "function",
    async: false,
    function: { name: t.name, description: t.description, parameters: t.parameters },
    server,
  }));
  if (salon.transfer_phone && channel === "phone") {
    // Transfers only work on real phone lines, not browser calls.
    tools.push({
      type: "transferCall",
      destinations: [
        {
          type: "number",
          number: salon.transfer_phone,
          description: "Transfer to the studio team when the guest asks for a person or needs help you cannot give.",
          message: "Of course, I'm connecting you to our team now.",
        },
      ],
    });
  }

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
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    // Natural turn-taking: wait for the guest to really finish, stop instantly when interrupted.
    startSpeakingPlan: {
      smartEndpointingPlan: { provider: "livekit", waitFunction: "20 + 500 * sqrt(x) + 2500 * x^3" },
    },
    stopSpeakingPlan: { numWords: 0, voiceSeconds: 0.2, backoffSeconds: 1 },
    backgroundSound: "off",
    server,
    serverMessages: ["tool-calls", "end-of-call-report"],
    endCallFunctionEnabled: true,
    endCallMessage: `Thank you for contacting ${salon.name}. Have a lovely day.`,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 900,
    metadata: { salonId: salon.id, channel },
  };
}
