"use client";
import { useActionState } from "react";
import { saveGuest, type GuestSaveState } from "../actions";

export function GuestForm({ g, readOnly }: { g: { id: string; name: string; email: string | null; tags: string[]; preferences: string; notes: string }; readOnly: boolean }) {
  const [state, action, pending] = useActionState<GuestSaveState, FormData>(saveGuest, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={g.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input name="name" defaultValue={g.name} readOnly={readOnly} className="field" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" defaultValue={g.email ?? ""} readOnly={readOnly} className="field" />
        </label>
      </div>
      <label className="block">
        <span className="label">Tags (comma separated)</span>
        <input name="tags" defaultValue={g.tags.join(", ")} placeholder="bride, sensitive skin, vip" readOnly={readOnly} className="field" />
      </label>
      <label className="block">
        <span className="label">Preferences</span>
        <textarea name="preferences" defaultValue={g.preferences} placeholder="Prefers Meera, likes a quiet room, fragrance-free products" readOnly={readOnly} className="field min-h-20" />
      </label>
      <label className="block">
        <span className="label">Notes for the team</span>
        <textarea name="notes" defaultValue={g.notes} placeholder="Allergies, skin concerns, anything the next therapist should know" readOnly={readOnly} className="field min-h-24" />
      </label>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button disabled={pending} className="min-h-10 rounded-full bg-charcoal px-5 text-sm text-ivory disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          {state && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
        </div>
      )}
    </form>
  );
}
