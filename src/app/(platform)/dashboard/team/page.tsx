import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { ChevronDown, Trash2 } from "lucide-react";
import { requireSalon } from "@/lib/session";
import { fmtHuman, todayIn } from "@/lib/time";
import { addTimeOff, deleteTimeOff, saveStaff } from "../actions";
import { Button, Card, EmptyState, Field, Input, PageHeader, Section, Select, StatusBadge } from "@/components/admin/kit";
import type { Tables } from "@/lib/database.types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function Team({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
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
      <form action={saveStaff} className="grid gap-5">
        {s && <input type="hidden" name="id" value={s.id} />}
        <input type="hidden" name="hours" value="1" />
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Name"><Input name="name" required defaultValue={s?.name} /></Field>
          <Field label="Title"><Input name="title" defaultValue={s?.title ?? ""} placeholder="Skin Therapist" /></Field>
          <Field label="Calendar colour"><Input name="color" type="color" defaultValue={s?.color ?? "#b4746b"} className="h-9 p-1" /></Field>
          <Field label="Status">
            <Select name="active" defaultValue={s?.active === false ? "off" : "on"}><option value="on">Active</option><option value="off">Inactive</option></Select>
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Weekly hours <span className="font-normal text-muted-foreground">(second shift optional, e.g. after lunch)</span>
          </legend>
          <div className="grid gap-2">
            {DAYS.map((d, i) => {
              const day = mine.filter((h) => h.weekday === i);
              return (
                <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-10 text-muted-foreground">{d}</span>
                  {[0, 1].map((k) => (
                    <span key={k} className="flex items-center gap-1.5 text-muted-foreground">
                      <Input type="time" aria-label={`${d} shift ${k + 1} start`} name={`d${i}_s${k + 1}_start`} defaultValue={day[k]?.start_time.slice(0, 5) ?? (!s && k === 0 && i !== 2 ? "10:00" : "")} className="tabular w-28" />
                      –
                      <Input type="time" aria-label={`${d} shift ${k + 1} end`} name={`d${i}_s${k + 1}_end`} defaultValue={day[k]?.end_time.slice(0, 5) ?? (!s && k === 0 && i !== 2 ? "19:00" : "")} className="tabular w-28" />
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Leave a day blank for a day off.</p>
        </fieldset>
        <Button className="w-fit">{s ? "Save" : "Add therapist"}</Button>
      </form>
    );
  };

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader title="Team & hours" description="Who works when. The AI only offers times when a qualified therapist is free." />
      {error && <p role="alert" className="-mt-4 text-sm text-destructive">{error}</p>}
      <div className="grid gap-3">
        {staff?.map((s) => (
          <Card key={s.id} className="gap-0 py-0">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
                <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-muted-foreground">{s.title}</span>
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {DAYS.filter((_, i) => hours?.some((h) => h.staff_id === s.id && h.weekday === i)).join(" ")}
                  {!s.active && <StatusBadge tone="neutral">inactive</StatusBadge>}
                  {isAdmin && <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />}
                </span>
              </summary>
              {isAdmin && <div className="border-t px-5 py-5">{staffForm(s)}</div>}
            </details>
          </Card>
        ))}
        {!staff?.length && (
          <Card className="py-0">
            <EmptyState title="No therapists yet" description={isAdmin ? "Add your first therapist below." : undefined} />
          </Card>
        )}
      </div>
      {isAdmin && <Section title="Add a therapist">{staffForm()}</Section>}

      <Section title="Leave, breaks & closures" description="Times when a therapist, or the whole studio, can't be booked.">
        <form action={addTimeOff} className="grid gap-4 sm:grid-cols-6 sm:items-end">
          <Field label="Who" className="sm:col-span-2">
            <Select name="staff">
              <option value="">Whole studio (closed)</option>
              {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="From date"><Input type="date" name="date" required defaultValue={todayIn(salon.timezone)} /></Field>
          <Field label="From time"><Input type="time" name="start" /></Field>
          <Field label="To date"><Input type="date" name="end_date" /></Field>
          <Field label="To time"><Input type="time" name="end" /></Field>
          <Field label="Reason" className="sm:col-span-5"><Input name="reason" placeholder="Leave, training, Diwali closure…" /></Field>
          <Button variant="outline">Add</Button>
        </form>
        <ul className="mt-5 divide-y border-t text-sm">
          {timeOff?.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="font-medium">{t.staff_id ? name.get(t.staff_id) : "Whole studio"}</span>
              <span className="tabular text-muted-foreground">{fmtHuman(t.starts_at, salon.timezone)} → {fmtHuman(t.ends_at, salon.timezone)}</span>
              <span className="text-muted-foreground">{t.reason}</span>
              <form action={deleteTimeOff} className="ml-auto">
                <input type="hidden" name="id" value={t.id} />
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 aria-hidden /> Remove
                </Button>
              </form>
            </li>
          ))}
          {!timeOff?.length && <li className="py-3 text-muted-foreground">No upcoming leave or closures.</li>}
        </ul>
      </Section>
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page(props: Parameters<typeof Team>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Team {...props} />
    </Suspense>
  );
}
