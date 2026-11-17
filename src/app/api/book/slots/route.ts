// Live availability for the brand-site booking flow.
// GET /api/book/slots?brand=lumiere&studio=bandra-west&service=FAC001&date=2026-11-20&specialist=ananya
// Always computed at request time (never cached): it reads the real calendar.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BookingError } from "@/lib/booking-service";
import { availability } from "@/lib/brand/booking";
import { clientIp, rateLimited } from "@/lib/rate-limit";

const slug = z.string().regex(/^[a-z0-9-]{2,80}$/);
const Query = z.object({
  brand: slug,
  studio: slug,
  service: z.string().regex(/^[A-Z]{2,4}\d{3}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  specialist: slug.nullish(),
});

export async function GET(req: NextRequest) {
  if (await rateLimited(`slots:${clientIp(req)}`, 60, 60)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const q = Query.safeParse({
    brand: sp.get("brand"),
    studio: sp.get("studio"),
    service: sp.get("service"),
    date: sp.get("date"),
    specialist: sp.get("specialist"),
  });
  if (!q.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const result = await availability(q.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: e.code === "not_found" ? 404 : 400 });
    console.error("[book/slots]", e);
    return NextResponse.json({ error: "We couldn't load times just now. Please try again." }, { status: 500 });
  }
}
