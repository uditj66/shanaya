import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "../database.types";

/** Same rule as the website: sample rows show in development and previews, never on the live site unless asked. */
const showSamples = () => process.env.SHOW_SAMPLE_CONTENT === "true" || (process.env.NODE_ENV !== "production" && process.env.SHOW_SAMPLE_CONTENT !== "false");

export type SisterBranch = Pick<Tables<"salons">, "id" | "name" | "slug" | "city" | "area" | "address" | "phone" | "is_placeholder" | "business_hours">;

export type SalonContext = {
  salon: Tables<"salons">;
  services: Tables<"services">[];
  staff: Pick<Tables<"staff">, "id" | "name" | "title">[];
  packages: Tables<"packages">[];
  branches: SisterBranch[]; // other branches of the same brand (so Shanaya can refer callers)
  team?: { salon_id: string; name: string; title: string | null }[]; // every therapist/doctor/beautician across the brand
  memberships?: Pick<Tables<"memberships">, "name" | "price" | "period" | "benefits" | "discount_pct" | "skip_deposit" | "included_per_period" | "included_period" | "included_categories">[];
  giftCards?: boolean; // the brand sells gift cards that can pay for bookings
};

/** Everything the agent needs to know about one branch. */
export async function loadSalonContext(db: SupabaseClient<Database>, salonId: string): Promise<SalonContext | null> {
  const [{ data: salon }, { data: services }, { data: staff }, { data: packages }] = await Promise.all([
    db.from("salons").select("*").eq("id", salonId).maybeSingle(),
    db.from("services").select("*").eq("salon_id", salonId).eq("active", true).order("sort_order"),
    db.from("staff").select("id, name, title").eq("salon_id", salonId).eq("active", true).order("sort_order"),
    db.from("packages").select("*").eq("salon_id", salonId).eq("active", true).order("code"),
  ]);
  if (!salon) return null;
  const { data: branches } = salon.brand_name
    ? await db
        .from("salons")
        .select("id, name, slug, city, area, address, phone, is_placeholder, business_hours")
        .eq("brand_name", salon.brand_name)
        .neq("id", salon.id)
        .order("city")
    : { data: [] as SisterBranch[] };
  const ids = [salon.id, ...(branches ?? []).map((b) => b.id)];
  const [{ data: team }, { data: memberships }] = await Promise.all([
    db.from("staff").select("salon_id, name, title").in("salon_id", ids).eq("active", true).order("sort_order"),
    salon.brand_id
      ? (() => {
          // Only tiers the website shows (and sells): sample tiers are hidden on the live site.
          const q = db.from("memberships").select("name, price, period, benefits, discount_pct, skip_deposit, included_per_period, included_period, included_categories").eq("brand_id", salon.brand_id).eq("published", true);
          return (showSamples() ? q : q.eq("is_sample", false)).order("sort_order");
        })()
      : Promise.resolve({ data: [] as NonNullable<SalonContext["memberships"]> }),
  ]);
  return {
    salon, services: services ?? [], staff: staff ?? [], packages: packages ?? [], branches: branches ?? [], team: team ?? [],
    memberships: memberships ?? [], giftCards: !!salon.brand_id,
  };
}

/** "Lumière Facial Studio & Spa, Bandra West" — how the branch introduces itself. */
export function displayName(s: Pick<Tables<"salons">, "name" | "brand_name" | "area">) {
  return s.brand_name && s.area ? `${s.brand_name}, ${s.area}` : s.name;
}
