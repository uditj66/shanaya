import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export const SALON_COOKIE = "shanaya_salon";

/**
 * Signed-in user + the salon they are working in. Owners with several salons (branches, clients)
 * switch between them; the choice is remembered in a cookie. Redirects to /login or /onboarding.
 */
export const requireSalon = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("salon_members")
    .select("role, salon:salon_id (*)")
    .eq("user_id", auth.user.id)
    .order("created_at");
  const list = (memberships ?? []).filter((m) => m.salon);
  if (!list.length) redirect("/onboarding");

  const chosen = (await cookies()).get(SALON_COOKIE)?.value;
  const current = list.find((m) => m.salon!.id === chosen) ?? list[0];

  return {
    supabase,
    user: auth.user,
    salon: current.salon!,
    role: current.role,
    isAdmin: current.role !== "staff",
    salons: list.map((m) => ({ id: m.salon!.id, name: m.salon!.name, slug: m.salon!.slug, role: m.role })),
  };
});
