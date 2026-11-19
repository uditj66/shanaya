import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireSalon } from "@/lib/session";
import { BookingError, getSlots } from "@/lib/booking-service";
import { isDate, todayIn } from "@/lib/time";
import { createBookingAction } from "../../actions";
import { Button, Field, Input, PageHeader, Section, Select, Textarea, money } from "@/components/admin/kit";

type SP = { service?: string; date?: string; staff?: string; error?: string };

async function NewBooking({ searchParams }: { searchParams: Promise<SP> }) {
  const { salon, supabase } = await requireSalon();
  const sp = await searchParams;
  const [{ data: services }, { data: staff }] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes, price").eq("salon_id", salon.id).eq("active", true).order("sort_order"),
    supabase.from("staff").select("id, name").eq("salon_id", salon.id).eq("active", true).order("sort_order"),
  ]);
  const serviceId = sp.service || services?.[0]?.id || "";
  const date = isDate(sp.date) ? sp.date : todayIn(salon.timezone);

  let slots: { time: string; staffIds: string[] }[] = [];
  let slotError = "";
  if (serviceId) {
    try {
      // Same engine the AI uses, so staff and AI always see the same free times.
      slots = (await getSlots(supabase, { salonId: salon.id, serviceId, date, staffId: sp.staff || null })).slots;
    } catch (e) {
      slotError = e instanceof BookingError ? e.message : "Could not load availability";
    }
  }
  const names = new Map((staff ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="New booking" description="Choose a service and day to see live availability." />
      <Section title="Find a time">
        <form className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Service">
            <Select name="service" defaultValue={serviceId}>
              {(services ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration_minutes}m · {money(s.price, salon.currency)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" name="date" defaultValue={date} />
          </Field>
          <Field label="Therapist">
            <Select name="staff" defaultValue={sp.staff ?? ""}>
              <option value="">Any available</option>
              {(staff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="outline">Show times</Button>
        </form>
      </Section>

      <Section title="Guest details">
        <form action={createBookingAction} className="grid gap-5">
          <input type="hidden" name="service" value={serviceId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="staff" value={sp.staff ?? ""} />
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Available times</legend>
            {slotError ? (
              <p className="text-sm text-destructive">{slotError}</p>
            ) : !slots.length ? (
              <p className="text-sm text-muted-foreground">No free times on this day.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s, i) => (
                  <label key={s.time} className="cursor-pointer">
                    <input type="radio" name="time" value={s.time} required defaultChecked={i === 0} className="peer sr-only" />
                    <span
                      className="tabular block rounded-md border bg-background px-3 py-1.5 text-sm shadow-xs transition-colors hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
                      title={s.staffIds.map((id) => names.get(id)).join(", ")}
                    >
                      {s.time}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Guest name">
              <Input name="name" required />
            </Field>
            <Field label="Mobile">
              <Input name="phone" required inputMode="tel" placeholder="98765 43210" />
            </Field>
            <Field label="Email (optional)">
              <Input name="email" type="email" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" placeholder="Skin concerns, allergies, preferences" />
          </Field>
          {sp.error && (
            <p role="alert" className="text-sm text-destructive">
              {sp.error}
            </p>
          )}
          <div>
            <Button disabled={!slots.length}>Confirm booking</Button>
          </div>
        </form>
      </Section>
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page(props: Parameters<typeof NewBooking>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <NewBooking {...props} />
    </Suspense>
  );
}
