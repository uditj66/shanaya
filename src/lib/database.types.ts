// Generated from the Supabase project schema (regenerate after schema changes).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Booking deposit lifecycle (online bookings only). */
export type DepositStatus = "pending" | "paid" | "refunded" | "forfeited" | "applied" | "expired";
/** A gift card used to pay for an online booking: used, put back on the card after a cancellation, or kept (late cancel). */
export type GiftCardUse = "used" | "returned" | "kept";
/** What a membership gave an online booking. */
export type MemberBenefit = "discount" | "included";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      agent_events: {
        Row: { created_at: string; detail: Json; id: string; kind: string; salon_id: string | null };
        Insert: { created_at?: string; detail?: Json; id?: string; kind: string; salon_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["agent_events"]["Insert"]>;
        Relationships: [];
      };
      tool_call_log: {
        Row: { created_at: string; result: Json; salon_id: string | null; tool: string; tool_call_id: string };
        Insert: { created_at?: string; result: Json; salon_id?: string | null; tool: string; tool_call_id: string };
        Update: Partial<Database["public"]["Tables"]["tool_call_log"]["Insert"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          blocked_until: string; call_id: string | null; cancel_reason: string | null; created_at: string; created_by: string | null;
          customer_id: string; ends_at: string; id: string; notes: string; price: number; reference: string; salon_id: string;
          service_id: string; source: Database["public"]["Enums"]["booking_source"]; staff_id: string; starts_at: string;
          status: Database["public"]["Enums"]["booking_status"]; updated_at: string;
          deposit_amount: number | null; deposit_status: DepositStatus | null; hold_expires_at: string | null; pay_token: string | null;
          gift_card_id: string | null; gift_card_amount: number | null; gift_card_state: GiftCardUse | null;
          membership_purchase_id: string | null; member_benefit: MemberBenefit | null; member_discount: number | null;
          member_included_from: string | null; refund_by: string | null; late_cancel: boolean;
        };
        Insert: {
          blocked_until: string; call_id?: string | null; cancel_reason?: string | null; created_at?: string; created_by?: string | null;
          customer_id: string; ends_at: string; id?: string; notes?: string; price?: number; reference?: string; salon_id: string;
          service_id: string; source?: Database["public"]["Enums"]["booking_source"]; staff_id: string; starts_at: string;
          status?: Database["public"]["Enums"]["booking_status"]; updated_at?: string;
          deposit_amount?: number | null; deposit_status?: DepositStatus | null; hold_expires_at?: string | null; pay_token?: string | null;
          gift_card_id?: string | null; gift_card_amount?: number | null; gift_card_state?: GiftCardUse | null;
          membership_purchase_id?: string | null; member_benefit?: MemberBenefit | null; member_discount?: number | null;
          member_included_from?: string | null; refund_by?: string | null; late_cancel?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "bookings_call_id_fkey"; columns: ["call_id"]; isOneToOne: false; referencedRelation: "calls"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_service_id_fkey"; columns: ["service_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_gift_card_id_fkey"; columns: ["gift_card_id"]; isOneToOne: false; referencedRelation: "gift_cards"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_membership_purchase_id_fkey"; columns: ["membership_purchase_id"]; isOneToOne: false; referencedRelation: "membership_purchases"; referencedColumns: ["id"] },
        ];
      };
      callbacks: {
        Row: {
          call_id: string | null; created_at: string; customer_name: string | null; id: string; phone: string | null; reason: string;
          resolved_at: string | null; resolved_by: string | null; salon_id: string; status: Database["public"]["Enums"]["callback_status"];
        };
        Insert: {
          call_id?: string | null; created_at?: string; customer_name?: string | null; id?: string; phone?: string | null; reason: string;
          resolved_at?: string | null; resolved_by?: string | null; salon_id: string; status?: Database["public"]["Enums"]["callback_status"];
        };
        Update: Partial<Database["public"]["Tables"]["callbacks"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "callbacks_call_id_fkey"; columns: ["call_id"]; isOneToOne: false; referencedRelation: "calls"; referencedColumns: ["id"] },
          { foreignKeyName: "callbacks_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      calls: {
        Row: {
          agent_state: Json; channel: Database["public"]["Enums"]["call_channel"]; cost: number | null; created_at: string; customer_id: string | null;
          customer_phone: string | null; duration_seconds: number | null; ended_at: string | null; ended_reason: string | null;
          external_id: string | null; id: string; outcome: string | null; recording_url: string | null; salon_id: string;
          started_at: string | null; summary: string | null; transcript: string | null;
        };
        Insert: {
          agent_state?: Json; channel: Database["public"]["Enums"]["call_channel"]; cost?: number | null; created_at?: string; customer_id?: string | null;
          customer_phone?: string | null; duration_seconds?: number | null; ended_at?: string | null; ended_reason?: string | null;
          external_id?: string | null; id?: string; outcome?: string | null; recording_url?: string | null; salon_id: string;
          started_at?: string | null; summary?: string | null; transcript?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["calls"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "calls_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "calls_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      customers: {
        Row: { created_at: string; email: string | null; id: string; name: string; notes: string; phone: string; salon_id: string; tags: string[]; preferences: string };
        Insert: { created_at?: string; email?: string | null; id?: string; name: string; notes?: string; phone: string; salon_id: string; tags?: string[]; preferences?: string };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "customers_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      packages: {
        Row: {
          active: boolean; code: string; created_at: string; description: string; id: string; included_codes: string[]; name: string;
          occasion: string; price: number; salon_id: string; service_id: string | null; target_customers: string[]; validity_days: number | null; visits: number;
        };
        Insert: {
          active?: boolean; code: string; created_at?: string; description?: string; id?: string; included_codes?: string[]; name: string;
          occasion: string; price: number; salon_id: string; service_id?: string | null; target_customers?: string[]; validity_days?: number | null; visits?: number;
        };
        Update: Partial<Database["public"]["Tables"]["packages"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "packages_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
          { foreignKeyName: "packages_service_id_fkey"; columns: ["service_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id"] },
        ];
      };
      salon_members: {
        Row: { created_at: string; role: Database["public"]["Enums"]["member_role"]; salon_id: string; user_id: string; staff_id: string | null };
        Insert: { created_at?: string; role?: Database["public"]["Enums"]["member_role"]; salon_id: string; user_id: string; staff_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["salon_members"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "salon_members_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      salons: {
        Row: {
          address: string | null; agent_instructions: string; agent_name: string; business_hours: Json;
          created_at: string; currency: string; id: string; max_days_ahead: number; min_notice_minutes: number;
          name: string; phone: string | null; policies: string; slot_interval_minutes: number; slug: string;
          timezone: string; transfer_phone: string | null; vapi_phone_number_id: string | null;
          brand_name: string | null; city: string | null; area: string | null; branch_code: string | null; is_placeholder: boolean; guest_profiles: Json; daily_web_voice_cap: number; daily_chat_cap: number;
          website: string | null; widget_enabled: boolean;
          brand_id: string | null; studio_slug: string | null; latitude: number | null; longitude: number | null; hero_image: string | null;
          gallery: string[]; is_flagship: boolean; published: boolean;
        };
        Insert: {
          address?: string | null; agent_instructions?: string; agent_name?: string; business_hours?: Json;
          created_at?: string; currency?: string; id?: string; max_days_ahead?: number; min_notice_minutes?: number;
          name: string; phone?: string | null; policies?: string; slot_interval_minutes?: number; slug: string;
          timezone?: string; transfer_phone?: string | null; vapi_phone_number_id?: string | null;
          brand_name?: string | null; city?: string | null; area?: string | null; branch_code?: string | null; is_placeholder?: boolean; guest_profiles?: Json; daily_web_voice_cap?: number; daily_chat_cap?: number;
          website?: string | null; widget_enabled?: boolean;
          brand_id?: string | null; studio_slug?: string | null; latitude?: number | null; longitude?: number | null; hero_image?: string | null;
          gallery?: string[]; is_flagship?: boolean; published?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["salons"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "salons_brand_id_fkey"; columns: ["brand_id"]; isOneToOne: false; referencedRelation: "brands"; referencedColumns: ["id"] },
        ];
      };
      services: {
        Row: {
          active: boolean; buffer_minutes: number; category: string; created_at: string; description: string; duration_minutes: number;
          id: string; name: string; price: number; salon_id: string; sort_order: number;
          code: string | null; suitable_for: string[]; add_ons: string[]; consultation_first: boolean; provider_note: string | null;
        };
        Insert: {
          active?: boolean; buffer_minutes?: number; category?: string; created_at?: string; description?: string; duration_minutes: number;
          id?: string; name: string; price?: number; salon_id: string; sort_order?: number;
          code?: string | null; suitable_for?: string[]; add_ons?: string[]; consultation_first?: boolean; provider_note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "services_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      staff: {
        Row: {
          active: boolean; color: string; created_at: string; id: string; name: string; salon_id: string; sort_order: number; title: string | null;
          slug: string | null; bio: string; specialties: string[]; languages: string[]; years_experience: number | null; portrait: string | null;
          portfolio: string[]; public_profile: boolean;
        };
        Insert: {
          active?: boolean; color?: string; created_at?: string; id?: string; name: string; salon_id: string; sort_order?: number; title?: string | null;
          slug?: string | null; bio?: string; specialties?: string[]; languages?: string[]; years_experience?: number | null; portrait?: string | null;
          portfolio?: string[]; public_profile?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "staff_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      staff_hours: {
        Row: { end_time: string; id: string; salon_id: string; staff_id: string; start_time: string; weekday: number };
        Insert: { end_time: string; id?: string; salon_id: string; staff_id: string; start_time: string; weekday: number };
        Update: Partial<Database["public"]["Tables"]["staff_hours"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "staff_hours_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
          { foreignKeyName: "staff_hours_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] },
        ];
      };
      staff_services: {
        Row: { salon_id: string; service_id: string; staff_id: string };
        Insert: { salon_id: string; service_id: string; staff_id: string };
        Update: Partial<Database["public"]["Tables"]["staff_services"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "staff_services_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
          { foreignKeyName: "staff_services_service_id_fkey"; columns: ["service_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id"] },
          { foreignKeyName: "staff_services_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] },
        ];
      };
      time_off: {
        Row: { created_at: string; ends_at: string; id: string; reason: string | null; salon_id: string; staff_id: string | null; starts_at: string };
        Insert: { created_at?: string; ends_at: string; id?: string; reason?: string | null; salon_id: string; staff_id?: string | null; starts_at: string };
        Update: Partial<Database["public"]["Tables"]["time_off"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "time_off_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
          { foreignKeyName: "time_off_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] },
        ];
      };
      // ── Brand websites (migration 20261119000000_brand_site) ──
      brands: {
        Row: {
          agent_name: string; created_at: string; currency: string; email: string | null; faqs: Json; full_name: string; id: string;
          instagram: string | null; locale: string; name: string; nudge_settings: Json; phone: string | null; site_url: string | null;
          slug: string; story: string; tagline: string;
          deposit_amount: number; deposit_refund_hours: number; deposit_hold_minutes: number;
        };
        Insert: {
          agent_name?: string; created_at?: string; currency?: string; email?: string | null; faqs?: Json; full_name: string; id?: string;
          instagram?: string | null; locale?: string; name: string; nudge_settings?: Json; phone?: string | null; site_url?: string | null;
          slug: string; story?: string; tagline?: string;
          deposit_amount?: number; deposit_refund_hours?: number; deposit_hold_minutes?: number;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
        Relationships: [];
      };
      service_content: {
        Row: { benefits: string[]; brand_id: string; code: string; featured: boolean; headline: string; image: string | null; ritual: string[]; slug: string; sort_order: number };
        Insert: { benefits?: string[]; brand_id: string; code: string; featured?: boolean; headline?: string; image?: string | null; ritual?: string[]; slug: string; sort_order?: number };
        Update: Partial<Database["public"]["Tables"]["service_content"]["Insert"]>;
        Relationships: [];
      };
      testimonials: {
        Row: {
          brand_id: string; created_at: string; guest_name: string; id: string; is_sample: boolean; published: boolean; quote: string;
          rating: number; salon_id: string | null; service_code: string | null; sort_order: number;
        };
        Insert: {
          brand_id: string; created_at?: string; guest_name: string; id?: string; is_sample?: boolean; published?: boolean; quote: string;
          rating?: number; salon_id?: string | null; service_code?: string | null; sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["testimonials"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "testimonials_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      press: {
        Row: { brand_id: string; headline: string; id: string; is_sample: boolean; publication: string; published: boolean; sort_order: number; url: string | null; year: number | null };
        Insert: { brand_id: string; headline: string; id?: string; is_sample?: boolean; publication: string; published?: boolean; sort_order?: number; url?: string | null; year?: number | null };
        Update: Partial<Database["public"]["Tables"]["press"]["Insert"]>;
        Relationships: [];
      };
      offers: {
        Row: {
          brand_id: string; description: string; ends_on: string | null; id: string; image: string | null; is_sample: boolean; published: boolean;
          service_code: string | null; sort_order: number; starts_on: string | null; terms: string; title: string;
        };
        Insert: {
          brand_id: string; description: string; ends_on?: string | null; id?: string; image?: string | null; is_sample?: boolean; published?: boolean;
          service_code?: string | null; sort_order?: number; starts_on?: string | null; terms?: string; title: string;
        };
        Update: Partial<Database["public"]["Tables"]["offers"]["Insert"]>;
        Relationships: [];
      };
      memberships: {
        Row: {
          benefits: string[]; brand_id: string; highlight: boolean; id: string; is_sample: boolean; name: string; period: string; price: number; published: boolean; sort_order: number;
          discount_pct: number; skip_deposit: boolean; included_per_period: number; included_period: "month" | "quarter" | "year"; included_categories: string[];
        };
        Insert: {
          benefits?: string[]; brand_id: string; highlight?: boolean; id?: string; is_sample?: boolean; name: string; period?: string; price: number; published?: boolean; sort_order?: number;
          discount_pct?: number; skip_deposit?: boolean; included_per_period?: number; included_period?: "month" | "quarter" | "year"; included_categories?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["memberships"]["Insert"]>;
        Relationships: [];
      };
      lookbook_items: {
        Row: {
          after_image: string | null; before_image: string | null; brand_id: string; caption: string; category: string; id: string; image: string;
          is_sample: boolean; published: boolean; service_code: string | null; sort_order: number; title: string;
        };
        Insert: {
          after_image?: string | null; before_image?: string | null; brand_id: string; caption?: string; category: string; id?: string; image: string;
          is_sample?: boolean; published?: boolean; service_code?: string | null; sort_order?: number; title: string;
        };
        Update: Partial<Database["public"]["Tables"]["lookbook_items"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          brand_id: string; consent_at: string; created_at: string; email: string | null; id: string; kind: string; message: string; name: string;
          phone: string | null; salon_id: string | null; status: Database["public"]["Enums"]["enquiry_status"];
        };
        Insert: {
          brand_id: string; consent_at: string; created_at?: string; email?: string | null; id?: string; kind: string; message?: string; name: string;
          phone?: string | null; salon_id?: string | null; status?: Database["public"]["Enums"]["enquiry_status"];
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      gift_card_requests: {
        Row: {
          amount: number; brand_id: string; consent_at: string; created_at: string; id: string; message: string; recipient_name: string;
          salon_id: string | null; sender_email: string | null; sender_name: string; sender_phone: string; status: Database["public"]["Enums"]["enquiry_status"];
        };
        Insert: {
          amount: number; brand_id: string; consent_at: string; created_at?: string; id?: string; message?: string; recipient_name: string;
          salon_id?: string | null; sender_email?: string | null; sender_name: string; sender_phone: string; status?: Database["public"]["Enums"]["enquiry_status"];
        };
        Update: Partial<Database["public"]["Tables"]["gift_card_requests"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number; brand_id: string; created_at: string; currency: string; error: string | null; id: string;
          kind: Database["public"]["Enums"]["payment_kind"]; method: string | null; paid_at: string | null; payer_email: string | null;
          payer_name: string; payer_phone: string; razorpay_order_id: string; razorpay_payment_id: string | null; ref_id: string | null;
          refunded_at: string | null; salon_id: string | null; status: Database["public"]["Enums"]["payment_status"];
          refund_amount: number | null;
        };
        Insert: {
          amount: number; brand_id: string; created_at?: string; currency?: string; error?: string | null; id?: string;
          kind: Database["public"]["Enums"]["payment_kind"]; method?: string | null; paid_at?: string | null; payer_email?: string | null;
          payer_name: string; payer_phone: string; razorpay_order_id: string; razorpay_payment_id?: string | null; ref_id?: string | null;
          refunded_at?: string | null; salon_id?: string | null; status?: Database["public"]["Enums"]["payment_status"];
          refund_amount?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      gift_cards: {
        Row: {
          activated_at: string | null; amount: number; balance: number; brand_id: string; code: string; consent_at: string; created_at: string;
          expires_at: string | null; id: string; message: string; recipient_name: string; salon_id: string | null; sender_email: string | null;
          sender_name: string; sender_phone: string; status: Database["public"]["Enums"]["gift_card_status"]; view_token: string;
        };
        Insert: {
          activated_at?: string | null; amount: number; balance: number; brand_id: string; code: string; consent_at: string; created_at?: string;
          expires_at?: string | null; id?: string; message?: string; recipient_name: string; salon_id?: string | null; sender_email?: string | null;
          sender_name: string; sender_phone: string; status?: Database["public"]["Enums"]["gift_card_status"]; view_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["gift_cards"]["Insert"]>;
        Relationships: [];
      };
      membership_purchases: {
        Row: {
          brand_id: string; consent_at: string; created_at: string; email: string | null; ends_at: string | null; id: string; membership_id: string | null;
          name: string; period: string; phone: string; price: number; salon_id: string | null; starts_at: string | null;
          status: Database["public"]["Enums"]["membership_status"]; tier_name: string;
        };
        Insert: {
          brand_id: string; consent_at: string; created_at?: string; email?: string | null; ends_at?: string | null; id?: string; membership_id?: string | null;
          name: string; period: string; phone: string; price: number; salon_id?: string | null; starts_at?: string | null;
          status?: Database["public"]["Enums"]["membership_status"]; tier_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["membership_purchases"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "membership_purchases_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
          { foreignKeyName: "membership_purchases_membership_id_fkey"; columns: ["membership_id"]; isOneToOne: false; referencedRelation: "memberships"; referencedColumns: ["id"] },
        ];
      };
      gift_card_redemptions: {
        Row: { amount: number; booking_id: string | null; created_at: string; gift_card_id: string; id: string; note: string; redeemed_by: string | null; salon_id: string };
        Insert: { amount: number; booking_id?: string | null; created_at?: string; gift_card_id: string; id?: string; note?: string; redeemed_by?: string | null; salon_id: string };
        Update: Partial<Database["public"]["Tables"]["gift_card_redemptions"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "gift_card_redemptions_gift_card_id_fkey"; columns: ["gift_card_id"]; isOneToOne: false; referencedRelation: "gift_cards"; referencedColumns: ["id"] },
          { foreignKeyName: "gift_card_redemptions_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      site_events: {
        Row: { brand_id: string; created_at: string; detail: Json; id: number; kind: string; path: string; session_id: string };
        Insert: { brand_id: string; created_at?: string; detail?: Json; id?: never; kind: string; path?: string; session_id: string };
        Update: Partial<Database["public"]["Tables"]["site_events"]["Insert"]>;
        Relationships: [];
      };
      job_applications: {
        Row: {
          brand_id: string; city: string; consent_at: string; created_at: string; email: string; experience_years: number | null; id: string;
          message: string; name: string; phone: string; role: string; status: Database["public"]["Enums"]["enquiry_status"];
        };
        Insert: {
          brand_id: string; city: string; consent_at: string; created_at?: string; email: string; experience_years?: number | null; id?: string;
          message?: string; name: string; phone: string; role: string; status?: Database["public"]["Enums"]["enquiry_status"];
        };
        Update: Partial<Database["public"]["Tables"]["job_applications"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      guest_summary: {
        Row: {
          id: string; salon_id: string; name: string; phone: string; email: string | null; tags: string[]; created_at: string;
          visits: number; upcoming: number; spend: number; last_visit: string | null; next_visit: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_member_benefit: { Args: { p_booking: string; p_membership: string }; Returns: Json };
      hit_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      redeem_gift_card: { Args: { p_code: string; p_amount: number; p_salon: string; p_note?: string }; Returns: Json };
      redeem_gift_card_for_booking: { Args: { p_code: string; p_booking: string; p_max: number }; Returns: Json };
      return_gift_card_for_booking: { Args: { p_booking: string }; Returns: number };
      site_stats: { Args: { p_brand: string; p_since: string; p_tz?: string }; Returns: Json };
    };
    Enums: {
      booking_source: "phone" | "web" | "staff";
      booking_status: "confirmed" | "cancelled" | "completed" | "no_show";
      call_channel: "phone" | "web";
      callback_status: "open" | "done";
      member_role: "owner" | "manager" | "staff" | "receptionist" | "stylist";
      enquiry_status: "new" | "contacted" | "converted" | "closed";
      payment_kind: "gift_card" | "membership" | "deposit";
      payment_status: "created" | "paid" | "failed" | "refunded";
      gift_card_status: "pending" | "active" | "redeemed" | "expired" | "cancelled";
      membership_status: "pending" | "active" | "expired" | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
