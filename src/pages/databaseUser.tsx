"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Download, X, Info } from "lucide-react";
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

type Jemaat = {
  foto: string;
  nama: string;
  kehadiran: string;
  jabatan: string;
  status: string;
  kehadiranSesi: "Pagi" | "Siang" | "Sore";
};

type IbadahSelection = {
  year: number;
  selectedMonth: number | null;
  selectedDate: string | null;
};

export default function DatabaseTablePage() {
  const [filterSessions, setFilterSessions] = useState<string[]>([]);
  const [checkedAll, setCheckedAll] = useState(false);
  const [checkedRows, setCheckedRows] = useState<boolean[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [jemaat, setJemaat] = useState<Jemaat[]>([]);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Jemaat | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterKehadiran, setFilterKehadiran] = useState("");
  const [selectedIbadah, setSelectedIbadah] = useState<IbadahSelection | null>(
    null,
  );

  const monthNames: string[] = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  useEffect(() => {
    const saved = localStorage.getItem("ibadahSelection");
    if (saved) {
      try {
        setSelectedIbadah(JSON.parse(saved) as IbadahSelection);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/jemaat", { cache: "no-store" });
        if (!res.ok) throw new Error("Gagal fetch data jemaat");

        const data: unknown = await res.json();

        if (
          Array.isArray(data) &&
          data.every(
            (item) =>
              item &&
              typeof (item as Jemaat).foto === "string" &&
              typeof (item as Jemaat).nama === "string" &&
              typeof (item as Jemaat).kehadiran === "string" &&
              typeof (item as Jemaat).jabatan === "string" &&
              typeof (item as Jemaat).status === "string" &&
              typeof (item as Jemaat).kehadiranSesi === "string" &&
              ["Pagi","Siang","Sore"].includes((item as Jemaat).kehadiranSesi)
          )
        ) {
          setJemaat(data as Jemaat[]);
        } else {
          throw new Error("Data jemaat tidak valid");
        }
      } catch (err) {
        console.error("Error fetch jemaat:", err);
      }
    };

    void fetchData(); 
  }, []);

  const filteredJemaat = jemaat.filter((j) => {
    return (
      (filterStatus === "" || j.status === filterStatus) &&
      (filterJabatan === "" || j.jabatan === filterJabatan) &&
      (filterKehadiran === "" || j.kehadiran === filterKehadiran) &&
      (filterSessions.length === 0 || filterSessions.includes(j.kehadiranSesi))
    );
  });


  useEffect(() => {
    setCheckedRows(new Array(filteredJemaat.length).fill(false));
    setCheckedAll(false);
  }, [filteredJemaat.length]);

  const toggleCheckAll = () => {
    const newValue = !checkedAll;
    setCheckedAll(newValue);
    setCheckedRows(new Array(filteredJemaat.length).fill(newValue));
  };

  const toggleRow = (index: number) => {
    setCheckedRows((prev) => {
      const newRows = [...prev];
      newRows[index] = !newRows[index];
      setCheckedAll(newRows.every(Boolean));
      return newRows;
    });
  };

  const downloadCSV = () => {
    if (filteredJemaat.length === 0) return;

    const firstItem = filteredJemaat[0];
    if (!firstItem) return;

    const headers = Object.keys(firstItem).join(",");

    const rows = filteredJemaat
      .filter((row): row is Jemaat => row !== undefined)
      .map((row) => Object.values(row).join(","))
      .join("\n");

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
    const doc = new jsPDF();
    const tableColumn = ["No", "Nama", "Kehadiran", "Jabatan", "Status"];
    const tableRows = filteredJemaat.map((row, idx) => [
      (idx + 1).toString(),
      row.nama,
      row.kehadiran,
      row.jabatan,
      row.status,
    ]);
    autoTable(doc, { head: [tableColumn], body: tableRows } as UserOptions);
    doc.save("data.pdf");
  };

  const handleRowClick = (row: Jemaat) => {
    setSelectedRow(row);
    setOpenDrawer(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-200">
      {/* HEADER */}
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
            <button
              onClick={() => setOpenDrawer(true)}
              className="rounded-full p-2 transition-colors duration-300 hover:bg-indigo-600"
            >
              <Info size={25} />
            </button>
            <div className="absolute left-1/2 mt-2 -translate-x-1/2 scale-75 rounded-lg bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              Info
            </div>

            <Drawer
              anchor="right"
              open={openDrawer}
              onClose={() => setOpenDrawer(false)}
            >
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
                      - Navigate through the menu <br />- Select the feature you
                      want to use
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

      {/* FILTERS */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          <select
            value={filterKehadiran}
            onChange={(e) => setFilterKehadiran(e.target.value)}
            className="rounded border border-indigo-500 bg-indigo-500 px-1 py-1 text-white"
          >
            <option value="">Kehadiran</option>
            <option value="Hadir">Hadir</option>
            <option value="Tidak Hadir">Tidak Hadir</option>
          </select>
          <select
            value={filterJabatan}
            onChange={(e) => setFilterJabatan(e.target.value)}
            className="rounded border border-indigo-500 bg-indigo-500 px-1 py-1 text-white"
          >
            <option value="">Jabatan</option>
            {[...new Set(jemaat.map((j) => j.jabatan))].map((jab) => (
              <option key={jab} value={jab}>
                {jab}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-indigo-500 bg-indigo-500 px-1 py-1 text-white"
          >
            <option value="">Status</option>
            <option value="Aktif">Aktif</option>
            <option value="Tidak Aktif">Tidak Aktif</option>
          </select>
          
          {/* ✅ Dropdown multiple filter sesi */}
          <select
            multiple
            value={filterSessions}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              setFilterSessions(selected);
            }}
            className="rounded border border-indigo-500 bg-indigo-500 px-2 py-1 text-white"
          >
            <option value="Pagi">Pagi</option>
            <option value="Siang">Siang</option>
            <option value="Sore">Sore</option>
          </select>

          <Link
            href="/selectDate"
            className="inline-flex items-center gap-1 rounded bg-indigo-500 px-3 py-1.5 text-sm text-white hover:bg-indigo-800"
          >
            <Plus size={14} /> Lihat Tanggal Lain
          </Link>
          <button
            onClick={() => setOpenDialog(true)}
            className="inline-flex items-center gap-1 rounded border bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-700 hover:text-white"
          >
            <Download size={14} /> Download
          </button>
          <Link
            href="/statistic"
            className="inline-flex items-center gap-1 rounded border bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-700 hover:text-white"
          >
            Lihat Statistik
          </Link>
        </div>
        <span className="text-sm text-gray-700">
          Total: {filteredJemaat.length} Jemaat
        </span>
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
      <div className="m-4 overflow-x-auto rounded-2xl bg-white shadow">
        {selectedIbadah && (
          <div className="mb-2 rounded bg-yellow-100 px-4 py-2 text-sm text-gray-700">
            {selectedIbadah.selectedDate
              ? `Tanggal terpilih: ${new Date(selectedIbadah.selectedDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`
              : selectedIbadah.selectedMonth !== null
                ? `Bulan terpilih: ${monthNames[selectedIbadah.selectedMonth]} ${selectedIbadah.year}`
                : ""}
          </div>
        )}
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-indigo-900 text-white">
            <tr>
              <th className="border px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={checkedAll}
                  onChange={toggleCheckAll}
                />
              </th>
              <th className="border px-3 py-2">No.</th>
              <th className="border px-3 py-2">Foto</th>
              <th className="border px-3 py-2">Nama</th>
              <th className="border px-3 py-2">Kehadiran</th>
              <th className="border px-3 py-2">Jabatan</th>
              <th className="border px-3 py-2">Status</th>
              <th className="border px-3 py-2">Sesi Ibadah</th>
            </tr>
          </thead>
          <tbody>
            {filteredJemaat.map((j, idx) => (
              <tr
                key={j.nama + idx}
                className="cursor-pointer transition odd:bg-purple-50 hover:bg-indigo-100"
                onClick={() => handleRowClick(j)}
              >
                <td
                  className="border px-3 py-2 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={checkedRows[idx] ?? false}
                    onChange={() => toggleRow(idx)}
                  />
                </td>
                <td className="border px-3 py-2">{idx + 1}.</td>
                <td className="border px-3 py-2">
                  <Image
                    src={j.foto}
                    alt={j.nama}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                </td>
                <td className="border px-3 py-2">{j.nama}</td>
                <td className="border px-3 py-2">{j.kehadiran}</td>
                <td className="border px-3 py-2">{j.jabatan}</td>
                <td className="border px-3 py-2">{j.status}</td>
                <td className="border px-3 py-2">{j.kehadiranSesi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DRAWER */}
      <Drawer
        anchor="right"
        open={openDrawer}
        onClose={() => setOpenDrawer(false)}
      >
        <div className="w-80 space-y-4 p-4">
          {selectedRow && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Detail Jemaat</h2>
                <button onClick={() => setOpenDrawer(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="flex justify-center">
                <Image
                  src={selectedRow.foto}
                  alt={selectedRow.nama}
                  width={100}
                  height={100}
                  className="rounded-full"
                />
              </div>
              <p>
                <strong>Nama:</strong> {selectedRow.nama}
              </p>
              <p>
                <strong>Kehadiran:</strong> {selectedRow.kehadiran}
              </p>
              <p>
                <strong>Jabatan:</strong> {selectedRow.jabatan}
              </p>
              <p>
                <strong>Status:</strong> {selectedRow.status}
              </p>
              <p>
                <strong>Sesi Ibadah:</strong> {selectedRow.kehadiranSesi}
              </p>
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
