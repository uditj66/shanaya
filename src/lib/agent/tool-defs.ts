// Tool schemas shown to the AI. Shared by phone (Vapi) and website (OpenAI); no server-only code here.
export type JsonSchema = { type: "object"; properties: Record<string, unknown>; required: string[] };
export type ToolDef = { name: string; description: string; parameters: JsonSchema };

export const toolDefs: ToolDef[] = [
  {
    name: "check_availability",
    description: "Find free appointment times for a service on a date. Call this before offering any time. If the date is full it returns the next available date.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "service_id from the Services list" },
        date: { type: "string", description: "YYYY-MM-DD" },
        preferred_time: { type: "string", description: "Optional HH:MM (24h) the guest prefers" },
        therapist_name: { type: "string", description: "Optional therapist the guest asked for" },
      },
      required: ["service_id", "date"],
    },
  },
  {
    name: "book_appointment",
    description: "Book a confirmed appointment. Only call after reading the details back and getting a clear yes.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM 24h, one of the times returned by check_availability" },
        customer_name: { type: "string" },
        phone: { type: "string", description: "Guest's mobile number (optional on phone calls: the caller's number is used)" },
        therapist_name: { type: "string", description: "Optional, only if the guest asked for someone" },
        notes: { type: "string", description: "Skin concerns, pregnancy, allergies, special requests" },
      },
      required: ["service_id", "date", "time", "customer_name"],
    },
  },
  {
    name: "find_appointments",
    description: "List the guest's upcoming appointments by mobile number.",
    parameters: { type: "object", properties: { phone: { type: "string", description: "Optional on phone calls" } }, required: [] },
  },
  {
    name: "reschedule_appointment",
    description: "Move an existing appointment to a new date and time. Check availability first.",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Booking reference, e.g. 3FA9C1" },
        new_date: { type: "string", description: "YYYY-MM-DD" },
        new_time: { type: "string", description: "HH:MM 24h" },
        phone: { type: "string", description: "Guest's mobile number, used to verify the booking (optional on phone calls)" },
      },
      required: ["reference", "new_date", "new_time"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancel an appointment after the guest confirms.",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string" },
        reason: { type: "string" },
        phone: { type: "string", description: "Guest's mobile number, used to verify the booking (optional on phone calls)" },
      },
      required: ["reference"],
    },
  },
  {
    name: "request_callback",
    description: "Ask the human team to call the guest back: complaints, medical questions, requests for a person, bridal or custom quotes, anything you cannot handle.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "What the guest needs, in one or two sentences" },
        customer_name: { type: "string" },
        phone: { type: "string" },
      },
      required: ["reason"],
    },
  },
];
