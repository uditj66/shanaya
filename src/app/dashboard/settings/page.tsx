import { requireSalon } from "@/lib/session";
import { appUrl } from "@/lib/agent/vapi";
import { connectPhoneNumber, saveSettings } from "./actions";
import { VoicePicker } from "./voice-picker";
import { VapiManaged } from "./vapi-managed";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; welcome?: string }> }) {
  const { salon } = await requireSalon();
  const sp = await searchParams;
  const hours = salon.business_hours as Record<string, [string, string][]>;
  const base = appUrl();
  const embed = `<script src="${base}/widget.js" data-salon="${salon.slug}" async></script>`;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Your studio details and how your AI receptionist behaves." />
      {sp.welcome && <Card className="border-gold bg-gold/5 text-sm">Welcome! Next: set your hours here, then add services and therapists.</Card>}
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
            <Field label="Assistant name"><Input name="agent_name" defaultValue={salon.agent_name} /></Field>
            <Field label="Transfer calls to (optional)" hint="Human fallback number in +91… format"><Input name="transfer_phone" defaultValue={salon.transfer_phone ?? ""} /></Field>
          </div>
          <Field label="Greeting" hint="Leave blank for the default"><Input name="agent_greeting" defaultValue={salon.agent_greeting ?? ""} /></Field>
          <Field label="Policies"><Textarea name="policies" defaultValue={salon.policies} /></Field>
          <Field label="Offers, FAQs and extra instructions"><Textarea name="agent_instructions" defaultValue={salon.agent_instructions} /></Field>
          {process.env.VAPI_ASSISTANT_ID ? (
            <VapiManaged assistantId={process.env.VAPI_ASSISTANT_ID} agentName={salon.agent_name} />
          ) : (
          <VoicePicker
            provider={salon.voice_provider}
            voiceId={salon.voice_id}
            model={salon.voice_model}
            speed={Number((salon.voice_settings as { speed?: number } | null)?.speed ?? 1)}
            agentName={salon.agent_name}
          />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Voice conversation model" hint="Phone and website voice calls (as listed in Vapi)"><Input name="phone_llm_model" defaultValue={salon.phone_llm_model} /></Field>
            <Field label="Typed chat model (OpenAI)"><Input name="llm_model" defaultValue={salon.llm_model} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="widget_enabled" defaultChecked={salon.widget_enabled} /> Website widget enabled</label>
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

      <Card className="space-y-3">
        <h2 className="font-serif text-xl font-semibold">Website widget</h2>
        <p className="text-sm text-muted">Paste this before <code>&lt;/body&gt;</code> on your website. Guests can chat or talk to book.</p>
        <pre className="overflow-x-auto rounded-lg bg-cream p-3 text-xs">{embed}</pre>
        <a href={`/w/${salon.slug}`} target="_blank" className="text-sm text-gold-dark underline">Open your booking assistant →</a>
      </Card>
    </div>
  );
}
