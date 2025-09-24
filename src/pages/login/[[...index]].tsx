// src/pages/login.tsx
"use client";

import { SignIn, SignedIn, UserButton, SignedOut, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/router";
import SyncUser from "src/components/SyncUser";

export default function LoginPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  // Redirect sementara kalau user sudah login dan load lengkap
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.log("User already signed in, redirecting to /selectDate");
      router.push("/selectDate").catch((error) => {
        console.error("Failed to redirect:", error);
      });
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center relative">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative mx-auto flex w-full max-w-4xl px-4">
        <div className="flex-1 pr-8 text-white">
          <h1 className="mt-20 mb-6 text-4xl font-bold">Selamat Datang Kembali</h1>
          <p className="text-lg italic">
            “Percayalah kepada TUHAN dengan segenap hatimu…”
          </p>
        </div>

        <div className="flex-1">
          <SignedIn>
            {/* Sync user ke DB lalu redirect */}
            <SyncUser onSynced={() => router.push("/selectDate")} />
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
            <SignIn path="/login" routing="path" signUpUrl="/register" />
          </SignedOut>
        </div>
      </div>
    </div>
  );
}
