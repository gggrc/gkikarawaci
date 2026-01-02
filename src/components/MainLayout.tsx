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

      <nav className="fixed top-0 left-0 z-50 flex w-full items-center justify-between px-4 sm:px-8 py-4 sm:py-6 bg-black/80 backdrop-blur-sm transition-none">
        <div className="flex items-center space-x-4">
          <Image src="/LOGOGKI.png" alt="Logo" width={36} height={36} className="h-9 w-9 sm:h-12 sm:w-12" unoptimized />
          <span className="text-white font-semibold text-lg sm:text-xl">GKI Karawaci</span>
        </div>
        
        <ul className="hidden md:flex items-center space-x-4 sm:space-x-8 text-white font-medium ml-auto">
          {navLinks.map((link) => (
            <li key={link.name} className={`cursor-pointer transition ${activeSection === link.viewKey ? "text-blue-400 font-bold underline underline-offset-4" : "hover:text-blue-400"}`}>
              <a href={link.href}>{link.name}</a>
            </li>
          ))}
          <li>
            <SignedOut>
              <Link href="/login">
                <button className="px-5 py-2 rounded-full border border-white text-white hover:bg-white hover:text-[#0f172a] transition">Login</button>
              </Link>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-3">
                <Link href="/statistic">
                  <button className="px-4 py-2 rounded-full border border-white text-white hover:bg-blue-300 hover:text-[#0f172a] transition">Daftar Hadir</button>
                </Link>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </li>
        </ul>

        <button className="md:hidden p-2 text-white hover:text-blue-400 transition" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={28} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-60 bg-black/30 backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute top-0 right-0 w-64 h-full bg-[#0f172a] shadow-2xl p-6 animate-slide-in-right">
            <div className="flex justify-end mb-8 border-b border-gray-700 pb-3">
              <button className="p-2 text-white hover:text-red-400 transition" onClick={() => setIsMobileMenuOpen(false)}>
                <X size={28} />
              </button>
            </div>
            <ul className="flex flex-col space-y-4 text-white font-medium">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className={`text-xl block py-2 ${activeSection === link.viewKey ? "text-blue-400 font-bold border-b-2 border-blue-400" : ""}`} onClick={() => setIsMobileMenuOpen(false)}>
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <main>{children}</main>

      <footer className="w-full bg-[#0f172a] text-white py-8 sm:py-10">
        <div className="container mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-lg sm:text-xl font-bold">GKI Karawaci</h3>
            <p className="text-xs sm:text-sm text-gray-300 mt-2">Ruko Villa Permata Blok C1 No. 3&8, Binong, Tangerang, Banten 15810</p>
          </div>
          <div className="text-sm text-gray-200 text-center md:text-right">© 2025 GKI Karawaci. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}