// Generated from the Supabase project schema (regenerate after schema changes).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };

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
        };
        Insert: {
          blocked_until: string; call_id?: string | null; cancel_reason?: string | null; created_at?: string; created_by?: string | null;
          customer_id: string; ends_at: string; id?: string; notes?: string; price?: number; reference?: string; salon_id: string;
          service_id: string; source?: Database["public"]["Enums"]["booking_source"]; staff_id: string; starts_at: string;
          status?: Database["public"]["Enums"]["booking_status"]; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "bookings_call_id_fkey"; columns: ["call_id"]; isOneToOne: false; referencedRelation: "calls"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_service_id_fkey"; columns: ["service_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] },
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
        Row: { created_at: string; email: string | null; id: string; name: string; notes: string; phone: string; salon_id: string };
        Insert: { created_at?: string; email?: string | null; id?: string; name: string; notes?: string; phone: string; salon_id: string };
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
        Row: { created_at: string; role: Database["public"]["Enums"]["member_role"]; salon_id: string; user_id: string };
        Insert: { created_at?: string; role?: Database["public"]["Enums"]["member_role"]; salon_id: string; user_id: string };
        Update: Partial<Database["public"]["Tables"]["salon_members"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "salon_members_salon_id_fkey"; columns: ["salon_id"]; isOneToOne: false; referencedRelation: "salons"; referencedColumns: ["id"] },
        ];
      };
      salons: {
        Row: {
          address: string | null; agent_greeting: string | null; agent_instructions: string; agent_name: string; business_hours: Json;
          created_at: string; currency: string; id: string; llm_model: string; max_days_ahead: number; min_notice_minutes: number;
          name: string; phone: string | null; phone_llm_model: string; policies: string; slot_interval_minutes: number; slug: string;
          timezone: string; transfer_phone: string | null; vapi_phone_number_id: string | null; voice_id: string | null; voice_model: string | null; voice_settings: Json;
          brand_name: string | null; city: string | null; area: string | null; branch_code: string | null; is_placeholder: boolean; guest_profiles: Json; daily_web_voice_cap: number; daily_chat_cap: number;
          voice_provider: string; website: string | null; widget_enabled: boolean;
        };
        Insert: {
          address?: string | null; agent_greeting?: string | null; agent_instructions?: string; agent_name?: string; business_hours?: Json;
          created_at?: string; currency?: string; id?: string; llm_model?: string; max_days_ahead?: number; min_notice_minutes?: number;
          name: string; phone?: string | null; phone_llm_model?: string; policies?: string; slot_interval_minutes?: number; slug: string;
          timezone?: string; transfer_phone?: string | null; vapi_phone_number_id?: string | null; voice_id?: string | null; voice_model?: string | null; voice_settings?: Json;
          brand_name?: string | null; city?: string | null; area?: string | null; branch_code?: string | null; is_placeholder?: boolean; guest_profiles?: Json; daily_web_voice_cap?: number; daily_chat_cap?: number;
          voice_provider?: string; website?: string | null; widget_enabled?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["salons"]["Insert"]>;
        Relationships: [];
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
        Row: { active: boolean; color: string; created_at: string; id: string; name: string; salon_id: string; sort_order: number; title: string | null };
        Insert: { active?: boolean; color?: string; created_at?: string; id?: string; name: string; salon_id: string; sort_order?: number; title?: string | null };
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
    };
    Views: { [_ in never]: never };
    Functions: {
      hit_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      create_salon: { Args: { p_currency?: string; p_name: string; p_slug: string; p_timezone?: string }; Returns: string };
    };
    Enums: {
      booking_source: "phone" | "web" | "staff";
      booking_status: "confirmed" | "cancelled" | "completed" | "no_show";
      call_channel: "phone" | "web";
      callback_status: "open" | "done";
      member_role: "owner" | "manager" | "staff";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
export type _Rel = Rel;
