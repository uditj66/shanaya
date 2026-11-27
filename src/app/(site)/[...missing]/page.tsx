import { Suspense } from "react";
import { notFound } from "next/navigation";

// Any unknown URL renders the website's own 404 (inside the site layout, marked noindex) instead of the
// framework default. Resolving inside <Suspense>, like every other dynamic route, keeps the static shell valid under
// Cache Components / partial prerendering (without it the route fails to render on Vercel).
export default function Missing({ params }: PageProps<"/[...missing]">) {
  return (
    <Suspense fallback={null}>
      <NotFound params={params} />
    </Suspense>
  );
}

async function NotFound({ params }: Pick<PageProps<"/[...missing]">, "params">) {
  await params;
  notFound();
  return null;
}
