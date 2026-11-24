"use client";
// Type the mobile number instead of saying it, during a website voice call. Spoken digits are easy to mis-hear
// ("double 7", a dropped "3") and each repeat costs time and AI credits; a typed number arrives exact, once.
import { useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import { ArrowUp, Check, Smartphone } from "lucide-react";
import { cleanMobile } from "@/components/use-shanaya-voice";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";

export function NumberEntry({ asked, onSend }: { asked: boolean; onSend: (digits: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const show = asked || open;

  // When Shanaya asks for the number, put the cursor in the box (the phone keyboard opens on mobile).
  useEffect(() => {
    if (asked) input.current?.focus({ preventScroll: true });
  }, [asked]);

  const submit = () => {
    const digits = cleanMobile(value);
    if (!digits) return setError("Please enter a 10-digit mobile number.");
    onSend(digits);
    setSent(digits.slice(-4));
    setValue("");
    setError(null);
    setOpen(false);
  };

  if (!show) {
    return sent ? (
      <p className="flex items-center gap-1.5 text-[0.8125rem] text-stone" role="status">
        <Check className="size-4 text-brass-ink" strokeWidth={1.75} aria-hidden /> Number ending {sent} sent
      </p>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-9 items-center gap-1.5 text-[0.8125rem] text-stone underline-offset-4 hover:text-charcoal hover:underline">
        <Smartphone className="size-4" strokeWidth={1.5} aria-hidden /> Type your number instead
      </button>
    );
  }

  return (
    <m.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT_SOFT }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="w-full max-w-[20rem]"
    >
      <label htmlFor="call-mobile" className="mb-1.5 block text-center text-[0.8125rem] text-stone">
        Type your mobile number here, it&apos;s quicker
      </label>
      <div className="flex items-center gap-2 rounded-full border border-line bg-white/85 py-1.5 pr-1.5 pl-4 focus-within:border-brass focus-within:ring-4 focus-within:ring-brass/10">
        <span className="text-[0.9375rem] text-stone" aria-hidden>
          +91
        </span>
        <input
          ref={input}
          id="call-mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={14}
          placeholder="98765 43210"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "call-mobile-error" : undefined}
          className="min-w-0 flex-1 bg-transparent text-[1.0625rem] tracking-[0.04em] outline-none placeholder:text-stone/50"
        />
        <button type="submit" aria-label="Send my number to Shanaya" className="grid size-9 shrink-0 place-items-center rounded-full bg-charcoal text-ivory hover:bg-charcoal/90">
          <ArrowUp className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      {error && (
        <p id="call-mobile-error" role="alert" className="mt-1.5 text-center text-[0.75rem] text-danger">
          {error}
        </p>
      )}
    </m.form>
  );
}
