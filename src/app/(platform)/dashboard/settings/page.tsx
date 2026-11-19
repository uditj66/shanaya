import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireSalon } from "@/lib/session";
import { connectPhoneNumber, saveSettings } from "./actions";
import { VapiManaged } from "./vapi-managed";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/dashboard-ui";
import { chatModel } from "@/lib/agent/chat-model";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { salon } = await requireSalon();
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const sp = await searchParams;
  const hours = salon.business_hours as Record<string, [string, string][]>;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Your studio details and how your AI receptionist behaves." />
      {sp.saved && <p className="text-sm text-sage">{sp.saved === "phone" ? "Phone number connected. Calls now reach your AI receptionist." : "Saved."}</p>}
      {sp.error && <p className="text-sm text-danger">{sp.error}</p>}

      <form action={saveSettings} className="space-y-6">
        <Card className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">Studio</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input name="name" defaultValue={salon.name} required /></Field>
            <Field label="Front desk phone"><Input name="phone" defaultValue={salon.phone ?? ""} /></Field>
            <Field label="Address"><Input name="address" defaultValue={salon.address ?? ""} /></Field>
            <Field label="Website"><Input name="website" defaultValue={salon.website ?? ""} /></Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">Opening hours</h2>
          {DAYS.map((d, i) => (
            <div key={d} className="flex items-center gap-2 text-sm">
              <span className="w-24 text-muted">{d}</span>
              <Input type="time" name={`open_${i}`} defaultValue={hours[String(i)]?.[0]?.[0] ?? ""} className="w-32" />–
              <Input type="time" name={`close_${i}`} defaultValue={hours[String(i)]?.[0]?.[1] ?? ""} className="w-32" />
              {!hours[String(i)]?.length && <span className="text-xs text-muted">Closed</span>}
            </div>
          ))}
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <Field label="Slot grid">
              <Select name="slot_interval_minutes" defaultValue={String(salon.slot_interval_minutes)}>
                {[10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>Every {m} min</option>)}
              </Select>
            </Field>
            <Field label="Minimum notice (min)"><Input type="number" name="min_notice_minutes" min={0} defaultValue={salon.min_notice_minutes} /></Field>
            <Field label="Book up to (days ahead)"><Input type="number" name="max_days_ahead" min={1} max={365} defaultValue={salon.max_days_ahead} /></Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">AI receptionist</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Assistant name" hint="Used on phone, website voice and chat"><Input name="agent_name" defaultValue={salon.agent_name} /></Field>
            <Field label="Transfer calls to (optional)" hint="This branch's front desk, e.g. +91 22 4000 0000. Used when a phone caller asks for a person"><Input name="transfer_phone" defaultValue={salon.transfer_phone ?? ""} /></Field>
          </div>
          <Field label="Policies"><Textarea name="policies" defaultValue={salon.policies} /></Field>
          <Field label="Offers, FAQs and extra instructions"><Textarea name="agent_instructions" defaultValue={salon.agent_instructions} /></Field>
          {assistantId ? (
            <VapiManaged assistantId={assistantId} agentName={salon.agent_name} />
          ) : (
            <p className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              Shanaya&apos;s voice assistant isn&apos;t set up: VAPI_ASSISTANT_ID is missing from the server environment, so calls can&apos;t be answered.
            </p>
          )}
          <p className="text-xs text-stone">Chat model: {chatModel()}, the same for every studio (set by OPENAI_MODEL in the server environment).</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="widget_enabled" defaultChecked={salon.widget_enabled} /> &quot;Ask Shanaya&quot; chat on the Lumière website (for this studio&apos;s pages)</label>
        </Card>
        <Button>Save settings</Button>
      </form>

      <Card className="space-y-3">
        <h2 className="font-serif text-xl font-semibold">Phone number</h2>
        <p className="text-sm text-muted">
          Buy or import a number in Vapi (Phone Numbers), copy its ID here and connect. Every call to it is then answered by your AI with your live services and calendar.
          Tip: keep your existing number and forward missed or after-hours calls to this one.
        </p>
        <form action={connectPhoneNumber} className="flex flex-wrap gap-2">
          <Input name="vapi_phone_number_id" defaultValue={salon.vapi_phone_number_id ?? ""} placeholder="Vapi phone number ID" className="max-w-sm" />
          <Button variant="outline">{salon.vapi_phone_number_id ? "Reconnect" : "Connect"}</Button>
        </form>
      </Card>
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page(props: Parameters<typeof Settings>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Settings {...props} />
    </Suspense>
  );
}
