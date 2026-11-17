import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { Chat } from "./chat";

// ISR: the salon's widget details are cached and refreshed when Settings saves (tag `salon:<slug>`).
async function widgetSalon(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`salon:${slug}`);
  const { data } = await adminClient().from("salons").select("name, agent_name, widget_enabled").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateStaticParams() {
  return [{ slug: "lumiere" }];
}

export default function WidgetPage({ params }: PageProps<"/w/[slug]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-ivory" />}>
      <Widget params={params} />
    </Suspense>
  );
}

async function Widget({ params }: Pick<PageProps<"/w/[slug]">, "params">) {
  const { slug } = await params;
  const salon = await widgetSalon(slug);
  if (!salon || !salon.widget_enabled) notFound();
  return <Chat slug={slug} salonName={salon.name} agentName={salon.agent_name} />;
}
