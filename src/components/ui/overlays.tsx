"use client";
import { Dialog as DialogPrimitive, Tabs as TabsPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Dialog & Sheet (one Radix Dialog, two presentations) ─────────────── */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlay =
  "fixed inset-0 z-50 bg-charcoal/25 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_300ms_var(--ease-out-soft)] data-[state=closed]:animate-[fade-out_200ms_var(--ease-ui)]";

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-ivory p-7 shadow-lift md:p-9",
          "data-[state=open]:animate-[pop-in_420ms_var(--ease-out-soft)] data-[state=closed]:animate-[fade-out_200ms_var(--ease-ui)]",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="display-cut pr-8 text-h3">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-2 text-stone">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        <div className="mt-6">{children}</div>
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Side panel on desktop, bottom sheet on phones. */
export function SheetContent({
  className,
  children,
  title,
  description,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string; side?: "right" | "bottom" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-ivory shadow-lift",
          side === "right"
            ? "inset-y-0 right-0 w-[min(30rem,100vw)] border-l border-line data-[state=open]:animate-[sheet-in-right_520ms_var(--ease-out-soft)] data-[state=closed]:animate-[sheet-out-right_260ms_var(--ease-ui)]"
            : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t border-line data-[state=open]:animate-[sheet-in-bottom_520ms_var(--ease-out-soft)] data-[state=closed]:animate-[sheet-out-bottom_260ms_var(--ease-ui)]",
          className,
        )}
        {...props}
      >
        {side === "bottom" && <span aria-hidden className="mx-auto mt-3 h-1 w-10 rounded-full bg-sand" />}
        <div className="px-6 pt-6 pb-2 md:px-8 md:pt-8">
          <DialogPrimitive.Title className="display-cut pr-10 text-h3">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1.5 text-sm text-stone">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        <div data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain px-6 pb-8 md:px-8">
          {children}
        </div>
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function CloseButton() {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className="absolute top-5 right-5 grid size-11 place-items-center rounded-full text-stone transition-colors duration-[var(--duration-ui)] hover:bg-linen hover:text-charcoal"
    >
      <X className="size-5" strokeWidth={1.25} />
    </DialogPrimitive.Close>
  );
}

/* ── Tabs: understated text tabs with a brass underline ────────────────── */
export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-7 overflow-x-auto border-b border-line [scrollbar-width:none]", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px min-h-11 shrink-0 pb-3 text-sm tracking-[0.02em] text-stone transition-colors duration-[var(--duration-ui)] hover:text-charcoal",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-charcoal after:transition-transform after:duration-500 after:ease-[var(--ease-out-soft)]",
        "data-[state=active]:text-charcoal data-[state=active]:after:scale-x-100",
        className,
      )}
      {...props}
    />
  );
}

/* ── Tooltip ────────────────────────────────────────────────────────────── */
export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={8}
            className="z-50 max-w-64 rounded-lg bg-charcoal px-3 py-2 text-[0.8125rem] leading-snug text-ivory shadow-lift data-[state=delayed-open]:animate-[fade-in_200ms_var(--ease-out-soft)]"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
