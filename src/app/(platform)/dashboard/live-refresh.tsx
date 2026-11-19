"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Refreshes the dashboard the moment the AI books, cancels or logs a call, with a small toast. */
export function LiveRefresh({ salonId }: { salonId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`salon-${salonId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `salon_id=eq.${salonId}` }, (p) => {
        const row = p.new as { source?: string; status?: string };
        if (p.eventType === "INSERT")
          toast.success(row.source === "staff" ? "Booking added" : `New ${row.source === "phone" ? "phone" : "website"} booking by AI`);
        else if (row.status === "cancelled") toast.info("A booking was cancelled");
        router.refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callbacks", filter: `salon_id=eq.${salonId}` }, () => {
        toast.info("New call-back request");
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `salon_id=eq.${salonId}` }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId, router]);

  return null;
}
