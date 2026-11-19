"use client";
// Calendar board: therapist (or day) columns, bookings you can drag to a new time or therapist.
// The move shows instantly (useOptimistic) and the server confirms it or puts it back with the nearest free times.
import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { CalBlock, CalBooking, CalColumn } from "@/lib/dashboard/calendar";
import { cn } from "@/components/admin/kit";
import { CHANNEL_COLORS } from "../overview-charts";
import { moveBooking } from "./actions";

const PX = 1.4; // pixels per minute
const HOUR = 60 * PX;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const SOURCE: Record<string, string> = CHANNEL_COLORS;

export function CalendarBoard({
  columns, events, blocks, startMin, endMin, interval, canMove,
}: {
  columns: CalColumn[]; events: CalBooking[]; blocks: CalBlock[]; startMin: number; endMin: number; interval: number; canMove: boolean;
}) {
  const [optimistic, applyMove] = useOptimistic(events, (list, m: { id: string; column: string; start: number }) =>
    list.map((e) => (e.id === m.id ? { ...e, column: m.column, end: m.start + (e.end - e.start), start: m.start, startLabel: hhmm(m.start) } : e)),
  );
  const [, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const height = (endMin - startMin) * PX;

  const onDragEnd = (e: DragEndEvent) => {
    const ev = optimistic.find((x) => x.id === e.active.id);
    const col = columns.find((c) => c.id === e.over?.id);
    if (!ev || !col) return;
    const snapped = Math.round((ev.start + e.delta.y / PX) / interval) * interval;
    const newStart = Math.max(startMin, Math.min(endMin - (ev.end - ev.start), snapped));
    if (newStart === ev.start && col.id === ev.column) return;
    start(async () => {
      applyMove({ id: ev.id, column: col.id, start: newStart });
      const r = await moveBooking({ reference: ev.reference, date: col.date, time: hhmm(newStart), staffId: col.staffId });
      if (r.ok) toast.success(`${ev.guest}: ${r.message}`);
      else
        toast.error(`${ev.guest} couldn't move`, {
          description: `${r.error}${r.alternatives?.length ? ` Free nearby: ${r.alternatives.join(", ")}.` : ""}`,
        });
    });
  };

  return (
    <div>
      {canMove && <p className="mb-3 text-sm text-muted-foreground">Drag an appointment to move it to another time or therapist.</p>}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <div className="flex min-w-[720px]">
            <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-card pt-14">
              <div className="relative" style={{ height }}>
                {Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => (
                  <span key={i} className="tabular absolute right-2 -translate-y-1/2 text-[0.6875rem] text-muted-foreground" style={{ top: i * HOUR }}>
                    {hhmm(startMin + i * 60)}
                  </span>
                ))}
              </div>
            </div>
            {columns.map((c) => (
              <Column key={c.id} col={c} height={height} startMin={startMin} endMin={endMin}>
                {blocks
                  .filter((b) => b.column === c.id)
                  .map((b, i) => (
                    <div
                      key={i}
                      className="absolute inset-x-1 rounded-md border border-dashed bg-muted px-2 py-1 text-[0.6875rem] text-muted-foreground"
                      style={{ top: (Math.max(b.start, startMin) - startMin) * PX, height: (Math.min(b.end, endMin) - Math.max(b.start, startMin)) * PX }}
                    >
                      {b.label}
                    </div>
                  ))}
                {optimistic
                  .filter((e) => e.column === c.id)
                  .map((e) => (
                    <Appointment key={e.id} ev={e} color={c.color} startMin={startMin} canMove={canMove && e.status === "confirmed"} />
                  ))}
              </Column>
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

function Column({ col, height, startMin, endMin, children }: { col: CalColumn; height: number; startMin: number; endMin: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const shiftsLabel = col.shifts.length ? col.shifts.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(", ") : "Off";
  return (
    <div className="min-w-40 flex-1 border-r last:border-r-0">
      <div className="sticky top-0 flex h-14 items-center gap-2 border-b bg-card px-3">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: col.color }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{col.title}</p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {col.subtitle ? `${col.subtitle} · ` : ""}
            {shiftsLabel}
          </p>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn("relative transition-colors", isOver && "bg-primary/8")}
        style={{
          height,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR - 1}px, var(--border) ${HOUR - 1}px, var(--border) ${HOUR}px)`,
        }}
      >
        {/* off-shift time is shaded */}
        {(col.shifts.length ? invert(col.shifts, startMin, endMin) : [[startMin, endMin] as [number, number]]).map(([a, b], i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--muted),var(--muted)_6px,transparent_6px,transparent_12px)] opacity-70"
            style={{ top: (a - startMin) * PX, height: (b - a) * PX }}
          />
        ))}
        {children}
      </div>
    </div>
  );
}

function invert(shifts: [number, number][], from: number, to: number) {
  const out: [number, number][] = [];
  let cur = from;
  for (const [a, b] of [...shifts].sort((x, y) => x[0] - y[0])) {
    if (a > cur) out.push([cur, Math.min(a, to)]);
    cur = Math.max(cur, b);
  }
  if (cur < to) out.push([cur, to]);
  return out;
}

function Appointment({ ev, color, startMin, canMove }: { ev: CalBooking; color: string; startMin: number; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ev.id, disabled: !canMove });
  const top = (ev.start - startMin) * PX;
  const h = Math.max(22, (ev.end - ev.start) * PX);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`${ev.startLabel} ${ev.guest}, ${ev.service}${canMove ? ". Press space to pick up, arrow keys to move, space to drop." : ""}`}
      className={cn(
        "absolute inset-x-1 z-[1] overflow-hidden rounded-md border border-l-[3px] bg-card px-2 py-1 text-xs text-card-foreground shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        canMove && "cursor-grab active:cursor-grabbing",
        isDragging ? "z-20 opacity-90 shadow-md ring-2 ring-primary" : "hover:border-ring/60",
        ev.status !== "confirmed" && "opacity-60",
      )}
      style={{ top, height: h, borderLeftColor: color, transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
    >
      <p className="flex items-center gap-1.5 truncate font-medium">
        <span className="tabular">{ev.startLabel}</span>
        {ev.guestId ? (
          <Link href={`/dashboard/guests/${ev.guestId}` as Route} onPointerDown={(e) => e.stopPropagation()} className="truncate hover:underline">
            {ev.guest}
          </Link>
        ) : (
          <span className="truncate">{ev.guest}</span>
        )}
      </p>
      {h > 34 && <p className="truncate text-muted-foreground">{ev.service}</p>}
      {h > 52 && ev.source !== "staff" && (
        <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: SOURCE[ev.source] }} />
          Shanaya · {ev.source === "phone" ? "phone" : "website"}
        </p>
      )}
    </div>
  );
}
