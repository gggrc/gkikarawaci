"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";

// Final, type-safe user structures
interface User {
  clerkId: string;
  nama: string;
  email: string;
  profile_pic: string | null;  // ✅ dari Clerk langsung
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
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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
        profile_pic: u.profile_pic, // ✅ ini sudah diisi dari API
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
  const handleAction = async (clerkId: string, action: "accepted" | "rejected"): Promise<void> => {
    try {
      const res = await fetch(`/api/users/${clerkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.clerkId === clerkId ? { ...u, status: action } : u))
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed top-0 left-0 h-full w-64 z-30">
        <Sidebar activeView="user" />
      </div>

      {/* Main Content */}
      <main className="ml-64 flex-1 overflow-y-auto p-8">
        <h1 className="text-3xl font-bold mb-8 text-indigo-800">User Management</h1>

        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <input
            type="text"
            placeholder="Search user by name..."
            className="border rounded-lg px-3 py-2 w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {(["all", "pending", "accepted", "rejected"] as const).map((f) => (
            <button
              key={f}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === f
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* User List */}
        {loading ? (
          <p>Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="space-y-10">
            {(["pending", "accepted", "rejected"] as const).map((status) => {
              const group = filteredUsers.filter((u) => u.status === status);
              if (group.length === 0) return null;

              return (
                <div key={status}>
                  <h2 className="text-2xl font-semibold mb-4 capitalize text-indigo-700">
                    {status} Users
                  </h2>

                  <div className="space-y-4">
                    {group.map((u) => (
                      <div
                        key={u.clerkId}
                        className="flex items-center justify-between bg-white p-4 rounded-xl shadow hover:shadow-md transition"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="relative w-12 h-12">
                            <Image
                              src={u.profile_pic ?? "/default-avatar.png"}
                              alt={u.nama}
                              fill
                              className="rounded-full object-cover border border-gray-300"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{u.nama}</p>
                            <p className="text-sm text-gray-500">{u.email}</p>
                          </div>
                        </div>

                        {status === "pending" ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => void handleAction(u.clerkId, "accepted")}
                              className="bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600 transition"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => void handleAction(u.clerkId, "rejected")}
                              className="bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600 transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`text-sm font-medium capitalize ${
                              status === "accepted"
                                ? "text-green-600"
                                : status === "rejected"
                                ? "text-red-600"
                                : "text-gray-500"
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
  );
}
