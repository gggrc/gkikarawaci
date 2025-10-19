export const runtime = "nodejs";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// ✅ Handler GET /api/me
export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);

  // Jika belum login
  if (!userId) {
    return NextResponse.json({ role: null, isVerified: "pending" });
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
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ Error in /api/me:", error.message);
    } else {
      console.error("❌ Unknown error in /api/me:", error);
    }
    return NextResponse.json({ role: null, isVerified: "pending" });
  }
}
