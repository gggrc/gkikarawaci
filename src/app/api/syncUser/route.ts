export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient, type PostgrestSingleResponse } from "@supabase/supabase-js";

// ✅ Type untuk tabel User
type User = {
  clerkId: string;
  nama: string;
  email: string;
  gender?: string;
  isVerified: string;
  role: string;
};

type IncomingUser = {
  id: string;
  name: string;
  email: string;
};

// ✅ Inisialisasi Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Debug log environment
console.log("🔑 Supabase URL:", process.env.SUPABASE_URL);
console.log(
  "🔑 Supabase KEY (first 8 chars):",
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8)
);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingUser;
    console.log("📩 Incoming user:", body);

    const { id, name, email } = body;

    // ✅ Cek apakah user sudah ada
    const result = (await supabase
      .from("User")
      .select("*")
      .eq("clerkId", id)
      .maybeSingle()) as PostgrestSingleResponse<User>;

    const existingUser = result.data;
    const selectError = result.error;

    if (selectError) {
      console.error("❌ Select error:", selectError);
    }

    // ✅ Kalau belum ada -> insert user baru
    if (!existingUser) {
      console.log("🆕 No existing user found, inserting new one...");

      const insertResult = (await supabase
        .from("User")
        .insert([
          {
            clerkId: id,
            nama: name,
            email,
            isVerified: "pending",
            role: "user",
          },
        ])
        .select()) as PostgrestSingleResponse<User>;

      if (insertResult.error) {
        console.error("❌ Insert error:", insertResult.error);
        return NextResponse.json({ error: insertResult.error }, { status: 500 });
      }

      console.log("✅ Inserted:", insertResult.data);
      return NextResponse.json({ success: true, inserted: true });
    }

    // ✅ Kalau sudah ada -> update data
    console.log("✅ Existing user found:", existingUser);
    await supabase.from("User").update({ nama: name, email }).eq("clerkId", id);

    return NextResponse.json({ success: true, updated: true });
  } catch (err) {
    console.error("❌ Sync user failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}