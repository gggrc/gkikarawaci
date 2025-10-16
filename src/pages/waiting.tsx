"use client";

import { useEffect, useState } from "react";

export default function WaitingPage() {
  const [status, setStatus] = useState<"pending" | "accepted" | "rejected" | null>(null);

  // 🔁 Cek status user setiap 3 detik
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch("/api/me");
      const data = await res.json();

      if (data.isVerified) {
        setStatus(data.isVerified);
        if (data.isVerified === "accepted") {
          window.location.href = "/statistic"; // redirect kalau sudah diterima
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* 🖼️ Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/waiting-bg.jpg')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      <main className="relative z-10 w-full max-w-lg px-6">
        <section
          role="status"
          className="mx-auto bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl text-center"
        >
          {/* 🔵 Ikon status */}
          <div className="flex items-center justify-center mb-4">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center ${
                status === "rejected"
                  ? "bg-red-50 text-red-600"
                  : "bg-indigo-50 text-indigo-600"
              }`}
            >
              {status === "rejected" ? (
                // ❌ icon cross
                <svg
                  className="h-10 w-10"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                // ⏳ icon spinner
                <svg
                  className={`h-10 w-10 ${status === "pending" ? "animate-spin" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  {status === "pending" && (
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  )}
                </svg>
              )}
            </div>
          </div>

          {/* 📝 Teks status */}
          {status === "rejected" ? (
            <>
              <h1 className="text-2xl font-semibold mb-2 text-red-600">
                Pendaftaran Ditolak
              </h1>
              <p className="text-gray-700 mb-6">
                Mohon maaf, akun Anda belum dapat digunakan. <br />
                Silakan hubungi admin untuk informasi lebih lanjut.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold mb-2">Menunggu Persetujuan Admin</h1>
              <p className="text-gray-700 mb-6">
                Akun Anda sedang diverifikasi oleh admin. <br />
                Proses ini bisa memakan waktu beberapa jam. Anda akan diarahkan secara otomatis
                setelah disetujui.
              </p>
            </>
          )}

          {/* 🔘 Tombol */}
          <div className="flex justify-center gap-3">
            <a
              href="/"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
              Kembali ke Beranda
            </a>
            <a
              href="mailto:admin@example.com"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition"
            >
              Hubungi Admin
            </a>
          </div>

          {/* 📨 Bantuan */}
          <p className="text-sm text-gray-500 mt-4">
            Jika butuh bantuan segera, kirim email ke <b>admin@example.com</b>
          </p>
        </section>
      </main>
    </div>
  );
}
