"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/session";

const Input = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).or(z.literal("")),
  tags: z.string().max(300),
  preferences: z.string().max(1000),
  notes: z.string().max(2000),
});

export type GuestSaveState = null | { ok: boolean; message: string };

/** Front-desk notes on a guest. Row level security keeps edits inside the staff member's studios. */
export async function saveGuest(_prev: GuestSaveState, form: FormData): Promise<GuestSaveState> {
  const v = Input.safeParse(Object.fromEntries(form));
  if (!v.success) return { ok: false, message: "Please check the name and email." };
  const s = await requireArea("guests");
  if (s.role === "stylist") return { ok: false, message: "Only the front desk can edit guest details." };
  const tags = [...new Set(v.data.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  const { error } = await s.supabase
    .from("customers")
    .update({ name: v.data.name, email: v.data.email || null, tags, preferences: v.data.preferences, notes: v.data.notes })
    .eq("id", v.data.id)
    .in("salon_id", s.salons.map((x) => x.id));
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  revalidatePath(`/dashboard/guests/${v.data.id}`);
  return { ok: true, message: "Saved." };
}
