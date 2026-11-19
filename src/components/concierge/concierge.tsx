"use client";
// Floating concierge launcher + proactive nudges. This part ships with every page, so it is tiny:
// the chat panel (AI SDK, cards, voice) is a separate chunk loaded only when the guest opens it.
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";
import { useConciergePage, type ConciergePageInfo } from "./page-context";

const Panel = dynamic(() => import("./panel"), { ssr: false });

export type NudgeSettings = { enabled: boolean; delay_seconds: number; scroll_ratio: number; max_per_session: number };

const SHOWN_KEY = "concierge:nudges"; // sessionStorage: how many nudges this session
const DISMISS_KEY = "concierge:dismissed"; // localStorage: remember dismissal for 3 days
const OPENED_KEY = "concierge:opened"; // sessionStorage: she's already chatting → no nudges
const ABANDON_KEY = "concierge:abandoned";
const DISMISS_MS = 3 * 24 * 3600 * 1000;

const store = {
  get(k: string, s: Storage | null) {
    try {
      return s?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set(k: string, v: string, s: Storage | null) {
    try {
      s?.setItem(k, v);
    } catch {}
  },
};
const session = () => (typeof window === "undefined" ? null : window.sessionStorage);
const local = () => (typeof window === "undefined" ? null : window.localStorage);

type Nudge = { text: string; opener: string; cta: string };

function nudgeFor(page: ConciergePageInfo, agent: string, reason: "greeting" | "context" | "abandon" | "exit"): Nudge {
  if (reason === "abandon" || reason === "exit")
    return { text: "Shall I help you finish your booking here? I can find a time in a few seconds.", opener: "Can you help me finish my booking?", cta: "Finish in chat" };
  if (page.kind === "service" && page.name)
    return { text: `Not sure if the ${page.name} suits your skin? I can help you choose.`, opener: `Is the ${page.name} right for my skin?`, cta: "Ask me" };
  if (page.kind === "studio" && page.name)
    return { text: `Visiting ${page.name}? I can check this studio's free times for you.`, opener: `What times are free at the ${page.name} studio this week?`, cta: "Check times" };
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return { text: `${hello}. I'm ${agent}, your beauty concierge. Looking for something for your skin, or a time to visit?`, opener: "", cta: "Chat with me" };
}

export function Concierge({ brand, agentName, voiceSlug, nudge }: { brand: string; agentName: string; voiceSlug: string; nudge: NudgeSettings }) {
  const page = useConciergePage();
  const [open, setOpen] = useState(false);
  const [opener, setOpener] = useState<string | null>(null);
  const [bubble, setBubble] = useState<Nudge | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const openChat = (first?: string | null) => {
    setBubble(null);
    setOpener(first || null);
    setOpen(true);
    store.set(OPENED_KEY, "1", session());
  };
  const close = () => setOpen(false);
  useEffect(() => {
    if (wasOpen.current && !open) launcherRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Allow any element to open the chat: <button data-open-concierge="Is this right for me?">
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-open-concierge]");
      if (el) {
        e.preventDefault();
        openChat(el.dataset.openConcierge || null);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Proactive nudges: polite, at most N per session, never while chatting, remembered when dismissed.
  useEffect(() => {
    if (!nudge.enabled || open || bubble) return;
    const allowed = () => {
      if (store.get(OPENED_KEY, session())) return false;
      const dismissed = Number(store.get(DISMISS_KEY, local()) ?? 0);
      if (Date.now() - dismissed < DISMISS_MS) return false;
      return Number(store.get(SHOWN_KEY, session()) ?? 0) < nudge.max_per_session;
    };
    if (!allowed()) return;
    const show = (reason: Parameters<typeof nudgeFor>[2]) => {
      if (!allowed()) return;
      store.set(SHOWN_KEY, String(Number(store.get(SHOWN_KEY, session()) ?? 0) + 1), session());
      setBubble(nudgeFor(page, agentName, reason));
    };
    const cleanups: (() => void)[] = [];

    // 1. She left the booking flow part-way: offer to finish in chat (once).
    if (page.kind !== "booking" && store.get(ABANDON_KEY, session())) {
      try {
        sessionStorage.removeItem(ABANDON_KEY);
      } catch {}
      const t = setTimeout(() => show("abandon"), 2500);
      return () => clearTimeout(t);
    }
    // 2. Exit intent on the booking page (desktop pointer leaving through the top of the window).
    if (page.kind === "booking" && (page.bookingStep ?? 0) >= 1 && window.matchMedia("(pointer: fine)").matches) {
      const onOut = (e: MouseEvent) => !e.relatedTarget && e.clientY <= 0 && show("exit");
      document.addEventListener("mouseout", onOut);
      cleanups.push(() => document.removeEventListener("mouseout", onOut));
    }
    // 3. Treatment or studio page: a contextual line after a short read.
    if ((page.kind === "service" || page.kind === "studio") && page.name) {
      const t = setTimeout(() => show("context"), Math.max(8, nudge.delay_seconds / 2) * 1000);
      cleanups.push(() => clearTimeout(t));
    }
    // 4. Home: after ~20s on site, or half-way down the page.
    if (page.kind === "home") {
      const t = setTimeout(() => show("greeting"), nudge.delay_seconds * 1000);
      const onScroll = () => {
        const ratio = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
        if (ratio >= nudge.scroll_ratio) show("greeting");
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => clearTimeout(t), () => window.removeEventListener("scroll", onScroll));
    }
    return () => cleanups.forEach((c) => c());
  }, [page, open, bubble, nudge, agentName]);

  const dismiss = () => {
    setBubble(null);
    store.set(DISMISS_KEY, String(Date.now()), local());
  };

  // Sit above the booking flow's bottom summary bar on phones.
  const raised = page.kind === "booking";

  return (
    <>
      {!open && (
        <div className={cn("fixed right-4 z-40 flex flex-col items-end gap-3 sm:right-6", raised ? "bottom-24 lg:bottom-6" : "bottom-4 sm:bottom-6")}>
          <AnimatePresence>
            {bubble && (
              <m.div
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.5, ease: EASE_OUT_SOFT }}
                className="relative w-[min(19rem,calc(100vw-2rem))] rounded-2xl rounded-br-md border border-line bg-ivory/95 p-4 pr-10 shadow-lift backdrop-blur-md"
              >
                <p className="text-[0.875rem] leading-relaxed text-charcoal">{bubble.text}</p>
                <button onClick={() => openChat(bubble.opener)} className="mt-3 inline-flex min-h-9 items-center rounded-full bg-charcoal px-4 text-[0.8125rem] text-ivory">
                  {bubble.cta}
                </button>
                <button onClick={dismiss} aria-label="Dismiss" className="absolute top-2 right-2 grid size-9 place-items-center rounded-full text-stone hover:bg-linen hover:text-charcoal">
                  <X className="size-4" strokeWidth={1.25} />
                </button>
              </m.div>
            )}
          </AnimatePresence>
          <button
            ref={launcherRef}
            onClick={() => openChat()}
            aria-label={`Chat with ${agentName}, your beauty concierge`}
            className="group flex h-14 items-center gap-3 rounded-full border border-charcoal/10 bg-charcoal pr-5 pl-2 text-ivory shadow-lift transition-transform duration-[var(--duration-ui)] hover:-translate-y-0.5 max-sm:w-14 max-sm:justify-center max-sm:px-0"
          >
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-champagne/40 bg-ivory/5">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5 10.6 7.4 16.5 9l-5.9 1.6L9 16.5l-1.6-5.9L1.5 9l5.9-1.6Z" stroke="#d8c3a0" strokeWidth="1" />
              </svg>
            </span>
            <span className="text-sm tracking-[0.02em] max-sm:hidden">Ask {agentName}</span>
          </button>
        </div>
      )}
      {open && <Panel brand={brand} agentName={agentName} voiceSlug={voiceSlug} opener={opener} onClose={close} />}
    </>
  );
}
