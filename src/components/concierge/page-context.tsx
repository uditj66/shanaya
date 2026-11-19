"use client";
import { useEffect, useSyncExternalStore } from "react";

/**
 * What the guest is looking at, so Shanaya (and her nudges) can be contextual.
 * Pages render <ConciergePage …/>; the launcher and the chat read it. Only slugs travel to the server, where they are
 * checked against the database before reaching the prompt.
 */
export type ConciergePageInfo = {
  kind: "home" | "service" | "studio" | "booking" | "other";
  service?: string; // slug
  studio?: string; // slug
  name?: string; // display name for nudges (never sent to the server)
  bookingStep?: number; // 0-3 while in the booking flow
};

let current: ConciergePageInfo = { kind: "other" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setConciergePage(info: ConciergePageInfo) {
  current = info;
  emit();
}
export const getConciergePage = () => current;
export function useConciergePage() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => current,
  );
}

/** Drop into any page: <ConciergePage kind="service" service="hydrafacial" name="HydraFacial" />. Renders nothing. */
export function ConciergePage(props: ConciergePageInfo) {
  const { kind, service, studio, name, bookingStep } = props;
  useEffect(() => {
    setConciergePage({ kind, service, studio, name, bookingStep });
    return () => {
      // Leaving the booking flow part-way through is remembered once, so the concierge can offer to help finish.
      if (kind === "booking" && (bookingStep ?? 0) >= 1 && (bookingStep ?? 0) < 3) {
        try {
          sessionStorage.setItem("concierge:abandoned", "1");
        } catch {}
      }
      setConciergePage({ kind: "other" });
    };
  }, [kind, service, studio, name, bookingStep]);
  return null;
}
