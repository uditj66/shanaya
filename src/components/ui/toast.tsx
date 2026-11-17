"use client";
import { useSyncExternalStore } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; title: string; description?: string; tone?: "neutral" | "success" | "danger" };

// Tiny global store so any client component can call toast() without a context provider in its tree.
let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
const EMPTY: ToastItem[] = [];

export function toast(title: string, opts: Omit<ToastItem, "id" | "title"> = {}) {
  items = [...items, { id: ++seq, title, ...opts }];
  emit();
}
const dismiss = (id: number) => {
  items = items.filter((t) => t.id !== id);
  emit();
};

/** Mount once per site (in the root layout). Announced politely to screen readers by Radix. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <ToastPrimitive.Provider duration={5000} swipeDirection="right">
      {list.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "relative grid gap-1 rounded-xl border border-line bg-ivory/95 py-4 pr-12 pl-5 shadow-lift backdrop-blur-md",
            "data-[state=open]:animate-[pop-in_420ms_var(--ease-out-soft)] data-[state=closed]:animate-[fade-out_200ms_var(--ease-ui)]",
            "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=end]:animate-[fade-out_200ms_var(--ease-ui)]",
            t.tone === "success" && "border-l-2 border-l-success",
            t.tone === "danger" && "border-l-2 border-l-danger",
          )}
        >
          <ToastPrimitive.Title className="text-sm font-medium text-charcoal">{t.title}</ToastPrimitive.Title>
          {t.description && <ToastPrimitive.Description className="text-sm text-stone">{t.description}</ToastPrimitive.Description>}
          <ToastPrimitive.Close aria-label="Dismiss" className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full text-stone hover:bg-linen hover:text-charcoal">
            <X className="size-4" strokeWidth={1.25} />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 outline-none" />
    </ToastPrimitive.Provider>
  );
}
