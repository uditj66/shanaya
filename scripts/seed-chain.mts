// Loads the Lumière chain from supabase/data/lumiere-catalogue.json into every branch.
// Safe to re-run: it updates in place, so all branches stay on the same SOP catalogue.
//
//   npm run seed:chain -- --admin you@example.com
//
// --admin  gives that existing login owner access to every branch (one admin for the whole chain).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const db = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const data = JSON.parse(readFileSync("supabase/data/lumiere-catalogue.json", "utf8"));
const adminEmail = process.argv[process.argv.indexOf("--admin") + 1];
if (!process.argv.includes("--admin") || !adminEmail) {
  console.error("Usage: npm run seed:chain -- --admin you@example.com");
  process.exit(1);
}

type Svc = { code: string; name: string; category: string; price: number; minutes: number; buffer: number; description: string; suitable_for?: string[]; add_ons?: string[]; consultation_first?: boolean; provider_note?: string; skill?: string };
type Pkg = { code: string; name: string; occasion: string; for: string[]; price: number; visits: number; validity_days?: number; includes: string[]; description: string };
type Branch = { code: string; slug: string; legacy_slug?: string; city: string; area: string; address: string; std: string; flagship?: boolean };
type Role = { role: string; skills: string[]; shift: [string, string]; color: string };

const must = <T,>(r: { data: T; error: unknown }) => {
  if (r.error) throw r.error;
  return r.data;
};

// deterministic pseudo-random per branch, so re-runs give the same names and numbers
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

function placeholderPhone(b: Branch) {
  const r = rng(`phone-${b.code}`);
  const rest = 10 - b.std.length;
  let digits = String(4 + Math.floor(r() * 2) * 2); // starts with 4 or 6, like city landlines
  while (digits.length < rest) digits += Math.floor(r() * 10);
  const half = Math.ceil(rest / 2);
  return `+91 ${b.std} ${digits.slice(0, half)} ${digits.slice(half)}`;
}

function teamNames(b: Branch, team: Role[]) {
  if (b.flagship) return ["Ananya", "Meera", "Dr. Ritika Sharma", "Kavya", "Farah", "Jasmine", "Payal"];
  const r = rng(`team-${b.code}`);
  const pool = [...data.first_names];
  return team.map((t) => {
    const name = pool.splice(Math.floor(r() * pool.length), 1)[0];
    return t.role === "Aesthetic Physician" ? `Dr. ${name}` : name;
  });
}

const packageMinutes = (p: Pkg, svcs: Svc[]) => Math.min(240, p.includes.reduce((m, c) => m + (svcs.find((s) => s.code === c)?.minutes ?? 0), 0));

