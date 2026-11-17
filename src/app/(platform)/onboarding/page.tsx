import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button, Field, Input, Select } from "@/components/dashboard-ui";
import { setSalonCookie } from "@/lib/salon-cookie";

async function create(form: FormData) {
  "use server";
  const supabase = await createClient();
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  const { data: salonId, error } = await supabase.rpc("create_salon", {
    p_name: name,
    p_slug: slug,
    p_timezone: String(form.get("timezone")),
    p_currency: String(form.get("currency")),
  });
  const again = form.get("new") ? "&new=1" : "";
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message.includes("duplicate") ? "That web address is taken" : error.message)}${again}`);
  await setSalonCookie(salonId); // open the dashboard on the salon just created
  redirect("/dashboard/settings?welcome=1");
}

// Reads the auth cookie, so the form streams in after a static shell.
export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center"><div className="h-80 w-full max-w-md animate-pulse rounded-2xl bg-cream" /></main>}>
      <Onboarding searchParams={searchParams as Promise<{ error?: string; new?: string }>} />
    </Suspense>
  );
}

async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string; new?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error, new: addingAnother } = await searchParams;
  const { count } = await supabase.from("salon_members").select("*", { count: "exact", head: true }).eq("user_id", data.user.id);
  if (count && !addingAnother) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form action={create} className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-6">
        {addingAnother && <input type="hidden" name="new" value="1" />}
        <h1 className="font-serif text-3xl font-semibold">{addingAnother ? "Add another salon" : "Set up your studio"}</h1>
        <p className="text-sm text-muted">
          {addingAnother ? "A new branch or client salon, with its own services, team, phone number and bookings." : "You can add services, therapists and hours on the next screens."}
        </p>
        <Field label="Studio name"><Input name="name" required minLength={2} placeholder="Lumière Facial Studio" /></Field>
        <Field label="Web address" hint="Used for your booking widget: /w/your-studio"><Input name="slug" required pattern="[a-zA-Z0-9-]{3,50}" placeholder="lumiere-indiranagar" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Timezone">
            <Select name="timezone" defaultValue="Asia/Kolkata">
              {["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Currency">
            <Select name="currency" defaultValue="INR">{["INR", "AED", "SGD", "GBP", "USD", "AUD"].map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full">Create studio</Button>
        {addingAnother && <a href="/dashboard" className="block text-center text-sm text-muted hover:text-ink">Cancel</a>}
      </form>
    </main>
  );
}
