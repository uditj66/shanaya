"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import manifest from "../../../../../public/images/manifest.json";
import { requireArea } from "@/lib/session";
import { tags } from "@/lib/brand/data";
import { collection, type Field } from "@/lib/dashboard/website-config";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

const imageIds = new Set((manifest as { images: { id: string }[] }).images.map((i) => i.id));
const nullIfEmpty = <T extends z.ZodTypeAny>(t: T) => z.preprocess((v) => (v === "" || v === undefined ? null : v), t.nullable());

/** Server-side validation built from the same field spec the form uses. */
function schemaFor(f: Field, studioIds: string[]): z.ZodTypeAny {
  switch (f.type) {
    case "text":
    case "textarea": {
      const s = z.string().trim().max(f.max ?? 200);
      return f.required ? s.min(1, `${f.label} is required`) : s;
    }
    case "number": {
      const n = z.coerce.number().min(f.min ?? 0).max(f.max ?? 1e9);
      return f.required ? n : nullIfEmpty(n);
    }
    case "bool":
      return z.boolean();
    case "lines":
    case "csv":
      return z.array(z.string().trim().min(1).max(300)).max(24);
    case "image": {
      const s = z.string().refine((v) => imageIds.has(v), "Pick a photo from the library");
      return f.required ? s : nullIfEmpty(s);
    }
    case "date":
      return nullIfEmpty(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
    case "select": {
      const s = z.enum(f.options!.map((o) => o.value) as [string, ...string[]]);
      return f.required ? s : nullIfEmpty(s);
    }
    case "studio":
      return nullIfEmpty(z.string().refine((v) => studioIds.includes(v)));
    case "faqs":
      return z.array(z.object({ q: z.string().trim().min(1).max(200), a: z.string().trim().min(1).max(1200) })).max(40);
    case "nudge":
      return z.object({
        enabled: z.boolean(),
        delay_seconds: z.coerce.number().int().min(5).max(300),
        scroll_ratio: z.coerce.number().min(0.1).max(1),
        max_per_session: z.coerce.number().int().min(0).max(5),
      });
  }
}

async function context() {
  const s = await requireArea("website");
  const brandId = s.salon.brand_id;
  if (!brandId) return null;
  const [{ data: brand }, { data: studios }] = await Promise.all([
    s.supabase.from("brands").select("id, slug").eq("id", brandId).single(),
    s.supabase.from("salons").select("id").eq("brand_id", brandId),
  ]);
  if (!brand) return null;
  return { s, brand, studioIds: (studios ?? []).map((x) => x.id) };
}

/** Create (id = null) or update one row of a website content type, then refresh that part of the public site. */
export async function saveWebsiteRow(key: string, id: string | null, values: Record<string, unknown>): Promise<SaveResult> {
  const c = collection(key);
  const ctx = await context();
  if (!c || !ctx) return { ok: false, error: "You can't edit this website." };
  if (id === null && !c.canAdd) return { ok: false, error: "This list can't be added to here." };

  const shape = Object.fromEntries(c.fields.map((f) => [f.name, schemaFor(f, ctx.studioIds)]));
  const v = z.object(shape).safeParse(values);
  if (!v.success) {
    const issue = v.error.issues[0];
    const field = c.fields.find((f) => f.name === issue?.path[0]);
    return { ok: false, error: field ? `${field.label}: ${issue.message}` : "Please check the form." };
  }
  // Columns and types are checked at runtime by the spec-built schema above.
  const data = v.data as never;
  const { supabase } = ctx.s;
  const brandId = ctx.brand.id;
  // Row level security also enforces this (brand admins only); the filters keep every write inside this brand.
  let res: { error: unknown; id?: string };
  if (c.table === "brands") {
    const r = await supabase.from("brands").update(data).eq("id", brandId);
    res = { error: r.error, id: brandId };
  } else if (c.table === "service_content") {
    const r = await supabase.from("service_content").update(data).eq("brand_id", brandId).eq("code", id ?? "");
    res = { error: r.error, id: id ?? "" };
  } else if (c.table === "staff") {
    const r = await supabase.from("staff").update(data).eq("id", id ?? "").in("salon_id", ctx.studioIds);
    res = { error: r.error, id: id ?? "" };
  } else if (id) {
    const r = await supabase.from(c.table).update(data).eq("id", id).eq("brand_id", brandId);
    res = { error: r.error, id };
  } else {
    const r = await supabase.from(c.table).insert({ ...(v.data as object), brand_id: brandId } as never).select("id").single();
    res = { error: r.error, id: (r.data as { id: string } | null)?.id };
  }
  if (res.error || !res.id) return { ok: false, error: "Couldn't save. Please try again." };
  updateTag(tags[c.tag](ctx.brand.slug));
  return { ok: true, id: res.id };
}

export async function deleteWebsiteRow(key: string, id: string): Promise<SaveResult> {
  const c = collection(key);
  const ctx = await context();
  if (!c || !ctx || !c.canAdd || !z.string().uuid().safeParse(id).success) return { ok: false, error: "This can't be deleted." };
  const { error } = await ctx.s.supabase.from(c.table as "press").delete().eq("id", id).eq("brand_id", ctx.brand.id);
  if (error) return { ok: false, error: "Couldn't delete. Please try again." };
  updateTag(tags[c.tag](ctx.brand.slug));
  return { ok: true, id };
}
