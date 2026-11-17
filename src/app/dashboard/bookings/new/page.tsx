import { requireSalon } from "@/lib/session";
import { BookingError, getSlots } from "@/lib/booking-service";
import { isDate, todayIn } from "@/lib/time";
import { createBookingAction } from "../../actions";
import { Button, Card, Field, Input, PageHeader, Select, Textarea, money } from "@/components/ui";

type SP = { service?: string; date?: string; staff?: string; error?: string };

export default async function NewBooking({ searchParams }: { searchParams: Promise<SP> }) {
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
    <div className="max-w-3xl">
      <PageHeader title="New booking" subtitle="Choose a service and day to see live availability." />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Service">
            <Select name="service" defaultValue={serviceId}>
              {(services ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}m · {money(s.price, salon.currency)}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" name="date" defaultValue={date} /></Field>
          <Field label="Therapist">
            <Select name="staff" defaultValue={sp.staff ?? ""}>
              <option value="">Any available</option>
              {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Button variant="outline">Show times</Button>
        </form>
      </Card>

      <Card>
        <form action={createBookingAction} className="space-y-4">
          <input type="hidden" name="service" value={serviceId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="staff" value={sp.staff ?? ""} />
          <div>
            <span className="label">Available times</span>
            {slotError ? <p className="text-sm text-danger">{slotError}</p> : !slots.length ? <p className="text-sm text-muted">No free times on this day.</p> : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s, i) => (
                  <label key={s.time} className="cursor-pointer">
                    <input type="radio" name="time" value={s.time} required defaultChecked={i === 0} className="peer sr-only" />
                    <span className="block rounded-lg border border-line px-3 py-1.5 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ivory" title={s.staffIds.map((id) => names.get(id)).join(", ")}>
                      {s.time}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Guest name"><Input name="name" required /></Field>
            <Field label="Mobile"><Input name="phone" required inputMode="tel" placeholder="98765 43210" /></Field>
            <Field label="Email (optional)"><Input name="email" type="email" /></Field>
          </div>
          <Field label="Notes"><Textarea name="notes" placeholder="Skin concerns, allergies, preferences" /></Field>
          {sp.error && <p className="text-sm text-danger">{sp.error}</p>}
          <Button disabled={!slots.length}>Confirm booking</Button>
        </form>
      </Card>
    </div>
  );
}
