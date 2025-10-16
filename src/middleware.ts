// ✅ src/middleware.ts
import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default clerkMiddleware(async (auth, req) => {
  const { userId } = auth(); // ✅ Clerk sudah inject context-nya
  const url = req.nextUrl;
  const pathname = url.pathname;

  // kalau belum login, biarin aja (buat halaman publik)
  if (!userId) return NextResponse.next();

  // halaman publik (nggak usah di-protect)
  if (
    pathname === "/" ||
    pathname.startsWith("/waiting") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  // ambil user dari DB
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  // kalau belum ada di DB ➜ waiting
  if (!user) {
    return NextResponse.redirect(new URL("/waiting", req.url));
  }

  // kalau belum accepted (pending / rejected) ➜ waiting
  if (user.isVerified !== "accepted" && user.role !== "admin") {
    return NextResponse.redirect(new URL("/waiting", req.url));
  }

  // kalau admin atau accepted user ➜ lanjut
  return NextResponse.next();
});

export const config = {
  matcher: [
    // aktif untuk semua route kecuali static assets & API auth Clerk
    "/((?!_next/static|_next/image|favicon.ico|images|api/auth).*)",
  ],
};
