// First-party, privacy-friendly site analytics: no cookies, no IP stored, a random id per browser tab, and nothing at
// all when the visitor has asked not to be tracked (Global Privacy Control / Do Not Track).
export type TrackKind = "page_view" | "booking_step" | "booking_done" | "chat_open" | "chat_message" | "enquiry";

let brand: string | null = null;
let last = "";

export function setTrackBrand(slug: string) {
  brand = slug;
}

function sessionId() {
  try {
    let id = sessionStorage.getItem("site:sid");
    if (!id) sessionStorage.setItem("site:sid", (id = crypto.randomUUID().replace(/-/g, "")));
    return id;
  } catch {
    return null;
  }
}

function optedOut() {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === "1";
}

export function track(kind: TrackKind, detail: Record<string, string | number> = {}) {
  if (typeof window === "undefined" || !brand || optedOut()) return;
  const sid = sessionId();
  if (!sid) return;
  const path = location.pathname.slice(0, 200);
  const key = `${kind}|${path}|${JSON.stringify(detail)}`;
  if (key === last) return; // React Strict Mode and re-renders can fire the same event twice
  last = key;
  const body = JSON.stringify({ brand, sid, kind, path, detail });
  if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "text/plain" }))) {
    void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
  }
}
