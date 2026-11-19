"use client";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { setTrackBrand, track } from "@/lib/track-client";
import { DepositPay } from "@/components/brand/deposit-pay";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Check } from "lucide-react";
import { bookAppointment, previewGiftCard, type BookState } from "@/app/(brand)/b/[brand]/book/actions";
import { brandHref } from "@/lib/brand/href";
import { cn, formatDuration, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/display";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/form-controls";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";
import { BrandImage } from "./brand-image";
import { ConciergePage } from "@/components/concierge/page-context";

export type BookTreatment = { code: string; name: string; group: string; minutes: number | null; price: number; consultationFirst: boolean; image: string };
export type BookStudio = { slug: string; city: string; area: string; lat: number | null; lng: number | null };
type Slots = {
  date: string; requestedDate: string; movedForward: boolean; today: string; lastDate: string; consultationFirst: boolean;
  specialists: { slug: string; name: string; title: string }[];
  slots: { time: string; with: string[] }[];
};

const STEPS = ["Treatment", "Studio", "Specialist & time", "Your details"] as const;
const PATH = "/book"; // visible URL (proxy rewrites it to /b/<brand>/book)

const tz = "Asia/Kolkata";
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (date: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(new Date(`${date}T12:00:00Z`));
const longDate = (date: string) => new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const to12 = (t: string) => {
  const [h, mm] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
// Only render clock-dependent UI after hydration (server and browser clocks may sit either side of midnight).
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export function BookingFlow({ brand, treatments, studios, deposit, refundHours = 24 }: { brand: string; treatments: BookTreatment[]; studios: BookStudio[]; deposit?: { amount: number; refundHours: number } | null; refundHours?: number }) {
  const params = useSearchParams();
  const mounted = useMounted();
  const sel = {
    service: params.get("service") ?? "",
    studio: params.get("studio") ?? "",
    specialist: params.get("specialist") ?? "",
    date: params.get("date") ?? "",
    time: params.get("time") ?? "",
  };
  const treatment = treatments.find((t) => t.code === sel.service);
  const studio = studios.find((s) => s.slug === sel.studio);
  const consult = !!treatment?.consultationFirst;
  const step = !treatment ? 0 : !studio ? 1 : consult || sel.time ? 3 : 2;

  /** Every choice is a history entry, so the browser back button steps back through the flow. */
  const go = (patch: Partial<typeof sel>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const url = `${PATH}?${next.toString()}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    document.getElementById("booking-step")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [state, action, pending] = useActionState<BookState, FormData>(bookAppointment, null);
  // A deposit booking is "done" only once paid; until then the held time and the pay button are shown.
  const [paid, setPaid] = useState<Extract<BookState, { kind: "booked" }> | null>(null);
  const [released, setReleased] = useState<string | null>(null);
  const raw = state?.ok ? state : null;
  const holding = raw?.kind === "deposit" && !paid && released !== raw.reference ? raw : null;
  const done = paid ?? (raw && raw.kind !== "deposit" ? raw : null);

  // Funnel analytics: one event per step reached, and one when the booking is confirmed.
  useEffect(() => {
    setTrackBrand(brand);
    if (done) track("booking_done", { kind: done.kind, service: sel.service });
    else track("booking_step", { step: step + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, !!done]);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <ConciergePage kind="booking" bookingStep={done ? 3 : step} />
      <div className="min-w-0 lg:col-span-8">
        {/* Progress */}
        {!done && (
          <ol aria-label="Booking steps" className="flex gap-2 md:gap-3">
            {STEPS.map((label, i) => {
              const reachable = i < step;
              const current = i === step;
              const shown = consult && i === 2 ? "Plan" : label;
              return (
                <li key={label} className="flex-1">
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-current={current ? "step" : undefined}
                    onClick={() => go(i === 0 ? { service: "", studio: sel.studio, specialist: "", date: "", time: "" } : i === 1 ? { studio: "", specialist: "", time: "" } : { time: "" })}
                    className="group w-full text-left disabled:cursor-default"
                  >
                    <span className={cn("block h-px w-full transition-colors duration-500", i <= step ? "bg-charcoal" : "bg-line")} />
                    <span className={cn("mt-3 block text-[0.75rem] tracking-[0.04em] max-sm:sr-only", current ? "text-charcoal" : reachable ? "text-stone group-hover:text-charcoal" : "text-stone/60")}>
                      {String(i + 1).padStart(2, "0")} · {shown}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <div id="booking-step" tabIndex={-1} className="mt-10 outline-none" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={done ? "done" : step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5, ease: EASE_OUT_SOFT }}>
              {done ? (
                <Confirmation state={done} refundHours={refundHours} />
              ) : holding ? (
                <DepositStage
                  hold={holding}
                  onPaid={(d) => setPaid({ ok: true, kind: "booked", reference: d.reference, when: d.when, startsAt: d.startsAt, minutes: d.minutes, studio: d.studio, treatment: d.treatment, specialist: holding.specialist, depositPaid: d.amount, depositRefundHours: holding.deposit.refundHours })}
                  onRelease={() => {
                    setReleased(holding.reference);
                    go({ time: "" });
                  }}
                />
              ) : step === 0 ? (
                <TreatmentStep treatments={treatments} onPick={(code) => go({ service: code, time: "" })} />
              ) : step === 1 ? (
                <StudioStep studios={studios} onPick={(slug) => go({ studio: slug, specialist: "", time: "" })} />
              ) : step === 2 ? (
                <TimeStep brand={brand} sel={sel} mounted={mounted} onSpecialist={(s) => go({ specialist: s, time: "" }, true)} onDate={(d) => go({ date: d, time: "" }, true)} onTime={(date, time) => go({ date, time })} />
              ) : (
                <DetailsStep brand={brand} sel={sel} consult={consult} price={treatment?.price ?? 0} deposit={deposit ? { ...deposit, amount: Math.max(1, Math.min(deposit.amount, Math.round(treatment?.price ?? deposit.amount))) } : null} action={action} pending={pending} state={state} onAlternative={(t) => go({ time: t }, true)} refundHours={refundHours} />
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Summary: sticky column on desktop, bottom bar on phones */}
      {!done && (
        <>
          <aside aria-label="Your booking" className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-28 rounded-2xl border border-line bg-white/60 p-7">
              <Summary treatment={treatment} studio={studio} sel={sel} consult={consult} />
            </div>
          </aside>
          {treatment && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-5 py-3 backdrop-blur-md lg:hidden">
              <p className="truncate text-sm">
                <span className="font-medium">{treatment.name}</span>
                {studio && <span className="text-stone"> · {studio.area}</span>}
                {sel.time && <span className="text-stone"> · {to12(sel.time)}</span>}
              </p>
              <p className="text-[0.8125rem] text-stone tabular-nums">
                {formatPrice(treatment.price)}
                {treatment.minutes ? ` · ${formatDuration(treatment.minutes)}` : ""} · Step {step + 1} of 4
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Step 1 ─────────────────────────────────────────────────────────── */
function TreatmentStep({ treatments, onPick }: { treatments: BookTreatment[]; onPick: (code: string) => void }) {
  const groups = [...new Set(treatments.map((t) => t.group))];
  const [group, setGroup] = useState(groups[0]);
  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="display-cut text-h1">Choose your ritual</h2>
      <div role="group" aria-label="Category" className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        {groups.map((g) => (
          <button key={g} type="button" aria-pressed={g === group} onClick={() => setGroup(g)} className={cn("min-h-10 shrink-0 rounded-full border px-4 text-[0.8125rem] transition-colors", g === group ? "border-charcoal bg-charcoal text-ivory" : "border-line text-stone hover:border-champagne hover:text-charcoal")}>
            {g}
          </button>
        ))}
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {treatments.filter((t) => t.group === group).map((t) => (
          <li key={t.code}>
            <button type="button" onClick={() => onPick(t.code)} className="group grid w-full grid-cols-[4rem_1fr] items-center gap-4 rounded-xl border border-line bg-white/60 p-3 text-left transition-[border-color,box-shadow] duration-[var(--duration-ui)] hover:border-charcoal hover:shadow-soft">
              <span className="relative aspect-square overflow-hidden rounded-lg bg-sand">
                <BrandImage id={t.image} fill sizes="64px" alt="" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{t.name}</span>
                <span className="block text-[0.8125rem] text-stone tabular-nums">
                  {formatPrice(t.price)}
                  {t.minutes ? ` · ${formatDuration(t.minutes)}` : ""}
                  {t.consultationFirst && " · consultation first"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Step 2 ─────────────────────────────────────────────────────────── */
function StudioStep({ studios, onPick }: { studios: BookStudio[]; onPick: (slug: string) => void }) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [status, setStatus] = useState("");
  const nearest = () => {
    if (!("geolocation" in navigator)) return setStatus("Location isn't available on this device.");
    setStatus("Finding studios near you…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const r = (d: number) => (d * Math.PI) / 180;
        const dist = (s: BookStudio) =>
          s.lat == null || s.lng == null ? 1e9 : Math.asin(Math.sqrt(Math.sin(r(s.lat - coords.latitude) / 2) ** 2 + Math.cos(r(coords.latitude)) * Math.cos(r(s.lat)) * Math.sin(r(s.lng - coords.longitude) / 2) ** 2));
        setOrder([...studios].sort((a, b) => dist(a) - dist(b)).map((s) => s.slug));
        setStatus("Sorted by distance from you.");
      },
      () => setStatus("Location isn't available, so choose from the list."),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };
  const nearestFirst = order ? order.slice(0, 3).map((slug) => studios.find((s) => s.slug === slug)!) : [];
  const cities = [...new Set(studios.map((s) => s.city))];
  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="display-cut text-h1">Choose your studio</h2>
      <p className="mt-4 text-stone">Same menu and price at every studio.</p>
      <button type="button" onClick={nearest} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-brass-ink underline decoration-champagne underline-offset-4">
        Use my location
      </button>
      <p className="min-h-5 text-[0.8125rem] text-stone">{status}</p>
      {nearestFirst.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow">Nearest to you</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {nearestFirst.map((s) => (
              <li key={s.slug}>
                <StudioButton s={s} onPick={onPick} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-10 grid gap-8">
        {cities.map((c) => (
          <div key={c}>
            <p className="eyebrow">{c}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {studios.filter((s) => s.city === c).map((s) => (
                <li key={s.slug}>
                  <StudioButton s={s} onPick={onPick} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function StudioButton({ s, onPick }: { s: BookStudio; onPick: (slug: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(s.slug)} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-line bg-white/60 px-4 text-left transition-colors hover:border-charcoal">
      <span className="display-cut text-[1.25rem]">{s.area}</span>
      <span aria-hidden="true" className="text-stone">→</span>
    </button>
  );
}

/* ── Step 3 ─────────────────────────────────────────────────────────── */
function TimeStep({
  brand,
  sel,
  mounted,
  onSpecialist,
  onDate,
  onTime,
}: {
  brand: string;
  sel: { service: string; studio: string; specialist: string; date: string };
  mounted: boolean;
  onSpecialist: (slug: string) => void;
  onDate: (date: string) => void;
  onTime: (date: string, time: string) => void;
}) {
  // Each result remembers which query it answers; while the current query has no answer yet, we're loading.
  const query = new URLSearchParams({ brand, studio: sel.studio, service: sel.service, ...(sel.date && { date: sel.date }), ...(sel.specialist && { specialist: sel.specialist }) }).toString();
  const [result, setResult] = useState<{ query: string; data?: Slots; error?: string } | null>(null);
  const loading = result?.query !== query;
  const data = loading ? null : (result?.data ?? null);
  const error = loading ? "" : (result?.error ?? "");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/book/slots?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "We couldn't load times.");
        setResult({ query, data: body });
      })
      .catch((e) => e.name !== "AbortError" && setResult({ query, error: e.message }));
    return () => ctrl.abort();
  }, [query]);

  const today = mounted ? ymd(new Date()) : null;
  const days = useMemo(() => (today ? Array.from({ length: 14 }, (_, i) => addDays(today, i)) : []), [today]);
  const shown = data?.date ?? sel.date;
  const parts = (t: string) => Number(t.slice(0, 2));
  const periods = data
    ? [
        ["Morning", data.slots.filter((s) => parts(s.time) < 12)],
        ["Afternoon", data.slots.filter((s) => parts(s.time) >= 12 && parts(s.time) < 17)],
        ["Evening", data.slots.filter((s) => parts(s.time) >= 17)],
      ] as const
    : [];

  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="display-cut text-h1">Choose a time</h2>

      <fieldset className="mt-8 min-w-0">
        <legend className="eyebrow">Specialist</legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {[{ slug: "", name: "Any specialist", title: "First available" }, ...(result?.data?.specialists ?? [])].map((p) => (
            <button
              key={p.slug || "any"}
              type="button"
              aria-pressed={sel.specialist === p.slug}
              onClick={() => onSpecialist(p.slug)}
              className={cn("min-h-11 rounded-full border px-4 text-left text-sm transition-colors", sel.specialist === p.slug ? "border-charcoal bg-charcoal text-ivory" : "border-line hover:border-champagne")}
            >
              {p.name}
              {p.slug && <span className={cn("ml-2 text-[0.75rem]", sel.specialist === p.slug ? "text-ivory/70" : "text-stone")}>{p.title}</span>}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-10 min-w-0">
        <legend className="eyebrow">Day</legend>
        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:px-0">
          {!mounted
            ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-[4.5rem] w-16 shrink-0" />)
            : days.map((d) => {
                const p = dayLabel(d);
                const get = (t: string) => p.find((x) => x.type === t)?.value;
                const active = d === shown;
                return (
                  <button key={d} type="button" aria-pressed={active} aria-label={longDate(d)} onClick={() => onDate(d)} className={cn("grid h-[4.5rem] w-16 shrink-0 place-content-center rounded-xl border text-center transition-colors", active ? "border-charcoal bg-charcoal text-ivory" : "border-line bg-white/60 hover:border-champagne")}>
                    <span className="text-[0.6875rem] uppercase tracking-[0.12em]">{d === today ? "Today" : get("weekday")}</span>
                    <span className="display-cut text-[1.375rem] leading-tight">{get("day")}</span>
                    <span className="text-[0.6875rem]">{get("month")}</span>
                  </button>
                );
              })}
        </div>
      </fieldset>

      <div className="mt-10 min-h-48">
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-busy="true" aria-label="Loading times">
            {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : error ? (
          <p role="alert" className="text-danger">{error}</p>
        ) : data && data.slots.length ? (
          <div className="grid gap-8">
            {data.movedForward && (
              <p className="rounded-xl bg-blush/50 p-4 text-sm text-blush-ink">
                {longDate(data.requestedDate)} is fully booked. The next free day is <strong className="font-medium">{longDate(data.date)}</strong>.
              </p>
            )}
            {periods.map(([label, list]) =>
              list.length ? (
                <fieldset key={label} className="min-w-0">
                  <legend className="text-sm text-stone">{label}</legend>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {list.map((s) => (
                      <button key={s.time} type="button" onClick={() => onTime(data.date, s.time)} className="min-h-12 rounded-xl border border-line bg-white/60 text-sm tabular-nums transition-colors hover:border-charcoal hover:bg-blush/40" aria-label={`${to12(s.time)} on ${longDate(data.date)}`}>
                        {to12(s.time)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null,
            )}
          </div>
        ) : (
          <p className="text-stone">No free times in the next three weeks{sel.specialist ? " with this specialist. Try “Any specialist”" : ""}. Please call the studio and we&apos;ll find you a time.</p>
        )}
      </div>
    </section>
  );
}

/* ── Step 4 ─────────────────────────────────────────────────────────── */
function DetailsStep({
  brand,
  sel,
  consult,
  price,
  deposit,
  action,
  pending,
  state,
  onAlternative,
  refundHours,
}: {
  refundHours: number;
  brand: string;
  sel: { service: string; studio: string; specialist: string; date: string; time: string };
  consult: boolean;
  price: number;
  deposit: { amount: number; refundHours: number } | null;
  action: (f: FormData) => void;
  pending: boolean;
  state: BookState;
  onAlternative: (time: string) => void;
}) {
  const err = state && !state.ok ? state : null;
  const fe = err?.fieldErrors ?? {};
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  const values = err?.values ?? {};
  const field = (name: string) => ({ id: `f-${name}`, name, defaultValue: values[name], "aria-invalid": fe[name] ? true : undefined, "aria-describedby": fe[name] ? `e-${name}` : undefined });
  const fieldError = (name: string) => (fe[name] ? <p id={`e-${name}`} className="text-[0.8125rem] text-danger">{fe[name]}</p> : null);

  // Gift card: optional, checked with "Apply" so the guest sees what it covers before confirming.
  const [giftOpen, setGiftOpen] = useState(!!values.gift_code);
  const [gift, setGift] = useState(values.gift_code ?? "");
  const [giftCheck, setGiftCheck] = useState<{ code: string; balance?: number; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const giftApplied = giftCheck?.balance !== undefined && giftCheck.code === gift.trim().toUpperCase() ? giftCheck.balance : null;
  const applyGift = async () => {
    const code = gift.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    const r = await previewGiftCard(brand, code).catch(() => ({ ok: false as const, error: "We couldn't check the code. Please try again." }));
    setChecking(false);
    setGiftCheck(r.ok ? { code, balance: r.balance } : { code, error: r.error });
  };
  const giftUsing = gift.trim() !== "";

  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="display-cut text-h1">{consult ? "Plan it with us" : "Your details"}</h2>
      <p className="mt-4 max-w-[52ch] text-stone">
        {consult
          ? "This treatment begins with a consultation. Leave your details and the studio will call you to plan it around your dates."
          : deposit
            ? `A ₹${deposit.amount.toLocaleString("en-IN")} deposit holds your time and comes off your bill at the studio. Cancel at least ${deposit.refundHours} hours before for a full refund.`
            : `You'll get your booking reference straight away. Reschedule or cancel free up to ${refundHours} hours before.`}
      </p>
      {!consult && (
        <p className="mt-3 max-w-[52ch] text-[0.8125rem] text-stone">
          Lumière member? Book with the mobile number on your membership and your benefits apply automatically{deposit ? ", with no deposit" : ""}.
        </p>
      )}

      {err && (
        <div role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {err.error}
          {err.alternatives && err.alternatives.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {err.alternatives.map((t) => (
                <button key={t} type="button" onClick={() => onAlternative(t)} className="min-h-10 rounded-full border border-charcoal/25 bg-white px-4 text-charcoal hover:border-charcoal">
                  {to12(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form action={action} noValidate className="mt-8 grid gap-6 md:grid-cols-2">
        {(["brand", "studio", "service", "specialist", "date", "time"] as const).map((k) => (
          <input key={k} type="hidden" name={k} value={k === "brand" ? brand : sel[k]} />
        ))}
        {/* Honeypot for bots, hidden from people and assistive tech */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <div className="grid gap-2">
          <Label htmlFor="f-name">Your name</Label>
          <Input ref={first} {...field("name")} autoComplete="name" required />
          {fieldError("name")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-phone">Mobile number</Label>
          <Input {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required />
          {fieldError("phone")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-email">Email <span className="font-normal text-stone">(optional)</span></Label>
          <Input {...field("email")} type="email" autoComplete="email" />
          {fieldError("email")}
        </div>
        <div className="grid gap-2 md:row-span-2">
          <Label htmlFor="f-notes">{consult ? "Preferred dates and anything we should know" : "Anything we should know?"}</Label>
          <Textarea {...field("notes")} placeholder="Skin concerns, allergies, pregnancy, an occasion…" maxLength={500} />
        </div>
        {!consult && (
          <div className="grid gap-2 md:col-span-2">
            {!giftOpen ? (
              <button type="button" onClick={() => setGiftOpen(true)} className="justify-self-start text-sm text-brass-ink underline decoration-champagne underline-offset-4">
                Have a gift card? Use it to pay
              </button>
            ) : (
              <>
                <Label htmlFor="f-gift_code">Gift card code <span className="font-normal text-stone">(optional)</span></Label>
                <div className="flex max-w-md gap-2">
                  <Input
                    {...field("gift_code")}
                    value={gift}
                    defaultValue={undefined}
                    onChange={(e) => setGift(e.target.value.toUpperCase())}
                    placeholder="LUM-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono tracking-[0.08em]"
                  />
                  <Button type="button" variant="quiet" onClick={applyGift} disabled={checking || gift.trim().length < 8}>
                    {checking ? "Checking…" : "Apply"}
                  </Button>
                </div>
                {fieldError("gift_code")}
                <p aria-live="polite" className="text-[0.8125rem]">
                  {giftCheck?.error && giftCheck.code === gift.trim().toUpperCase() ? (
                    <span className="text-danger">{giftCheck.error}</span>
                  ) : giftApplied !== null ? (
                    <span className="text-success">
                      Balance ₹{giftApplied.toLocaleString("en-IN")}.{" "}
                      {giftApplied >= price
                        ? `It covers this treatment in full${price ? ` (₹${price.toLocaleString("en-IN")})` : ""}.`
                        : `It pays ₹${giftApplied.toLocaleString("en-IN")} now; the remaining ₹${(price - giftApplied).toLocaleString("en-IN")} is paid at the studio.`}{" "}
                      Member prices are applied first.
                    </span>
                  ) : (
                    <span className="text-stone">The card pays for the treatment when you confirm, so no deposit is needed.</span>
                  )}
                </p>
              </>
            )}
          </div>
        )}
        <div className="grid gap-2">
          <div className="flex items-start gap-3">
            <Checkbox id="f-consent" name="consent" aria-invalid={fe.consent ? true : undefined} aria-describedby={fe.consent ? "e-consent" : undefined} className="mt-0.5" />
            <Label htmlFor="f-consent" className="font-normal leading-relaxed text-stone">
              I agree that Lumière may contact me about this {consult ? "request" : "booking"}. See our{" "}
              <Link href={brandHref("/privacy")} className="underline underline-offset-4">privacy notice</Link>.
            </Label>
          </div>
          {fieldError("consent")}
        </div>
        <div className="md:col-span-2">
          <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
            {pending ? (consult ? "Sending…" : "Confirming…") : consult ? "Request a call-back" : deposit && !giftUsing ? "Continue" : "Confirm booking"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ── Deposit ─────────────────────────────────────────────────────────── */
function DepositStage({ hold, onPaid, onRelease }: { hold: Extract<BookState, { kind: "deposit" }>; onPaid: Parameters<typeof DepositPay>[0]["onPaid"]; onRelease: () => void }) {
  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="display-cut text-h1">Your time is held.</h2>
      <p className="mt-4 max-w-[52ch] text-lead text-stone">
        {hold.treatment} at {hold.studio}, {hold.when}
        {hold.specialist ? ` with ${hold.specialist}` : ""}. Pay the deposit to confirm it.
      </p>
      {hold.memberEnds && <MemberEndsNote ends={hold.memberEnds} />}
      <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white/60 p-6 md:p-8">
        <DepositPay token={hold.deposit.token} checkout={hold.deposit.checkout} amount={hold.deposit.amount} holdUntil={hold.deposit.holdUntil} refundHours={hold.deposit.refundHours} autoOpen onPaid={onPaid} onRelease={onRelease} />
      </div>
    </section>
  );
}

/* ── Summary & confirmation ─────────────────────────────────────────── */
function Summary({ treatment, studio, sel, consult }: { treatment?: BookTreatment; studio?: BookStudio; sel: { specialist: string; date: string; time: string }; consult: boolean }) {
  const rows: [string, string | null][] = [
    ["Treatment", treatment?.name ?? null],
    ["Studio", studio ? `${studio.area}, ${studio.city}` : null],
    ...(!consult ? ([["When", sel.time && sel.date ? `${longDate(sel.date)}, ${to12(sel.time)}` : null]] as [string, string | null][]) : []),
  ];
  return (
    <div>
      <p className="eyebrow">Your booking</p>
      {treatment && (
        <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-xl bg-sand">
          <BrandImage id={treatment.image} fill sizes="320px" alt="" />
        </div>
      )}
      <dl className="mt-5 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-stone">{k}</dt>
            <dd className={cn("text-right", !v && "text-stone")}>{v ?? "Not chosen yet"}</dd>
          </div>
        ))}
      </dl>
      {treatment && (
        <p className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-sm text-stone">{treatment.minutes ? formatDuration(treatment.minutes) : "Programme"}</span>
          <span className="display-cut text-h3 tabular-nums">{formatPrice(treatment.price)}</span>
        </p>
      )}
      {consult && <Badge tone="accent" className="mt-4">Consultation first</Badge>}
      <p className="mt-4 text-[0.75rem] text-stone">Prices exclude GST. Pay at the studio by UPI, card or cash.</p>
    </div>
  );
}

/** Member benefit, gift card and what's left to pay at the studio. */
function PaymentSummary({ p }: { p: NonNullable<Extract<BookState, { kind: "booked" }>["payment"]> }) {
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const rows: [string, string, string?][] = [["Treatment price", inr(p.price)]];
  if (p.member) {
    rows.push(
      p.member.benefit === "included"
        ? [`Included with ${p.member.tier}`, `−${inr(p.member.discount)}`, p.member.includedNote]
        : [`${p.member.tier} member discount`, `−${inr(p.member.discount)}`],
    );
  }
  if (p.giftCard) rows.push(["Paid with gift card", `−${inr(p.giftCard.amount)}`, `${inr(p.giftCard.balance)} left on the card`]);
  return (
    <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-line bg-white/60 px-6 py-2 text-left text-sm">
    <dl className="divide-y divide-line">
      {rows.map(([k, v, note]) => (
        <div key={k} className="flex justify-between gap-4 py-3">
          <dt>
            {k}
            {note && <span className="block text-[0.75rem] text-stone">{note}</span>}
          </dt>
          <dd className="tabular-nums">{v}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 py-3 font-medium">
        <dt>To pay at the studio</dt>
        <dd className="tabular-nums">{p.payAtStudio > 0 ? inr(p.payAtStudio) : "Nothing"}</dd>
      </div>
    </dl>
      {p.member && <p className="border-t border-line py-3 text-[0.75rem] text-stone">Please bring the phone your membership is registered to; the studio confirms it at your visit.</p>}
    </div>
  );
}

/** Her membership ends before this visit, so its benefits don't apply to it. */
function MemberEndsNote({ ends }: { ends: string }) {
  return (
    <p className="mx-auto mt-6 max-w-[52ch] rounded-xl border border-champagne bg-white/60 px-5 py-4 text-sm text-stone">
      Your membership ends on {ends}, before this visit, so member benefits don&apos;t apply to it. Renew before your visit and the studio will apply them.
    </p>
  );
}

function Confirmation({ state, refundHours }: { state: Extract<BookState, { ok: true }>; refundHours: number }) {
  const ics = () => {
    if (state.kind !== "booked") return "";
    const start = new Date(state.startsAt);
    const end = new Date(start.getTime() + state.minutes * 60_000);
    const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lumiere//Booking//EN", "BEGIN:VEVENT", `UID:${state.reference}@lumiere`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${state.treatment} at ${state.studio}`, `DESCRIPTION:Booking reference ${state.reference}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
  };
  return (
    <section aria-labelledby="done-title" className="mx-auto max-w-2xl py-6 text-center">
      <m.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: EASE_OUT_SOFT }} className="mx-auto grid size-16 place-items-center rounded-full border border-champagne text-brass-ink">
        <Check className="size-7" strokeWidth={1.25} />
      </m.span>
      {state.kind === "booked" ? (
        <>
          <h2 id="done-title" className="display-cut mt-8 text-display-l">You&apos;re booked.</h2>
          <p className="mt-5 text-lead text-stone">
            {state.treatment} at {state.studio}, {state.when}
            {state.specialist ? ` with ${state.specialist}` : ""}.
          </p>
          <p className="mt-8 inline-flex flex-col items-center rounded-2xl border border-line bg-white/60 px-8 py-5">
            <span className="eyebrow">Booking reference</span>
            <span className="display-cut mt-2 text-h2 tracking-[0.12em]">{state.reference}</span>
          </p>
          {state.memberEnds && <MemberEndsNote ends={state.memberEnds} />}
          {state.payment && <PaymentSummary p={state.payment} />}
          <p className="mt-6 text-sm text-stone">
            {state.payment?.giftCard
              ? `Keep this reference to reschedule or cancel. Cancel at least ${state.payment.refundHours} hours before and the gift card amount goes back on your card.`
              : state.depositPaid
              ? `Your ₹${state.depositPaid.toLocaleString("en-IN")} deposit is paid and comes off your bill. Keep this reference to reschedule or cancel; cancel at least ${state.depositRefundHours ?? 24} hours before for a full refund.`
              : `Keep this reference to reschedule or cancel. Free changes up to ${state.depositRefundHours ?? refundHours} hours before.`}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild variant="quiet">
              <a href={ics()} download={`lumiere-${state.reference}.ics`}>Add to calendar</a>
            </Button>
            <Button asChild>
              <Link href={brandHref("/")}>Back to home</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 id="done-title" className="display-cut mt-8 text-display-l">Thank you.</h2>
          <p className="mt-5 text-lead text-stone">The {state.studio} team will call you during opening hours to plan your {state.treatment}.</p>
          <Button asChild className="mt-10">
            <Link href={brandHref("/")}>Back to home</Link>
          </Button>
        </>
      )}
    </section>
  );
}
