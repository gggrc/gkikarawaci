// src/env.js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Variabel yang hanya tersedia di Server (Aman)
   */
  server: {
    // ✅ FIX: Mengganti .url() ke .min(1) karena URL PostgreSQL seringkali gagal di validasi Zod.
    DATABASE_URL: z.string().min(1), 
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), 
    CLERK_SECRET_KEY: z.string().min(1), 
    CLERK_WEBHOOK_SECRET: z.string().min(1),
  },

  /**
   * Variabel yang tersedia di Client (Wajib berawalan NEXT_PUBLIC_)
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(), // Ini harus tetap .url()
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_FRONTEND_API: z.string().url(), // Ini harus tetap .url()
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_FRONTEND_API: process.env.NEXT_PUBLIC_CLERK_FRONTEND_API,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});