export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: number
          clerkId: string
          nama: string
          tanggal_lahir: string | null
          gender: string
          email: string
          jabatan: string
          isVerified: string
          role: string
        }
        Insert: {
          user_id?: number
          clerkId: string
          nama: string
          tanggal_lahir?: string | null
          gender?: string
          email: string
          jabatan: string
          isVerified?: boolean
          role: string
        }
        Update: {
          nama?: string
          tanggal_lahir?: string | null
          gender?: string
          email?: string
          jabatan?: string
          isVerified?: boolean
          role?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
