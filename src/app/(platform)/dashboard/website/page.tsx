import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import manifest from "../../../../../public/images/manifest.json";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Card, Empty, PageHeader } from "@/components/dashboard-ui";
import { COLLECTIONS, type ImageOption, type Row } from "@/lib/dashboard/website-config";
import { CollectionEditor } from "./editor";

const images: ImageOption[] = (manifest as { images: ImageOption[] }).images.map(({ id, file, alt }) => ({ id, file, alt }));
const pick = (r: Record<string, unknown>, names: string[]) => Object.fromEntries(names.map((n) => [n, r[n] ?? null]));

async function Website({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireArea("website");
  const { tab: raw } = await searchParams;
  const c = COLLECTIONS.find((x) => x.key === raw) ?? COLLECTIONS[0];
  const brandId = s.salon.brand_id;
  if (!brandId) {
    return (
      <div>
        <PageHeader title="Website" />
        <Card><Empty>This studio isn&apos;t part of a brand website yet.</Empty></Card>
      </div>
    );
  }
  const names = c.fields.map((f) => f.name);
  const { data: studioRows } = await s.supabase.from("salons").select("id, area, city, name").eq("brand_id", brandId).order("city");
  const studios = (studioRows ?? []).map((x) => ({ id: x.id, label: [x.area, x.city].filter(Boolean).join(", ") || x.name }));
  const studioLabel = new Map(studios.map((x) => [x.id, x.label]));

  let rows: Row[] = [];
  const db = s.supabase;
  switch (c.table) {
    case "brands": {
      const { data } = await db.from("brands").select("*").eq("id", brandId).single();
      if (data) rows = [{ id: data.id, label: data.full_name, sub: data.tagline, values: pick(data, names) }];
      break;
    }
    case "service_content": {
      // Names come from the flagship's menu (the same catalogue codes run in every studio).
      const [{ data }, { data: svc }] = await Promise.all([
        db.from("service_content").select("*").eq("brand_id", brandId).order("sort_order"),
        db.from("services").select("code, name, category").in("salon_id", studios.map((x) => x.id)).limit(2000),
      ]);
      const byCode = new Map((svc ?? []).map((x) => [x.code, x]));
      rows = (data ?? []).map((r) => ({ id: r.code, label: byCode.get(r.code)?.name ?? r.code, sub: [byCode.get(r.code)?.category, r.headline].filter(Boolean).join(" · "), values: pick(r, names) }));
      break;
    }
    case "staff": {
      const { data } = await db.from("staff").select("*").in("salon_id", studios.map((x) => x.id)).eq("active", true).order("name");
      rows = (data ?? []).map((r) => ({ id: r.id, label: r.name, sub: [r.title, studioLabel.get(r.salon_id)].filter(Boolean).join(" · "), values: pick(r, names) }));
      break;
    }
    default: {
      const { data } = await db.from(c.table).select("*").eq("brand_id", brandId).order("sort_order");
      rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: String(r[c.titleField] ?? "Untitled"), values: pick(r, names) }));
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Brand-wide" title="Website" subtitle="Edit what guests see on the website. Changes go live within seconds of saving." />
      <nav className="mb-6 flex gap-1.5 overflow-x-auto pb-1 text-sm" aria-label="Website sections">
        {COLLECTIONS.map((x) => (
          <Link key={x.key} href={`/dashboard/website?tab=${x.key}` as Route} aria-current={x.key === c.key ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-1.5 ${x.key === c.key ? "bg-charcoal text-ivory" : "text-stone ring-1 ring-line hover:text-charcoal"}`}>
            {x.label}
          </Link>
        ))}
      </nav>
      <p className="mb-5 max-w-2xl text-sm text-stone">{c.intro}</p>
      <CollectionEditor key={c.key} collectionKey={c.key} fields={c.fields} rows={rows} canAdd={c.canAdd} studios={studios} images={images} single={c.key === "brand"} />
    </div>
  );
}

export default function Page(props: Parameters<typeof Website>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Website {...props} />
    </Suspense>
  );
}
