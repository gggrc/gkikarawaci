"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Download, X, Settings } from "lucide-react";
import Link from "next/link";
import { UserButton, SignedIn } from "@clerk/nextjs";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import {
  Button,
  Drawer,
  Box,
  Typography,
  TextField,
  Stack,
} from "@mui/material";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";

import Menu from "@mui/material/Menu";
import Checkbox from "@mui/material/Checkbox";


type Jemaat = {
  id: number;
  foto: string;
  nama: string;
  kehadiran: string;
  jabatan: string;
  status: string;
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string;
};

type IbadahSelection = {
  year: number;
  selectedMonth: number | null;
  selectedDate: string | null;
};

export const saveDocsToStorage = (docs: Record<number, string>) => {
  localStorage.setItem("uploadedDocs", JSON.stringify(docs));
};

export const loadDocsFromStorage = (): Record<number, string> => {
  const data = localStorage.getItem("uploadedDocs");
  if (!data) return {};

  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<number, string>;
    }
  } catch (e) {
    console.error("Failed to parse uploadedDocs:", e);
  }
  return {};
};

export default function DatabaseTablePage() {
  const [filterSessions, setFilterSessions] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [checkedAll, setCheckedAll] = useState(false);
  const [checkedRows, setCheckedRows] = useState<boolean[]>([]);
  const [openDialog, setOpenDialog] = useState(false);

  const [jemaat, setJemaat] = useState<Jemaat[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [draftJemaat, setDraftJemaat] = useState<Jemaat[]>([]);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Jemaat | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterKehadiran, setFilterKehadiran] = useState("");
  const [selectedIbadah, setSelectedIbadah] = useState<IbadahSelection | null>(
    null,
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [successDialog, setSuccessDialog] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Record<number, string>>({});
  const [viewDoc, setViewDoc] = useState<string | null>(null);

  useEffect(() => {
    setUploadedDocs(loadDocsFromStorage());
  }, []);

  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState<Jemaat>({
    id: 0,
    foto: "",
    nama: "",
    kehadiran: "",
    jabatan: "",
    status: "",
    tanggalLahir: "",
    umur: "",
    keluarga: "",
    email: "",
    telepon: "",
    kehadiranSesi: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveForm = () => {
  setJemaat((prev) =>
    prev.map((item) =>
      item.id === formData.id ? { ...item, ...formData } : item
    )
  );
  setOpen(false);
};

  // saat upload
  const handleFileUpload = (idx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedDocs((prev) => {
        const updated = { ...prev, [idx]: base64 };
        saveDocsToStorage(updated);
        return updated;
      });
      setSuccessDialog(true);
    };
    reader.readAsDataURL(file);
  };

  // saat delete
  const handleDeleteFile = (idx: number) => {
    setUploadedDocs((prev) => {
      const updated = { ...prev };
      delete updated[idx];
      saveDocsToStorage(updated);
      return updated;
    });
    setViewDoc(null);
  };

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
        const parsed: IbadahSelection = JSON.parse(saved) as IbadahSelection;
        setSelectedIbadah(parsed);
      } catch (err) {
        console.error("Failed to parse ibadahSelection from localStorage", err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/jemaat", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal fetch data jemaat");
      return (await res.json()) as Jemaat[];
    };

    fetchData()
      .then((data) => setJemaat(data))
      .catch((err) => console.error("Error fetch jemaat:", err));
  }, []);

  const filteredJemaat = (editMode ? draftJemaat : jemaat).filter((j) => {
    return (
      (filterStatus === "" || j.status === filterStatus) &&
      (filterJabatan === "" || j.jabatan === filterJabatan) &&
      (filterKehadiran === "" || j.kehadiran === filterKehadiran) &&
      (filterSessions.length === 0 || filterSessions.includes(j.kehadiranSesi))
    );
  });
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterJabatan, filterKehadiran, filterSessions]);


  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentData = filteredJemaat.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredJemaat.length / itemsPerPage);


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
      setCheckedAll(newRows.every((v) => v));
      return newRows;
    });
  };

  const downloadCSV = () => {
    if (filteredJemaat.length === 0) return;
    const headers = Object.keys(filteredJemaat[0]!).join(",");
    const rows = filteredJemaat
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
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 10,
      } as UserOptions);
      doc.save("data.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  const handleEnterEdit = () => {
    const copy = filteredJemaat.map((j) => ({ ...j }));
    setDraftJemaat(copy);
    setEditMode(true);
  };

  const handleCancel = () => {
    setDraftJemaat([]);
    setEditMode(false);
  };

  type UpdateResponse = {
    data: Jemaat[];
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/jemaat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftJemaat),
      });

      if (!res.ok) throw new Error("Gagal update data");

      const result = (await res.json()) as UpdateResponse;

      if (!Array.isArray(result.data)) throw new Error("Response tidak valid");

      setJemaat(result.data);
      setEditMode(false);
      setDraftJemaat([]);
    } catch (err) {
      console.error("Error update jemaat:", err);
    }
  };

