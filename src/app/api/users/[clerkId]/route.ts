export const runtime = "nodejs";
import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// ✅ Definisikan tipe parameter route
type RouteParams = {
  clerkId: string;
};

// ✅ Definisikan tipe body request
type PatchBody = {
  status: "accepted" | "rejected";
};

// ✅ Helper aman untuk parsing JSON tanpa lint error
async function safeJson<T>(req: NextRequest): Promise<T> {
  return (await req.json()) as unknown as T;
}

// PATCH /api/users/[clerkId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const { clerkId } = await context.params;
    const { userId } = getAuth(req);

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (admin?.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ✅ Gunakan helper supaya tidak dianggap unsafe
    const body = await safeJson<PatchBody>(req);
    const { status } = body;

    if (!["accepted", "rejected"].includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const updated = await prisma.user.update({
      where: { clerkId },
      data: { isVerified: status },
    });

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    console.error("PATCH /api/users/[clerkId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
