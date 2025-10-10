// src/lib/supabase-client.ts
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import type { Database } from "~/types/database.types"; 

// --- START: Klien Supabase dengan JWT Clerk ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Hook untuk mendapatkan klien Supabase yang sudah terotentikasi dengan token Clerk.
 * Token JWT Clerk disuntikkan ke dalam header Authorization setiap fetch.
 */
export function useSupabase() {
  const { getToken, isLoaded } = useAuth();

  const supabase = useMemo(() => {
    // Inisialisasi Klien Supabase
    const client = createClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
        },
        global: {
          // Intercept fetch API untuk menyuntikkan token Clerk
          fetch: async (url, options = {}) => {
            // Ambil token Clerk dengan template 'supabase'
            const clerkToken = await getToken({ template: 'supabase' });

            const headers = new Headers(options.headers);
            if (clerkToken) {
              headers.set("Authorization", `Bearer ${clerkToken}`);
            }
            
            // Lanjutkan dengan permintaan ke Supabase
            return fetch(url, {
              ...options,
              headers,
            });
          },
        },
      }
    );
    return client;
  }, [getToken]);

  return { supabase, isLoaded };
}