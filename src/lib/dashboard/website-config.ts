// The website editor's content types. One field spec drives the dashboard form (client) and the validation (server),
// so adding a field is a one-line change here.

export type FieldType = "text" | "textarea" | "number" | "bool" | "lines" | "csv" | "image" | "date" | "select" | "studio" | "faqs" | "nudge";
export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number;
  min?: number;
  hint?: string;
  options?: { value: string; label: string }[];
  /** For image fields: which manifest sections to offer (e.g. ["services", "rituals"]). Empty = all. */
  sections?: string[];
};

export type CollectionKey = "brand" | "treatments" | "specialists" | "testimonials" | "press" | "offers" | "memberships" | "lookbook";
export type Collection = {
  key: CollectionKey;
  label: string;
  intro: string;
  table: "brands" | "service_content" | "staff" | "testimonials" | "press" | "offers" | "memberships" | "lookbook_items";
  /** The column that names a row in the list. */
  titleField: string;
  fields: Field[];
  canAdd: boolean;
  /** Which part of the public site to refresh after a save. */
  tag: "brand" | "menu" | "team" | "content";
};

const PUBLISH: Field[] = [
  { name: "published", label: "Show on the website", type: "bool" },
  { name: "is_sample", label: "Sample content (hidden on the live site until you untick this)", type: "bool" },
  { name: "sort_order", label: "Order (lower shows first)", type: "number", min: 0, max: 999 },
];

