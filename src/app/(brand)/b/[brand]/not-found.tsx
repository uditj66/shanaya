import Link from "next/link";
import { brandHref } from "@/lib/brand/href";
import { Button } from "@/components/ui/button";

export default function BrandNotFound() {
  return (
    <section className="container-page grid min-h-[70dvh] content-center py-24">
      <p className="eyebrow">Page not found</p>
      <h1 className="display-cut mt-5 text-display-l">This room is quiet.</h1>
      <p className="mt-6 max-w-[44ch] text-lead text-stone">The page you were looking for has moved or no longer exists.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg"><Link href={brandHref("/")}>Back to home</Link></Button>
        <Button asChild size="lg" variant="quiet"><Link href={brandHref("/services")}>Browse treatments</Link></Button>
      </div>
    </section>
  );
}
