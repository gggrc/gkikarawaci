import { NextResponse } from "next/server";

// ----------------------
// 1. Tipe data
// ----------------------
export type Jemaat = {
  id: string; // tambahkan id unik
  foto: string;
  nama: string;
  kehadiran: "Hadir" | "Tidak Hadir";
  jabatan: string;
  status: "Aktif" | "Tidak Aktif";
};

// ----------------------
// 2. Type guard
// ----------------------
function isJemaat(obj: unknown): obj is Jemaat {
  if (typeof obj !== "object" || obj === null) return false;

  return (
    "id" in obj &&
    typeof (obj as { id: unknown }).id === "string" &&
    "foto" in obj &&
    typeof (obj as { foto: unknown }).foto === "string" &&
    "nama" in obj &&
    typeof (obj as { nama: unknown }).nama === "string" &&
    "kehadiran" in obj &&
    ((obj as { kehadiran: unknown }).kehadiran === "Hadir" ||
      (obj as { kehadiran: unknown }).kehadiran === "Tidak Hadir") &&
    "jabatan" in obj &&
    typeof (obj as { jabatan: unknown }).jabatan === "string" &&
    "status" in obj &&
    ((obj as { status: unknown }).status === "Aktif" ||
      (obj as { status: unknown }).status === "Tidak Aktif")
  );
}

function isJemaatArray(data: unknown): data is Jemaat[] {
  return Array.isArray(data) && data.every(isJemaat);
}

// ----------------------
// 3. Data awal
// ----------------------
let jemaat: Jemaat[] = [
  {
    id: "GKI_01",
    foto: "/avatar1.png",
    nama: "Toing Sidayat",
    kehadiran: "Hadir",
    jabatan: "Pendeta",
    status: "Aktif",
  },
  {
    id: "GKI_02",
    foto: "/avatar2.png",
    nama: "Abdul Sulaiman",
    kehadiran: "Hadir",
    jabatan: "Pengurus A",
    status: "Aktif",
  },
  {
    id: "GKI_03",
    foto: "/avatar3.png",
    nama: "Steve Johnson",
    kehadiran: "Tidak Hadir",
    jabatan: "Pengurus B",
    status: "Aktif",
  },
  {
    id: "GKI_04",
    foto: "/avatar4.png",
    nama: "Supriad Ismail",
    kehadiran: "Hadir",
    jabatan: "Pengurus C",
    status: "Aktif",
  },
  {
    id: "GKI_05",
    foto: "/avatar5.png",
    nama: "Suti Sutantari",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Tidak Aktif",
  },
  {
    id: "GKI_06",
    foto: "/avatar6.png",
    nama: "Siti Andarasari",
    kehadiran: "Tidak Hadir",
    jabatan: "Jemaat",
    status: "Aktif",
  },
  {
    id: "GKI_07",
    foto: "/avatar7.png",
    nama: "Putri Elizabeth",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Aktif",
  },
  {
    id: "GKI_08",
    foto: "/avatar8.png",
    nama: "Indah Purnawisari",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Tidak Aktif",
  },
];

// ----------------------
// 4. GET - ambil data jemaat
// ----------------------
export async function GET() {
  return NextResponse.json(jemaat);
}

// ----------------------
// 5. PUT - update data jemaat
// ----------------------
export async function PUT(req: Request) {
  const json: unknown = await req.json();

  if (!isJemaatArray(json)) {
    return NextResponse.json({ message: "Data tidak valid" }, { status: 400 });
  }

  jemaat = json;
  return NextResponse.json({
    message: "Data berhasil diperbarui",
    data: jemaat,
  });
}
