import { PrismaClient } from "@prisma/client";

declare global {
  // Supaya tidak membuat PrismaClient baru setiap kali file ini di-import (Next.js optimization)
  var prisma: PrismaClient | undefined;
}

// Pakai nullish coalescing (??) untuk hindari warning prefer-nullish-coalescing
export const prisma = global.prisma ?? new PrismaClient();

// Assign ke global untuk re-use di hot reload
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
