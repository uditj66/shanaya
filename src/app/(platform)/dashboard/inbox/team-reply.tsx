"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hand, SendHorizontal, Undo2 } from "lucide-react";
import { Button, Textarea } from "@/components/admin/kit";
import { sendTeamReply, setTakeover } from "./actions";

/** Take over a website chat, reply as the team, and hand it back to the AI. Refreshes while the chat is live. */
export function TeamReply({ callId, takenBy, agentName }: { callId: string; takenBy: string | null; agentName: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  // While a team member is answering, pull in the guest's new messages every few seconds.
  useEffect(() => {
    if (!takenBy) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [takenBy, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong.");
      else after?.();
    });

  return (
    <div className="border-t bg-muted/40 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        {takenBy ? (
          <>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              {takenBy} is answering. {agentName} is paused.
            </span>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => setTakeover(callId, false))} className="ml-auto">
              <Undo2 aria-hidden /> Hand back to {agentName}
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">{agentName} is handling this chat.</span>
            <Button type="button" size="sm" disabled={pending} onClick={() => run(() => setTakeover(callId, true))} className="ml-auto">
              <Hand aria-hidden /> Take over
            </Button>
          </>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t) run(() => sendTeamReply(callId, t), () => setText(""));
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="team-reply" className="sr-only">
          Reply to the guest
        </label>
        <Textarea
          id="team-reply"
          rows={2}
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={takenBy ? "Write to the guest…" : "Reply as the team (this pauses the AI)…"}
          className="min-h-12 flex-1 resize-none bg-background"
        />
        <Button disabled={pending || !text.trim()}>
          <SendHorizontal aria-hidden />
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
