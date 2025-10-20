export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: number
          clerkId: string
          nama: string
          email: string
          isVerified: string
          role: string
        }
        Insert: {
          user_id?: number
          clerkId: string
          nama: string
          email: string
          isVerified?: boolean
          role: string
        }
        Update: {
          nama?: string
          email?: string
          isVerified?: boolean
          role?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
