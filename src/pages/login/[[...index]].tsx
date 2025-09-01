import { SignIn, SignedIn, UserButton, SignedOut } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-[url('/backgroundLogin.jpeg')]">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative flex w-full max-w-4xl mx-auto px-4">
    
        <div className="flex-1 text-white pr-8">
          <h1 className="text-4xl font-bold mb-6 mt-8">Selamat Datang Kembali</h1>
          <p className="italic text-lg">
            “Percayalah kepada TUHAN dengan segenap hatimu, dan janganlah bersandar kepada pengertianmu sendiri. Akuilah Dia dalam segala lakumu, maka Ia akan meluruskan jalanmu.”
          </p>
          <h4 className="italic text-xl font-bold mt-3">(Amsal 3:5-6)</h4>
        </div>

        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        <SignedOut>
          <SignIn 
            path="/login" 
            routing="path" 
            signUpUrl="/register" 
            redirectUrl="/selectDate" 
          />
        </SignedOut>
      </div>
    </div>
  );
}
