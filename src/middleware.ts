// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Tentukan route mana saja yang butuh login (proteksi umum)
const isProtectedRoute = createRouteMatcher([
  "/statistic(.*)",
  "/databaseUser(.*)",
  "/user(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 1. Jika mencoba akses route yang diproteksi tapi belum login
  if (isProtectedRoute(req) && !userId) {
    return (await auth()).redirectToSignIn();
  }

  // 2. Jika sudah login, cek status verifikasi via API internal
  if (userId && isProtectedRoute(req)) {
    try {
      // Kita panggil API /api/me untuk tahu status user dari database Prisma
      const baseUrl = req.nextUrl.origin;
      const res = await fetch(`${baseUrl}/api/me`, {
        headers: { Cookie: req.headers.get("cookie") || "" },
      });

      if (res.ok) {
        const userData = await res.json();

        // LOGIKA: Belum diverifikasi -> Arahkan ke Waiting
        if (userData.isVerified === "pending") {
          return NextResponse.redirect(new URL("/waiting", req.url));
        }

        // LOGIKA: Ditolak -> Arahkan ke Rejected (atau tetap di waiting dengan status error)
        if (userData.isVerified === "rejected") {
          return NextResponse.redirect(new URL("/waiting", req.url));
        }

        // LOGIKA: Unauthorized (User biasa mencoba masuk ke halaman admin)
        const isAdminRoute = req.nextUrl.pathname.startsWith("/databaseUser");
        if (isAdminRoute && userData.role !== "admin") {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
      }
    } catch (error) {
      console.error("Middleware Auth Error:", error);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};