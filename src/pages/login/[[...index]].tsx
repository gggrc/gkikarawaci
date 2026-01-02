import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client"; // Sesuaikan path client Anda

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Mengarahkan user kembali ke halaman utama setelah login berhasil
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) setError(error.message);
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Masuk ke GKI</h2>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>
        )}

        {/* Tombol Login Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 p-2 rounded-md hover:bg-gray-50 transition"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span>Masuk dengan Google</span>
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
          <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-500">Atau menggunakan email</span></div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <input name="email" type="email" required placeholder="Email" className="w-full border p-2 rounded" />
          <input name="password" type="password" required placeholder="Password" className="w-full border p-2 rounded" />
          <button type="submit" className="w-full bg-blue-600 p-2 text-white rounded">Login</button>
        </form>

        <p className="text-center text-sm">
          Belum punya akun? <Link href="/register" className="text-blue-600">Daftar</Link>
        </p>
      </div>
    </div>
  );
}