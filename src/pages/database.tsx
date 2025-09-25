
import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X, Settings } from "lucide-react";
import Link from "next/link";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import { Button, Typography, TextField } from "@mui/material";

interface Jemaat {
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
}

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function DatabaseTablePage() {
  const [jemaat, setJemaat] = useState<Jemaat[]>([]);
  const [selectedTables, setSelectedTables] = useState<{date: string, event: string}[]>([]);
  const [tablePages, setTablePages] = useState<number[]>([]);
  const [checkedRows, setCheckedRows] = useState<boolean[][]>([]);
  const [checkedAll, setCheckedAll] = useState<boolean[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState<boolean[]>([]);
  const [draftJemaat, setDraftJemaat] = useState<Jemaat[][]>([]);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [formData, setFormData] = useState<Jemaat | null>(null);
  const itemsPerPage = 10;
  // Filters per table
  const [filterKehadiran, setFilterKehadiran] = useState<string[]>([]);
  const [filterJabatan, setFilterJabatan] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

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

  useEffect(() => {
    const saved = localStorage.getItem("ibadahSelection");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          selectedDates?: string[];
          selectedEventsByDate?: Record<string, string[]>;
        };
        const tables: {date: string, event: string}[] = [];
        if (Array.isArray(parsed.selectedDates) && parsed.selectedEventsByDate) {
          parsed.selectedDates.forEach((date) => {
            const events = parsed.selectedEventsByDate?.[date] ?? [];
            events.forEach((event) => {
              tables.push({ date, event });
            });
          });
        }
        setSelectedTables(tables);
      } catch (err) {
        console.error("Failed to parse ibadahSelection from localStorage", err);
      }
    }
  }, []);

  useEffect(() => {
    setTablePages(selectedTables.map(() => 1));
    setCheckedRows(selectedTables.map(() => jemaat.map(() => false)));
    setCheckedAll(selectedTables.map(() => false));
    setEditMode(selectedTables.map(() => false));
    setDraftJemaat(selectedTables.map(() => jemaat.map(j => ({ ...j }))));
    setFilterKehadiran(selectedTables.map(() => ""));
    setFilterJabatan(selectedTables.map(() => ""));
    setFilterStatus(selectedTables.map(() => ""));
  }, [selectedTables, jemaat]);

  // Filter logic per table
  const getFilteredJemaat = (jemaatList: Jemaat[], tableIdx: number) => {
    return jemaatList.filter(j =>
      (filterKehadiran[tableIdx] === "" || j.kehadiran === filterKehadiran[tableIdx]) &&
      (filterJabatan[tableIdx] === "" || j.jabatan === filterJabatan[tableIdx]) &&
      (filterStatus[tableIdx] === "" || j.status === filterStatus[tableIdx])
    );
  };
  const getPagedData = (jemaatList: Jemaat[], tableIdx: number) => {
    const filtered = getFilteredJemaat(jemaatList, tableIdx);
    const page = tablePages[tableIdx] ?? 1;
    const indexOfLast = page * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    return filtered.slice(indexOfFirst, indexOfLast);
  };

  const toggleCheckAll = (tableIdx: number) => {
    setCheckedAll((prev) => prev.map((v, idx) => idx === tableIdx ? !v : v));
    setCheckedRows((prev) => prev.map((rows, idx) => {
      if (idx !== tableIdx) return rows;
      const allChecked = !(checkedAll?.[tableIdx]);
      return rows.map(() => allChecked);
    }));
  };
  const toggleRow = (tableIdx: number, rowIdx: number) => {
    setCheckedRows((prev) => prev.map((rows, idx) => {
      if (idx !== tableIdx) return rows;
      const newRows = [...rows];
      newRows[rowIdx] = !newRows[rowIdx];
      return newRows;
    }));
    setCheckedAll((prev) => prev.map((v, idx) => {
      if (idx !== tableIdx) return v;
      const currentRows = checkedRows?.[tableIdx] ?? [];
      const newRows = [...currentRows];
      newRows[rowIdx] = !newRows[rowIdx];
      return newRows.every(Boolean);
    }));
  };

  // Edit mode per table
  const handleEnterEdit = (tableIdx: number) => {
    setEditMode((prev) => prev.map((v, idx) => idx === tableIdx ? true : v));
  };
  const handleCancelEdit = (tableIdx: number) => {
    setEditMode((prev) => prev.map((v, idx) => idx === tableIdx ? false : v));
    setDraftJemaat((prev) => prev.map((rows, idx) => idx === tableIdx ? jemaat.map(j => ({ ...j })) : rows));
  };
  const handleSaveEdit = (tableIdx: number) => {
    setEditMode((prev) => prev.map((v, idx) => idx === tableIdx ? false : v));
    // Optionally, update jemaat data here if needed
  };

  // Drawer for profile editing
  const handleRowClick = (row: Jemaat) => {
    setFormData(row);
    setOpenDrawer(true);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!formData) return;
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };
  const handleSaveForm = () => {
    setOpenDrawer(false);
    // Optionally, update jemaat data here if needed
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-200">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-indigo-900 px-4 py-2 text-white">
        <div className="flex items-center space-x-2">
          <Image src="/LOGOGKI.png" alt="Logo" width={48} height={48} className="h-12 w-12" />
          <span className="ml-3 text-2xl font-bold">Data Jemaat GKI Karawaci</span>
        </div>
        <div className="flex gap-2">
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
        <span className="text-sm text-gray-700">Total: {jemaat.length} Jemaat</span>
      </div>

      {/* Render tables for each selected event/date, with filter and paging per table */}
      <div>
        {selectedTables.length > 0 ? (
          <div>
            {selectedTables.map(({ date, event }, idx) => {
              const pagedData = getPagedData(editMode[idx] && draftJemaat[idx] ? draftJemaat[idx] : jemaat, idx);
              const totalPages = Math.ceil(jemaat.length / itemsPerPage);
              return (
                <div key={date + event} className="mb-8">
                  <h2 className="text-xl font-bold mb-2">{date} - {event}</h2>
                  {/* Filter bar per table (styled) */}
                  <div className="flex items-center gap-2 mb-2 bg-white rounded-lg shadow px-4 py-2">
                    <select
                      value={filterKehadiran[idx]}
                      onChange={e => setFilterKehadiran(f => f.map((v, i) => i === idx ? e.target.value : v))}
                      className="rounded border border-indigo-500 bg-indigo-500 px-2 py-1 text-white"
                    >
                      <option value="">Kehadiran</option>
                      <option value="Hadir">Hadir</option>
                      <option value="Tidak Hadir">Tidak Hadir</option>
                    </select>
                    <select
                      value={filterJabatan[idx]}
                      onChange={e => setFilterJabatan(f => f.map((v, i) => i === idx ? e.target.value : v))}
                      className="rounded border border-indigo-500 bg-indigo-500 px-2 py-1 text-white"
                    >
                      <option value="">Jabatan</option>
                      {[...new Set(jemaat.map((j) => j.jabatan))].map((jab) => (
                        <option key={jab} value={jab}>{jab}</option>
                      ))}
                    </select>
                    <select
                      value={filterStatus[idx]}
                      onChange={e => setFilterStatus(f => f.map((v, i) => i === idx ? e.target.value : v))}
                      className="rounded border border-indigo-500 bg-indigo-500 px-2 py-1 text-white"
                    >
                      <option value="">Status</option>
                      <option value="Aktif">Aktif</option>
                      <option value="Tidak Aktif">Tidak Aktif</option>
                    </select>
                    {!editMode[idx] ? (
                      <button
                        onClick={() => handleEnterEdit(idx)}
                        className="rounded-full p-2 hover:bg-indigo-600"
                      >
                        <Settings size={20} />
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="contained" color="primary" onClick={() => handleSaveEdit(idx)}>
                          Save
                        </Button>
                        <Button
                          variant="contained"
                          sx={{ backgroundColor: "red", color: "white", "&:hover": { backgroundColor: "darkred" } }}
                          onClick={() => handleCancelEdit(idx)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="m-4 overflow-x-auto rounded-2xl bg-white shadow">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-indigo-900 text-white">
                        <tr>
                          <th className="border px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={checkedAll[idx] ?? false}
                              onChange={() => toggleCheckAll(idx)}
                            />
                          </th>
                          <th className="border px-3 py-2">No.</th>
                          <th className="border px-3 py-2">ID</th>
                          <th className="border px-3 py-2">Foto</th>
                          <th className="border px-3 py-2">Nama</th>
                          <th className="border px-3 py-2">Kehadiran</th>
                          <th className="border px-3 py-2">Jabatan</th>
                          <th className="border px-3 py-2">Status</th>
                          <th className="border px-3 py-2">Add more Info</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedData.map((j, i) => (
                          <tr
                            key={j.id || i}
                            className="cursor-pointer transition odd:bg-purple-50 hover:bg-indigo-100"
                          >
                            <td className="border px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={checkedRows[idx]?.[i] ?? false}
                                onChange={() => toggleRow(idx, i)}
                              />
                            </td>
                            <td className="border px-3 py-2">{i + 1 + ((tablePages[idx] ?? 1) - 1) * itemsPerPage}.</td>
                            <td className="border px-3 py-2">{j.id}</td>
                            <td className="border px-3 py-2">
                              <Image src={j.foto} alt={j.nama} width={40} height={40} className="rounded-full" />
                            </td>
                            <td className="border px-3 py-2">
                              {editMode[idx] && draftJemaat[idx]?.[i] ? (
                                <TextField
                                  size="small"
                                  value={draftJemaat[idx]?.[i]?.nama ?? ""}
                                  onChange={(e) => {
                                    const updated = [...draftJemaat];
                                    if (updated[idx]?.[i]) updated[idx][i].nama = e.target.value;
                                    setDraftJemaat(updated);
                                  }}
                                />
                              ) : (
                                j.nama
                              )}
                            </td>
                            <td className="border px-3 py-2">
                              {editMode[idx] && draftJemaat[idx]?.[i] ? (
                                <TextField
                                  select
                                  size="small"
                                  value={draftJemaat[idx]?.[i]?.kehadiran ?? ""}
                                  onChange={(e) => {
                                    const updated = [...draftJemaat];
                                    if (updated[idx]?.[i]) updated[idx][i].kehadiran = e.target.value;
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
                              {editMode[idx] && draftJemaat[idx]?.[i] ? (
                                <TextField
                                  size="small"
                                  value={draftJemaat[idx]?.[i]?.jabatan ?? ""}
                                  onChange={(e) => {
                                    const updated = [...draftJemaat];
                                    if (updated[idx]?.[i]) updated[idx][i].jabatan = e.target.value;
                                    setDraftJemaat(updated);
                                  }}
                                />
                              ) : (
                                j.jabatan
                              )}
                            </td>
                            <td className="border px-3 py-2">
                              {editMode[idx] && draftJemaat[idx]?.[i] ? (
                                <TextField
                                  select
                                  size="small"
                                  value={draftJemaat[idx]?.[i]?.status ?? ""}
                                  onChange={(e) => {
                                    const updated = [...draftJemaat];
                                    if (updated[idx]?.[i]) updated[idx][i].status = e.target.value;
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
                            {/* Add More Info Button */}
                            <td className="border px-3 py-2 text-center">
                              <Button
                                variant="contained"
                                color="primary"
                                onClick={() => handleRowClick(j)}
                              >
                                Add More Info
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Paging controls for this table */}
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mb-4">
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={tablePages[idx] === 1}
                        onClick={() => setTablePages(pages => pages.map((p, i) => i === idx ? p - 1 : p))}
                      >
                        Previous
                      </Button>
                      <span>Page {tablePages[idx] ?? 1} of {totalPages}</span>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={tablePages[idx] === totalPages}
                        onClick={() => setTablePages(pages => pages.map((p, i) => i === idx ? p + 1 : p))}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-500">Tidak ada event/ibadah yang dipilih.</div>
        )}
      </div>

      {/* DRAWER for Add More Info */}
      <Dialog open={openDrawer} onClose={() => setOpenDrawer(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Edit Info Jemaat: {formData?.nama}
          <button className="float-right" onClick={() => setOpenDrawer(false)}>
            <X size={20} />
          </button>
        </DialogTitle>
        <DialogContent dividers>
          {formData && (
            <div>
              <TextField
                label="Tanggal Lahir"
                type="date"
                name="tanggalLahir"
                InputLabelProps={{ shrink: true }}
                value={formData?.tanggalLahir ?? ""}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Umur"
                type="number"
                name="umur"
                value={formData?.umur ?? ""}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Keluarga"
                name="keluarga"
                value={formData?.keluarga ?? ""}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Email"
                type="email"
                name="email"
                value={formData?.email ?? ""}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
              <TextField
                label="No. Telp"
                type="tel"
                name="telepon"
                value={formData?.telepon ?? ""}
                onChange={handleChange}
                fullWidth
                margin="normal"
              />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpenDrawer(false)}>
            Batal
          </Button>
          <Button variant="contained" onClick={handleSaveForm}>
            Simpan
          </Button>
        </DialogActions>
      </Dialog>

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
          <Button onClick={() => {
            // Download all tables as CSV
            let csv = "";
            selectedTables.forEach(({date, event}, idx) => {
              const filtered = getFilteredJemaat(jemaat, idx);
              if (!filtered || filtered.length === 0 || !filtered[0]) return;
              csv += `\n${date} - ${event}\n`;
              const headers = Object.keys(filtered[0] ?? {}).join(",");
              csv += headers + "\n";
              csv += filtered.map(row => Object.values(row ?? {}).join(",")).join("\n") + "\n";
            });
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", "data.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setOpenDialog(false);
          }}>CSV</Button>
          <Button onClick={() => {
            // Download all tables as PDF
            try {
              const doc = new jsPDF();
              let y = 20;
              selectedTables.forEach(({date, event}, idx) => {
                const filtered = getFilteredJemaat(jemaat, idx);
                if (!filtered || filtered.length === 0 || !filtered[0]) return;
                doc.text(`${date} - ${event}`, 10, y);
                const tableColumn = Object.keys(filtered[0] ?? {});
                const tableRows = filtered.map(row => Object.values(row ?? {}) as string[]);
                autoTable(doc, {
                  head: [tableColumn],
                  body: tableRows,
                  startY: y + 10,
                });
                // Update y for next table
                let finalY: number = y;
                if (typeof ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY) === "number") {
                  finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
                }
                y = finalY + 20;
              });
              doc.save("data.pdf");
            } catch (err) {
              console.error("PDF generation failed:", err);
            }
            setOpenDialog(false);
          }}>PDF</Button>
          <Button onClick={() => setOpenDialog(false)} color="secondary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}