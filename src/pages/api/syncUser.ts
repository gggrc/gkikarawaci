// src/pages/api/syncUser.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { clerkClient, getAuth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client"; 

declare global {
  var prisma: PrismaClient | undefined;
}
const prisma: PrismaClient = globalThis.prisma ??= new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Use Clerk SDK to get the user
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    if (!clerkUser) return res.status(404).json({ message: "Clerk user not found" });

    // Ambil email dan status verifikasi
    const primaryEmail = clerkUser.emailAddresses.find(e => e.emailAddress);
    if (!primaryEmail) return res.status(400).json({ message: "User does not have a valid email" });

    const isVerified = primaryEmail.verification?.status === "verified";
    const fullName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || "Nama Tidak Diketahui";
    // Ambil gender, default ke "unknown" jika tidak ada
    const gender = (clerkUser as { gender?: string }).gender ?? "unknown";

    // Data yang akan digunakan untuk update dan sebagai dasar create
    const baseUserData = {
      nama: fullName,
      email: primaryEmail.emailAddress,
      isVerified,
      gender,
      jabatan: "Jemaat", // Tetapkan default untuk konsistensi
      role: "user",      // Tetapkan default untuk konsistensi
    };

    // Upsert user
    const user = await prisma.user.upsert({
      where: { clerkId: clerkUser.id } as Prisma.UserWhereUniqueInput,
      update: baseUserData, // Update synced fields
      create: {
        ...baseUserData,
        clerkId: clerkUser.id,
        tanggal_lahir: null, // Menggunakan null untuk tanggal_lahir yang opsional
      } as Prisma.UserCreateInput,
    });

    res.status(200).json({ message: "User synced successfully", user });
  } catch (error) {
    console.error("syncUser error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}