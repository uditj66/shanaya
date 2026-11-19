"use client";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Textarea } from "@/components/admin/kit";
import { Spinner } from "@/components/admin/ui/spinner";
import { saveGuest, type GuestSaveState } from "../actions";

export function GuestForm({ g, readOnly }: { g: { id: string; name: string; email: string | null; tags: string[]; preferences: string; notes: string }; readOnly: boolean }) {
  const [state, action, pending] = useActionState<GuestSaveState, FormData>(saveGuest, null);
  // Each save returns a fresh result object, so this fires once per save.
  useEffect(() => {
    if (state) (state.ok ? toast.success : toast.error)(state.message);
  }, [state]);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={g.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={g.name} readOnly={readOnly} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={g.email ?? ""} readOnly={readOnly} />
        </Field>
      </div>
      <Field label="Tags (comma separated)">
        <Input name="tags" defaultValue={g.tags.join(", ")} placeholder="bride, sensitive skin, vip" readOnly={readOnly} />
      </Field>
      <Field label="Preferences">
        <Textarea name="preferences" defaultValue={g.preferences} placeholder="Prefers Meera, likes a quiet room, fragrance-free products" readOnly={readOnly} className="min-h-20" />
      </Field>
      <Field label="Notes for the team">
        <Textarea name="notes" defaultValue={g.notes} placeholder="Allergies, skin concerns, anything the next therapist should know" readOnly={readOnly} className="min-h-24" />
      </Field>
      {!readOnly && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </form>
  );
}
