import Link from "next/link";
import { requireSalon } from "@/lib/session";
import { healthEvents } from "@/lib/health";
import { signOut } from "../login/actions";
import { LiveRefresh } from "./live-refresh";
import { SalonSwitcher } from "./salon-switcher";

const nav = [
  ["/dashboard", "Today"],
  ["/dashboard/bookings", "Bookings"],
  ["/dashboard/calls", "Calls & chats"],
  ["/dashboard/callbacks", "Call-backs"],
  ["/dashboard/customers", "Guests"],
  ["/dashboard/services", "Services"],
  ["/dashboard/team", "Team & hours"],
  ["/dashboard/health", "Health"],
  ["/dashboard/settings", "Settings"],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { salon, salons, user, supabase, role } = await requireSalon();
  const { count: openCallbacks } = await supabase
    .from("callbacks")
    .select("*", { count: "exact", head: true })
    .eq("salon_id", salon.id)
    .eq("status", "open");
  // same count as the Health page (branch + chain-wide problems for owners, daily limits excluded)
  const { recentProblems: recentIssues } = await healthEvents(supabase, salon.id, role);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="px-4 py-5">
          <p className="mb-1 px-1 text-[10px] uppercase tracking-[0.3em] text-gold">Shanaya</p>
          <SalonSwitcher salons={salons} currentId={salon.id} />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-sm text-muted hover:bg-cream hover:text-ink">
              {label}
              {href === "/dashboard/callbacks" && !!openCallbacks && (
                <span className="ml-2 rounded-full bg-gold px-1.5 text-[11px] font-semibold text-white">{openCallbacks}</span>
              )}
              {href === "/dashboard/health" && !!recentIssues && (
                <span className="ml-2 rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">{recentIssues}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 py-4 text-xs text-muted md:absolute md:bottom-0 md:block">
          <p className="truncate">{user.email}</p>
          <form action={signOut}><button className="mt-1 hover:text-ink">Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        {salon.is_placeholder && (
          <Link href="/dashboard/settings" className="mb-6 block rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-dark hover:bg-gold/15">
            <strong>This branch still has placeholder details.</strong> Add its real address and phone number in Settings (and real team names in Team &amp; hours) before guests call. Until then Shanaya won&apos;t read out its address or number.
          </Link>
        )}
        {children}
      </main>
      <LiveRefresh salonId={salon.id} />
    </div>
  );
}
