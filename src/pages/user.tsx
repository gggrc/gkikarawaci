"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Sidebar from "~/components/Sidebar"; // Menggunakan alias path yang benar
import { Menu, Loader2 } from "lucide-react"; // Import Menu dan Loader2 untuk loading state

// Final, type-safe user structures
interface User {
  clerkId: string;
  nama: string;
  email: string;
  profile_pic: string | null;
  status: "pending" | "accepted" | "rejected";
}

interface RawUser {
  clerkId: string;
  nama: string;
  email: string;
  profile_pic: string | null;
  isVerified: string;
}

export default function UserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<
    "all" | "pending" | "accepted" | "rejected"
  >("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // NEW STATE for responsiveness

  // ✅ Fetch users with strict typing
  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");

      const raw = (await res.json()) as RawUser[];

      const data: User[] = raw.map((u) => ({
        clerkId: u.clerkId,
        nama: u.nama,
        email: u.email,
        profile_pic: u.profile_pic,
        status:
          u.isVerified === "accepted"
            ? "accepted"
            : u.isVerified === "rejected"
              ? "rejected"
              : "pending",
      }));

      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  // ✅ Handles Accept / Reject buttons
  const handleAction = async (
    clerkId: string,
    action: "accepted" | "rejected",
  ): Promise<void> => {
    try {
      const res = await fetch(`/api/users/${clerkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.clerkId === clerkId ? { ...u, status: action } : u,
          ),
        );
      } else {
        console.error(await res.text());
        alert("Failed to update user status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Filter + search logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.nama.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || u.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    // Responsive Main Container
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (FIX: Removed lg:relative to prevent it from occupying space in the flow) */}
      <div
        className={`fixed top-0 left-0 z-40 h-screen w-64 transform bg-white shadow-2xl transition-transform duration-300 lg:shadow-none ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Menggunakan `isOpen` dan `onClose` untuk kontrol di Sidebar */}
        <Sidebar
          activeView="user"
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Content (FIX: Removed flex-grow, and made sure lg:ml-64 is applied) */}
      {/* We need an outer div to manage the content area flow, effectively simulating a non-flex layout with fixed sidebar */}
      <div className="w-full overflow-y-auto lg:ml-64">
        <main className={`w-full p-4 transition-all duration-300 md:p-8`}>
          {/* Hamburger Menu for Mobile */}
          <div className="mb-4 flex justify-start lg:hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-full bg-indigo-600 p-2 text-white shadow-md"
            >
              <Menu size={24} />
            </button>
          </div>

          <h1 className="mb-6 text-2xl font-bold text-indigo-800 md:text-3xl">
            User Management
          </h1>

          {/* Search & Filter (Improved Responsiveness) */}
          <div className="mb-8 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-lg md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Cari user berdasarkan nama..."
              className="w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none md:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex flex-wrap gap-2 md:gap-3">
              {(["all", "pending", "accepted", "rejected"] as const).map(
                (f) => (
                  <button
                    key={f}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all md:px-4 md:py-2 ${
                      filter === f
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* User List */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2
                size={32}
                className="mr-2 animate-spin text-indigo-600"
              />
              <p className="text-xl text-indigo-600">Memuat daftar user...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              Tidak ada user yang ditemukan.
            </p>
          ) : (
            <div className="space-y-8">
              {(["pending", "accepted", "rejected"] as const).map((status) => {
                const group = filteredUsers.filter((u) => u.status === status);
                if (group.length === 0) return null;

                return (
                  <div key={status}>
                    <h2 className="mb-4 border-b pb-2 text-xl font-bold text-indigo-700 capitalize md:text-2xl">
                      {status} Users ({group.length})
                    </h2>

                    <div className="space-y-4">
                      {group.map((u) => (
                        <div
                          key={u.clerkId}
                          // Improved card responsiveness
                          className="flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 shadow transition hover:shadow-md sm:flex-row sm:items-center"
                        >
                          <div className="mb-3 flex items-center space-x-4 sm:mb-0">
                            {/* FIX: Add 'relative' to the parent div for Image fill */}
                            <div className="relative h-12 w-12 flex-shrink-0">
                              <Image
                                src={u.profile_pic ?? "/default-avatar.png"}
                                alt={u.nama}
                                fill
                                className="rounded-full border border-gray-300 object-cover"
                                unoptimized
                              />
                            </div>
                            <div>
                              {/* Memastikan teks pecah baris di layar kecil */}
                              <p className="max-w-full font-semibold break-words text-gray-800">
                                {u.nama}
                              </p>
                              <p className="max-w-full text-sm break-words text-gray-500">
                                {u.email}
                              </p>
                            </div>
                          </div>

                          {status === "pending" ? (
                            <div className="flex justify-end space-x-2 border-t pt-2 sm:justify-start sm:border-t-0 sm:pt-0">
                              <button
                                onClick={() =>
                                  void handleAction(u.clerkId, "accepted")
                                }
                                className="rounded bg-green-500 px-3 py-1.5 text-sm text-white transition hover:bg-green-600"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() =>
                                  void handleAction(u.clerkId, "rejected")
                                }
                                className="rounded bg-red-500 px-3 py-1.5 text-sm text-white transition hover:bg-red-600"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`rounded-full px-3 py-1 text-center text-sm font-medium capitalize ${
                                status === "accepted"
                                  ? "bg-green-100 text-green-700"
                                  : status === "rejected"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {status}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
