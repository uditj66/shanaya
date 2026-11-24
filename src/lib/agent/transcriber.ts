// How Shanaya hears guests (Deepgram through Vapi), set on every call so it always matches the live menu and team.
//  • language "multi": Indian guests switch between English and Hindi mid-sentence ("Saturday ko slot hai kya?").
//    Plain English recognition garbles those words, so she mis-hears and the guest sees nonsense in captions.
//  • keyterm: words Deepgram should listen for (brand, therapists, treatments, areas). Names like "Lumière",
//    "Meera" or "HydraFacial" are otherwise easy to mis-hear.
//  • fallbackPlan: if Deepgram rejects or drops the main setup, Vapi switches transcriber instead of ending the call.
//
// Deepgram caps keyterms at about 500 TOKENS per request (not 100 terms): going over makes it refuse the connection,
// and Vapi then ends the call at once ("deepgram-transcriber-failed"). So the list is cut by an estimated token
// budget, well under that cap, as well as by count.
import type { SalonContext } from "./context";

export const MAX_KEYTERMS = 100;
/** Our own ceiling on estimated tokens, far below Deepgram's ~500 so estimation error can never reach it. */
export const KEYTERM_TOKEN_BUDGET = 250;
const MAX_KEYTERM_CHARS = 50;

/**
 * A pessimistic token count: about 1 token per 3 characters of each word, at least 1 per word. Real tokenisers do
 * better on English, but Indian names and accented words split into more pieces, so we assume the worst.
 */
export const estimateTokens = (term: string) => term.split(/\s+/).reduce((n, w) => n + Math.max(1, Math.ceil(w.length / 3)), 0);

/** Letters (any script), digits, spaces, apostrophes and hyphens only: "&" and other symbols can break the request. */
const clean = (s: string) =>
  s
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_KEYTERM_CHARS);

/** Words worth boosting, most important first (whatever doesn't fit the budget is dropped from the end). */
export function keytermsFor(ctx: SalonContext): string[] {
  const brand = ctx.salon.brand_name || ctx.salon.name;
  const plain = (s: string) => s.replace(/\s*[·|,(].*$/, "").trim(); // "Lumière · Bandra West" → "Lumière"
  const groups: (string | null | undefined)[][] = [
    [plain(brand).split(" ")[0], ctx.salon.agent_name], // guests say "Lumière", not the full name
    // where she can book: studio areas (city names are common words Deepgram already knows)
    [ctx.salon.area, ...ctx.branches.map((b) => b.area)],
    // who she might ask for: first names are what guests say ("Is Meera free?")
    (ctx.team ?? ctx.staff).map((m) => m.name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0]),
    // what she might ask for: our own named packages and tiers first, then the treatment menu
    ctx.packages.map((p) => p.name),
    (ctx.memberships ?? []).map((m) => m.name),
    ctx.services.map((s) => s.name),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  let tokens = 0;
  for (const term of groups.flat()) {
    const t = clean(String(term ?? ""));
    if (t.length < 3 || seen.has(t.toLowerCase())) continue;
    const cost = estimateTokens(t);
    if (tokens + cost > KEYTERM_TOKEN_BUDGET) continue; // a shorter term later may still fit
    seen.add(t.toLowerCase());
    out.push(t);
    tokens += cost;
    if (out.length === MAX_KEYTERMS) break;
  }
  return out;
}

/** Per-call transcriber override for Vapi (assistantOverrides.transcriber). Same for phone and website calls. */
export function transcriberFor(ctx: SalonContext) {
  return {
    provider: "deepgram",
    model: "nova-3",
    language: "multi",
    keyterm: keytermsFor(ctx),
    fallbackPlan: {
      transcribers: [
        // same hearing without the boosted words, then the plain English setup that has always worked
        { provider: "deepgram", model: "nova-3", language: "multi" },
        { provider: "deepgram", model: "nova-3", language: "en" },
      ],
    },
  } as const;
}
