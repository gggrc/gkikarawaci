"use client";
import { useState, useMemo } from "react";
import Image from "next/image";
import { UserButton, SignedIn } from "@clerk/nextjs";
import Link from "next/link";
import { Info, Download, X } from "lucide-react";

import Drawer from "@mui/material/Drawer";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [openDialog, setOpenDialog] = useState(false);

  // 🟦 data dummy jemaat
  const jemaat = useMemo(
    () => [
      { nama: "Toing Sidayat", kehadiran: "Hadir", jabatan: "Pendeta" },
      { nama: "Abdul Sulaiman", kehadiran: "Hadir", jabatan: "Pengurus A" },
      { nama: "Steve Johnson", kehadiran: "Tidak Hadir", jabatan: "Pengurus B" },
      { nama: "Supriad Ismail", kehadiran: "Hadir", jabatan: "Pengurus C" },
      { nama: "Suti Sutantari", kehadiran: "Hadir", jabatan: "Jemaat" },
      { nama: "Siti Andarasari", kehadiran: "Tidak Hadir", jabatan: "Jemaat" },
      { nama: "Putri Elizabeth", kehadiran: "Hadir", jabatan: "Jemaat" },
      { nama: "Indah Purnawisari", kehadiran: "Hadir", jabatan: "Jemaat" },
    ],
    []
  );

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
        acc[j.jabatan] = (acc[j.jabatan] ?? 0) + 1;
      }
    });
    return Object.entries(acc).map(([jabatan, jumlah]) => ({
      name: jabatan,
      jumlah,
    }));
  }, [jemaat]);

  // 🟦 state filter chart
  const [selectedCharts, setSelectedCharts] = useState<string[]>([
    "total",
    "perJabatan",
  ]);

  const toggleChart = (chart: string) => {
    setSelectedCharts((prev) =>
      prev.includes(chart)
        ? prev.filter((c) => c !== chart)
        : [...prev, chart]
    );
  };

  // 🟦 download PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    let startY = 10;

    if (selectedCharts.includes("total")) {
      const totalColumn = ["Status", "Jumlah"];
      const totalRows = kehadiranData.map((row) => [row.name, row.jumlah.toString()]);

      autoTable(doc, {
        head: [totalColumn],
        body: totalRows,
        startY,
      });

      const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      if (lastTable?.finalY) {
        startY = lastTable.finalY + 10;
      }
    }

    if (selectedCharts.includes("perJabatan")) {
      const jabColumn = ["Jabatan", "Jumlah"];
      const jabRows = perJabatan.map((row) => [row.name, row.jumlah.toString()]);

      autoTable(doc, {
        head: [jabColumn],
        body: jabRows,
        startY,
      });
    }

    doc.save("statistik.pdf");
  };

  // 🟦 download CSV
  const downloadCSV = () => {
    let csvContent = "";

    if (selectedCharts.includes("total")) {
      csvContent += "Total Kehadiran\n";
      csvContent += "Status,Jumlah\n";
      kehadiranData.forEach((row) => {
        csvContent += `${row.name},${row.jumlah}\n`;
      });
      csvContent += "\n";
    }

    if (selectedCharts.includes("perJabatan")) {
      csvContent += "Hadir per Jabatan\n";
      csvContent += "Jabatan,Jumlah\n";
      perJabatan.forEach((row) => {
        csvContent += `${row.name},${row.jumlah}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "statistik.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

          {/* tombol download */}
          <button
            onClick={() => setOpenDialog(true)}
            className="px-3 py-1.5 bg-indigo-500 text-white rounded inline-flex items-center gap-1 text-sm hover:bg-indigo-800 transition-colors duration-200"
          >
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

      {/* dialog download */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          Download Statistik
          <button className="float-right" onClick={() => setOpenDialog(false)}>
            <X size={20} />
          </button>
        </DialogTitle>
        <DialogContent dividers>
          <Typography>Pilih format file yang ingin diunduh:</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { downloadCSV(); setOpenDialog(false); }}>CSV</Button>
          <Button onClick={() => { downloadPDF(); setOpenDialog(false); }}>PDF</Button>
          <Button onClick={() => setOpenDialog(false)} color="secondary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

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
