"use client";
import { useState } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as m from "motion/react-m";
import { brandHref } from "@/lib/brand/href";
import { Button } from "@/components/ui/button";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";
import type { NAV } from "./site-header";

/** Full-screen ivory menu for phones and tablets: large serif links, staggered in. */
export function MobileMenu({ name, items }: { name: string; items: typeof NAV }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button aria-label="Open menu" className="grid size-11 place-items-center rounded-full text-charcoal hover:bg-linen lg:hidden">
          <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
            <path d="M0 1h22M6 9h16" stroke="currentColor" strokeWidth="1.25" />
          </svg>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col bg-ivory data-[state=open]:animate-[fade-in_300ms_var(--ease-out-soft)] data-[state=closed]:animate-[fade-out_200ms_var(--ease-ui)]">
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Site navigation</DialogPrimitive.Description>
          <div className="container-page flex h-16 items-center justify-between border-b border-line/70">
            <span className="display-cut text-[1.625rem]">{name}</span>
            <DialogPrimitive.Close aria-label="Close menu" className="grid size-11 place-items-center rounded-full hover:bg-linen">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m2 2 12 12M14 2 2 14" stroke="currentColor" strokeWidth="1.25" />
              </svg>
            </DialogPrimitive.Close>
          </div>
          <nav aria-label="Main" className="container-page flex-1 overflow-y-auto py-10">
            <ul className="grid gap-2">
              {items.map((n, i) => (
                <m.li key={n.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT_SOFT, delay: 0.08 + i * 0.06 }}>
                  <Link href={brandHref(n.href)} onClick={() => setOpen(false)} className="display-cut block py-2 text-h2">
                    {n.label}
                  </Link>
                </m.li>
              ))}
            </ul>
            <ul className="mt-10 grid gap-1 border-t border-line pt-8 text-stone">
              {(
                [
                  ["/about", "Our story"],
                  ["/gift-cards", "Gift cards"],
                  ["/careers", "Careers"],
                  ["/contact", "Contact"],
                ] as const
              ).map(([href, label]) => (
                <li key={href}>
                  <Link href={brandHref(href)} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="container-page border-t border-line py-5">
            <Button asChild size="lg" className="w-full">
              <Link href={brandHref("/book")} onClick={() => setOpen(false)}>
                Book a ritual
              </Link>
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
