import { Suspense } from "react";
import type { Route } from "next";
import manifest from "../../../../../public/images/manifest.json";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Globe } from "lucide-react";
import { Card, EmptyState, PageHeader, SegmentedNav } from "@/components/admin/kit";
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
      <div className="grid gap-6">
        <PageHeader title="Website" />
        <Card className="py-0">
          <EmptyState icon={Globe} title="No brand website" description="This studio isn't part of a brand website yet." />
        </Card>
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
    <div className="grid gap-6">
      <PageHeader eyebrow="Brand-wide" title="Website" description="Edit what guests see on the website. Changes go live within seconds of saving." />
      <div className="-mt-2 grid gap-3">
        <SegmentedNav label="Website sections" items={COLLECTIONS.map((x) => ({ href: `/dashboard/website?tab=${x.key}` as Route, label: x.label, active: x.key === c.key }))} />
        <p className="max-w-2xl text-sm text-muted-foreground">{c.intro}</p>
      </div>
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
