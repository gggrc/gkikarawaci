// src/app/api/me/route.ts
import { getAuth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);

  if (!userId) {
    return NextResponse.json({ role: null, isVerified: null });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      role: true,
      isVerified: true,
    },
  });

  return NextResponse.json({
    role: user?.role ?? null,
    isVerified: user?.isVerified ?? "pending",
  });
}
