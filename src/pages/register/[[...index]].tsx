import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const nama = formData.get("nama") as string;

    // 1. Daftar ke Supabase Auth (Client-side)
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nama } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      try {
        // 2. Sinkronkan ke Prisma melalui API Route (Server-side)
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            nama: nama,
          }),
        });

        if (res.ok) {
          router.push("/waiting");
        } else {
          setError("Gagal menyinkronkan profil database.");
        }
      } catch (err) {
        setError("Terjadi kesalahan jaringan.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Daftar Akun Baru</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}
        <form onSubmit={handleSignup} className="mt-8 space-y-6">
          <div className="space-y-4">
            <input name="nama" type="text" required placeholder="Nama Lengkap" className="w-full border p-2 rounded" />
            <input name="email" type="email" required placeholder="Email" className="w-full border p-2 rounded" />
            <input name="password" type="password" required placeholder="Password" className="w-full border p-2 rounded" />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-green-600 p-2 text-white rounded hover:bg-green-700">
            {loading ? "Mendaftar..." : "Daftar"}
          </button>
        </form>
        <p className="text-center text-sm">Sudah punya akun? <Link href="/login" className="text-blue-600">Login</Link></p>
      </div>
    </div>
  );
}