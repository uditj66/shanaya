"use server";
// Drag-to-reschedule from the calendar. Same engine as the AI: availability rules apply and the database refuses overlaps.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSalon } from "@/lib/session";
import { BookingError, rescheduleBooking } from "@/lib/booking-service";

const Input = z.object({
  reference: z.string().regex(/^[A-Z0-9]{4,12}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  staffId: z.string().uuid(),
});

export type MoveResult = { ok: true; message: string } | { ok: false; error: string; alternatives?: string[] };

export async function moveBooking(input: z.input<typeof Input>): Promise<MoveResult> {
  const v = Input.safeParse(input);
  if (!v.success) return { ok: false, error: "That move isn't valid." };
  const { supabase, salon, role, isAll } = await requireSalon();
  if (role === "stylist") return { ok: false, error: "Ask the front desk to move appointments." };
  if (isAll) return { ok: false, error: "Choose a studio in the sidebar to move its appointments." };
  try {
    const b = await rescheduleBooking(supabase, { salonId: salon.id, reference: v.data.reference, date: v.data.date, time: v.data.time, staffId: v.data.staffId });
    revalidatePath("/dashboard", "layout");
    const lost = !b.memberBenefitLost ? ""
      : b.memberEndedBefore ? " The guest's membership ends before the new date, so member benefits no longer apply to this visit."
      : b.member_benefit === "discount" ? " Its included member treatment for that period is already used, so the member discount applies instead."
      : " Member benefits no longer apply to this visit.";
    const passed = b.includedPassedTo ? ` The freed included treatment now goes to booking ${b.includedPassedTo.reference}.` : "";
    return { ok: true, message: `Moved to ${v.data.time}${b.staff?.name ? ` with ${b.staff.name}` : ""}.${lost}${passed}` };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message, alternatives: e.alternatives.map((a) => a.time) };
    console.error("[moveBooking]", e);
    return { ok: false, error: "Couldn't move that appointment. Please try again." };
  }
}
