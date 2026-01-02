// src/pages/waiting.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MeResponse = {
  isVerified: "pending" | "accepted" | "rejected" | null;
  role: string | null;
};

export default function WaitingPage() {
  const [status, setStatus] = useState<
    "pending" | "accepted" | "rejected" | null
  >(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/me");
        const data = (await res.json()) as MeResponse;

        if (data.isVerified) {
          setStatus(data.isVerified);
          if (data.isVerified === "accepted") {
            window.location.href =
              data.role === "admin" ? "/databaseUser" : "/statistic";
            return true;
          }
        }
        return false;
      } catch (error) {
        console.error("Gagal mengambil status user:", error);
        return false;
      }
    };

    void checkStatus();
    const interval = setInterval(() => {
      void checkStatus().then((redirected) => {
        if (redirected) clearInterval(interval);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/waiting-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/50" />

      <main className="relative z-10 w-full max-w-lg px-6">
        <section className="mx-auto rounded-2xl bg-white/80 p-8 text-center shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full ${status === "rejected" ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"}`}
            >
              {status === "rejected" ? (
                <svg
                  className="h-10 w-10"
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
                <svg
                  className={`h-10 w-10 ${status === "pending" ? "animate-spin" : ""}`}
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

          <h1 className="mb-2 text-2xl font-semibold">
            {status === "rejected"
              ? "Pendaftaran Ditolak"
              : "Menunggu Persetujuan Admin"}
          </h1>
          <p className="mb-6 text-gray-700">
            {status === "rejected"
              ? "Mohon maaf, akun Anda belum dapat digunakan. Silakan hubungi admin."
              : "Akun Anda sedang diverifikasi. Anda akan diarahkan otomatis setelah disetujui."}
          </p>

          <div className="flex flex-col justify-center">
            <Link
              href="/"
              className="w-full rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}