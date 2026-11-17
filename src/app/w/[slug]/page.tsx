import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { Chat } from "./chat";

export default async function WidgetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: salon } = await adminClient().from("salons").select("name, agent_name, widget_enabled").eq("slug", slug).maybeSingle();
  if (!salon || !salon.widget_enabled) notFound();
  return <Chat slug={slug} salonName={salon.name} agentName={salon.agent_name} />;
}
