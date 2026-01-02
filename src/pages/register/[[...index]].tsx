// src/pages/register/[[...index]].tsx
import AuthLayout from "@/components/AuthLayout";
import { SignUp, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <AuthLayout title="Selamat Datang">
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
    </AuthLayout>
  );
}
