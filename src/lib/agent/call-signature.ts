// Signed branch id for Vapi calls.
// The browser starts website calls with our public key, so it could send ANY salon_id in variableValues.
// Our server signs (salon_id, expiry) with the webhook secret when it builds the call config; the webhook only
// trusts a salon_id whose signature is valid and not expired.
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.VAPI_WEBHOOK_SECRET || "local-dev-secret";
const mac = (salonId: string, exp: string) => createHmac("sha256", secret()).update(`${salonId}:${exp}`).digest("base64url");

/** Valid for 3 hours: covers the longest call (15 min) plus a late end-of-call report. */
export function signSalon(salonId: string, ttlSeconds = 3 * 3600, now = Date.now()) {
  const exp = String(Math.floor(now / 1000) + ttlSeconds);
  return { salon_sig: mac(salonId, exp), sig_exp: exp };
}

export function verifySalon(salonId: unknown, sig: unknown, exp: unknown, now = Date.now()): boolean {
  if (typeof salonId !== "string" || typeof sig !== "string" || typeof exp !== "string") return false;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  const expected = Buffer.from(mac(salonId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
