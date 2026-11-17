"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refreshes the dashboard the moment the AI books, cancels or logs a call, with a small toast. */
export function LiveRefresh({ salonId }: { salonId: string }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`salon-${salonId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `salon_id=eq.${salonId}` }, (p) => {
        const row = p.new as { source?: string; status?: string };
        if (p.eventType === "INSERT") setToast(row.source === "staff" ? "Booking added" : `New ${row.source === "phone" ? "phone" : "website"} booking by AI`);
        else if (row.status === "cancelled") setToast("A booking was cancelled");
        router.refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callbacks", filter: `salon_id=eq.${salonId}` }, () => {
        setToast("New call-back request");
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `salon_id=eq.${salonId}` }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div role="status" className="fixed right-4 bottom-4 z-50 rounded-xl bg-ink px-4 py-3 text-sm text-ivory shadow-lg">
      {toast}
    </div>
  );
}
