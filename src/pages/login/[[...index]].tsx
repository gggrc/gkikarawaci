// src/pages/login/[[...index]].tsx
import { SignIn, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function LoginPage() {
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
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="/register"
            redirectUrl="/statistic"
          />
        </SignedOut>
      </div>
    </div>
  );
}