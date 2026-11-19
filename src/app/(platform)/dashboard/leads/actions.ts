"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/session";

const Input = z.object({
  table: z.enum(["leads", "gift_card_requests", "job_applications"]),
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "converted", "closed"]),
});

/** Move an enquiry along the pipeline. Row level security limits it to the team's own brand. */
export async function setEnquiryStatus(input: z.input<typeof Input>): Promise<{ ok: boolean }> {
  const v = Input.safeParse(input);
  if (!v.success) return { ok: false };
  const s = await requireArea("leads");
  if (v.data.table === "job_applications" && !(s.role === "owner" || s.role === "manager")) return { ok: false };
  const brandId = s.salon.brand_id;
  if (!brandId) return { ok: false };
  const { error } = await s.supabase.from(v.data.table).update({ status: v.data.status }).eq("id", v.data.id).eq("brand_id", brandId);
  if (error) return { ok: false };
  revalidatePath("/dashboard", "layout"); // the nav badge counts new leads
  return { ok: true };
}
