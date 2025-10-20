export const runtime = "nodejs";
import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// GET /api/users?status=pending
export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (admin?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const users = await prisma.user.findMany({
    where: status ? { isVerified: status } : {},
    select: {
      clerkId: true,
      nama: true,
      email: true,
      role: true,
      isVerified: true,
    },
  });

  return NextResponse.json(users);
}
