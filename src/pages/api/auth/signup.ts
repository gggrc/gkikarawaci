import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "@/server/db"; // Prisma client Anda

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { id, email, nama } = req.body;

  try {
    // Simpan ke tabel User di skema public
    const user = await db.user.create({
      data: {
        id: id,
        email: email,
        nama: nama,
        role: "user",
        isVerified: "pending",
      },
    });
    return res.status(200).json(user);
  } catch (error) {
    console.error("Prisma Sync Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}