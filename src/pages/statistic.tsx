"use client";
import Image from "next/image";
import { UserButton, SignedIn } from "@clerk/nextjs";
import Link from "next/link";
import { Filter, Download, Info } from "lucide-react";

export default function Statistic() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-200">
      <div className="flex items-center justify-between bg-indigo-900 px-4 py-2 text-white">
        <div className="flex items-center space-x-2">
          <Image
            src="/LOGOGKI.png"
            alt="Logo"
            width={48}
            height={48}
            className="h-12 w-12"
          />
          <span className="ml-3 text-2xl font-bold">
            Data Jemaat GKI Karawaci
          </span>
        </div>
        <div className="flex space-x-2">
          <div className="group relative inline-block">
            <button className="rounded-full p-2 transition-colors duration-300 hover:bg-indigo-600">
              <Info size={25} />
            </button>

            <div className="absolute left-1/2 mt-2 -translate-x-1/2 scale-75 rounded-lg bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              Info
            </div>
          </div>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded border px-3 py-1 text-sm">
            <Filter size={14} /> Filter
          </button>
          <button className="flex items-center gap-1 rounded border px-3 py-1 text-sm">
            <Download size={14} /> Download
          </button>
          <Link
            href="/database"
            className="inline-flex items-center gap-1 rounded bg-indigo-500 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-indigo-800"
          >
            Kembali ke Tabel Data
          </Link>
        </div>
      </div>
    </div>
  );
}
