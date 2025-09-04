"use client";
import { useState, useMemo } from "react";
import Image from "next/image";
import { UserButton, SignedIn } from "@clerk/nextjs";
import Link from "next/link";
import { Filter, Download, Info } from "lucide-react";

import Drawer from "@mui/material/Drawer";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Statistic() {
  const [open, setOpen] = useState(false);

  // 🟦 data dummy
  const jemaat = [
    { nama: "Toing Sidayat", kehadiran: "Hadir", jabatan: "Pendeta" },
    { nama: "Abdul Sulaiman", kehadiran: "Hadir", jabatan: "Pengurus A" },
    { nama: "Steve Johnson", kehadiran: "Tidak Hadir", jabatan: "Pengurus B" },
    { nama: "Supriad Ismail", kehadiran: "Hadir", jabatan: "Pengurus C" },
    { nama: "Suti Sutantari", kehadiran: "Hadir", jabatan: "Jemaat" },
    { nama: "Siti Andarasari", kehadiran: "Tidak Hadir", jabatan: "Jemaat" },
    { nama: "Putri Elizabeth", kehadiran: "Hadir", jabatan: "Jemaat" },
    { nama: "Indah Purnawisari", kehadiran: "Hadir", jabatan: "Jemaat" },
  ];

  // 🟦 data grafik
  const hadirCount = jemaat.filter((j) => j.kehadiran === "Hadir").length;
  const tidakHadirCount = jemaat.filter((j) => j.kehadiran === "Tidak Hadir").length;
  const kehadiranData = [
    { name: "Hadir", jumlah: hadirCount },
    { name: "Tidak Hadir", jumlah: tidakHadirCount },
  ];

  const perJabatan = useMemo(() => {
    const acc: Record<string, number> = {};
    jemaat.forEach((j) => {
      if (j.kehadiran === "Hadir") {
        acc[j.jabatan] = (acc[j.jabatan] || 0) + 1;
      }
    });
    return Object.entries(acc).map(([jabatan, jumlah]) => ({
      name: jabatan,
      jumlah,
    }));
  }, [jemaat]);

  // 🟦 state filter chart
  const [selectedCharts, setSelectedCharts] = useState<string[]>(["total", "perJabatan"]);

  const toggleChart = (chart: string) => {
    setSelectedCharts((prev) =>
      prev.includes(chart) ? prev.filter((c) => c !== chart) : [...prev, chart]
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-200">
      {/* header */}
      <div className="flex items-center justify-between bg-indigo-900 px-4 py-2 text-white">
        <div className="flex items-center space-x-2">
          <Image src="/LOGOGKI.png" alt="Logo" width={48} height={48} className="h-12 w-12" />
          <span className="ml-3 text-2xl font-bold">Data Jemaat GKI Karawaci</span>
        </div>
        <div className="flex space-x-2">
          <div className="group relative inline-block">
            <button
              onClick={() => setOpen(true)}
              className="rounded-full p-2 transition-colors duration-300 hover:bg-indigo-600"
            >
              <Info size={25} />
            </button>
            <div className="absolute left-1/2 mt-2 -translate-x-1/2 scale-75 rounded-lg bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              Info
            </div>
            <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
              <div style={{ width: 320, padding: "16px" }}>
                <Typography variant="h6" gutterBottom>
                  Help
                </Typography>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>How to use?</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2">
                      - Pilih filter grafik untuk ditampilkan.
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </div>
            </Drawer>
          </div>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>

      {/* filter button area */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          {/* tombol toggle */}
          <button
            onClick={() => toggleChart("total")}
            className={`px-3 py-1.5 rounded text-sm ${
              selectedCharts.includes("total")
                ? "bg-indigo-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Total Kehadiran
          </button>
          <button
            onClick={() => toggleChart("perJabatan")}
            className={`px-3 py-1.5 rounded text-sm ${
              selectedCharts.includes("perJabatan")
                ? "bg-indigo-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Hadir per Jabatan
          </button>
          <Link
            href="/database"
            className="inline-flex items-center gap-1 rounded bg-indigo-500 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-indigo-800"
          >
            Kembali ke Tabel Data
          </Link>
        </div>
      </div>

      {/* tampilkan grafik sesuai filter */}
      <div className="p-6 space-y-8">
        {selectedCharts.includes("total") && (
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Total Kehadiran</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={kehadiranData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="jumlah" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedCharts.includes("perJabatan") && (
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Hadir per Jabatan</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perJabatan}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="jumlah" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
