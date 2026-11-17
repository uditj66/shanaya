/**
 * Lightweight map: an OpenStreetMap embed that only loads when scrolled near (loading="lazy"), so it never costs the
 * page's first paint and ships no map JavaScript of our own. A plain link is always available as the accessible fallback.
 */
export function StudioMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const d = 0.008;
  const bbox = [lng - d, lat - d * 0.6, lng + d, lat + d * 0.6].map((n) => n.toFixed(5)).join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
  return (
    <figure>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-image)] border border-line bg-sand">
        <iframe
          title={`Map showing ${label}`}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full [filter:saturate(0.55)_sepia(0.12)_contrast(0.98)]"
        />
      </div>
      <figcaption className="mt-3 text-[0.8125rem] text-stone">
        Map data © OpenStreetMap contributors ·{" "}
        <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-charcoal">
          Open larger map
        </a>
      </figcaption>
    </figure>
  );
}
