"use client";
import { useActionState } from "react";
import { signIn, type AuthState } from "./actions";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/components/admin/kit";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null);

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">Lumière</CardTitle>
          <CardDescription>Team dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4">
            <Field label="Email">
              <Input name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" required minLength={8} autoComplete="current-password" />
            </Field>
            {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            <Button className="w-full" disabled={pending}>{pending ? "Please wait…" : "Sign in"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
