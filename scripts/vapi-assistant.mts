// Manage the saved "Shanaya" assistant in your Vapi dashboard.
//
//   npm run vapi:assistant -- create --url https://your-app.vercel.app
//       Creates it once (voice, model, personality, tools) and saves VAPI_ASSISTANT_ID to .env.local.
//   npm run vapi:assistant -- sync-tools --url https://your-app.vercel.app
//       Updates the booking tools, server address (with the webhook secret) and the list of messages Vapi
//       sends us. Your voice, model, greeting and personality edits made in the Vapi dashboard are kept.
//   npm run vapi:assistant -- reset-prompt --url https://your-app.vercel.app
//       Replaces ONLY the system prompt and first message with the built-in persona (overwrites prompt edits
//       made in Vapi). Tools and server are left alone; run sync-tools for those.
import { readFileSync, writeFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const cmd = process.argv[2];
const url = arg("--url");
if (!["create", "sync-tools", "reset-prompt"].includes(cmd ?? "") || !url) {
  console.error("Usage: npm run vapi:assistant -- <create|sync-tools|reset-prompt> --url https://your-live-app");
  process.exit(1);
}
// Without these, a sync would silently remove the webhook secret and every tool call would be "unauthorised".
for (const k of ["VAPI_API_KEY", "VAPI_CREDENTIAL_ID"]) {
  if (!get(k)) {
    console.error(`${k} is missing in .env.local. Refusing to continue (it would break Shanaya's booking tools).`);
    process.exit(1);
  }
}

// the builders read these from the environment
process.env.PUBLIC_APP_URL = url;
process.env.VAPI_CREDENTIAL_ID = get("VAPI_CREDENTIAL_ID");
const { savedAssistantDefinition } = await import("../src/lib/agent/vapi");

const H = { Authorization: `Bearer ${get("VAPI_API_KEY")}`, "Content-Type": "application/json" };
const api = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`https://api.vapi.ai${path}`, { ...init, headers: H });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Vapi ${r.status}: ${JSON.stringify(body.message ?? body).slice(0, 400)}`);
  return body;
};

const def = savedAssistantDefinition();
const existing = get("VAPI_ASSISTANT_ID");

if (cmd === "create") {
  if (existing) {
    console.error("VAPI_ASSISTANT_ID is already set. Use sync-tools, or clear it in .env.local to create a new one.");
    process.exit(1);
  }
  const created = await api("/assistant", { method: "POST", body: JSON.stringify(def) });
  const next = /^VAPI_ASSISTANT_ID=/m.test(env) ? env.replace(/^VAPI_ASSISTANT_ID=.*$/m, `VAPI_ASSISTANT_ID=${created.id}`) : `${env.trimEnd()}\n# Saved "Shanaya" assistant in the Vapi dashboard\nVAPI_ASSISTANT_ID=${created.id}\n`;
  writeFileSync(".env.local", next);
  console.log(`Created "${created.name}" in Vapi and saved VAPI_ASSISTANT_ID to .env.local.`);
  console.log(`Edit her here: https://dashboard.vapi.ai/assistants/${created.id}`);
} else if (cmd === "reset-prompt") {
  if (!existing) throw new Error("No VAPI_ASSISTANT_ID in .env.local. Run create first.");
  const current = await api(`/assistant/${existing}`);
  await api(`/assistant/${existing}`, {
    method: "PATCH",
    body: JSON.stringify({ model: { ...current.model, messages: def.model.messages }, firstMessage: def.firstMessage }),
  });
  console.log("Reset the system prompt and first message to the built-in persona (voice, model, tools and server kept).");
} else {
  if (!existing) throw new Error("No VAPI_ASSISTANT_ID in .env.local. Run create first.");
  const current = await api(`/assistant/${existing}`);
  const updated = await api(`/assistant/${existing}`, {
    method: "PATCH",
    // reasoningEffort travels with the tools: without it OpenAI rejects tool calls for GPT-5.x models (see vapi.ts)
    body: JSON.stringify({ model: { ...current.model, tools: def.model.tools, reasoningEffort: def.model.reasoningEffort }, server: def.server, serverMessages: def.serverMessages }),
  });
  if (!updated.server?.credentialId) throw new Error("Vapi saved the server WITHOUT the webhook credential: tool calls would be rejected. Check VAPI_CREDENTIAL_ID.");
  if (updated.model?.reasoningEffort !== def.model.reasoningEffort) throw new Error(`Vapi didn't keep reasoningEffort "${def.model.reasoningEffort}": Shanaya's tools may not work. Check the model in the Vapi dashboard.`);
  console.log(`Synced ${def.model.tools.length} tools (reasoning "${def.model.reasoningEffort}"), server (with secret) and server messages (${def.serverMessages.join(", ")}). Voice, model and personality left as you set them.`);
}
