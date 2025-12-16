// src/pages/login/[[...index]].tsx
import { SignIn, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center p-4">
      <div className="absolute inset-0 bg-black/30" />
      {/* PERUBAHAN: max-w-4xl -> max-w-3xl & memastikan flex center untuk konten kiri */}
      <div className="relative mx-auto flex flex-col md:flex-row w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-sm">
        {/* Left text section - Added flex-col justify-center for vertical centering */}
        <div className="flex-1 p-8 text-white hidden md:flex flex-col justify-center items-start"> 
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

        {/* Login form - Added flex justify-center items-center to center the Clerk component */}
        <div className="flex-1 w-full bg-white p-6 sm:p-10 flex justify-center items-center">
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
    </div>
  );
}