import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { TriangleAlert } from "lucide-react";
import { can, requireSalon, type Area } from "@/lib/session";
import { healthEvents } from "@/lib/health";
import { AppSidebar, type NavGroup, type NavItem } from "@/components/admin/app-sidebar";
import { SiteHeader } from "@/components/admin/site-header";
import { SidebarInset, SidebarProvider } from "@/components/admin/ui/sidebar";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Toaster } from "@/components/admin/ui/sonner";
import { signOut } from "../login/actions";
import { LiveRefresh } from "./live-refresh";
import { switchSalon } from "./switch-action";

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

  const [{ count: openCallbacks }, { count: newLeads }, health, jar] = await Promise.all([
    supabase.from("callbacks").select("*", { count: "exact", head: true }).in("salon_id", scopeIds).eq("status", "open"),
    salon.brand_id
      ? supabase.from("leads").select("*", { count: "exact", head: true }).eq("brand_id", salon.brand_id).eq("status", "new")
      : Promise.resolve({ count: 0 }),
    can(role, "health") ? healthEvents(supabase, salon.id, role) : Promise.resolve({ recentProblems: 0 }),
    cookies(),
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
    <SidebarProvider defaultOpen={jar.get("sidebar_state")?.value !== "false"}>
      <AppSidebar
        brand={salon.brand_name?.split(" ")[0] ?? "Shanaya"}
        groups={groups}
        studios={salons.map((s) => ({ id: s.id, label: s.area ?? s.name, city: s.city ?? "Studios" }))}
        current={isAll ? "all" : salon.id}
        allowAll={canSeeAll}
        user={user.email ?? ""}
        signOut={signOut}
        switchSalon={switchSalon}
      />
      <SidebarInset className="min-w-0">
        <SiteHeader groups={groups} />
        <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-6 md:px-6 lg:px-8">
          {salon.is_placeholder && !isAll && can(role, "settings") && (
            <Link
              href="/dashboard/settings"
              className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                <strong className="font-medium">This studio still has sample contact details.</strong>{" "}
                <span className="text-muted-foreground">
                  Add its real address and phone in Settings (and real team names in Team &amp; hours) before guests call. Until then
                  Shanaya won&apos;t read them out.
                </span>
              </span>
            </Link>
          )}
          {children}
        </main>
      </SidebarInset>
      <LiveRefresh salonId={salon.id} />
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r bg-sidebar p-3 md:flex">
        <Skeleton className="h-12 rounded-lg" />
        <div className="grid gap-2 pt-4">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-8 rounded-md" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="h-14 border-b" />
        <div className="px-4 py-6 md:px-6 lg:px-8">
          <Skeleton className="h-8 w-64" />
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
