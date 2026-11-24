/** Soft gold orb that breathes while connecting and pulses while Shanaya speaks. */
export function VoiceOrb({ active, connecting, size = 48 }: { active: boolean; connecting?: boolean; size?: number }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      <span className={`absolute inset-0 rounded-full bg-gold/30 ${active ? "motion-safe:animate-ping" : connecting ? "motion-safe:animate-pulse" : ""}`} />
      <span className={`relative h-full w-full rounded-full bg-gradient-to-br from-[#e9d3b0] via-gold to-rose shadow-lg motion-safe:transition-transform motion-safe:duration-300 ${active ? "scale-105" : "scale-95"}`} />
    </span>
  );
}
