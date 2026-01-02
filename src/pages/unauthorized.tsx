// src/pages/unauthorized.tsx
import Link from "next/link";

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl sm:p-10">
        <h1 className="mb-4 text-3xl font-bold text-red-600">Akses Ditolak</h1>
        <p className="mb-6 text-gray-600">
          Kamu tidak punya akses ke halaman ini.
        </p>

        {/* ARAHAN KE INDEX.TSX */}
        <Link
          href="/"
          className="inline-block w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
