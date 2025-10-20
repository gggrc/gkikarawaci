export const runtime = "nodejs";
import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/clerk-sdk-node";
import prisma from "@/lib/prisma";
import type { User as ClerkUser } from "@clerk/backend";

export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (admin?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // 🔸 Ambil semua user dari database lokal
  const dbUsers = await prisma.user.findMany({
    where: status ? { isVerified: status } : {},
    select: {
      clerkId: true,
      nama: true,
      email: true,
      isVerified: true,
    },
  });

  // 🔸 Ambil semua user dari Clerk
  const clerkUsers = await clerkClient.users.getUserList(); // ✅ ini yg bener

  // 🔸 Gabungkan user dari DB dan Clerk berdasarkan clerkId
  const mergedUsers = dbUsers.map((dbUser) => {
    const clerkUser: ClerkUser | undefined = clerkUsers.find(
      (c: ClerkUser) => c.id === dbUser.clerkId
    );

    return {
      clerkId: dbUser.clerkId,
      nama:
        dbUser.nama ||
        `${clerkUser?.firstName ?? ""} ${clerkUser?.lastName ?? ""}`.trim() ??
        clerkUser?.username ??
        "No Name",
      email: dbUser.email ?? clerkUser?.emailAddresses[0]?.emailAddress ?? "-",
      profile_pic: clerkUser?.imageUrl ?? null, // 👈 ambil dari Clerk
      isVerified: dbUser.isVerified,
    };
  });

  return NextResponse.json(mergedUsers);
}
