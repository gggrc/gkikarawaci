import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server"; // Gunakan client tersentralisasi
import type { Database } from "@/types/database.types"; 

// Mengambil tipe User langsung dari definisi database
type User = Database['public']['Tables']['User']['Row'];

type IncomingUser = {
  id: string;
  name: string;
  email: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingUser;
    const { id, name, email } = body;

    console.log("📩 Incoming user sync:", body);

    // 1. Cek apakah user sudah ada berdasarkan clerkId
    const { data: existingUser, error: selectError } = await supabase
      .from("User")
      .select("*")
      .eq("clerkId", id)
      .maybeSingle();

    if (selectError) {
      console.error("❌ Select error:", selectError);
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    // 2. Jika belum ada -> Insert user baru
    if (!existingUser) {
      console.log("🆕 No existing user found, inserting new one...");

      const { data: insertedData, error: insertError } = await supabase
        .from("User")
        .insert([
          {
            clerkId: id,
            nama: name,
            email: email,
            isVerified: "pending",
            role: "user",
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("❌ Insert error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, inserted: true, data: insertedData });
    }

    // 3. Jika sudah ada -> Update data yang mungkin berubah
    console.log("✅ Existing user found, updating...");
    const { error: updateError } = await supabase
      .from("User")
      .update({ 
        nama: name, 
        email: email 
      })
      .eq("clerkId", id);

    if (updateError) {
      console.error("❌ Update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: true });
  } catch (err) {
    console.error("❌ Sync user failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}