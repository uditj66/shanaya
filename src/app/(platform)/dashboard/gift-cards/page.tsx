import { Suspense } from "react";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Badge, Card, Empty, PageHeader, Stat, money } from "@/components/dashboard-ui";
import { RedeemDesk } from "./redeem-desk";

async function GiftCards() {
  const s = await requireArea("giftcards");
  const brandId = s.salon.brand_id;
  const tz = s.salon.timezone;
  const { data: cards } = brandId
    ? await s.supabase
        .from("gift_cards")
        .select("id, code, recipient_name, sender_name, sender_phone, amount, balance, status, created_at, expires_at")
        .eq("brand_id", brandId)
        .neq("status", "pending")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const list = cards ?? [];
  const sold = list.reduce((t, c) => t + Number(c.amount), 0);
  const outstanding = list.filter((c) => c.status === "active").reduce((t, c) => t + Number(c.balance), 0);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Brand-wide" title="Gift cards" subtitle="Look up a guest's gift card and take today's bill off the balance. Cards bought on the website appear here instantly." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Gift cards sold" value={list.length} hint="Latest 100" />
        <Stat label="Value sold" value={money(sold, s.salon.currency)} />
        <Stat label="Unused balance" value={money(outstanding, s.salon.currency)} hint="Still to be redeemed" />
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <h2 className="display-cut mb-4 text-[1.375rem]">Redeem</h2>
          <RedeemDesk canRedeem={!s.isAll} />
        </Card>
        <Card className="overflow-x-auto p-0 xl:col-span-3">
          <h2 className="display-cut px-5 pt-5 text-[1.375rem]">Recent gift cards</h2>
          {list.length ? (
            <table className="mt-3 w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.75rem] text-stone">
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-3 py-2.5 font-medium">For / from</th>
                  <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-mono text-xs tracking-[0.1em]">
                      {c.code}
                      <p className="mt-0.5 font-sans tracking-normal text-stone">{formatInTimeZone(new Date(c.created_at), tz, "d MMM yyyy")}</p>
                    </td>
                    <td className="px-3 py-3">{c.recipient_name}<p className="text-xs text-stone">from {c.sender_name} · +{c.sender_phone}</p></td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(c.balance, s.salon.currency)}<p className="text-xs text-stone">of {money(c.amount, s.salon.currency)}</p></td>
                    <td className="px-5 py-3"><Badge tone={c.status === "active" ? "confirmed" : "done"}>{c.status === "redeemed" ? "used" : c.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No gift cards sold yet.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <GiftCards />
    </Suspense>
  );
}
