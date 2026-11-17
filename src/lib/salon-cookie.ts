import "server-only";
import { cookies } from "next/headers";
import { SALON_COOKIE } from "./session";

/** Remember the salon a user is working in (validated against membership on every request). */
export async function setSalonCookie(salonId: string) {
  (await cookies()).set(SALON_COOKIE, salonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
