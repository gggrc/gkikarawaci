import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    // ✅ explicitly type your JSON structure
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = (await req.json()) as { id: string; name: string; email: string };


    const { id, name, email } = body;

    // Upsert user (insert if not exists, update if exists)
    await prisma.user.upsert({
      where: { clerkId: id },
      update: { nama: name, email },
      create: {
        clerkId: id,
        nama: name,
        email,
        gender: "unknown",
        jabatan: "unknown",
        isVerified: false,
        role: "user",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Sync user failed:", err);
    return NextResponse.json(
      { error: "Database operation failed", details: String(err) },
      { status: 500 }
    );
  }
}
