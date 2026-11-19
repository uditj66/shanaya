"use client";
import { ExternalLink, Play } from "lucide-react";
import { useShanayaVoice } from "@/components/use-shanaya-voice";
import { VoiceOrb } from "@/components/voice-orb";
import { Button, buttonVariants } from "@/components/admin/kit";

/** Shown when Shanaya is a saved assistant in Vapi: her voice and personality are edited there. */
export function VapiManaged({ assistantId, agentName }: { assistantId: string; agentName: string }) {
  const voice = useShanayaVoice("/api/voice-preview");
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{agentName}&apos;s voice and personality are managed in Vapi</p>
          <p className="text-xs text-muted-foreground">One assistant for every branch, on phone and website. Changes in Vapi apply to the next call.</p>
        </div>
        {voice.live ? (
          <Button type="button" variant="destructive" size="sm" onClick={voice.stop}>
            <VoiceOrb active={voice.speaking} connecting={voice.status === "connecting"} size={16} /> End test call
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={voice.start}>
            <Play aria-hidden /> Talk to {agentName}
          </Button>
        )}
      </div>
      {voice.error && <p role="alert" className="text-xs text-destructive">{voice.error}</p>}
      <a href={`https://dashboard.vapi.ai/assistants/${assistantId}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
        Edit {agentName} in Vapi <ExternalLink aria-hidden />
      </a>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        <li>Voice: Vapi → Assistant → Voice → pick a voice and press play to preview.</li>
        <li>Personality and greeting: Model → System prompt / First message. Keep the {"{{knowledge}}"} line: it carries live branches, menu and calendar.</li>
        <li>Services, prices, branches and hours: edit them here in your dashboard, never in Vapi.</li>
      </ul>
    </div>
  );
}
