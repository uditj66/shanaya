import { describe, expect, it } from "vitest";
import { depositRefundBlock, depositState, type DepositBooking } from "./deposit-refund";

// the real case: booked at 7:35 pm for 1:30 pm next day (after the 24-hour deadline), cancelled by staff at 7:39 pm
const kept: DepositBooking = {
  reference: "19FC1C", deposit_status: "forfeited", status: "cancelled",
  starts_at: "2026-11-25T08:00:00Z", refund_by: "2026-11-24T08:00:00Z",
  created_at: "2026-11-24T14:05:00Z", updated_at: "2026-11-24T14:09:00Z",
};
const TZ = "Asia/Kolkata";

describe("deposit refunds", () => {
  it("explains a kept deposit with the deadline, and that it was booked after the deadline had passed", () => {
    const why = depositRefundBlock(kept, TZ)!;
    expect(why).toContain("kept under your cancellation policy");
    expect(why).toContain("Booking 19FC1C (Wed 25 Nov, 1:30 PM)");
    expect(why).toContain("cancelled on Tue 24 Nov, 7:39 PM");
    expect(why).toContain("free-cancellation deadline of Tue 24 Nov, 1:30 PM");
    expect(why).toContain("could never be cancelled for free");
    expect(depositState(kept)).toEqual({ label: "Kept · late cancel", refundable: false });
  });

  it("doesn't mention booking late when it was booked in good time", () => {
    expect(depositRefundBlock({ ...kept, created_at: "2026-11-20T10:00:00Z" }, TZ)).not.toContain("never be cancelled for free");
  });

  it("allows a refund only while the deposit is still held", () => {
    expect(depositRefundBlock({ ...kept, deposit_status: "paid" }, TZ)).toBeNull();
    expect(depositState({ ...kept, deposit_status: "paid" }).refundable).toBe(true);
    expect(depositRefundBlock({ ...kept, deposit_status: "applied" }, TZ)).toContain("taken off the guest's bill");
    expect(depositRefundBlock({ ...kept, deposit_status: "refunded" }, TZ)).toContain("already been refunded");
    expect(depositRefundBlock(null, TZ)).toContain("can't be found");
  });
});
