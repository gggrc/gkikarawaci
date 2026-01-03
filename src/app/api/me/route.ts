export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();  

  console.log("🔎 Clerk userId dari auth():", userId);

  // Belum login
  if (!userId) {
    console.log("⚠️ Tidak ada userId — user belum login");
    return NextResponse.json({
      role: null,
      isVerified: "pending",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true, isVerified: true },
    });

    console.log("📌 Hasil pencarian user di DB:", user);

    return NextResponse.json({
      role: user?.role ?? "user",
      isVerified: user?.isVerified ?? "pending",
    });

  } catch (error) {
    console.error("❌ Error in /api/me:", error);
    return NextResponse.json({
      role: null,
      isVerified: "pending",
    });
  }
}
