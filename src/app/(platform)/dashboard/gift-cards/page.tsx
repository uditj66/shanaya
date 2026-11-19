import { Suspense } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Gift, IndianRupee, WalletCards } from "lucide-react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import {
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Section,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  money,
} from "@/components/admin/kit";
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
      <PageHeader eyebrow="Brand-wide" title="Gift cards" description="Look up a guest's gift card and take today's bill off the balance. Cards bought on the website appear here instantly." />
      <section aria-label="Gift cards at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={Gift} label="Gift cards sold" value={list.length} hint="Latest 100" />
        <StatCard icon={IndianRupee} label="Value sold" value={money(sold, s.salon.currency)} />
        <StatCard icon={WalletCards} label="Unused balance" value={money(outstanding, s.salon.currency)} hint="Still to be redeemed" />
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-5">
        <Section className="xl:col-span-2" title="Redeem" description="Find a card by its code">
          <RedeemDesk canRedeem={!s.isAll} />
        </Section>
        <Card className="gap-4 overflow-hidden pb-0 xl:col-span-3 [&_[data-slot=table-container]]:overflow-x-auto">
          <CardHeader>
            <CardTitle>Recent gift cards</CardTitle>
          </CardHeader>
          {list.length ? (
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Code</TableHead>
                  <TableHead>For / from</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6 align-top">
                      <span className="font-mono text-xs tracking-[0.1em]">{c.code}</span>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatInTimeZone(new Date(c.created_at), tz, "d MMM yyyy")}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      {c.recipient_name}
                      <p className="text-xs text-muted-foreground">from {c.sender_name} · +{c.sender_phone}</p>
                    </TableCell>
                    <TableCell className="tabular text-right align-top">
                      {money(c.balance, s.salon.currency)}
                      <p className="text-xs text-muted-foreground">of {money(c.amount, s.salon.currency)}</p>
                    </TableCell>
                    <TableCell className="pr-6 align-top">
                      <StatusBadge status={c.status}>{c.status === "redeemed" ? "used" : c.status}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={Gift} title="No gift cards sold yet" className="pb-12" />
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
