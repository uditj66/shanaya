import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Card, Empty, PageHeader, money } from "@/components/dashboard-ui";
import { Board, type Enquiry } from "./board";

const KIND_LABEL: Record<string, string> = { contact: "Contact form", membership: "Membership enquiry", consultation: "Consultation request", chat: "From the chat" };

async function Leads({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireArea("leads");
  const admin = s.role === "owner" || s.role === "manager";
  const tabs = [["leads", "Enquiries"], ["gifts", "Gift cards"], ...(admin ? [["careers", "Careers"]] : [])] as [string, string][];
  const { tab: raw } = await searchParams;
  const tab = tabs.some(([k]) => k === raw) ? raw! : "leads";
  const brandId = s.salon.brand_id;
  const tz = s.salon.timezone;
  const when = (iso: string) => formatInTimeZone(new Date(iso), tz, "d MMM");
  const studio = (id: string | null) => (id ? (s.salons.find((x) => x.id === id)?.area ?? "") : "");

  let items: Enquiry[] = [];
  let table: "leads" | "gift_card_requests" | "job_applications" = "leads";
  if (brandId && tab === "leads") {
    const { data } = await s.supabase.from("leads").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
    items = (data ?? []).map((l) => ({
      id: l.id, status: l.status, title: l.name, when: when(l.created_at), body: l.message,
      sub: [KIND_LABEL[l.kind] ?? l.kind, studio(l.salon_id)].filter(Boolean).join(" · "),
      contact: { phone: l.phone, email: l.email },
    }));
  } else if (brandId && tab === "gifts") {
    table = "gift_card_requests";
    const { data } = await s.supabase.from("gift_card_requests").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
    items = (data ?? []).map((g) => ({
      id: g.id, status: g.status, title: `${g.sender_name} → ${g.recipient_name}`, when: when(g.created_at), body: g.message,
      sub: [money(g.amount, s.salon.currency), studio(g.salon_id)].filter(Boolean).join(" · "),
      contact: { phone: g.sender_phone, email: g.sender_email },
    }));
  } else if (brandId && tab === "careers") {
    table = "job_applications";
    const { data } = await s.supabase.from("job_applications").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
    items = (data ?? []).map((j) => ({
      id: j.id, status: j.status, title: j.name, when: when(j.created_at), body: j.message,
      sub: [j.role, j.city, j.experience_years != null ? `${j.experience_years} yrs` : ""].filter(Boolean).join(" · "),
      contact: { phone: j.phone, email: j.email },
    }));
  }

  return (
    <div>
      <PageHeader eyebrow="Brand-wide" title="Leads" subtitle="Enquiries from the website and the concierge chat, gift card requests and job applications." />
      <nav className="mb-5 flex flex-wrap gap-1.5 text-sm" aria-label="Lead type">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/dashboard/leads?tab=${k}` as Route} aria-current={tab === k ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 ${tab === k ? "bg-charcoal text-ivory" : "text-stone ring-1 ring-line hover:text-charcoal"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {!brandId ? (
        <Card><Empty>Leads appear here once your studio has a brand website.</Empty></Card>
      ) : (
        <Board key={tab} table={table} items={items} />
      )}
    </div>
  );
}

export default function Page(props: Parameters<typeof Leads>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Leads {...props} />
    </Suspense>
  );
}
