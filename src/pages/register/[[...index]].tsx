// src/pages/register.tsx
import { SignUp, SignedIn, UserButton, SignedOut } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-[url('/backgroundLogin.jpeg')]">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative flex w-full max-w-4xl mx-auto px-4">
        
        <div className="flex-1 text-white pr-8">
          <h1 className="text-4xl font-bold mb-3 mt-25">Selamat Datang</h1>
          <p className="text-lg">
            Mulailah perjalananmu bersama kami.
          </p>
        </div>

        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        <SignedOut>
          <SignUp 
            path="/register" 
            routing="path" 
            signInUrl="/login"
            redirectUrl="/selectDate" 
          />
        </SignedOut>
      </div>
    </div>
  );
}
