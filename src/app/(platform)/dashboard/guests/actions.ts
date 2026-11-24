"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/session";
import { todayIn } from "@/lib/time";
import { isSensitive, NOTE_KINDS, parseNotes, tidyNotes, type MemoryNote } from "@/lib/agent/guest-memory";
import type { Json } from "@/lib/database.types";

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

// ── What Shanaya remembers (guest_memory) ─────────────────────────────────────
// One memory per guest (mobile number) for the whole brand. Staff can add or remove notes, clear them, or stop
// Shanaya remembering a guest at all (she asked us to: DPDP Act consent withdrawal and erasure).

export type MemoryResult = { error?: string } | undefined;

/** The guest (by customer id) and her memory row, both through the staff member's own access (RLS). */
async function memoryFor(customerId: string) {
  if (!z.string().uuid().safeParse(customerId).success) return null;
  const s = await requireArea("guests");
  if (s.role === "stylist") return null;
  const { data: g } = await s.supabase.from("customers").select("id, phone, salon_id").eq("id", customerId).maybeSingle();
  if (!g) return null;
  const { data: rows } = await s.supabase
    .from("guest_memory")
    .select("salon_id, notes, opted_out")
    .eq("phone", g.phone)
    .in("salon_id", s.salons.map((x) => x.id))
    .order("updated_at", { ascending: false })
    .limit(1);
  return { s, g, row: rows?.[0] ?? null };
}

async function writeMemory(m: NonNullable<Awaited<ReturnType<typeof memoryFor>>>, patch: { notes?: MemoryNote[]; opted_out?: boolean }) {
  const values = { ...(patch.notes ? { notes: patch.notes as unknown as Json } : {}), ...(patch.opted_out === undefined ? {} : { opted_out: patch.opted_out }), updated_at: new Date().toISOString() };
  const { error } = m.row
    ? await m.s.supabase.from("guest_memory").update(values).eq("salon_id", m.row.salon_id).eq("phone", m.g.phone)
    : await m.s.supabase.from("guest_memory").insert({ salon_id: m.g.salon_id, phone: m.g.phone, ...values });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath(`/dashboard/guests/${m.g.id}`);
}

const NoteInput = z.object({
  text: z.string().trim().min(2, "Write a short note.").max(160, "Keep it under 160 characters."),
  kind: z.enum(NOTE_KINDS),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
});

export async function addMemoryNote(customerId: string, input: { text: string; kind: string; until?: string }): Promise<MemoryResult> {
  const v = NoteInput.safeParse(input);
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Please check the note." };
  if (isSensitive(v.data.text)) return { error: "Health and payment details don't go here. Add them to Notes for the team or the booking." };
  const m = await memoryFor(customerId);
  if (!m) return { error: "Only the front desk can change this." };
  if (m.row?.opted_out) return { error: "This guest asked not to be remembered. Turn remembering back on first." };
  const today = todayIn(m.s.salon.timezone);
  const notes = tidyNotes([...parseNotes(m.row?.notes), { text: v.data.text, kind: v.data.kind, until: v.data.until || null, at: new Date().toISOString() }], today);
  return writeMemory(m, { notes });
}

export async function removeMemoryNote(customerId: string, text: string): Promise<MemoryResult> {
  const m = await memoryFor(customerId);
  if (!m?.row) return { error: "Only the front desk can change this." };
  return writeMemory(m, { notes: parseNotes(m.row.notes).filter((n) => n.text !== text) });
}

/** Forget everything Shanaya remembers about this guest (she may start remembering again after her next call). */
export async function clearMemory(customerId: string): Promise<MemoryResult> {
  const m = await memoryFor(customerId);
  if (!m) return { error: "Only the front desk can change this." };
  if (!m.row) return;
  return writeMemory(m, { notes: [] });
}

/** Stop (or resume) remembering this guest. Stopping also erases what's remembered. */
export async function setRemembering(customerId: string, on: boolean): Promise<MemoryResult> {
  const m = await memoryFor(customerId);
  if (!m) return { error: "Only the front desk can change this." };
  return writeMemory(m, on ? { opted_out: false } : { notes: [], opted_out: true });
}