export const COLLECTIONS: Collection[] = [
  {
    key: "brand",
    label: "Brand & concierge",
    intro: "Your story, contact details, the questions the concierge answers, and when it greets visitors.",
    table: "brands",
    titleField: "full_name",
    canAdd: false,
    tag: "brand",
    fields: [
      { name: "tagline", label: "Tagline", type: "text", max: 120 },
      { name: "story", label: "Brand story (About page)", type: "textarea", max: 3000 },
      { name: "phone", label: "Main phone", type: "text", max: 20 },
      { name: "email", label: "Main email", type: "text", max: 120 },
      { name: "instagram", label: "Instagram handle", type: "text", max: 60 },
      { name: "faqs", label: "Frequently asked questions", type: "faqs", hint: "Shown on the site and used by the concierge to answer guests." },
      { name: "nudge_settings", label: "Concierge greetings", type: "nudge" },
      { name: "deposit_amount", label: "Online booking deposit (₹)", type: "number", min: 0, max: 100000, required: true, hint: "Taken when guests book on the website or in the chat, and taken off the bill at the studio. 0 turns deposits off." },
      { name: "deposit_refund_hours", label: "Refund the deposit if cancelled at least (hours before)", type: "number", min: 0, max: 168, required: true },
      { name: "deposit_hold_minutes", label: "Hold an unpaid booking for (minutes)", type: "number", min: 5, max: 60, required: true },
    ],
  },
  {
    key: "treatments",
    label: "Treatments",
    intro: "How each treatment is described on the website. Prices and durations come from each studio's menu (Treatments).",
    table: "service_content",
    titleField: "headline",
    canAdd: false,
    tag: "menu",
    fields: [
      { name: "headline", label: "Headline", type: "text", max: 160 },
      { name: "image", label: "Photo", type: "image", sections: ["services", "rituals", "occasions", "hero"] },
      { name: "featured", label: "Feature on the home page", type: "bool" },
      { name: "sort_order", label: "Order (lower shows first)", type: "number", min: 0, max: 999 },
      { name: "ritual", label: "The ritual, step by step (one per line)", type: "lines" },
      { name: "benefits", label: "Benefits (one per line)", type: "lines" },
    ],
  },
  {
    key: "specialists",
    label: "Specialists",
    intro: "Public profiles for your therapists. Names, shifts and studios are managed in Team & hours.",
    table: "staff",
    titleField: "name",
    canAdd: false,
    tag: "team",
    fields: [
      { name: "title", label: "Title", type: "text", max: 80, hint: "e.g. Senior Skin Therapist" },
      { name: "bio", label: "Bio", type: "textarea", max: 1200 },
      { name: "specialties", label: "Specialties (comma separated)", type: "csv" },
      { name: "languages", label: "Languages (comma separated)", type: "csv" },
      { name: "years_experience", label: "Years of experience", type: "number", min: 0, max: 60 },
      { name: "public_profile", label: "Show a profile page on the website", type: "bool" },
    ],
  },
  {
    key: "testimonials",
    label: "Testimonials",
    intro: "Guest words for the home and studio pages. Only publish quotes guests have agreed to share.",
    table: "testimonials",
    titleField: "guest_name",
    canAdd: true,
    tag: "content",
    fields: [
      { name: "guest_name", label: "Guest's first name", type: "text", required: true, max: 60 },
      { name: "quote", label: "Quote", type: "textarea", required: true, max: 600 },
      { name: "rating", label: "Rating (1–5)", type: "number", min: 1, max: 5, required: true },
      { name: "salon_id", label: "Studio", type: "studio" },
      { name: "service_code", label: "Treatment code (optional)", type: "text", max: 20 },
      ...PUBLISH,
    ],
  },
  {
    key: "press",
    label: "Press",
    intro: "Mentions in publications, shown as a quiet row on the home and About pages.",
    table: "press",
    titleField: "publication",
    canAdd: true,
    tag: "content",
    fields: [
      { name: "publication", label: "Publication", type: "text", required: true, max: 80 },
      { name: "headline", label: "Headline", type: "text", required: true, max: 200 },
      { name: "url", label: "Link", type: "text", max: 300 },
      { name: "year", label: "Year", type: "number", min: 1990, max: 2100 },
      ...PUBLISH,
    ],
  },
  {
    key: "offers",
    label: "Offers",
    intro: "Seasonal offers on the Offers page. They hide themselves after the end date.",
    table: "offers",
    titleField: "title",
    canAdd: true,
    tag: "content",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 100 },
      { name: "description", label: "Description", type: "textarea", required: true, max: 600 },
      { name: "terms", label: "Terms", type: "textarea", max: 600 },
      { name: "image", label: "Photo", type: "image" },
      { name: "service_code", label: "Treatment code (optional)", type: "text", max: 20 },
      { name: "starts_on", label: "Starts", type: "date" },
      { name: "ends_on", label: "Ends", type: "date" },
      ...PUBLISH,
    ],
  },
  {
    key: "memberships",
    label: "Memberships",
    intro: "Membership tiers on the Offers & memberships page. Guests enquire; the team follows up.",
    table: "memberships",
    titleField: "name",
    canAdd: true,
    tag: "content",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 60 },
      { name: "price", label: "Price", type: "number", min: 0, max: 1000000, required: true },
      { name: "period", label: "Billed", type: "select", options: [{ value: "year", label: "Yearly" }, { value: "6 months", label: "Every 6 months" }, { value: "month", label: "Monthly" }] },
      { name: "benefits", label: "Benefits (one per line)", type: "lines" },
      { name: "highlight", label: "Highlight as the recommended tier", type: "bool" },
      ...PUBLISH,
    ],
  },
  {
    key: "lookbook",
    label: "Lookbook",
    intro: "Editorial photos for the Lookbook page. Use only your own photography or licensed images.",
    table: "lookbook_items",
    titleField: "title",
    canAdd: true,
    tag: "content",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 100 },
      { name: "category", label: "Category", type: "select", required: true, options: ["Skin", "Spa", "Hair", "Nails", "Bridal", "Studio"].map((v) => ({ value: v, label: v })) },
      { name: "caption", label: "Caption", type: "textarea", max: 400 },
      { name: "image", label: "Photo", type: "image", required: true },
      { name: "service_code", label: "Treatment code (optional)", type: "text", max: 20 },
      ...PUBLISH,
    ],
  },
];

export const collection = (key: string) => COLLECTIONS.find((c) => c.key === key);

export type Row = { id: string; values: Record<string, unknown>; label: string; sub?: string };
export type ImageOption = { id: string; file: string; alt: string };
