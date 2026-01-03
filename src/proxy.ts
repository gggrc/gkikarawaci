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

  if (isProtectedRoute(req) && !userId) {
    return (await auth()).redirectToSignIn();
  }

  if (userId && isProtectedRoute(req)) {
    try {
      const baseUrl = req.nextUrl.origin;
      const res = await fetch(`${baseUrl}/api/me`, {
        headers: { Cookie: req.headers.get("cookie") ?? "" },
      });

      if (res.ok) {
        const userData = (await res.json()) as {
          role: string;
          isVerified: "pending" | "accepted" | "rejected";
        };

        const isAdminRoute = req.nextUrl.pathname.startsWith("/databaseUser");

        // 1) Cek admin dulu
        if (isAdminRoute && userData.role !== "user") {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        // 2) Baru cek verifikasi
        if (userData.isVerified === "pending" || userData.isVerified === "rejected") {
          return NextResponse.redirect(new URL("/waiting", req.url));
        }
      }
    } catch (err) {
      console.error("Middleware error:", err);
    }
  }

  return NextResponse.next();
});