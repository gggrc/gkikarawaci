// src/app/api/syncUser/route.ts
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, email } = body;

    if (!id || !email)
      return NextResponse.json({ error: "Missing user data" }, { status: 400 });

    await prisma.user.upsert({
      where: { clerkId: id },
      update: { nama: name, email },
      create: {
        clerkId: id,
        nama: name,
        email,
        gender: "unknown",
        jabatan: "Jemaat",
        role: "user",
        isVerified: true,
        tanggal_lahir: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ SyncUser failed:", err);
    return NextResponse.json(
      { error: "SyncUser failed", details: String(err) },
      { status: 500 }
    );
  }
}
