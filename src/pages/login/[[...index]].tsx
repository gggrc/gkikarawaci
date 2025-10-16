import { SignIn, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative mx-auto flex w-full max-w-4xl px-4">
        {/* Left text section */}
        <div className="flex-1 pr-8 text-white">
          <h1 className="mt-8 mb-6 text-4xl font-bold">
            Selamat Datang Kembali
          </h1>
          <p className="text-lg italic">
            “Percayalah kepada TUHAN dengan segenap hatimu, dan janganlah
            bersandar kepada pengertianmu sendiri. Akuilah Dia dalam segala
            lakumu, maka Ia akan meluruskan jalanmu.”
          </p>
          <h4 className="mt-3 text-xl font-bold italic">(Amsal 3:5-6)</h4>
        </div>

        {/* Login form */}
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        <SignedOut>
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="/register"
            redirectUrl="/"  // ✅ redirect ke root supaya middleware yang handle arahkan selanjutnya
          />
        </SignedOut>
      </div>
    </div>
  );
}
