"use client";

import { useEffect, useState } from "react";
import { LogOut, BarChart3, ListChecks, Users } from "lucide-react";
import { useClerk } from "@clerk/nextjs";

interface SidebarProps {
  activeView: string;
}

type UserRole = "user" | "admin" | null;

export default function Sidebar({ activeView }: SidebarProps) {
  const { signOut } = useClerk();
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🧠 Ambil role user dari API
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) {
          console.warn("Failed to fetch role:", res.status);
          setRole(null);
          return;
        }
        const data = (await res.json()) as { role?: UserRole };
        setRole(data.role ?? null);
      } catch (err) {
        console.error("Failed to fetch role:", err);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchRole();
  }, []);

  // ⏳ Tampilkan loading saat role belum siap
  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-64 bg-indigo-800 p-6 shadow-2xl text-white items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-3"></div>
        <span>Loading...</span>
      </div>
    );
  }

  // 📋 Menu default untuk semua user
  type MenuItem = {
    name: string;
    icon: React.ElementType;
    href: string;
    viewKey: string;
    onClick?: () => void;
  };

  const menuItems: MenuItem[] = [
    {
      name: "Statistik Jemaat",
      icon: BarChart3,
      href: "/statistic",
      viewKey: "statistic",
    },
    {
      name: "Data & Kehadiran",
      icon: ListChecks,
      href: "/database",
      viewKey: "database",
    },
  ];

  // 🧑‍💼 Tambahkan menu admin hanya kalau role === "admin"
  if (role === "admin") {
    menuItems.push({
      name: "Users",
      icon: Users,
      href: "/user",
      viewKey: "user",
    });
  }

  return (
    <div className="flex flex-col h-full w-64 bg-indigo-800 p-6 shadow-2xl z-20">
      {/* Logo / Header */}
      <div className="flex items-center space-x-3 pb-8 border-b border-white">
        <span className="text-xl font-extrabold text-white">GKI Karawaci</span>
      </div>

      {/* Navigation */}
      <nav className="flex-grow mt-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.name}
            className={`flex items-center space-x-3 p-3 rounded-xl w-full transition ${
              activeView === item.viewKey
                ? "bg-indigo-500 text-white shadow-lg"
                : "text-white hover:bg-indigo-600 hover:text-white"
            }`}
            onClick={item.onClick ?? (() => (window.location.href = item.href))}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="pt-6 border-t border-white mt-auto">
        <button
          className="text-white flex items-center text-lg space-x-3 hover:text-red-400 hover:font-bold transition"
          onClick={() => signOut({ redirectUrl: "/" })}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>

      
    </div>
  );
}
