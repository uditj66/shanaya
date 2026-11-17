import { requireSalon } from "@/lib/session";
import { saveService } from "../actions";
import { Badge, Button, Card, Field, Input, PageHeader, Textarea, money } from "@/components/ui";
import type { Tables } from "@/lib/database.types";

export default async function Services({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { salon, supabase, isAdmin } = await requireSalon();
  const { error } = await searchParams;
  const [{ data: services }, { data: staff }, { data: links }] = await Promise.all([
    supabase.from("services").select("*").eq("salon_id", salon.id).order("sort_order").order("name"),
    supabase.from("staff").select("id, name").eq("salon_id", salon.id).eq("active", true).order("sort_order"),
    supabase.from("staff_services").select("staff_id, service_id").eq("salon_id", salon.id),
  ]);

  const serviceForm = (s?: Tables<"services">) => (
    <form action={saveService} className="space-y-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-3"><Field label="Name"><Input name="name" required defaultValue={s?.name} /></Field></div>
        <div className="sm:col-span-3"><Field label="Category"><Input name="category" defaultValue={s?.category ?? "Facial"} /></Field></div>
        <div className="sm:col-span-2"><Field label="Duration (min)"><Input name="duration" type="number" min={5} required defaultValue={s?.duration_minutes ?? 60} /></Field></div>
        <div className="sm:col-span-2"><Field label="Cleanup buffer (min)" hint="Room reset after"><Input name="buffer" type="number" min={0} defaultValue={s?.buffer_minutes ?? 10} /></Field></div>
        <div className="sm:col-span-2"><Field label={`Price (${salon.currency})`}><Input name="price" type="number" min={0} step="1" defaultValue={s?.price ?? 0} /></Field></div>
      </div>
      <Field label="Description (the AI uses this to recommend)"><Textarea name="description" defaultValue={s?.description} /></Field>
      <div>
        <span className="label">Performed by</span>
        <div className="flex flex-wrap gap-3">
          {(staff ?? []).map((st) => (
            <label key={st.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="staff" value={st.id} defaultChecked={s ? links?.some((l) => l.service_id === s.id && l.staff_id === st.id) : true} />
              {st.name}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> Bookable</label>
      <Button>{s ? "Save" : "Add service"}</Button>
    </form>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title="Services" subtitle="What guests can book. The AI reads this list live on every call." />
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <div className="space-y-3">
        {services?.map((s) => (
          <Card key={s.id} className="p-0">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-muted">{s.category} · {s.duration_minutes} min · {money(s.price, salon.currency)}</span>
                <span className="ml-auto text-xs text-muted">
                  {links?.filter((l) => l.service_id === s.id).length ?? 0} therapists {!s.active && <Badge tone="cancelled">hidden</Badge>}
                </span>
              </summary>
              {isAdmin && <div className="border-t border-line px-5 py-4">{serviceForm(s)}</div>}
            </details>
          </Card>
        ))}
      </div>
      {isAdmin && (
        <Card className="mt-6">
          <h2 className="mb-3 font-serif text-xl font-semibold">Add a service</h2>
          {serviceForm()}
        </Card>
      )}
    </div>
  );
}
