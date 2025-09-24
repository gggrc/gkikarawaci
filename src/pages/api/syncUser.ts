// src/pages/api/syncUser.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { clerkClient, getAuth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}
const prisma: PrismaClient = globalThis.prisma ??= new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    if (!clerkUser) return res.status(404).json({ message: "Clerk user not found" });

    // Ambil email dan status verifikasi
    const primaryEmail = clerkUser.emailAddresses.find(e => e.emailAddress);
    if (!primaryEmail) return res.status(400).json({ message: "User does not have a valid email" });

    const isVerified = primaryEmail.verification?.status === "verified";

    // Data user untuk DB
    const userData = {
      clerkId: clerkUser.id,
      nama: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || "Nama Tidak Diketahui",
      email: primaryEmail.emailAddress,
      isVerified,
      role: "user",
      tanggal_lahir: null as unknown as string | Date,
      gender: "gender" in clerkUser && typeof clerkUser.gender === "string" ? clerkUser.gender : "unknown",
      jabatan: ""
    };

    // Upsert user
    const user = await prisma.user.upsert({
      where: { clerkId: userData.clerkId },
      update: userData,
      create: userData
    });

    res.status(200).json({ message: "User synced successfully", user });
  } catch (error) {
    console.error("syncUser error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