async function main() {
  const brand = data.brand;
  const team: Role[] = data.team_template;
  const services: Svc[] = data.services;
  const packages: Pkg[] = data.packages;
  const branches: Branch[] = data.branches;

  // admin login
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const admin = users?.users.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());
  if (!admin) throw new Error(`No login found for ${adminEmail}. Sign up in the app first.`);

  // single-visit packages become bookable "services"; multi-visit ones need a consultation
  const packageServices: Svc[] = packages.map((p) => ({
    code: p.code,
    name: `${p.name} (package)`,
    category: "Occasion Packages",
    price: p.price,
    minutes: packageMinutes(p, services),
    buffer: 15,
    description: `${p.description}${p.visits > 1 ? ` ${p.visits} visits within ${p.validity_days ?? 60} days.` : ""}`,
    suitable_for: [p.occasion.toLowerCase(), ...p.for],
    consultation_first: p.visits > 1,
    provider_note: p.visits > 1 ? "Multi-visit programme: our team plans the visit dates with you in a short consultation." : "All treatments in one relaxed visit.",
  }));
  const allServices = [...services, ...packageServices];

  for (const b of branches) {
    // 1. branch (salon) record
    let salon =
      must(await db.from("salons").select("id, slug").eq("branch_code", b.code).maybeSingle()) ??
      (b.legacy_slug ? must(await db.from("salons").select("id, slug").eq("slug", b.legacy_slug).maybeSingle()) : null);
    const fields = {
      name: `${brand.name} · ${b.area}`,
      slug: b.slug,
      brand_name: brand.name,
      city: b.city,
      area: b.area,
      address: b.address,
      phone: placeholderPhone(b),
      branch_code: b.code,
      is_placeholder: true,
      timezone: brand.timezone,
      currency: brand.currency,
      business_hours: brand.business_hours,
      slot_interval_minutes: brand.slot_interval_minutes,
      min_notice_minutes: brand.min_notice_minutes,
      max_days_ahead: brand.max_days_ahead,
      agent_name: brand.agent_name,
      policies: brand.policies.join("\n"),
      agent_instructions: brand.extra_information.join("\n"),
      guest_profiles: data.guest_profiles,
      widget_enabled: true,
    };
    if (salon) must(await db.from("salons").update(fields).eq("id", salon.id));
    else salon = must(await db.from("salons").insert(fields).select("id, slug").single());
    const salonId = salon!.id;

    // 2. one admin for the whole chain
    must(await db.from("salon_members").upsert({ salon_id: salonId, user_id: admin.id, role: "owner" }, { onConflict: "salon_id,user_id" }));

    // 3. standard team (7 roles), with weekly offs spread out
    const names = teamNames(b, team);
    const existingStaff = must(await db.from("staff").select("id, name").eq("salon_id", salonId)) ?? [];
    const staffIds: string[] = [];
    for (let i = 0; i < team.length; i++) {
      const row = { salon_id: salonId, name: names[i], title: team[i].role, color: team[i].color, active: true, sort_order: i + 1 };
      const found = existingStaff.find((s) => s.name === names[i]);
      const saved = found
        ? must(await db.from("staff").update(row).eq("id", found.id).select("id").single())
        : must(await db.from("staff").insert(row).select("id").single());
      staffIds.push(saved!.id);
    }
    // retire staff that are not part of the standard team (keep history if they have bookings)
    for (const s of existingStaff.filter((x) => !names.includes(x.name))) {
      const { count } = await db.from("bookings").select("*", { count: "exact", head: true }).eq("staff_id", s.id);
      if (count) must(await db.from("staff").update({ active: false }).eq("id", s.id));
      else must(await db.from("staff").delete().eq("id", s.id));
    }
    must(await db.from("staff_hours").delete().in("staff_id", staffIds));
    const offset = Math.floor(rng(`off-${b.code}`)() * 7);
    const hours = staffIds.flatMap((id, i) =>
      [0, 1, 2, 3, 4, 5, 6]
        .filter((d) => d !== (offset + i * 3) % 7) // one weekly off, staggered across the team
        .map((d) => ({ salon_id: salonId, staff_id: id, weekday: d, start_time: team[i].shift[0], end_time: team[i].shift[1] })),
    );
    must(await db.from("staff_hours").insert(hours));

    // 4. standard service menu (old non-SOP services are hidden, not deleted, to keep booking history)
    must(await db.from("services").update({ active: false }).eq("salon_id", salonId).is("code", null));
    const existingSvc = must(await db.from("services").select("id, code").eq("salon_id", salonId).not("code", "is", null)) ?? [];
    const svcId = new Map<string, string>();
    for (const [i, s] of allServices.entries()) {
      const row = {
        salon_id: salonId,
        code: s.code,
        name: s.name,
        category: s.category,
        description: s.description,
        duration_minutes: s.minutes,
        buffer_minutes: s.buffer,
        price: s.price,
        active: true,
        sort_order: i + 1,
        suitable_for: s.suitable_for ?? [],
        add_ons: s.add_ons ?? [],
        consultation_first: !!s.consultation_first,
        provider_note: s.provider_note ?? null,
      };
      const found = existingSvc.find((x) => x.code === s.code);
      const saved = found
        ? must(await db.from("services").update(row).eq("id", found.id).select("id").single())
        : must(await db.from("services").insert(row).select("id").single());
      svcId.set(s.code, saved!.id);
    }

    // 5. who performs what (by skill)
    must(await db.from("staff_services").delete().eq("salon_id", salonId));
    const links = allServices.flatMap((s) =>
      team
        .map((t, i) => ({ t, id: staffIds[i] }))
        .filter(({ t }) => t.skills.includes(s.skill ?? s.category))
        .map(({ id }) => ({ salon_id: salonId, staff_id: id, service_id: svcId.get(s.code)! })),
    );
    must(await db.from("staff_services").insert(links));

    // 6. occasion packages
    must(
      await db.from("packages").upsert(
        packages.map((p) => ({
          salon_id: salonId,
          code: p.code,
          name: p.name,
          occasion: p.occasion,
          target_customers: p.for,
          price: p.price,
          visits: p.visits,
          validity_days: p.validity_days ?? null,
          description: p.description,
          included_codes: p.includes,
          service_id: svcId.get(p.code) ?? null,
          active: true,
        })),
        { onConflict: "salon_id,code" },
      ),
    );
    console.log(`✓ ${b.code.padEnd(8)} ${fields.name}  (${allServices.length} services, ${packages.length} packages, ${team.length} team)`);
  }
  console.log(`\nDone: ${branches.length} branches. ${adminEmail} is owner of every branch.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
