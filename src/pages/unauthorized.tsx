// src/pages/unauthorized.tsx
import Link from "next/link";

export default function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="bg-white p-8 sm:p-10 rounded-xl shadow-2xl max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Akses Ditolak</h1>
        <p className="text-gray-600 mb-6">Kamu tidak punya akses ke halaman ini.</p>
        <Link
          href="/"
          className="w-full inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}