import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuth } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

// PATCH /api/users/[clerkId]
export async function PATCH(req: NextRequest, context: { params: Promise<{ clerkId: string }> }) {
  try {
    const { clerkId } = await context.params;
    const { userId } = getAuth(req);

    // 🧩 Harus login
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🧩 Pastikan yang update adalah admin
    const admin = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 🧩 Ambil status dari body request
    const { status } = await req.json(); // "accepted" | "rejected"

    if (!["accepted", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // 🧩 Update user di database
    const updated = await prisma.user.update({
      where: { clerkId },
      data: { isVerified: status },
    });

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    console.error("PATCH /api/users/[clerkId] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
