// src/lib/supabase-server.ts (Wajib menggunakan kode bersih ini)
import { createClient } from "@supabase/supabase-js";
// ✅ FIX: Menggunakan jalur relatif yang aman
import type { Database } from "../types/database.types"; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("❌ Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
}

// Hanya file ini yang mengekspor klien Supabase
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
    },
  }
);