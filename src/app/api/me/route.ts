export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();  // ⬅️ FIX: harus await

  // Belum login
  if (!userId) {
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
