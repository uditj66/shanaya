import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { AlertTriangle } from "lucide-react";
import { requireSalon } from "@/lib/session";
import { connectPhoneNumber, saveSettings } from "./actions";
import { VapiManaged } from "./vapi-managed";
import { Button, Field, Input, Label, PageHeader, Section, Select, Textarea } from "@/components/admin/kit";
import { chatModel } from "@/lib/agent/chat-model";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { salon } = await requireSalon();
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const sp = await searchParams;
  const hours = salon.business_hours as Record<string, [string, string][]>;

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Settings" description="Your studio details and how your AI receptionist behaves." />
      {sp.saved && (
        <p role="status" className="-mt-4 text-sm text-success">
          {sp.saved === "phone" ? "Phone number connected. Calls now reach your AI receptionist." : "Saved."}
        </p>
      )}
      {sp.error && <p role="alert" className="-mt-4 text-sm text-destructive">{sp.error}</p>}

      <form action={saveSettings} className="grid gap-6">
        <Section title="Studio">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input name="name" defaultValue={salon.name} required /></Field>
            <Field label="Front desk phone"><Input name="phone" defaultValue={salon.phone ?? ""} /></Field>
            <Field label="Address"><Input name="address" defaultValue={salon.address ?? ""} /></Field>
            <Field label="Website"><Input name="website" defaultValue={salon.website ?? ""} /></Field>
          </div>
        </Section>

        <Section title="Opening hours">
          <div className="grid gap-2">
            {DAYS.map((d, i) => (
              <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">{d}</span>
                <Input type="time" aria-label={`${d} opens`} name={`open_${i}`} defaultValue={hours[String(i)]?.[0]?.[0] ?? ""} className="tabular w-32" />
                <span className="text-muted-foreground">–</span>
                <Input type="time" aria-label={`${d} closes`} name={`close_${i}`} defaultValue={hours[String(i)]?.[0]?.[1] ?? ""} className="tabular w-32" />
                {!hours[String(i)]?.length && <span className="text-xs text-muted-foreground">Closed</span>}
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-3">
            <Field label="Slot grid">
              <Select name="slot_interval_minutes" defaultValue={String(salon.slot_interval_minutes)}>
                {[10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>Every {m} min</option>)}
              </Select>
            </Field>
            <Field label="Minimum notice (min)"><Input type="number" name="min_notice_minutes" min={0} defaultValue={salon.min_notice_minutes} /></Field>
            <Field label="Book up to (days ahead)"><Input type="number" name="max_days_ahead" min={1} max={365} defaultValue={salon.max_days_ahead} /></Field>
          </div>
        </Section>

        <Section title="AI receptionist" contentClassName="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assistant name" hint="Used on phone, website voice and chat"><Input name="agent_name" defaultValue={salon.agent_name} /></Field>
            <Field label="Transfer calls to (optional)" hint="This branch's front desk, e.g. +91 22 4000 0000. Used when a phone caller asks for a person"><Input name="transfer_phone" defaultValue={salon.transfer_phone ?? ""} /></Field>
          </div>
          <Field label="Policies"><Textarea name="policies" defaultValue={salon.policies} /></Field>
          <Field label="Offers, FAQs and extra instructions"><Textarea name="agent_instructions" defaultValue={salon.agent_instructions} /></Field>
          {assistantId ? (
            <VapiManaged assistantId={assistantId} agentName={salon.agent_name} />
          ) : (
            <p role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>Shanaya&apos;s voice assistant isn&apos;t set up: VAPI_ASSISTANT_ID is missing from the server environment, so calls can&apos;t be answered.</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">Chat model: {chatModel()}, the same for every studio (set by OPENAI_MODEL in the server environment).</p>
          <Label className="font-normal">
            <input type="checkbox" name="widget_enabled" defaultChecked={salon.widget_enabled} className="size-4 accent-primary" /> &quot;Ask Shanaya&quot; chat on the Lumière website (for this studio&apos;s pages)
          </Label>
        </Section>
        <Button className="w-fit">Save settings</Button>
      </form>

      <Section
        title="Phone number"
        description="Buy or import a number in Vapi (Phone Numbers), copy its ID here and connect. Every call to it is then answered by your AI with your live services and calendar. Tip: keep your existing number and forward missed or after-hours calls to this one."
      >
        <form action={connectPhoneNumber} className="flex flex-wrap gap-2">
          <Input name="vapi_phone_number_id" aria-label="Vapi phone number ID" defaultValue={salon.vapi_phone_number_id ?? ""} placeholder="Vapi phone number ID" className="max-w-sm" />
          <Button variant="outline">{salon.vapi_phone_number_id ? "Reconnect" : "Connect"}</Button>
        </form>
      </Section>
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
