import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "@/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { id, email, nama } = req.body;

  try {
    // upsert: update jika ada, create jika belum ada
    await db.user.upsert({
      where: { id: id },
      update: { email, nama },
      create: {
        id,
        email,
        nama,
        role: "user",
        isVerified: "pending",
      },
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Sync failed" });
  }
}