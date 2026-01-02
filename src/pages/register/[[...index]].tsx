// src/pages/register/[[...index]].tsx
import { SignUp, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center p-4 relative">
      {/* Overlay Gelap */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Card Clerk */}
      <div className="relative z-10">
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