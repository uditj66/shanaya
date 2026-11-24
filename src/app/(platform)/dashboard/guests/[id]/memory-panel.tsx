"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button, Field, Input, Option, Select, StatusBadge, type Tone } from "@/components/admin/kit";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Spinner } from "@/components/admin/ui/spinner";
import { addMemoryNote, clearMemory, removeMemoryNote, setRemembering, type MemoryResult } from "../actions";

export type PanelNote = { text: string; kind: string; when: string | null; past: boolean; added: string };

const KINDS: { value: string; label: string; tone: Tone }[] = [
  { value: "concern", label: "Concern", tone: "info" },
  { value: "occasion", label: "Occasion", tone: "brand" },
  { value: "preference", label: "Likes", tone: "success" },
  { value: "dislike", label: "Didn't enjoy", tone: "warning" },
  { value: "life", label: "About her", tone: "neutral" },
];
const kindOf = (k: string) => KINDS.find((x) => x.value === k) ?? KINDS[2];

/** What Shanaya has learned about this guest from her calls, with the front desk in control of it. */
export function MemoryPanel({ customerId, notes, optedOut, readOnly }: { customerId: string; notes: PanelNote[]; optedOut: boolean; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [kind, setKind] = useState("preference");
  const [until, setUntil] = useState("");

  const run = (job: () => Promise<MemoryResult>, done?: string, after?: () => void) =>
    start(async () => {
      const res = await job();
      if (res?.error) toast.error(res.error);
      else {
        if (done) toast.success(done);
        after?.();
      }
    });

  if (optedOut) {
    return (
      <div className="grid gap-3 text-sm">
        <p className="text-muted-foreground">This guest asked not to be remembered. Shanaya won&apos;t keep notes from her calls, and nothing is stored.</p>
        {!readOnly && (
          <div>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setRemembering(customerId, true), "Shanaya will remember her again from her next call.")}>
              {pending && <Spinner />}
              Turn remembering back on
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {notes.length ? (
        <ul className="-my-2 divide-y text-sm">
          {notes.map((n) => {
            const k = kindOf(n.kind);
            return (
              <li key={n.text} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p>
                    <StatusBadge tone={k.tone} className="mr-2 align-middle">
                      {k.label}
                    </StatusBadge>
                    {n.text}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.when ? `${n.past ? "Was on" : "On"} ${n.when} · ` : ""}noted {n.added}
                  </p>
                </div>
                {!readOnly && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Forget: ${n.text}`} disabled={pending} onClick={() => run(() => removeMemoryNote(customerId, n.text))}>
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing yet. After her calls, Shanaya notes her concerns, occasions and preferences here, so she can greet her like a regular.</p>
      )}

      {!readOnly && (
        <form
          className="grid gap-3 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addMemoryNote(customerId, { text, kind, until }), undefined, () => {
              setText("");
              setUntil("");
            });
          }}
        >
          <Field label="Add a note for Shanaya">
            <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={160} placeholder="Prefers Meera, evenings only" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <Option key={k.value} value={k.value}>
                    {k.label}
                  </Option>
                ))}
              </Select>
            </Field>
            <Field label="Date (optional)">
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Health details (allergies, pregnancy, skin conditions) go in Notes for the team, never here.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending || text.trim().length < 2}>
              {pending ? <Spinner /> : <Plus aria-hidden />}
              Add note
            </Button>
            {notes.length > 0 && (
              <ConfirmAction
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={pending}>
                    Forget everything
                  </Button>
                }
                title="Forget everything about this guest?"
                description="Shanaya's notes about her are deleted and can't be recovered. She will start noting things again after her next call."
                confirmLabel="Forget everything"
                destructive
                success="Notes deleted."
                onConfirm={() => clearMemory(customerId)}
              />
            )}
            <ConfirmAction
              trigger={
                <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-muted-foreground">
                  Stop remembering her
                </Button>
              }
              title="Stop remembering this guest?"
              description="Use this when she asks not to be remembered. Her notes are deleted, and Shanaya won't keep notes from her future calls or mention past conversations. Her bookings are not affected."
              confirmLabel="Stop remembering"
              destructive
              success="Shanaya will no longer remember her."
              onConfirm={() => setRemembering(customerId, false)}
            />
          </div>
        </form>
      )}
    </div>
  );
}
