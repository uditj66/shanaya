"use client";
// The cards a website voice call shows: the times Shanaya is offering, and the booking she made (with the things a
// guest wants to do with a booking: keep the reference, put it in her calendar, find the studio, share it).
import { useState } from "react";
import * as m from "motion/react-m";
import { CalendarPlus, Check, Copy, MapPin, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";
import { bookingIcs, dayLabel, directionsUrl, timeLabel, whatsappUrl, type BookingCard, type CallCard, type SlotsCard } from "./call-cards";

export function CallCardView({ card, brandName, compact = false }: { card: CallCard; brandName: string; compact?: boolean }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT_SOFT }}
      className={cn("rounded-2xl border border-line bg-white/80 text-left shadow-sm backdrop-blur", compact ? "px-4 py-3" : "px-5 py-4")}
    >
      {card.kind === "slots" ? <Slots card={card} /> : <Booking card={card} brandName={brandName} compact={compact} />}
    </m.div>
  );
}

function Slots({ card }: { card: SlotsCard }) {
  return (
    <div>
      <p className="text-[0.6875rem] tracking-[0.16em] text-stone uppercase">Times for {dayLabel(card.date)}</p>
      <p className="mt-1 text-[0.9375rem] font-medium">{card.service}</p>
      {card.branch && <p className="text-[0.8125rem] text-stone">{card.branch}</p>}
      {card.times.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Times offered">
          {card.times.map((t) => (
            <li key={t.time} className="rounded-full border border-champagne bg-ivory px-3 py-1.5 text-[0.8125rem]">
              {timeLabel(t.time)}
              {t.therapist && <span className="text-stone"> · {t.therapist}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[0.8125rem] text-stone">Fully booked{card.nextDate ? ` · next free day ${dayLabel(card.nextDate)}` : ""}</p>
      )}
      <p className="mt-2 text-[0.75rem] text-stone">Just tell Shanaya which time suits you.</p>
    </div>
  );
}

function Booking({ card, brandName, compact }: { card: BookingCard; brandName: string; compact: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the reference is on screen to read */
    }
  };
  const addToCalendar = () => {
    const url = URL.createObjectURL(new Blob([bookingIcs(card, brandName)], { type: "text/calendar;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${brandName.split(" ")[0]}-${card.reference}.ics` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const action = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-ivory px-3 text-[0.8125rem] text-charcoal hover:bg-linen";

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[0.6875rem] tracking-[0.16em] text-brass-ink uppercase">
        <Check className="size-3.5" strokeWidth={2} aria-hidden /> Booked
      </p>
      <p className="mt-1 text-[0.9375rem] font-medium">
        {card.service}
        {card.therapist && <span className="font-normal text-stone"> with {card.therapist}</span>}
      </p>
      <p className="text-[0.8125rem]">
        {dayLabel(card.date)}, {timeLabel(card.time)}
        {card.branch && <span className="text-stone"> · {card.branch.replace(/^.*?,\s*/, "")}</span>}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[0.75rem] text-stone">Reference</span>
        <span className="rounded-md bg-linen px-2 py-0.5 font-mono text-[0.875rem] tracking-[0.12em]">{card.reference}</span>
        <button onClick={() => void copy()} className="grid size-8 place-items-center rounded-full text-stone hover:bg-linen hover:text-charcoal" aria-label="Copy booking reference">
          {copied ? <Check className="size-4" strokeWidth={1.75} /> : <Copy className="size-4" strokeWidth={1.5} />}
        </button>
      </div>
      {!compact && card.payNote && <p className="mt-1 text-[0.75rem] text-stone">{card.payNote}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={addToCalendar} className={action}>
          <CalendarPlus className="size-4" strokeWidth={1.5} aria-hidden /> Add to calendar
        </button>
        <a href={directionsUrl(card)} target="_blank" rel="noopener noreferrer" className={action}>
          <MapPin className="size-4" strokeWidth={1.5} aria-hidden /> Directions
        </a>
        <a href={whatsappUrl(card)} target="_blank" rel="noopener noreferrer" className={action}>
          <MessageCircle className="size-4" strokeWidth={1.5} aria-hidden /> Share
        </a>
      </div>
    </div>
  );
}
