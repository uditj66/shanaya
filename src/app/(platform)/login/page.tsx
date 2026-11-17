"use client";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { Button, Field, Input } from "@/components/dashboard-ui";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "in" ? signIn : signUp, null);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-gold">Shanaya</p>
        <h1 className="mt-2 text-center font-serif text-4xl font-semibold">{mode === "in" ? "Welcome back" : "Create your studio"}</h1>
        <p className="mt-2 text-center text-sm text-muted">AI receptionist and booking desk for premium salons.</p>
        <form action={action} className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6">
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} />
          </Field>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          {state?.info && <p className="text-sm text-sage">{state.info}</p>}
          <Button className="w-full" disabled={pending}>{pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
        </form>
        <button className="mt-4 w-full text-center text-sm text-muted hover:text-ink" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New salon? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
