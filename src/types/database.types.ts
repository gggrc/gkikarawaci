export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      Ibadah: {
        Row: {
          id_ibadah: string
          jenis_kebaktian: string
          sesi_ibadah: number
          tanggal_ibadah: string
          weeklyEventId: string | null
        }
        Insert: {
          id_ibadah: string
          jenis_kebaktian: string
          sesi_ibadah: number
          tanggal_ibadah: string
          weeklyEventId?: string | null
        }
        Update: {
          id_ibadah?: string
          jenis_kebaktian?: string
          sesi_ibadah?: number
          tanggal_ibadah?: string
          weeklyEventId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Ibadah_weeklyEventId_fkey"
            columns: ["weeklyEventId"]
            isOneToOne: false
            referencedRelation: "WeeklyEvent"
            referencedColumns: ["id"]
          },
        ]
      }
      Jemaat: {
        Row: {
          age: number
          dateOfBirth: string
          email: string
          gender: string
          handphone: string
          id_jemaat: string
          jabatan: string
          name: string
          status: string
          tanggal_lahir: string
        }
        Insert: {
          age: number
          dateOfBirth: string
          email: string
          gender: string
          handphone: string
          id_jemaat: string
          jabatan: string
          name: string
          status: string
          tanggal_lahir: string
        }
        Update: {
          age?: number
          dateOfBirth?: string
          email?: string
          gender?: string
          handphone?: string
          id_jemaat?: string
          jabatan?: string
          name?: string
          status?: string
          tanggal_lahir?: string
        }
        Relationships: []
      }
      Kehadiran: {
        Row: {
          id_ibadah: string
          id_jemaat: string
          id_kehadiran: string
          name: string | null
          status: string | null
          waktu_presensi: string | null
        }
        Insert: {
          id_ibadah: string
          id_jemaat: string
          id_kehadiran: string
          name?: string | null
          status?: string | null
          waktu_presensi?: string | null
        }
        Update: {
          id_ibadah?: string
          id_jemaat?: string
          id_kehadiran?: string
          name?: string | null
          status?: string | null
          waktu_presensi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Kehadiran_id_ibadah_fkey"
            columns: ["id_ibadah"]
            isOneToOne: false
            referencedRelation: "Ibadah"
            referencedColumns: ["id_ibadah"]
          },
          {
            foreignKeyName: "Kehadiran_id_jemaat_fkey"
            columns: ["id_jemaat"]
            isOneToOne: false
            referencedRelation: "Jemaat"
            referencedColumns: ["id_jemaat"]
          },
        ]
      }
      Statistics: {
        Row: {
          stat_id: string
          text: string
          title: string
        }
        Insert: {
          stat_id: string
          text: string
          title: string
        }
        Update: {
          stat_id?: string
          text?: string
          title?: string
        }
        Relationships: []
      }
      User: {
        Row: {
          clerkId: string
          email: string
          isVerified: string
          nama: string
          role: string
          user_id: number
        }
        Insert: {
          clerkId: string
          email: string
          isVerified?: string
          nama: string
          role: string
          user_id?: number
        }
        Update: {
          clerkId?: string
          email?: string
          isVerified?: string
          nama?: string
          role?: string
          user_id?: number
        }
        Relationships: []
      }
      WeeklyEvent: {
        Row: {
          description: string | null
          end_date: string | null
          id: string
          jenis_kebaktian: string
          repetition_type: string
          sesi_ibadah: number
          start_date: string
          title: string
        }
        Insert: {
          description?: string | null
          end_date?: string | null
          id: string
          jenis_kebaktian: string
          repetition_type?: string
          sesi_ibadah: number
          start_date: string
          title: string
        }
        Update: {
          description?: string | null
          end_date?: string | null
          id?: string
          jenis_kebaktian?: string
          repetition_type?: string
          sesi_ibadah?: number
          start_date?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  Schema extends keyof DatabaseWithoutInternals = "public",
  EnumName extends keyof DatabaseWithoutInternals[Schema]["Enums"] = never,
> = DatabaseWithoutInternals[Schema]["Enums"][EnumName]

export type CompositeTypes<
  Schema extends keyof DatabaseWithoutInternals = "public",
  CompositeName extends keyof DatabaseWithoutInternals[Schema]["CompositeTypes"] = never,
> = DatabaseWithoutInternals[Schema]["CompositeTypes"][CompositeName]


export const Constants = {
  public: {
    Enums: {},
  },
} as const
