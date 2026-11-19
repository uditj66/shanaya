"use client";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

// Light / dark / system theme for the team app, with no extra dependency.
// The choice lives in localStorage; THEME_SCRIPT (inlined in the (platform) root layout <head>)
// applies it before first paint so there is no flash. Brand sites never load any of this.

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "admin-theme";

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

const listeners = new Set<() => void>();
const read = (): ThemeChoice => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
};
const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const apply = () => {
  const t = read();
  document.documentElement.classList.toggle("dark", t === "dark" || (t === "system" && media().matches));
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onSystem = () => {
    apply();
    cb();
  };
  const onStorage = (e: StorageEvent) => e.key === KEY && onSystem();
  media().addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    media().removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(t: ThemeChoice) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  apply();
  listeners.forEach((l) => l());
}

/** The saved choice plus what is actually showing ("light" | "dark"). */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);
  const resolved = useSyncExternalStore<"light" | "dark">(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light" as const,
  );
  return { theme, resolved, setTheme };
}

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const satisfies readonly { value: ThemeChoice; label: string; icon: unknown }[];
