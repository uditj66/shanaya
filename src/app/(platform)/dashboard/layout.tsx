import { Suspense } from "react";
import Link from "next/link";
import { can, requireSalon, type Area } from "@/lib/session";
import { healthEvents } from "@/lib/health";
import { signOut } from "../login/actions";
import { LiveRefresh } from "./live-refresh";
import { DashboardNav, type NavGroup, type NavItem } from "./nav";

// Static shell (prerendered, paints instantly) + the signed-in workspace streamed in.
// Everything below reads the auth cookie, so it lives inside <Suspense>.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}

async function Workspace({ children }: { children: React.ReactNode }) {
  const session = await requireSalon();
  const { salon, salons, user, supabase, role, isAll, scopeIds, canSeeAll } = session;

  const [{ count: openCallbacks }, { count: newLeads }, health] = await Promise.all([
    supabase.from("callbacks").select("*", { count: "exact", head: true }).in("salon_id", scopeIds).eq("status", "open"),
    salon.brand_id
      ? supabase.from("leads").select("*", { count: "exact", head: true }).eq("brand_id", salon.brand_id).eq("status", "new")
      : Promise.resolve({ count: 0 }),
    can(role, "health") ? healthEvents(supabase, salon.id, role) : Promise.resolve({ recentProblems: 0 }),
  ]);

  const item = (area: Area, i: NavItem): NavItem[] => (can(role, area) ? [i] : []);
  const groups: NavGroup[] = [
    {
      label: "Day to day",
      items: [
        ...item("overview", { href: "/dashboard", label: "Overview", icon: "LayoutDashboard" }),
        ...item("calendar", { href: "/dashboard/calendar", label: "Calendar", icon: "CalendarDays" }),
        ...item("bookings", { href: "/dashboard/bookings", label: "Bookings", icon: "ListChecks" }),
      ],
    },
    {
      label: "Guests",
      items: [
        ...item("guests", { href: "/dashboard/guests", label: "Guests", icon: "Users" }),
        ...item("inbox", { href: "/dashboard/inbox", label: "Inbox", icon: "Inbox" }),
        ...item("leads", { href: "/dashboard/leads", label: "Leads", icon: "Sparkles", badge: newLeads ?? 0 }),
        ...item("giftcards", { href: "/dashboard/gift-cards", label: "Gift cards", icon: "Gift" }),
        ...item("members", { href: "/dashboard/members", label: "Members", icon: "Crown" }),
        ...item("inbox", { href: "/dashboard/callbacks", label: "Call-backs", icon: "PhoneCall", badge: openCallbacks ?? 0 }),
      ],
    },
    {
      label: "Studio",
      items: [
        ...item("services", { href: "/dashboard/services", label: "Treatments", icon: "Sparkles" }),
        ...item("team", { href: "/dashboard/team", label: "Team & hours", icon: "UserRound" }),
        ...item("settings", { href: "/dashboard/settings", label: "Settings", icon: "Settings" }),
      ],
    },
    {
      label: "Business",
      items: [
        ...item("website", { href: "/dashboard/website", label: "Website", icon: "Globe" }),
        ...item("analytics", { href: "/dashboard/analytics", label: "Analytics", icon: "ChartLine" }),
        ...item("payments", { href: "/dashboard/payments", label: "Payments", icon: "CreditCard" }),
        ...item("health", { href: "/dashboard/health", label: "Health", icon: "Activity", badge: health.recentProblems, tone: "danger" }),
      ],
    },
  ].filter((g) => g.items.length);

  return (
    <div className="min-h-dvh lg:flex">
      <DashboardNav
        brand={salon.brand_name?.split(" ")[0] ?? "Shanaya"}
        groups={groups}
        studios={salons.map((s) => ({ id: s.id, label: s.area ?? s.name, city: s.city ?? "Studios" }))}
        current={isAll ? "all" : salon.id}
        allowAll={canSeeAll}
        user={user.email ?? ""}
        signOut={signOut}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 xl:px-12">
        {salon.is_placeholder && !isAll && can(role, "settings") && (
          <Link href="/dashboard/settings" className="mb-6 block rounded-2xl border border-champagne bg-[#f6efe3] px-4 py-3 text-sm text-brass-ink hover:bg-[#f1e7d6]">
            <strong className="font-medium">This studio still has sample contact details.</strong> Add its real address and phone in Settings (and real team names in Team &amp; hours) before guests call. Until then Shanaya won&apos;t read them out.
          </Link>
        )}
        {children}
      </main>
      <LiveRefresh salonId={salon.id} />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:flex" aria-busy="true">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line px-6 py-6 lg:flex">
        <p className="display-cut text-[1.625rem]">&nbsp;</p>
        <div className="h-10 animate-pulse rounded-xl bg-linen" />
        <div className="grid gap-2">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-xl bg-linen/70" />)}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 xl:px-12">
        <div className="h-10 w-72 animate-pulse rounded-xl bg-linen" />
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-linen/70" />)}
        </div>
      </main>
    </div>
  );
}
