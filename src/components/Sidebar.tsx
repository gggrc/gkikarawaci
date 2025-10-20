"use client";

import { useEffect, useState } from "react";
import { LogOut, BarChart3, ListChecks, Users } from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import Image from "next/image";

interface SidebarProps {
  activeView: string;
}

type UserRole = "user" | "admin" | null;

export default function Sidebar({ activeView }: SidebarProps) {
  const { signOut } = useClerk();
  const { user } = useUser(); // ✅ Clerk user (ada imageUrl, fullName, email)
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-64 bg-indigo-800 p-6 shadow-2xl text-white items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-3"></div>
        <span>Loading...</span>
      </div>
    );
  }

  type MenuItem = {
    name: string;
    icon: React.ElementType;
    href: string;
    viewKey: string;
    onClick?: () => void;
  };

  const menuItems: MenuItem[] = [
    { name: "Statistik Jemaat", icon: BarChart3, href: "/statistic", viewKey: "statistic" },
    { name: "Data & Kehadiran", icon: ListChecks, href: "/database", viewKey: "database" },
  ];

  if (role === "admin") {
    menuItems.push({ name: "Users", icon: Users, href: "/user", viewKey: "user" });
  }

  return (
    <div className="flex flex-col h-full w-64 bg-indigo-800 p-6 shadow-2xl z-20">
      <div className="flex items-center space-x-3 pb-8 border-b border-white">
        <span className="text-xl font-extrabold text-white">GKI Karawaci</span>
      </div>

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

      {/* ✅ Profile + Logout */}
      <div className="pt-6 border-t border-white mt-auto flex items-center gap-3">
        <Image
          src={user?.imageUrl ?? "/default-avatar.png"}
          alt={user?.fullName ?? "User"}
          width={36}
          height={36}
          className="rounded-full border border-white"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold">{user?.fullName}</p>
          <p className="text-xs text-gray-300 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="text-white hover:text-red-400 transition"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
