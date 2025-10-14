// src/pages/register.tsx
import { SignUp, SignedIn, UserButton, SignedOut } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative mx-auto flex w-full max-w-4xl px-4">
        <div className="flex-1 pr-8 text-white">
          <h1 className="mt-25 mb-3 text-4xl font-bold">Selamat Datang</h1>
          <p className="text-lg">Mulailah perjalananmu bersama kami.</p>
        </div>

        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        <SignedOut>
          <SignUp
            path="/register"
            routing="path"
            signInUrl="/login"
            redirectUrl="/statistic"
          />
        </SignedOut>
      </div>
    </div>
  );
}