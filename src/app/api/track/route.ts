// First-party analytics beacon for the brand websites. Stores the event kind, path and a random per-tab id only:
// no IP address, no user agent, no cookies.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { getBrand } from "@/lib/brand/data";
import { clientIp, rateLimited } from "@/lib/rate-limit";

const Body = z.object({
  brand: z.string().regex(/^[a-z0-9-]{2,40}$/),
  sid: z.string().regex(/^[a-zA-Z0-9]{8,64}$/),
  kind: z.enum(["page_view", "booking_step", "booking_done", "chat_open", "chat_message", "enquiry"]),
  path: z.string().max(200).regex(/^\//),
  detail: z.record(z.string().max(40), z.union([z.string().max(80), z.number()])).refine((d) => Object.keys(d).length <= 6).default({}),
});

export async function POST(req: NextRequest) {
  const none = new NextResponse(null, { status: 204 });
  if (await rateLimited(`track:${clientIp(req)}`, 120, 60)) return none;
  const v = Body.safeParse(await req.json().catch(() => null)); // sendBeacon posts text/plain JSON
  if (!v.success) return none;
  const brand = await getBrand(v.data.brand);
  if (!brand) return none;
  await adminClient().from("site_events").insert({ brand_id: brand.id, session_id: v.data.sid, kind: v.data.kind, path: v.data.path, detail: v.data.detail });
  return none;
}
