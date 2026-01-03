import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server"; 

type IncomingUser = {
  id: string;
  name: string;
  email: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingUser;
    const { id, name, email } = body;

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    // 1. Cek apakah user sudah ada berdasarkan clerkId
    const { data: existingUser, error: selectError } = await supabase
      .from("User")
      .select("*")
      .eq("clerkId", id)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    // 2. Jika belum ada -> Insert user baru
    if (!existingUser) {
      const { data: insertedData, error: insertError } = await supabase
        .from("User")
        .insert([
          {
            clerkId: id,
            nama: name,
            email: email,
            isVerified: "pending", // Default status
            role: "user",        // Default role
          },
        ])
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "inserted", data: insertedData });
    }

    // 3. Jika sudah ada -> Update data (opsional, untuk memastikan data terbaru)
    const { error: updateError } = await supabase
      .from("User")
      .update({ 
        nama: name, 
        email: email 
      })
      .eq("clerkId", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: "updated" });
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}