// Booking money rules shared by the booking code and the AI's knowledge, so what Shanaya says always matches what
// the system does. Brand-editable values (deposit amount, refund hours) live on the brand row; these are fixed.

/** How many upcoming bookings a member may hold without a deposit (owner's rule, 2026-11-20). */
export const MEMBER_FREE_HOLDS = 3;

/** Gift cards are valid this long from purchase. */
export const GIFT_CARD_VALIDITY_MONTHS = 12;
