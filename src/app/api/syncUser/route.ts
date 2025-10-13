// src/app/api/syncUser/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ Definisikan tipe data untuk request body
type IncomingUser = {
  id: string;
  name: string;
  email: string;
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ pakai service key, bukan anon key
);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingUser;
    console.log("📩 Incoming user:", body);

    const { id, name, email } = body;

    const { error } = await supabase
      .from("User")
      .upsert([
        {
          clerkId: id,          // ini tetap camelCase di JS
          nama: name,
          email: email,
          gender: "unknown",
          jabatan: "unknown",
          isVerified: false,
          role: "user",
        },
      ]);


    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ User synced successfully");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Sync user failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
