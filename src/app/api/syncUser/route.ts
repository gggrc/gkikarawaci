export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

// ✅ Type untuk tabel User
type User = {
  clerkId: string;
  nama: string;
  email: string;
  gender: string;
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingUser;
    console.log("📩 Incoming user:", body);

    const { id, name, email } = body;

    // ✅ Langkah aman dan bersih
    const result = await supabase
      .from("User")
      .select("*")
      .eq("clerkId", id)
      .single();

    const { data: existingUser } = result as PostgrestSingleResponse<User>;

    if (existingUser) {
      await supabase
        .from("User")
        .update({ nama: name, email })
        .eq("clerkId", id);

      return NextResponse.json({ success: true, updated: true });
    } else {
      await supabase.from("User").insert([
        {
          clerkId: id,
          nama: name,
          email,
          isVerified: "pending",
          role: "user",
        },
      ]);

      return NextResponse.json({ success: true, inserted: true });
    }
  } catch (err) {
    console.error("❌ Sync user failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
