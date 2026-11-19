"use client";
import { useActionState } from "react";
import { signIn, type AuthState } from "./actions";
import { Button, Field, Input } from "@/components/dashboard-ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-gold">Lumière · Shanaya</p>
        <h1 className="mt-2 text-center font-serif text-4xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-muted">The Lumière team&apos;s booking desk and AI receptionist.</p>
        <form action={action} className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6">
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required minLength={8} autoComplete="current-password" />
          </Field>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <Button className="w-full" disabled={pending}>{pending ? "Please wait…" : "Sign in"}</Button>
        </form>
      </div>
    </main>
  );
}
