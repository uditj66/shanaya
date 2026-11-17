"use client";
import { useId } from "react";
import { Checkbox as CheckboxPrimitive, Label as LabelPrimitive, RadioGroup as RadioPrimitive, Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control = [
  "w-full rounded-lg border border-line bg-white/80 px-4 text-[0.9375rem] text-charcoal placeholder:text-stone/70",
  "transition-[border-color,box-shadow,background-color] duration-[var(--duration-ui)] ease-[var(--ease-ui)]",
  "hover:border-champagne focus-visible:border-brass focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-brass/12 focus-visible:outline-none",
  "aria-invalid:border-danger aria-invalid:ring-danger/10 disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(control, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("text-[0.8125rem] font-medium tracking-[0.02em] text-charcoal", className)} {...props} />;
}

/**
 * Label + control + hint + error, wired for screen readers (aria-describedby / aria-invalid).
 * Works with React Hook Form: pass `error={formState.errors.x?.message}`.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })}
      {hint && !error && <p id={hintId} className="text-[0.8125rem] text-stone">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-[0.8125rem] text-danger">{error}</p>}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer grid size-6 shrink-0 place-items-center rounded-[6px] border border-charcoal/35 bg-white transition-colors duration-[var(--duration-ui)]",
        "hover:border-charcoal data-[state=checked]:border-charcoal data-[state=checked]:bg-charcoal data-[state=checked]:text-ivory",
        "focus-visible:ring-4 focus-visible:ring-brass/15",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={2} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className={cn("grid gap-3", className)} {...props} />;
}

/** A selectable card (used for studio / specialist / time choices). */
export function RadioCard({ className, children, ...props }: React.ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        "rounded-xl border border-line bg-white/70 p-4 text-left transition-[border-color,background-color,box-shadow] duration-[var(--duration-ui)]",
        "hover:border-champagne data-[state=checked]:border-charcoal data-[state=checked]:bg-blush/40 data-[state=checked]:shadow-soft",
        "focus-visible:ring-4 focus-visible:ring-brass/15 disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </RadioPrimitive.Item>
  );
}

export function Select({
  placeholder,
  options,
  className,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...root
}: React.ComponentProps<typeof SelectPrimitive.Root> & {
  placeholder?: string;
  options: { value: string; label: string }[];
  className?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  return (
    <SelectPrimitive.Root {...root}>
      <SelectPrimitive.Trigger
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className={cn(control, "flex h-12 items-center justify-between gap-2 text-left data-[placeholder]:text-stone/70", className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-stone" strokeWidth={1.5} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-ivory shadow-lift data-[state=open]:animate-[pop-in_220ms_var(--ease-out-soft)]"
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex min-h-10 cursor-pointer items-center rounded-lg py-2 pr-9 pl-3 text-sm outline-none select-none data-[highlighted]:bg-linen data-[state=checked]:font-medium"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3">
                  <Check className="size-4 text-brass-ink" strokeWidth={1.75} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
