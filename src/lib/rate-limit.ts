// Simple per-instance rate limiter for public endpoints (swap for Upstash/Redis when running multi-region).
const hits = new Map<string, { n: number; reset: number }>();

export function rateLimited(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  h.n++;
  return h.n > limit;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
