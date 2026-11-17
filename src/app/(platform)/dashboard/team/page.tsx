import { requireSalon } from "@/lib/session";
import { fmtHuman, todayIn } from "@/lib/time";
import { addTimeOff, deleteTimeOff, saveStaff } from "../actions";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/dashboard-ui";
import type { Tables } from "@/lib/database.types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function Team({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { salon, supabase, isAdmin } = await requireSalon();
  const { error } = await searchParams;
  const [{ data: staff }, { data: hours }, { data: timeOff }] = await Promise.all([
    supabase.from("staff").select("*").eq("salon_id", salon.id).order("sort_order").order("name"),
    supabase.from("staff_hours").select("*").eq("salon_id", salon.id).order("start_time"),
    supabase.from("time_off").select("*").eq("salon_id", salon.id).gte("ends_at", new Date().toISOString()).order("starts_at"),
  ]);
  const name = new Map((staff ?? []).map((s) => [s.id, s.name]));

  const staffForm = (s?: Tables<"staff">) => {
    const mine = (hours ?? []).filter((h) => h.staff_id === s?.id);
    return (
      <form action={saveStaff} className="space-y-4">
        {s && <input type="hidden" name="id" value={s.id} />}
        <input type="hidden" name="hours" value="1" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Name"><Input name="name" required defaultValue={s?.name} /></Field>
          <Field label="Title"><Input name="title" defaultValue={s?.title ?? ""} placeholder="Skin Therapist" /></Field>
          <Field label="Calendar colour"><Input name="color" type="color" defaultValue={s?.color ?? "#b4746b"} className="h-10 p-1" /></Field>
          <Field label="Status">
            <Select name="active" defaultValue={s?.active === false ? "off" : "on"}><option value="on">Active</option><option value="off">Inactive</option></Select>
          </Field>
        </div>
        <div>
          <span className="label">Weekly hours (second shift optional, e.g. after lunch)</span>
          <div className="grid gap-2">
            {DAYS.map((d, i) => {
              const day = mine.filter((h) => h.weekday === i);
              return (
                <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-10 text-muted">{d}</span>
                  {[0, 1].map((k) => (
                    <span key={k} className="flex items-center gap-1">
                      <Input type="time" name={`d${i}_s${k + 1}_start`} defaultValue={day[k]?.start_time.slice(0, 5) ?? (!s && k === 0 && i !== 2 ? "10:00" : "")} className="w-28" />
                      –
                      <Input type="time" name={`d${i}_s${k + 1}_end`} defaultValue={day[k]?.end_time.slice(0, 5) ?? (!s && k === 0 && i !== 2 ? "19:00" : "")} className="w-28" />
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">Leave a day blank for a day off.</p>
        </div>
        <Button>{s ? "Save" : "Add therapist"}</Button>
      </form>
    );
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Team & hours" subtitle="Who works when. The AI only offers times when a qualified therapist is free." />
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <div className="space-y-3">
        {staff?.map((s) => (
          <Card key={s.id} className="p-0">
            <details>
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4">
                <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-muted">{s.title}</span>
                <span className="ml-auto text-xs text-muted">
                  {DAYS.filter((_, i) => hours?.some((h) => h.staff_id === s.id && h.weekday === i)).join(" ")}
                  {!s.active && " · inactive"}
                </span>
              </summary>
              {isAdmin && <div className="border-t border-line px-5 py-4">{staffForm(s)}</div>}
            </details>
          </Card>
        ))}
      </div>
      {isAdmin && (
        <Card className="mt-6">
          <h2 className="mb-3 font-serif text-xl font-semibold">Add a therapist</h2>
          {staffForm()}
        </Card>
      )}

      <h2 className="mt-10 mb-3 font-serif text-2xl font-semibold">Leave, breaks & closures</h2>
      <Card>
        <form action={addTimeOff} className="grid gap-3 sm:grid-cols-6 sm:items-end">
          <div className="sm:col-span-2">
            <Field label="Who">
              <Select name="staff"><option value="">Whole studio (closed)</option>{staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
          </div>
          <Field label="From date"><Input type="date" name="date" required defaultValue={todayIn(salon.timezone)} /></Field>
          <Field label="From time"><Input type="time" name="start" /></Field>
          <Field label="To date"><Input type="date" name="end_date" /></Field>
          <Field label="To time"><Input type="time" name="end" /></Field>
          <div className="sm:col-span-5"><Field label="Reason"><Input name="reason" placeholder="Leave, training, Diwali closure…" /></Field></div>
          <Button variant="outline">Add</Button>
        </form>
        <ul className="mt-4 divide-y divide-line text-sm">
          {timeOff?.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <span className="font-medium">{t.staff_id ? name.get(t.staff_id) : "Whole studio"}</span>
              <span className="text-muted">{fmtHuman(t.starts_at, salon.timezone)} → {fmtHuman(t.ends_at, salon.timezone)}</span>
              <span className="text-muted">{t.reason}</span>
              <form action={deleteTimeOff} className="ml-auto"><input type="hidden" name="id" value={t.id} /><button className="text-xs text-danger">Remove</button></form>
            </li>
          ))}
          {!timeOff?.length && <li className="py-2 text-muted">No upcoming leave or closures.</li>}
        </ul>
      </Card>
    </div>
  );
}
