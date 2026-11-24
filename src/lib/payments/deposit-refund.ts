// Why a booking deposit can or can't be refunded from the dashboard, in words a manager understands.
// Pure (no database), so the Payments list, the refund dialog and the refund action all say the same thing.
import { formatInTimeZone } from "date-fns-tz";
import type { DepositStatus } from "../database.types";

export type DepositBooking = {
  reference: string;
  deposit_status: DepositStatus | null;
  starts_at: string;
  refund_by: string | null; // free-cancellation deadline (24 hours before by default)
  created_at: string;
  updated_at: string; // when it was cancelled, for a cancelled booking
  status: string;
};

/** Short label for the Payments list (null = still held, so it can be refunded). */
export function depositState(b: DepositBooking | null): { label: string; refundable: boolean } {
  switch (b?.deposit_status) {
    case "paid":
      return { label: "Held", refundable: true };
    case "forfeited":
      return { label: "Kept · late cancel", refundable: false };
    case "applied":
      return { label: "Used on bill", refundable: false };
    case "refunded":
      return { label: "Refunded", refundable: false };
    default:
      return { label: "Not held", refundable: false };
  }
}

const when = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "EEE d MMM, h:mm a");

/** The full reason a deposit can't be refunded, or null when it can. */
export function depositRefundBlock(b: DepositBooking | null, tz: string): string | null {
  if (!b) return "The booking for this deposit can't be found, so it can't be refunded here.";
  const ref = `Booking ${b.reference} (${when(b.starts_at, tz)})`;
  switch (b.deposit_status) {
    case "paid":
      return null;
    case "forfeited": {
      const deadline = b.refund_by ? when(b.refund_by, tz) : null;
      const bookedLate = b.refund_by && Date.parse(b.created_at) >= Date.parse(b.refund_by);
      return [
        `The deposit was kept under your cancellation policy. ${ref} was cancelled on ${when(b.updated_at, tz)}`,
        deadline ? `, after the free-cancellation deadline of ${deadline} (the refund window before the appointment).` : ", too close to the appointment.",
        bookedLate ? ` It was booked on ${when(b.created_at, tz)}, when that deadline had already passed, so it could never be cancelled for free.` : "",
      ].join("");
    }
    case "applied":
      return `${ref}: the deposit was already taken off the guest's bill at the studio, so there's nothing left to refund.`;
    case "refunded":
      return `${ref}: this deposit has already been refunded.`;
    default:
      return `${ref}: no deposit is being held for this booking (it was never paid, or the hold expired).`;
  }
}
