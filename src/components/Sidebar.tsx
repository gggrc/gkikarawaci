// src/components/Sidebar.tsx
import Image from "next/image";
import Link from "next/link";
import { ListChecks, BarChart3, LogOut } from "lucide-react";
import { UserButton, useClerk } from "@clerk/nextjs";

interface SidebarProps {
  activeView: 'database' | 'statistic' | 'index'; 
}

export default function Sidebar({ activeView }: SidebarProps) {
  // Clerk Hook tetap dipertahankan untuk fungsi signOut
  const { signOut } = useClerk(); 

  const menuItems = [
    { 
      name: 'Statistik Jemaat', 
      icon: BarChart3, 
      href: '/statistic',
      viewKey: 'statistic' as const
    },
    { 
      name: 'Data & Kehadiran', 
      icon: ListChecks, 
      href: '/database',
      viewKey: 'database' as const
    },
  ];

  const MenuItem = ({ name, icon: Icon, href, viewKey }: { name: string, icon: React.ComponentType<{ size?: number }>, href: string, viewKey: string }) => {
    const isActive = activeView === viewKey;

    // Penyesuaian warna menu untuk latar belakang navy
    const linkClasses = `flex items-center space-x-3 p-3 rounded-xl transition-colors w-full text-left
        ${isActive 
            ? 'bg-indigo-500 text-white shadow-lg' 
            : 'text-white hover:bg-indigo-600 hover:text-white'}`

    return (
      <Link
        href={href}
        className={linkClasses}
      >
        <Icon size={20} />
        <span className="font-medium">{name}</span>
      </Link>
    );
  };

  return (
    // Mengubah latar belakang utama menjadi navy
    <div className="flex flex-col h-full w-64 bg-indigo-800 p-6 shadow-2xl z-20">
      
      {/* PERBAIKAN 1: Hapus onClick={() => signOut({ redirectUrl: "/" })} dari div Header. 
        Header sekarang hanya sebagai branding/display.
      */}
      <div 
        className="flex items-center space-x-3 pb-8 border-b border-white group"
      >
        <Image src="/LOGOGKI.png" alt="Logo GKI" width={40} height={40} className="h-10 w-10" />
        <span className="text-xl font-extrabold text-white">
          GKI Karawaci
        </span>
        {/* Hapus ikon LogOut di sini, karena ini bukan tombol logout */}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-grow mt-6 space-y-2">
        {menuItems.map((item) => (
          <MenuItem key={item.name} {...item} />
        ))}
      </nav>

      {/* Footer/User Section */}
      <div className="pt-6 border-t border-white mt-auto">
        <div className="flex items-center justify-between">
          
          {/* PERBAIKAN 2: Pertahankan Tombol Logout. Ini adalah cara ke-1 untuk logout. */}
          <button 
              className="text-white flex items-center text-lg space-x-3 hover:text-red-400 hover:font-bold transition"
              onClick={() => signOut({ redirectUrl: "/" })}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
          
          {/* PERBAIKAN 3: Pertahankan User Avatar (UserButton). Ini adalah cara ke-2 untuk logout. */}
          <UserButton afterSignOutUrl="/" /> 
        </div>
      </div>
    </div>
  );
}