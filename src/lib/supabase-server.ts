import { createClient } from '@supabase/supabase-js'
import type { Database } from "src/lib/database.types"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Masih bisa cek runtime juga
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

