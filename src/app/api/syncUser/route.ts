import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type IncomingUser = {
  id: string;
  name: string;
  email: string;
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingUser;
    console.log("📩 Incoming user:", body);

    const { id, name, email } = body;

    // 🔍 cek apakah user sudah ada
    const { data: existingUser, error: fetchError } = await supabase
      .from("User")
      .select("*")
      .eq("clerkId", id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // selain "not found"
      console.error("❌ Fetch user error:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (existingUser) {
      // ✅ user sudah ada → update hanya nama & email (biar sinkron)
      const { error: updateError } = await supabase
        .from("User")
        .update({
          nama: name,
          email: email,
        })
        .eq("clerkId", id);

      if (updateError) {
        console.error("❌ Update user error:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log("🔁 Existing user synced (no role/isVerified change)");
      return NextResponse.json({ success: true, updated: true });
    } else {
      // 🆕 user belum ada → insert baru
      const { error: insertError } = await supabase.from("User").insert([
        {
          clerkId: id,
          nama: name,
          email: email,
          gender: "unknown",
          jabatan: "unknown",
          isVerified: "pending",
          role: "user",
        },
      ]);

      if (insertError) {
        console.error("❌ Insert user error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      console.log("✅ New user inserted");
      return NextResponse.json({ success: true, inserted: true });
    }
  } catch (err) {
    console.error("❌ Sync user failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
