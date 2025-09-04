"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Filter, Download, Info, X } from "lucide-react";
import Link from "next/link";
import { UserButton, SignedIn } from "@clerk/nextjs";

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
import type { UserOptions } from "jspdf-autotable";

type Selection = {
  year: number;
  selectedMonth: number;
  selectedDate: number | null;
};

type Jemaat = {
  foto: string;
  nama: string;
  kehadiran: string;
  jabatan: string;
  status: string;
};

export default function DatabaseTablePage() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [checkedAll, setCheckedAll] = useState(false);
  const [checkedRows, setCheckedRows] = useState<boolean[]>([]);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  //state baru
  const [filterStatus, setFilterStatus] = useState("");
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterKehadiran, setFilterKehadiran] = useState("");
//changed ^


  const jemaat: Jemaat[] = [
    { foto: "/avatar1.png", nama: "Toing Sidayat", kehadiran: "Hadir", jabatan: "Pendeta", status: "Aktif" },
    { foto: "/avatar2.png", nama: "Abdul Sulaiman", kehadiran: "Hadir", jabatan: "Pengurus A", status: "Aktif" },
    { foto: "/avatar3.png", nama: "Steve Johnson", kehadiran: "Tidak Hadir", jabatan: "Pengurus B", status: "Aktif" },
    { foto: "/avatar4.png", nama: "Supriad Ismail", kehadiran: "Hadir", jabatan: "Pengurus C", status: "Aktif" },
    { foto: "/avatar5.png", nama: "Suti Sutantari", kehadiran: "Hadir", jabatan: "Jemaat", status: "Tidak Aktif" },
    { foto: "/avatar6.png", nama: "Siti Andarasari", kehadiran: "Tidak Hadir", jabatan: "Jemaat", status: "Aktif" },
    { foto: "/avatar7.png", nama: "Putri Elizabeth", kehadiran: "Hadir", jabatan: "Jemaat", status: "Aktif" },
    { foto: "/avatar8.png", nama: "Indah Purnawisari", kehadiran: "Hadir", jabatan: "Jemaat", status: "Tidak Aktif" },
  ];

//hasil filter
  const filteredJemaat = jemaat.filter((j) => {
    return (
      (filterStatus === "" || j.status === filterStatus) &&
      (filterJabatan === "" || j.jabatan === filterJabatan) &&
      (filterKehadiran === "" || j.kehadiran === filterKehadiran)
    );
  });
