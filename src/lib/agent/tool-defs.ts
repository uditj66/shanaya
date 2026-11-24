// Tool schemas shown to the AI. Shared by phone/web voice (Vapi) and typed chat (OpenAI); no server-only code here.
// Tools work across the whole chain: every booking action names a branch_id and a service code from the knowledge.
export type JsonSchema = { type: "object"; properties: Record<string, unknown>; required: string[] };
export type ToolDef = { name: string; description: string; parameters: JsonSchema };

const branch = { type: "string", description: "branch_id from the Branch directory (the branch the guest chose)" };
const service = { type: "string", description: "Service code from the menu, e.g. FAC003 (or a package code such as PKG002)" };

export const toolDefs: ToolDef[] = [
  {
    name: "check_availability",
    description: "Find free appointment times for a service at a branch on a date. Call this before offering any time. If that day is full it returns the next available date.",
    parameters: {
      type: "object",
      properties: {
        branch_id: branch,
        service,
        date: { type: "string", description: "YYYY-MM-DD" },
        preferred_time: { type: "string", description: "Optional HH:MM (24h) the guest prefers" },
        therapist_name: { type: "string", description: "Optional therapist the guest asked for" },
      },
      required: ["branch_id", "service", "date"],
    },
  },
  {
    name: "book_appointment",
    description: "Book a confirmed appointment. Only call after reading the details back (branch, treatment, day, time, name) and getting a clear yes.",
    parameters: {
      type: "object",
      properties: {
        branch_id: branch,
        service,
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM 24h, one of the times returned by check_availability" },
        customer_name: { type: "string" },
        phone: { type: "string", description: "Her mobile number. Optional only on phone calls with caller ID (the caller's number is used)" },
        therapist_name: { type: "string", description: "Optional, only if the guest asked for someone" },
        notes: { type: "string", description: "Skin concerns, pregnancy, allergies, occasion, special requests" },
        gift_card_code: { type: "string", description: "Optional gift card code she wants to pay with, e.g. LUM-AB12-CD34 (check it first with check_gift_card)" },
      },
      required: ["branch_id", "service", "date", "time", "customer_name"],
    },
  },
  {
    name: "check_gift_card",
    description:
      "Check a gift card code: whether it can be used and its balance. Use it when she wants to pay with a gift card or asks how much is left on one, before book_appointment. Membership benefits need no tool: book_appointment applies them from her mobile number.",
    parameters: {
      type: "object",
      properties: { code: { type: "string", description: "The gift card code, e.g. LUM-AB12-CD34" } },
      required: ["code"],
    },
  },
  {
    name: "guest_history",
    description:
      "Recognise a returning guest and look up her past visits at any branch of the brand: treatments, branches, the therapist, doctor or beautician who served her, her usual branch, any upcoming visit and membership. On the website, call it once you have her mobile number and first name. Also use it when she wants 'the same person as last time'.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Her mobile number. Optional only on phone calls with caller ID" },
        name: { type: "string", description: "Her first name as she gave it (required on the website: it must match the name on her bookings)" },
        reference: { type: "string", description: "Optional: any of her booking references, if she happens to have one" },
      },
      required: [],
    },
  },
  {
    name: "find_appointments",
    description:
      "Find the guest's upcoming appointments at any branch of the brand. On phone calls the caller's number is enough; on the website (no caller ID) a booking reference plus mobile number is required.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Her mobile number. Optional only on phone calls with caller ID" },
        reference: { type: "string", description: "Booking reference (required on the website)" },
      },
      required: [],
    },
  },
  {
    name: "reschedule_appointment",
    description: "Move an existing appointment (same branch) to a new date and time. Check availability first. If find_appointments gave a late_change_note for it, tell her that note before moving it.",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Booking reference, e.g. 3FA9C1" },
        new_date: { type: "string", description: "YYYY-MM-DD" },
        new_time: { type: "string", description: "HH:MM 24h" },
        phone: { type: "string", description: "Her mobile number, used to verify the booking. Optional only on phone calls with caller ID" },
      },
      required: ["reference", "new_date", "new_time"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancel an appointment after the guest confirms. If find_appointments gave a late_change_note for it, tell her that note first and only cancel once she still wants to.",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string" },
        reason: { type: "string" },
        phone: { type: "string", description: "Her mobile number, used to verify the booking. Optional only on phone calls with caller ID" },
      },
      required: ["reference"],
    },
  },
  {
    name: "request_callback",
    description: "Ask the team to call the guest back: consultations (medi-facials, bridal and honeymoon programmes), complaints, medical questions, requests for a person, custom quotes. Needs her name and mobile number.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "What she needs, including preferred dates if relevant" },
        customer_name: { type: "string" },
        phone: { type: "string" },
        branch_id: { type: "string", description: "Branch she prefers, if known" },
      },
      required: ["reason"],
    },
  },
];
