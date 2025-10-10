// src/pages/api/syncUser.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Logic sinkronisasi (upsert ke Prisma) telah dihapus dari sini.
  // Sinkronisasi kini sepenuhnya ditangani oleh CLERK WEBHOOK.

  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Cukup kembalikan sukses, mengindikasikan bahwa user telah terotentikasi.
    res.status(200).json({ message: "User sync process initiated (delegated to Webhook)" });
  } catch (error) {
    console.error("syncUser error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}