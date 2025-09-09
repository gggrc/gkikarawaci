"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";

export default function SaveUser() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const saveUser = async () => {
    if (!user) {
      setStatus("User belum login");
      return;
    }

    setLoading(true);
    setStatus(null);

    const res = await fetch("/api/save-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: `${user.firstName ?? ""} ${user.lastName ?? ""}`,
        email: user.primaryEmailAddress?.emailAddress,
        tanggal_lahir: new Date(), // default dulu
        gender: "unknown", // default
        jabatan: "member", // default
        isVerified: user.emailAddresses[0]?.verification?.status === "verified",
        role: "user",
      }),
    });

    if (res.ok) {
      setStatus("✅ User berhasil disimpan/diupdate");
    } else {
      setStatus("❌ Gagal menyimpan user");
    }

    setLoading(false);
  };

  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-2">Sinkronisasi User</h2>

      <button
        onClick={saveUser}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Menyimpan..." : "Simpan user ke Database"}
      </button>

      {status && <p className="mt-3 text-sm">{status}</p>}
    </div>
  );
}
