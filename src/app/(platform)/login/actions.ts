"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string } | null;

/** Team sign-in. Accounts are created for Lumière staff by the owner; there is no public sign-up. */
export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  });
  if (error) return { error: error.message };
  const { count } = await supabase.from("salon_members").select("salon_id", { count: "exact", head: true }).eq("user_id", data.user.id);
  if (!count) {
    await supabase.auth.signOut();
    return { error: "This account isn't linked to any Lumière studio yet. Please ask the owner to add you." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
