"use client";
import { useOptimistic, useState, useTransition } from "react";
import { setEnquiryStatus } from "./actions";

export type Status = "new" | "contacted" | "converted" | "closed";
export type Enquiry = { id: string; status: Status; title: string; sub: string; body: string; when: string; contact: { phone?: string | null; email?: string | null } };
type Table = "leads" | "gift_card_requests" | "job_applications";

const COLUMNS: { key: Status; label: string; hint: string }[] = [
  { key: "new", label: "New", hint: "Reply within a day" },
  { key: "contacted", label: "Contacted", hint: "In conversation" },
  { key: "converted", label: "Converted", hint: "Booked or sold" },
  { key: "closed", label: "Closed", hint: "No further action" },
];
const NEXT: Record<Status, Status | null> = { new: "contacted", contacted: "converted", converted: null, closed: null };

/** A four-column pipeline. Moves show at once (optimistic) and roll back if the save fails. */
export function Board({ table, items }: { table: Table; items: Enquiry[] }) {
  const [list, move] = useOptimistic(items, (cur, { id, status }: { id: string; status: Status }) => cur.map((x) => (x.id === id ? { ...x, status } : x)));
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (id: string, status: Status) =>
    start(async () => {
      setError(null);
      move({ id, status });
      const r = await setEnquiryStatus({ table, id, status });
      if (!r.ok) setError("Couldn't update that enquiry. Please try again.");
    });

  return (
    <>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = list.filter((x) => x.status === col.key);
          return (
            <section key={col.key} aria-labelledby={`col-${col.key}`} className="min-w-0 rounded-2xl bg-linen/50 p-3">
              <header className="mb-3 flex items-baseline justify-between px-1">
                <h2 id={`col-${col.key}`} className="text-sm font-medium">{col.label} <span className="text-stone tabular-nums">· {cards.length}</span></h2>
                <span className="text-[0.6875rem] text-stone">{col.hint}</span>
              </header>
              <ul className="grid gap-2.5">
                {cards.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line bg-white p-3.5 text-sm shadow-[0_1px_2px_rgb(43_37_35/0.04)]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{c.title}</p>
                      <span className="shrink-0 text-[0.6875rem] text-stone">{c.when}</span>
                    </div>
                    {c.sub && <p className="mt-0.5 text-xs text-brass-ink">{c.sub}</p>}
                    {c.body && <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-stone">{c.body}</p>}
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {c.contact.phone && <a href={`tel:+${c.contact.phone.replace(/\D/g, "")}`} className="text-charcoal underline-offset-2 hover:underline">+{c.contact.phone.replace(/\D/g, "")}</a>}
                      {c.contact.email && <a href={`mailto:${c.contact.email}`} className="truncate text-charcoal underline-offset-2 hover:underline">{c.contact.email}</a>}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      {NEXT[c.status] && (
                        <button type="button" onClick={() => set(c.id, NEXT[c.status]!)} className="min-h-8 rounded-full bg-charcoal px-3 text-xs text-ivory">
                          Mark {NEXT[c.status]}
                        </button>
                      )}
                      <label className="sr-only" htmlFor={`st-${c.id}`}>Status for {c.title}</label>
                      <select id={`st-${c.id}`} value={c.status} onChange={(e) => set(c.id, e.target.value as Status)} className="ml-auto min-h-8 rounded-full border border-line bg-ivory px-2 text-xs">
                        {COLUMNS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </div>
                  </li>
                ))}
                {cards.length === 0 && <li className="px-1 py-6 text-center text-xs text-stone">Nothing here.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
