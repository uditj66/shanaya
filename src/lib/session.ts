import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Enums } from "./database.types";

export const SALON_COOKIE = "shanaya_salon";
/** Cookie value for the brand-wide view (owners and managers with several studios). */
export const ALL_STUDIOS = "all";

/** Dashboard roles. The legacy "staff" role behaves exactly like a receptionist. */
export type Role = "owner" | "manager" | "receptionist" | "stylist";
const normalise = (r: Enums<"member_role">): Role => (r === "staff" ? "receptionist" : r);

/** What each role may open. Server actions re-check; row level security is the final guard. */
export const PERMISSIONS = {
  overview: ["owner", "manager", "receptionist", "stylist"],
  calendar: ["owner", "manager", "receptionist", "stylist"],
  bookings: ["owner", "manager", "receptionist"],
  guests: ["owner", "manager", "receptionist", "stylist"],
  inbox: ["owner", "manager", "receptionist"],
  leads: ["owner", "manager", "receptionist"],
  giftcards: ["owner", "manager", "receptionist"],
  members: ["owner", "manager", "receptionist"],
  payments: ["owner", "manager"],
  website: ["owner", "manager"],
  analytics: ["owner", "manager"],
  services: ["owner", "manager"],
  team: ["owner", "manager"],
  settings: ["owner", "manager"],
  health: ["owner", "manager"],
} as const satisfies Record<string, readonly Role[]>;
export type Area = keyof typeof PERMISSIONS;
export const can = (role: Role, area: Area) => (PERMISSIONS[area] as readonly Role[]).includes(role);

/**
 * Signed-in user + where they are working. Owners/managers with several studios can pick "All studios"
 * (brand-wide overview, inbox, guests, analytics); pages that need one studio then use the flagship.
 * Redirects to /login when signed out or not linked to a studio.
 */
export const requireSalon = cache(async () => {
  // Everything behind a sign-in is personal and live: render it per request, so reading the clock (today, "Good morning")
  // is allowed under Cache Components.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("salon_members")
    .select("role, staff_id, salon:salon_id (*)")
    .eq("user_id", auth.user.id)
    .order("created_at");
  const list = (memberships ?? []).filter((m) => m.salon);
  if (!list.length) redirect("/login");

  const chosen = (await cookies()).get(SALON_COOKIE)?.value;
  const leaders = list.filter((m) => m.role === "owner" || m.role === "manager");
  const isAll = chosen === ALL_STUDIOS && leaders.length > 1;
  const current = isAll
    ? (leaders.find((m) => m.salon!.is_flagship) ?? leaders[0])
    : (list.find((m) => m.salon!.id === chosen) ?? list.find((m) => m.salon!.is_flagship) ?? list[0]);
  const role = normalise(current.role);

  return {
    supabase,
    user: auth.user,
    salon: current.salon!,
    role,
    isAdmin: role === "owner" || role === "manager",
    /** The therapist row linked to a stylist's login (their own column and guests). */
    staffId: role === "stylist" ? current.staff_id : null,
    /** Brand-wide view across every studio this owner/manager runs. */
    isAll,
    /** Studios in scope for lists and reports: all of them in the brand-wide view, otherwise the current one. */
    scopeIds: isAll ? leaders.map((m) => m.salon!.id) : [current.salon!.id],
    canSeeAll: leaders.length > 1,
    salons: list.map((m) => ({ id: m.salon!.id, name: m.salon!.name, slug: m.salon!.slug, area: m.salon!.area, city: m.salon!.city, role: normalise(m.role) })),
  };
});
export type Session = Awaited<ReturnType<typeof requireSalon>>;

/** Gate a page or action by role; sends people who can't open it back to their overview. */
export async function requireArea(area: Area) {
  const s = await requireSalon();
  if (!can(s.role, area)) redirect("/dashboard");
  return s;
}
