"use client";

import { useEffect, useState } from "react";
import { LogOut, BarChart3, ListChecks, Users, X } from "lucide-react"; 
import { useClerk, UserButton } from "@clerk/nextjs";
import Image from "next/image"; 
import { useRouter } from "next/router";

interface SidebarProps {
  activeView: string;
  isOpen: boolean;
  onClose?: () => void;
}

export default function Sidebar({ activeView, isOpen, onClose }: SidebarProps) {
  const { signOut } = useClerk(); 
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setRole(data.role ?? null);
        }
      } catch (err) {
        console.error("Failed to fetch role:", err);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchRole();
  }, []);

  const menuItems = [
    { name: "Statistik Jemaat", icon: BarChart3, href: "/statistic", viewKey: "statistic" },
    { 
      name: "Data & Kehadiran", 
      icon: ListChecks, 
      href: role === "admin" ? "/database" : "/databaseUser",
      viewKey: "database" 
    },
  ];

  if (role === "admin") {
    menuItems.push({ name: "Users", icon: Users, href: "/user", viewKey: "user" });
  }

  // Handle navigation internal tanpa reload
  const handleNav = (href: string) => {
    void router.push(href);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Overlay Backdrop untuk Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-65 bg-indigo-900 text-white shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:h-screen
      `}>
        <div className="flex flex-col h-full">
          {/* Header Sidebar */}
          <div className="p-6 flex items-center justify-between border-b border-indigo-800">
            <div className="flex items-center space-x-3">
              <Image src="/LOGOGKI.png" alt="Logo" width={40} height={40} unoptimized />
              <span className="text-xl font-bold tracking-tight">GKI Karawaci</span>
            </div>
            <button onClick={onClose} className="md:hidden p-1 hover:bg-indigo-800 rounded-lg">
              <X size={24} />
            </button>
          </div>

          {/* Navigasi */}
          <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center py-10 opacity-50">
                <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mb-2" />
                <span className="text-xs">Memuat menu...</span>
              </div>
            ) : (
              menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNav(item.href)}
                  className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all duration-200 ${
                    activeView === item.viewKey
                      ? "bg-white text-indigo-900 shadow-md font-semibold"
                      : "hover:bg-indigo-800 text-indigo-100"
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </button>
              ))
            )}
          </nav>

          {/* Footer Sidebar */}
          <div className="p-4 border-t border-indigo-800 bg-indigo-950/50">
            <div className="flex items-center justify-between bg-indigo-800/40 p-3 rounded-2xl">
              <div className="flex items-center space-x-3">
                <UserButton afterSignOutUrl="/" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-indigo-200">User Profile</span>
                  <button 
                    onClick={() => signOut({ redirectUrl: "/" })}
                    className="text-xs text-red-400 hover:text-red-300 text-left font-bold"
                  >
                    Logout
                  </button>
                </div>
              </div>
              <LogOut size={18} className="text-indigo-400" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}