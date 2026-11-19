import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { ChevronDown } from "lucide-react";
import { requireSalon } from "@/lib/session";
import { saveService } from "../actions";
import { Button, Card, EmptyState, Field, Input, Label, PageHeader, Section, StatusBadge, Textarea, money } from "@/components/admin/kit";
import type { Tables } from "@/lib/database.types";

async function Services({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { salon, supabase, isAdmin } = await requireSalon();
  const { error } = await searchParams;
  const [{ data: services }, { data: staff }, { data: links }] = await Promise.all([
    supabase.from("services").select("*").eq("salon_id", salon.id).order("sort_order").order("name"),
    supabase.from("staff").select("id, name").eq("salon_id", salon.id).eq("active", true).order("sort_order"),
    supabase.from("staff_services").select("staff_id, service_id").eq("salon_id", salon.id),
  ]);

  const serviceForm = (s?: Tables<"services">) => (
    <form action={saveService} className="grid gap-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Name" className="sm:col-span-3"><Input name="name" required defaultValue={s?.name} /></Field>
        <Field label="Category" className="sm:col-span-3"><Input name="category" defaultValue={s?.category ?? "Facial"} /></Field>
        <Field label="Duration (min)" className="sm:col-span-2"><Input name="duration" type="number" min={5} required defaultValue={s?.duration_minutes ?? 60} /></Field>
        <Field label="Cleanup buffer (min)" hint="Room reset after" className="sm:col-span-2"><Input name="buffer" type="number" min={0} defaultValue={s?.buffer_minutes ?? 10} /></Field>
        <Field label={`Price (${salon.currency})`} className="sm:col-span-2"><Input name="price" type="number" min={0} step="1" defaultValue={s?.price ?? 0} /></Field>
      </div>
      <Field label="Description (the AI uses this to recommend)"><Textarea name="description" defaultValue={s?.description} /></Field>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Performed by</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {(staff ?? []).map((st) => (
            <Label key={st.id} className="font-normal">
              <input type="checkbox" name="staff" value={st.id} defaultChecked={s ? links?.some((l) => l.service_id === s.id && l.staff_id === st.id) : true} className="size-4 accent-primary" />
              {st.name}
            </Label>
          ))}
        </div>
      </fieldset>
      <Label className="font-normal">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4 accent-primary" /> Bookable
      </Label>
      <Button className="w-fit">{s ? "Save" : "Add service"}</Button>
    </form>
  );

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader title="Services" description="What guests can book. The AI reads this list live on every call." />
      {error && <p role="alert" className="-mt-4 text-sm text-destructive">{error}</p>}
      <div className="grid gap-3">
        {services?.map((s) => (
          <Card key={s.id} className="gap-0 py-0">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
                <span className="font-medium">{s.name}</span>
                <span className="tabular text-sm text-muted-foreground">
                  {s.category} · {s.duration_minutes} min · {money(s.price, salon.currency)}
                </span>
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular">{links?.filter((l) => l.service_id === s.id).length ?? 0} therapists</span>
                  {!s.active && <StatusBadge tone="danger">hidden</StatusBadge>}
                  {isAdmin && <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />}
                </span>
              </summary>
              {isAdmin && <div className="border-t px-5 py-5">{serviceForm(s)}</div>}
            </details>
          </Card>
        ))}
        {!services?.length && (
          <Card className="py-0">
            <EmptyState title="No services yet" description={isAdmin ? "Add your first treatment below." : undefined} />
          </Card>
        )}
      </div>
      {isAdmin && <Section title="Add a service">{serviceForm()}</Section>}
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page(props: Parameters<typeof Services>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Services {...props} />
    </Suspense>
  );
}
