import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuth } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

// ✅ GET /api/users?status=pending
export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Pastikan yang akses adalah admin
  const admin = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // ✅ Ambil semua user dengan status tertentu (misal: pending)
  const users = await prisma.user.findMany({
    where: status ? { isVerified: status } : {},
    select: {
      clerkId: true,
      nama: true,
      email: true,
    },
  });

  return NextResponse.json(users);
}
