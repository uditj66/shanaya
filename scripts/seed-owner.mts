// Creates (or resets) a demo owner login for the Lumière demo salon.
//   npm run seed:owner
// The email/password are written to .env.local (DEMO_OWNER_EMAIL / DEMO_OWNER_PASSWORD), never printed.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ENV = ".env.local";
const env = readFileSync(ENV, "utf8");
const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
if (!key) {
  console.error("Add SUPABASE_SERVICE_ROLE_KEY to .env.local first.");
  process.exit(1);
}
const SALON_ID = "11111111-1111-1111-1111-111111111111";
const email = get("DEMO_OWNER_EMAIL") || "owner@lumiere-demo.test";
const password = get("DEMO_OWNER_PASSWORD") || randomBytes(12).toString("base64url");

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
let user = list?.users.find((u) => u.email === email);
if (user) {
  await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
} else {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}
const { error } = await db.from("salon_members").upsert({ salon_id: SALON_ID, user_id: user!.id, role: "owner" });
if (error) throw error;

let next = env;
for (const [k, v] of [["DEMO_OWNER_EMAIL", email], ["DEMO_OWNER_PASSWORD", password]]) {
  next = new RegExp(`^${k}=`, "m").test(next) ? next.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : `${next.trimEnd()}\n${k}=${v}\n`;
}
writeFileSync(ENV, next);
console.log(`Demo owner ready for "Lumière Facial Studio". Login details saved in ${ENV} (DEMO_OWNER_EMAIL / DEMO_OWNER_PASSWORD).`);
