import { SignUp, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative mx-auto flex w-full max-w-4xl px-4">
        {/* Left text section */}
        <div className="flex-1 pr-8 text-white">
          <h1 className="mt-8 mb-6 text-4xl font-bold">Selamat Datang</h1>
          <p className="text-lg">Mulailah perjalananmu bersama kami.</p>
        </div>

        {/* Register form */}
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        <SignedOut>
          <SignUp
            path="/register"
            routing="path"
            signInUrl="/login"
            redirectUrl="/"  // ✅ redirect ke root juga
          />
        </SignedOut>
      </div>
    </div>
  );
}
