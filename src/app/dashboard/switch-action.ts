"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setSalonCookie } from "@/lib/salon-cookie";

/** Switch the dashboard to another salon. Only salons the user belongs to are accepted. */
export async function switchSalon(salonId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase
    .from("salon_members")
    .select("salon_id")
    .eq("user_id", auth.user.id)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (data) await setSalonCookie(salonId);
  redirect("/dashboard");
}