const handleRowClick = (
  row: Jemaat,
  e: React.MouseEvent<HTMLTableRowElement>
) => {
  // Jangan buka drawer detail kalau sedang edit (editMode),
  // drawer detail sudah terbuka (openDrawer), atau drawer Add More Info terbuka (open)
  if (editMode || openDrawer || open) return;

  let target = e.target as HTMLElement | null;

  while (target && target !== e.currentTarget) {
    if (
      target.tagName === "BUTTON" &&
      target.textContent &&
      ["dokumen", "add more info"].includes(
        target.textContent.trim().toLowerCase()
      )
    ) {
      return; // Jangan buka drawer
    }
    target = target.parentElement;
  }

  setSelectedRow(row);
  setOpenDrawer(true);
};

const handleOpenDrawer = (jemaat?: Jemaat) => {
  if (jemaat) {
    // kalau edit jemaat yang sudah ada
    setFormData(jemaat);
  } else {
    // kalau tambah jemaat baru
    setFormData({
      id: Date.now(), // atau generate ID unik
      foto: "",
      nama: "",
      kehadiran: "",
      jabatan: "",
      status: "",
      tanggalLahir: "",
      umur: "",
      keluarga: "",
      email: "",
      telepon: "",
      kehadiranSesi:"",
    });
  }
  setOpen(true);
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
        <div className="flex items-center space-x-2">
          {!editMode ? (
            <button
              onClick={handleEnterEdit}
              className="rounded-full p-2 hover:bg-indigo-600"
            >
              <Settings size={25} />
            </button>
          ) : (
            <div className="flex gap-2">
              <Button variant="contained" color="primary" onClick={handleSave}>
                Save
              </Button>
              <Button
                variant="contained" // ganti dari outlined ke contained biar bisa pakai background color
                sx={{
                  backgroundColor: "red",
                  color: "white",
                  "&:hover": {
                    backgroundColor: "darkred", // warna saat hover
                  },
                }}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          )}
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

          {/* 🆕 Filter Sesi Ibadah dengan checkbox dropdown */}
          <div>
            <Button
              onClick={(e) => setAnchorEl(e.currentTarget)}
              className="rounded border border-indigo-500 bg-indigo-500 px-2 py-1 text-white"
            >
              Sesi Ibadah
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              {["Pagi", "Siang", "Sore"].map((sesi) => (
                <MenuItem
                  key={sesi}
                  onClick={() => {
                    setFilterSessions((prev) =>
                      prev.includes(sesi)
                        ? prev.filter((v) => v !== sesi) 
                        : [...prev, sesi]               
                    );
                  }}
                >
                  <Checkbox checked={filterSessions.includes(sesi)} />
                  {sesi}
                </MenuItem>
              ))}
            </Menu>
          </div>

          <Link
            href="/selectDate"
            className="inline-flex items-center gap-1 rounded bg-indigo-500 px-3 py-2 text-sm text-white hover:bg-indigo-800"
          >
            <Plus size={14} /> Lihat Tanggal Lain
          </Link>
          <button
            onClick={() => setOpenDialog(true)}
            className="inline-flex items-center gap-1 rounded border bg-white px-3 py-2 text-sm text-black hover:bg-gray-700 hover:text-white"
          >
            <Download size={14} /> Download
          </button>
          <Link
            href="/statistic"
            className="inline-flex items-center gap-1 rounded border bg-white px-3 py-2 text-sm text-black hover:bg-gray-700 hover:text-white"
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
              ? `Tanggal terpilih: ${new Date(
                  selectedIbadah.selectedDate,
                ).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}`
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
              <th className="border px-3 py-2">ID</th>
              <th className="border px-3 py-2">Foto</th>
              <th className="border px-3 py-2">Nama</th>
              <th className="border px-3 py-2">Kehadiran</th>
              <th className="border px-3 py-2">Jabatan</th>
              <th className="border px-3 py-2">Status</th>
              <th className="border px-3 py-2">Sesi Ibadah</th>
              <th className="border px-3 py-2">Dokumen</th>{" "}
              <th className="border px-3 py-2">Add more Info</th>{" "}
            </tr>
          </thead>
          <tbody>
            {currentData.map((j, idx) => (
              <tr
                key={j.nama + idx}
                className="cursor-pointer transition odd:bg-purple-50 hover:bg-indigo-100"
                onClick={(e) => handleRowClick(j, e)}
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
                <td className="border px-3 py-2">{indexOfFirst + idx + 1}.</td>
                <td className="border px-3 py-2">{j.id}</td> 
                <td className="border px-3 py-2">
                  <Image
                    src={j.foto}
                    alt={j.nama}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                </td>
                <td className="border px-3 py-2">
                  {editMode && draftJemaat[idx] ? (
                    <TextField
                      size="small"
                      value={draftJemaat[idx].nama}
                      onChange={(e) => {
                        const updated = [...draftJemaat];
                        updated[idx]!.nama = e.target.value;
                        setDraftJemaat(updated);
                      }}
                    />
                  ) : (
                    j.nama
                  )}
                </td>
                <td className="border px-3 py-2">
                  {editMode && draftJemaat[idx] ? (
                    <TextField
                      select
                      size="small"
                      value={draftJemaat[idx].kehadiran}
                      onChange={(e) => {
                        const updated = [...draftJemaat];
                        updated[idx]!.kehadiran = e.target.value;
                        setDraftJemaat(updated);
                      }}
                    >
                      <MenuItem value="Hadir">Hadir</MenuItem>
                      <MenuItem value="Tidak Hadir">Tidak Hadir</MenuItem>
                    </TextField>
                  ) : (
                    j.kehadiran
                  )}
                </td>
                <td className="border px-3 py-2">
                  {editMode && draftJemaat[idx] ? (
                    <TextField
                      size="small"
                      value={draftJemaat[idx].jabatan}
                      onChange={(e) => {
                        const updated = [...draftJemaat];
                        updated[idx]!.jabatan = e.target.value;
                        setDraftJemaat(updated);
                      }}
                    />
                  ) : (
                    j.jabatan
                  )}
                </td>
                <td className="border px-3 py-2">
                  {editMode && draftJemaat[idx] ? (
                    <TextField
                      select
                      size="small"
                      value={draftJemaat[idx].status}
                      onChange={(e) => {
                        const updated = [...draftJemaat];
                        updated[idx]!.status = e.target.value;
                        setDraftJemaat(updated);
                      }}
                    >
                      <MenuItem value="Aktif">Aktif</MenuItem>
                      <MenuItem value="Tidak Aktif">Tidak Aktif</MenuItem>
                    </TextField>
                  ) : (
                    j.status
                  )}
                </td>

                {/* ✅ Kolom baru sesi ibadah */}
                <td className="border px-3 py-2">
                  {editMode && draftJemaat[idx] ? (
                    <TextField
                      select
                      size="small"
                      value={draftJemaat[idx].kehadiranSesi}
                      onChange={(e) => {
                        const updated = [...draftJemaat];
                        updated[idx]!.kehadiranSesi = e.target.value;
                        setDraftJemaat(updated);
                      }}
                    >
                      <MenuItem value="Pagi">Pagi</MenuItem>
                      <MenuItem value="Siang">Siang</MenuItem>
                      <MenuItem value="Sore">Sore</MenuItem>
                    </TextField>
                  ) : (
                    j.kehadiranSesi
                  )}
                </td>

                {/* Kolom Upload Dokumen */}
                <td className="border px-3 py-2 text-center">
                  {!uploadedDocs[idx] ? (
                    <label className="inline-block cursor-pointer rounded bg-green-600 px-3 py-1 text-white hover:bg-green-800">
                      Add Document
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(idx, file);
                        }}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => setViewDoc(uploadedDocs[idx] ?? null)}
                      >
                        View Document
                      </Button>
                    </div>
                  )}
                </td>

                <Dialog
                  open={successDialog}
                  onClose={() => setSuccessDialog(false)}
                  BackdropProps={{
                    style: {
                      backgroundColor: "rgba(0, 0, 0, 0)",
                    },
                  }}
                  PaperProps={{
                    style: {
                      boxShadow: "none",
                      border: "1px solid #ddd",
                    },
                  }}
                >
                  <DialogTitle>
                    Upload Berhasil
                    <button
                      className="float-right"
                      onClick={() => setSuccessDialog(false)}
                    >
                      <X size={20} />
                    </button>
                  </DialogTitle>
                  <DialogContent dividers>
                    <Typography>Dokumen berhasil diunggah.</Typography>
                  </DialogContent>
                  <DialogActions>
                    <Button
                      onClick={() => setSuccessDialog(false)}
                      color="primary"
                    >
                      Close
                    </Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={!!viewDoc}
                  onClose={() => setViewDoc(null)}
                  maxWidth="md"
                  fullWidth
                  BackdropProps={{
                    style: { backgroundColor: "rgba(0,0,0,0)" },
                  }}
                  PaperProps={{
                    style: { boxShadow: "none", border: "1px solid #ddd" },
                  }}
                >
                  <DialogTitle>
                    Preview Document
                    <button
                      className="float-right"
                      onClick={() => setViewDoc(null)}
                    >
                      <X size={20} />
                    </button>
                  </DialogTitle>
                  <DialogContent dividers style={{ minHeight: "400px" }}>
                    {viewDoc ? (
                      viewDoc.startsWith("data:application/pdf") ? (
                        <iframe src={viewDoc} className="h-[70vh] w-full" />
                      ) : viewDoc.startsWith("data:image/") ? (
                        <Image
                          src={viewDoc}
                          alt="Uploaded"
                          width={600}
                          height={400}
                          className="mx-auto rounded object-contain"
                          unoptimized
                        />
                      ) : (
                        <Typography>
                          File tidak dapat dipreview. Silakan download.
                        </Typography>
                      )
                    ) : null}
                  </DialogContent>

                  <DialogActions>
                    <Button
                      onClick={() => {
                        const idx = Object.entries(uploadedDocs).find(
                          ([, file]) => file === viewDoc,
                        )?.[0];
                        if (idx) handleDeleteFile(Number(idx));
                      }}
                      color="error"
                      variant="outlined"
                    >
                      Delete
                    </Button>
                    <Button onClick={() => setViewDoc(null)} color="secondary">
                      Close
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* Kolom Button Add More Info */}
                <td className="border px-3 py-2 text-center">
                  {/* Tombol untuk buka Drawer */}
      <Button
  variant="contained"
  color="primary"
  onClick={(e) => {
    e.stopPropagation();
    handleOpenDrawer(j); // buka drawer isi data jemaat j
  }}
