"use server";
// Staff actions. All run as the signed-in user, so row level security applies.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalon } from "@/lib/session";
import { BookingError, cancelBooking, createBooking } from "@/lib/booking-service";
import { zonedToDate } from "@/lib/time";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createBookingAction(form: FormData) {
  const { supabase, salon, user } = await requireSalon();
  const back = `/dashboard/bookings/new?service=${s(form, "service")}&date=${s(form, "date")}&staff=${s(form, "staff")}`;
  try {
    await createBooking(supabase, {
      salonId: salon.id,
      serviceId: s(form, "service"),
      date: s(form, "date"),
      time: s(form, "time"),
      staffId: s(form, "staff") || null,
      customer: { name: s(form, "name"), phone: s(form, "phone"), email: s(form, "email") || null },
      notes: s(form, "notes"),
      source: "staff",
      createdBy: user.id,
    });
  } catch (e) {
    const msg = e instanceof BookingError ? e.message : "Could not create booking";
    redirect(`${back}&error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard?date=${s(form, "date")}`);
}

export async function setBookingStatus(form: FormData) {
  const { supabase, salon } = await requireSalon();
  const status = s(form, "status") as "completed" | "no_show" | "cancelled";
  if (status === "cancelled") {
    try {
      await cancelBooking(supabase, { salonId: salon.id, reference: s(form, "reference"), reason: "Cancelled by staff" });
    } catch (e) {
      // already cancelled or not found: refresh the list instead of showing an error page
      if (!(e instanceof BookingError)) throw e;
    }
  } else {
    await supabase.from("bookings").update({ status }).eq("salon_id", salon.id).eq("reference", s(form, "reference"));
  }
  revalidatePath("/dashboard", "layout");
}

export async function resolveCallback(form: FormData) {
  const { supabase, salon, user } = await requireSalon();
  await supabase
    .from("callbacks")
    .update({ status: "done", resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("salon_id", salon.id)
    .eq("id", s(form, "id"));
  revalidatePath("/dashboard", "layout");
}

// ── Services ──
export async function saveService(form: FormData) {
  const { supabase, salon } = await requireSalon();
  const row = {
    salon_id: salon.id,
    name: s(form, "name"),
    category: s(form, "category") || "Facial",
    description: s(form, "description"),
    duration_minutes: Number(s(form, "duration")),
    buffer_minutes: Number(s(form, "buffer") || 0),
    price: Number(s(form, "price") || 0),
    active: form.get("active") === "on",
  };
  const id = s(form, "id");
  const { data, error } = id
    ? await supabase.from("services").update(row).eq("id", id).eq("salon_id", salon.id).select("id").single()
    : await supabase.from("services").insert(row).select("id").single();
  if (error) redirect(`/dashboard/services?error=${encodeURIComponent(error.message)}`);

  // which therapists perform it
  const staffIds = form.getAll("staff").map(String);
  await supabase.from("staff_services").delete().eq("service_id", data!.id).eq("salon_id", salon.id);
  if (staffIds.length) {
    await supabase.from("staff_services").insert(staffIds.map((staff_id) => ({ salon_id: salon.id, staff_id, service_id: data!.id })));
  }
  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

// ── Team ──
export async function saveStaff(form: FormData) {
  const { supabase, salon } = await requireSalon();
  const row = { salon_id: salon.id, name: s(form, "name"), title: s(form, "title") || null, color: s(form, "color") || "#b4746b", active: form.get("active") !== "off" };
  const id = s(form, "id");
  const { data, error } = id
    ? await supabase.from("staff").update(row).eq("id", id).eq("salon_id", salon.id).select("id").single()
    : await supabase.from("staff").insert(row).select("id").single();
  if (error) redirect(`/dashboard/team?error=${encodeURIComponent(error.message)}`);

  // weekly hours: fields like d1_s1_start, d1_s1_end, d1_s2_start ...
  const rows: { salon_id: string; staff_id: string; weekday: number; start_time: string; end_time: string }[] = [];
  for (let d = 0; d < 7; d++) {
    for (const sh of [1, 2]) {
      const a = s(form, `d${d}_s${sh}_start`);
      const b = s(form, `d${d}_s${sh}_end`);
      if (a && b && b > a) rows.push({ salon_id: salon.id, staff_id: data!.id, weekday: d, start_time: a, end_time: b });
    }
  }
  if (form.has("hours")) {
    await supabase.from("staff_hours").delete().eq("staff_id", data!.id).eq("salon_id", salon.id);
    if (rows.length) await supabase.from("staff_hours").insert(rows);
  }
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team");
}

export async function addTimeOff(form: FormData) {
  const { supabase, salon } = await requireSalon();
  const date = s(form, "date");
  const endDate = s(form, "end_date") || date;
  const starts = zonedToDate(date, s(form, "start") || "00:00", salon.timezone);
  const ends = zonedToDate(endDate, s(form, "end") || "23:59", salon.timezone);
  const { error } = await supabase.from("time_off").insert({
    salon_id: salon.id,
    staff_id: s(form, "staff") || null,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    reason: s(form, "reason") || null,
  });
  if (error) redirect(`/dashboard/team?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/team");
}

export async function deleteTimeOff(form: FormData) {
  const { supabase, salon } = await requireSalon();
  await supabase.from("time_off").delete().eq("id", s(form, "id")).eq("salon_id", salon.id);
  revalidatePath("/dashboard", "layout");
}
