// src/pages/register.tsx
import { SignUp, SignedIn, UserButton, SignedOut, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/router";
import SyncUser from "src/components/SyncUser";

export default function RegisterPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.log("User signed in, redirecting to /selectDate");
      void router.push("/selectDate");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center relative">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative mx-auto flex w-full max-w-4xl px-4">
        <div className="flex-1 pr-8 text-white">
          <h1 className="mt-20 mb-3 text-4xl font-bold">Selamat Datang</h1>
          <p className="text-lg">Mulailah perjalananmu bersama kami.</p>
        </div>

        <div className="flex-1">
          <SignedIn>
            <SyncUser />
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
            <SignUp path="/register" routing="path" signInUrl="/login" />
          </SignedOut>
        </div>
      </div>
    </div>
  );
}