// src/pages/login/[[...index]].tsx
import dynamic from "next/dynamic";
import AuthLayout from "@/components/AuthLayout";

// Lazy load komponen Clerk
const SignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  { ssr: false },
);
const SignedOut = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignedOut),
  { ssr: false },
);
const SignedIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignedIn),
  { ssr: false },
);
const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false },
);

export default function LoginPage() {
  return (
    <AuthLayout
      title="Selamat Datang Kembali"
      quote="“Percayalah kepada TUHAN dengan segenap hatimu...”"
      verse="(Amsal 3:5-6)"
    >
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
    </AuthLayout>
  );
}
