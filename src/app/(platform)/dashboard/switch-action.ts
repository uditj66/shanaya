"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setSalonCookie } from "@/lib/salon-cookie";
import { ALL_STUDIOS } from "@/lib/session";

/** Switch the dashboard to another studio, or to "All studios" (owners/managers of several). Membership is checked. */
export async function switchSalon(salonId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  if (salonId === ALL_STUDIOS) {
    const { count } = await supabase
      .from("salon_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .in("role", ["owner", "manager"]);
    if ((count ?? 0) > 1) await setSalonCookie(ALL_STUDIOS);
    redirect("/dashboard");
  }
  const { data } = await supabase.from("salon_members").select("salon_id").eq("user_id", auth.user.id).eq("salon_id", salonId).maybeSingle();
  if (data) await setSalonCookie(salonId);
  redirect("/dashboard");
}
