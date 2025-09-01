"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Filter, Download, Info } from "lucide-react";
import Link from "next/link";
import { UserButton, SignedIn } from "@clerk/nextjs";

type Selection = {
  year: number;
  selectedMonth: number;
  selectedDate: number | null;
};

export default function DatabaseTablePage() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [checkedAll, setCheckedAll] = useState(false);
  const [checkedRows, setCheckedRows] = useState<boolean[]>([]);

  useEffect(() => {
    const data = localStorage.getItem("ibadahSelection");
    if (data) setSelection(JSON.parse(data) as Selection);
  }, []);

  const jemaat = [
    { foto: "/avatar1.png", nama: "Toing Sidayat", kehadiran: "Hadir", jabatan: "Pendeta", status: "Aktif" },
    { foto: "/avatar2.png", nama: "Abdul Sulaiman", kehadiran: "Hadir", jabatan: "Pengurus A", status: "Aktif" },
    { foto: "/avatar3.png", nama: "Steve Johnson", kehadiran: "Tidak Hadir", jabatan: "Pengurus B", status: "Aktif" },
    { foto: "/avatar4.png", nama: "Supriad Ismail", kehadiran: "Hadir", jabatan: "Pengurus C", status: "Aktif" },
    { foto: "/avatar5.png", nama: "Suti Sutantari", kehadiran: "Hadir", jabatan: "Jemaat", status: "Tidak Aktif" },
    { foto: "/avatar6.png", nama: "Siti Andarasari", kehadiran: "Tidak Hadir", jabatan: "Jemaat", status: "Aktif" },
    { foto: "/avatar7.png", nama: "Putri Elizabeth", kehadiran: "Hadir", jabatan: "Jemaat", status: "Aktif" },
    { foto: "/avatar8.png", nama: "Indah Purnawisari", kehadiran: "Hadir", jabatan: "Jemaat", status: "Tidak Aktif" },
  ];

  // inisialisasi checkbox per baris
  useEffect(() => {
    setCheckedRows(new Array(jemaat.length).fill(false));
  }, [jemaat.length]);

  const toggleCheckAll = () => {
    const newValue = !checkedAll;
    setCheckedAll(newValue);
    setCheckedRows(new Array(jemaat.length).fill(newValue));
  };

  const toggleRow = (index: number) => {
    const newRows = [...checkedRows];
    newRows[index] = !newRows[index];
    setCheckedRows(newRows);
    setCheckedAll(newRows.every((v) => v));
  };

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      <div className="bg-indigo-900 text-white flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-2">
          <Image src="/LOGOGKI.png" alt="Logo" width={48} height={48} className="h-12 w-12"/>
        <span className="ml-3 text-2xl font-bold">Data Jemaat GKI Karawaci</span>
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

      <div className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border rounded flex items-center gap-1 text-sm">
            <Filter size={14} /> Filter
          </button>
          <button className="px-3 py-1 border rounded flex items-center gap-1 text-sm">
            <Download size={14} /> Download
          </button>
          <Link
            href="/selectDate"
            className="px-3 py-1.5 bg-indigo-500 text-white rounded inline-flex items-center gap-1 text-sm 
                      hover:bg-indigo-800 transition-colors duration-200"
          >
            <Plus size={14} /> Lihat Tanggal Lain
          </Link>
          <Link
            href="/statistic"
            className="px-3 py-1.5 bg-indigo-500 text-white rounded inline-flex items-center gap-1 text-sm 
                      hover:bg-indigo-800 transition-colors duration-200"
          >
            Lihat Statistik
          </Link>
        </div>
        <span className="text-sm text-gray-700">Total: {jemaat.length} Jemaat</span>
      </div>

      {/* TABLE */}
      <div className="m-4 overflow-x-auto bg-white rounded-2xl shadow">
        <div className="flex justify-between items-center px-4 py-2 text-lg font-bold text-gray-600 border-b">
          <span>
            {selection
              ? ` ${selection.selectedDate ?? ""} ${new Date(
                  0,
                  selection.selectedMonth
                ).toLocaleString("id-ID", { month: "long" })} ${selection.year}`
              : ""}
          </span>
        </div>

        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-indigo-900 text-white">
            <tr>
              <th className="px-3 py-2 border text-center">
                <input
                  type="checkbox"
                  checked={checkedAll}
                  onChange={toggleCheckAll}
                />
              </th>
              <th className="px-3 py-2 border">No.</th>
              <th className="px-3 py-2 border">Foto</th>
              <th className="px-3 py-2 border">Nama</th>
              <th className="px-3 py-2 border">Kehadiran</th>
              <th className="px-3 py-2 border">Jabatan</th>
              <th className="px-3 py-2 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {jemaat.map((j, idx) => (
              <tr key={idx} className="odd:bg-purple-50">
                <td className="px-3 py-2 border text-center">
                  <input
                    type="checkbox"
                    checked={checkedRows[idx] ?? false}
                    onChange={() => toggleRow(idx)}
                  />
                </td>
                <td className="px-3 py-2 border">{idx + 1}.</td>
                <td className="px-3 py-2 border">
                  <Image
                    src={j.foto}
                    alt={j.nama}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                </td>
                <td className="px-3 py-2 border">{j.nama}</td>
                <td className="px-3 py-2 border">{j.kehadiran}</td>
                <td className="px-3 py-2 border">{j.jabatan}</td>
                <td className="px-3 py-2 border">{j.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
