/** One dot per included treatment in a period: filled = used, ringed = booked, empty = still available. */
export function UsageDots({ total, used, booked }: { total: number; used: number; booked: number }) {
  const dots = Array.from({ length: Math.min(total, 12) }, (_, i) => (i < used ? "used" : i < used + booked ? "booked" : "free"));
  return (
    <span className="flex gap-1" role="img" aria-label={`${used} used, ${booked} booked, ${Math.max(0, total - used - booked)} available`}>
      {dots.map((d, i) => (
        <span
          key={i}
          className={
            d === "used" ? "size-2.5 rounded-full bg-foreground"
            : d === "booked" ? "size-2.5 rounded-full border-2 border-primary"
            : "size-2.5 rounded-full border bg-card"
          }
        />
      ))}
    </span>
  );
}
