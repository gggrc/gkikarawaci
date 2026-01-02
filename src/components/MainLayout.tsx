import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SignedOut, UserButton, SignedIn } from "@clerk/nextjs";

type Props = {
  children: React.ReactNode;
  activeSection?: string;
};

export default function MainLayout({ children, activeSection }: Props) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Home", href: "/#home", viewKey: "home" },
    { name: "About", href: "/#about", viewKey: "about" },
    { name: "Location", href: "/#location", viewKey: "location" },
  ];

  return (
    <>
      <Head>
        <title>Database Jemaat GKI Karawaci</title>
        <link rel="icon" href="/LOGOGKI.png" />
      </Head>

      <nav className="fixed top-0 left-0 z-50 flex w-full items-center justify-between px-4 sm:px-8 py-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <Image 
            src="/LOGOGKI.png" 
            alt="Logo" 
            width={40} 
            height={40} 
            priority // Memuat logo lebih cepat (LCP optimization)
            unoptimized 
          />
          <span className="text-white font-semibold text-lg">GKI Karawaci</span>
        </div>
        
        <ul className="hidden md:flex items-center space-x-8 text-white font-medium">
          {navLinks.map((link) => (
            <li key={link.name}>
              <Link 
                href={link.href}
                className={`transition-colors ${activeSection === link.viewKey ? "text-blue-400 font-bold" : "hover:text-blue-400"}`}
              >
                {link.name}
              </Link>
            </li>
          ))}
          <li>
            <SignedOut>
              <Link href="/login" className="px-5 py-2 rounded-full border border-white hover:bg-white hover:text-black transition">
                Login
              </Link>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-3">
                <Link href="/statistic" className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 transition">
                  Daftar Hadir
                </Link>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </li>
        </ul>

        <button className="md:hidden p-2 text-white" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={28} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute top-0 right-0 w-64 h-full bg-[#0f172a] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-8">
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-white"><X size={28} /></button>
            </div>
            <ul className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} onClick={() => setIsMobileMenuOpen(false)} className="text-white text-xl block">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main Content: Next.js hanya akan merender konten halaman yang aktif di sini */}
      <main className="min-h-screen">{children}</main>

      <footer className="bg-[#0f172a] text-white py-8">
        <div className="container mx-auto px-6 text-center md:text-left">
          <p>© 2025 GKI Karawaci</p>
        </div>
      </footer>
    </>
  );
}