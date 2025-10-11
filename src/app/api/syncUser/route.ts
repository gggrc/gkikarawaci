import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ make sure you're using SERVICE ROLE key
);

export async function POST(req: Request) {
  try {
    const { id, name, email } = await req.json();
    console.log("📩 Incoming user:", { id, name, email });

    const { data, error } = await supabase
      .from("User") // 👈 match table name exactly
      .upsert({ clerkId: id, nama: name, email });

    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    console.log("✅ Synced user to Supabase:", data);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("❌ Server error:", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