>
  Add More Info
</Button>

      {/* Drawer dari kanan */}
      <Drawer
  anchor="right"
  open={open}
  onClose={() => setOpen(false)}
  BackdropProps={{
    style: { backgroundColor: "rgba(0,0,0,0.1)" },
  }}
  PaperProps={{
    style: {
      boxShadow: "none",
      border: "1px solid #ddd",
      width: "100%", 
      maxWidth: "480px", 
    },
  }}
>
        <Box sx={{ width: "100%", p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Edit Info Jemaat: {formData.nama}
          </Typography>

          <Stack spacing={2}>
            <TextField
              label="Tanggal Lahir"
              type="date"
              name="tanggalLahir"
              InputLabelProps={{ shrink: true }}
              value={formData.tanggalLahir}
              onChange={handleChange}
            />
            <TextField
              label="Umur"
              type="number"
              name="umur"
              value={formData.umur}
              onChange={handleChange}
            />
            <TextField
              label="Keluarga"
              name="keluarga"
              value={formData.keluarga}
              onChange={handleChange}
            />
            <TextField
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
            <TextField
              label="No. Telp"
              type="tel"
              name="telepon"
              value={formData.telepon}
              onChange={handleChange}
            />

            <Stack direction="row" spacing={2} justifyContent="flex-end" mt={2}>
              <Button variant="outlined" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button variant="contained" onClick={handleSaveForm}>
                Simpan
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* PAGINATION */}
        <div className="flex justify-center items-center gap-2 my-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="rounded border border-gray-400 px-2 py-1 text-sm disabled:opacity-50"
          >
            Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`rounded border px-3 py-1 text-sm ${
                currentPage === i + 1
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : "border-gray-400"
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="rounded border border-gray-400 px-2 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
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
                <strong>Nama:</strong> {selectedRow.id}
              </p>
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
                <strong>Tanggal Lahir:</strong> {selectedRow.tanggalLahir}
              </p>
              <p>
                <strong>Umur:</strong> {selectedRow.umur}
              </p>
              <p>
                <strong>Keluarga:</strong> {selectedRow.keluarga}
              </p>
              <p>
                <strong>Email:</strong> {selectedRow.email}
              </p>
              <p>
                <strong>Telepon:</strong> {selectedRow.telepon}
              </p>
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
