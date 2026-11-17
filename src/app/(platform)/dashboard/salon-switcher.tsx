"use client";
import Link from "next/link";
import { useTransition } from "react";
import { switchSalon } from "./switch-action";

type SalonOption = { id: string; name: string; slug: string };

/** Sidebar dropdown to move between the salons this login belongs to. */
export function SalonSwitcher({ salons, currentId }: { salons: SalonOption[]; currentId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <label htmlFor="salon-switcher" className="sr-only">Switch salon</label>
      <select
        id="salon-switcher"
        value={currentId}
        disabled={pending}
        onChange={(e) => start(() => switchSalon(e.target.value))}
        className="w-full cursor-pointer rounded-lg border border-line bg-ivory px-2 py-1.5 font-serif text-lg font-semibold outline-none focus:border-gold disabled:opacity-60"
      >
        {salons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.slug})
          </option>
        ))}
      </select>
      <Link href="/onboarding?new=1" className="block px-1 text-xs text-muted hover:text-gold-dark">
        + Add another salon
      </Link>
    </div>
  );
}
