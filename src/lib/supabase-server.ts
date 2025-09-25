import { createClient } from "@supabase/supabase-js";
import type { Database } from "src/types/database.types"; // pastikan path sesuai

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cek runtime (optional, biar gampang debug di dev)
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("❌ Missing Supabase environment variables");
}

// Hanya untuk server-side (jangan expose service role key ke client!)
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
    },
  }
);
