// src/components/Sidebar.tsx
"use client";

import { useEffect, useState } from "react";
// Import Menu dan X icons (Meskipun Menu digunakan di parent, X digunakan di sini)
import { LogOut, BarChart3, ListChecks, Users, X } from "lucide-react"; 
import { useClerk } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image"; 

interface SidebarProps {
  activeView: string;
  // New props for toggle control
  isOpen: boolean;
  onClose?: () => void; // Dibuat opsional (tambahkan ?)
}

type UserRole = "user" | "admin" | null;

export default function Sidebar({ activeView, isOpen, onClose }: SidebarProps) {
  const { signOut } = useClerk(); 
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

  // Use a transition class to slide it in/out on mobile
  const sidebarClasses = `
    flex flex-col h-full w-64 bg-indigo-800 p-6 shadow-2xl z-50 
    transform transition-transform duration-300
    ${isOpen ? 'translate-x-0 fixed' : '-translate-x-full fixed'} 
    md:translate-x-0 md:static md:flex 
    ${!isOpen && 'hidden md:flex'}
  `;

  if (isLoading) {
    return (
      <div className={sidebarClasses}>
        <div className="flex flex-col h-full w-64 bg-indigo-800 p-6 shadow-2xl text-white items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-3"></div>
            <span>Loading...</span>
        </div>
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

  return (
    <>
      {/* Mobile Backdrop (only when open) */}
      {isOpen && onClose && ( // Pastikan onClose ada sebelum menggunakan backdrop
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}
      
      <div className={sidebarClasses}>
        <div className="flex items-center justify-between pb-8 border-b border-white">
          <div className="flex items-center space-x-3">
              <Image src="/LOGOGKI.png" alt="Logo GKI" width={40} height={40} className="h-10 w-10" unoptimized />
              <span className="text-xl font-extrabold text-white">GKI Karawaci</span>
          </div>
          {/* Close button for mobile */}
          {onClose && (
            <button onClick={onClose} className="md:hidden p-1 text-white hover:text-red-400">
                <X size={24} />
            </button>
          )}
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
              onClick={item.onClick ?? (() => {
                  window.location.href = item.href;
                  // FIX: Cek kondisional sebelum memanggil onClose
                  if (onClose) {
                      onClose(); // Close sidebar after navigation on mobile
                  }
              })}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        {/* Footer / Logout Section */}
        <div className="pt-6 border-t border-white mt-auto">
          <div className="flex items-center justify-between">
            {/* Tombol Logout */}
            <button
              className="text-white flex items-center text-lg space-x-3 hover:text-red-400 hover:font-bold transition"
              onClick={() => signOut({ redirectUrl: "/" })}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>

            {/* Avatar Clerk (klik ini juga bisa logout lewat modal Clerk) */}
            <div className="ml-2">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}