import Link from "next/link";
import { brandHref, type BrandPath } from "@/lib/brand/href";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "./mobile-menu";

export const NAV: { href: BrandPath; label: string }[] = [
  { href: "/services", label: "Treatments" },
  { href: "/occasions", label: "Occasions" },
  { href: "/studios", label: "Studios" },
  { href: "/team", label: "Specialists" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/offers", label: "Offers" },
];

/** Sticky header, anchored during page transitions. Desktop: links | wordmark | book. Phone: wordmark | book + menu. */
export function SiteHeader({ name }: { name: string }) {
  return (
    <header style={{ viewTransitionName: "site-header" }} className="sticky top-0 z-40 border-b border-line/70 bg-ivory/88 backdrop-blur-md">
      <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center md:h-20">
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex gap-7">
            {NAV.slice(0, 4).map((n) => (
              <li key={n.href}>
                <Link href={brandHref(n.href)} className="relative py-2 text-[0.8125rem] tracking-[0.04em] text-stone transition-colors hover:text-charcoal">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lg:hidden" />
        <Link href={brandHref("/")} className="display-cut justify-self-center text-[1.625rem] leading-none tracking-[0.02em] md:text-[1.875rem]" aria-label={`${name}, home`}>
          {name}
        </Link>
        <div className="flex items-center justify-end gap-2 md:gap-5">
          <nav aria-label="More" className="hidden lg:block">
            <ul className="flex gap-7">
              {NAV.slice(4).map((n) => (
                <li key={n.href}>
                  <Link href={brandHref(n.href)} className="py-2 text-[0.8125rem] tracking-[0.04em] text-stone transition-colors hover:text-charcoal">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={brandHref("/book")}>Book</Link>
          </Button>
          <MobileMenu name={name} />
        </div>
      </div>
    </header>
  );
}