//changed^

  useEffect(() => {
    const data = localStorage.getItem("ibadahSelection");
    if (data) {
      try {
        setSelection(JSON.parse(data) as Selection);
      } catch (error) {
        console.error("Failed to parse selection:", error);
      }
    }
  }, []);

  useEffect(() => {
    setCheckedRows(new Array(jemaat.length).fill(false));
  }, [jemaat.length]);

  const toggleCheckAll = () => {
    const newValue = !checkedAll;
    setCheckedAll(newValue);
    setCheckedRows(new Array(jemaat.length).fill(newValue));
  };

  const toggleRow = (index: number) => {
    setCheckedRows((prev) => {
      const newRows = [...prev];
      newRows[index] = !newRows[index];
      setCheckedAll(newRows.every((v) => v));
      return newRows;
    });
  };

  const downloadCSV = () => {
    if (filteredJemaat.length === 0) return;

    const headers = Object.keys(filteredJemaat[0]!).join(",");
    const rows = filteredJemaat.map((row) => Object.values(row).join(",")).join("\n");

    const csvContent = [headers, rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setOpenDialog(false);
  };

  const downloadPDF = () => {
    try {
      const doc = new jsPDF();

      const tableColumn = ["No", "Nama", "Kehadiran", "Jabatan", "Status"];
      const tableRows = filteredJemaat.map((row, idx) => [
        (idx + 1).toString(),
        row.nama,
        row.kehadiran,
        row.jabatan,
        row.status,
      ]);

      const options: UserOptions = {
        head: [tableColumn],
        body: tableRows,
        startY: 10,
      };

      autoTable(doc, options);

      doc.save("data.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      {/* HEADER */}
      <div className="bg-indigo-900 text-white flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-2">
          <Image src="/LOGOGKI.png" alt="Logo" width={48} height={48} className="h-12 w-12" />
          <span className="ml-3 text-2xl font-bold">Data Jemaat GKI Karawaci</span>
        </div>
        <div className="flex space-x-2">
          <div className="group relative inline-block">
            <button
              onClick={() => setOpenDrawer(true)}
              className="rounded-full p-2 transition-colors duration-300 hover:bg-indigo-600"
            >
              <Info size={25} />
            </button>
            <div className="absolute left-1/2 mt-2 -translate-x-1/2 scale-75 rounded-lg bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              Info
            </div>

            <Drawer anchor="right" open={openDrawer} onClose={() => setOpenDrawer(false)}>
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
                      - Open the app <br />
                      - Navigate through the menu <br />
                      - Select the feature you want to use
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

      {/* ACTION BAR */}
      <div className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* FILTER AREA */} 
          <select
            className="border border-indigo-500 bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="Aktif">Aktif</option>
            <option value="Tidak Aktif">Tidak Aktif</option>
          </select>

          <select
            className="border border-indigo-500 bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={filterJabatan}
            onChange={(e) => setFilterJabatan(e.target.value)}>
            <option value="">Semua Jabatan</option>
            {[...new Set(jemaat.map((j) => j.jabatan))].map((jab) => (
              <option key={jab} value={jab}>
                {jab}
              </option>
            ))}
          </select>

          <select
            className="border border-indigo-500 bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={filterKehadiran}
            onChange={(e) => setFilterKehadiran(e.target.value)}>
            <option value="">Semua Kehadiran</option>
            <option value="Hadir">Hadir</option>
            <option value="Tidak Hadir">Tidak Hadir</option>
          </select>

          <button
            onClick={() => setOpenDialog(true)}
            className="px-3 py-1.5 bg-indigo-500 text-white rounded inline-flex items-center gap-1 text-sm hover:bg-indigo-800 transition-colors duration-200"
          >
            <Download size={14} /> Download
          </button>
          <Link
            href="/selectDate"
            className="px-3 py-1.5 bg-indigo-500 text-white rounded inline-flex items-center gap-1 text-sm hover:bg-indigo-800 transition-colors duration-200"
          >
            <Plus size={14} /> Lihat Tanggal Lain
          </Link>
          <Link
            href="/statistic"
            className="px-3 py-1.5 bg-indigo-500 text-white rounded inline-flex items-center gap-1 text-sm hover:bg-indigo-800 transition-colors duration-200"
          >
            Lihat Statistik
          </Link>
        </div>
        <span className="text-sm text-gray-700">Total: {filteredJemaat.length} Jemaat</span>
      </div>

      {/* DOWNLOAD DIALOG */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          Download Tabel
          <button className="float-right" onClick={() => setOpenDialog(false)}>
            <X size={20} />
          </button>
        </DialogTitle>
        <DialogContent dividers>
          <Typography>Pilih format file yang ingin diunduh:</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={downloadCSV}>CSV</Button>
          <Button onClick={downloadPDF}>PDF</Button>
          <Button onClick={() => setOpenDialog(false)} color="secondary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* TABLE */}
      <div className="m-4 overflow-x-auto bg-white rounded-2xl shadow">
        <div className="flex justify-between items-center px-4 py-2 text-lg font-bold text-gray-600 border-b">
          <span>
            {selection
              ? `${selection.selectedDate ?? ""} ${new Date(
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
                <input type="checkbox" checked={checkedAll} onChange={toggleCheckAll} />
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
            {filteredJemaat.map((j, idx) => (
              <tr key={j.nama} className="odd:bg-purple-50">
                <td className="px-3 py-2 border text-center">
                  <input
                    type="checkbox"
                    // indexnya skrg dr filteredJemaat
                    checked={checkedRows[idx] ?? false}
                    onChange={() => toggleRow(idx)}
                  />
                </td>
                <td className="px-3 py-2 border">{idx + 1}.</td>
                <td className="px-3 py-2 border">
                  <Image src={j.foto} alt={j.nama} width={40} height={40} className="rounded-full" />
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
