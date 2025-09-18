import { NextResponse } from "next/server";

// ----------------------
// 1. Tipe data
// ----------------------
export type Jemaat = {
  id: string;                             // id unik
  foto: string;
  nama: string;
  kehadiran: "Hadir" | "Tidak Hadir";
  jabatan: string;
  status: "Aktif" | "Tidak Aktif";
  kehadiranSesi: "Pagi" | "Siang" | "Sore"; // ✅ tambahkan field sesi ibadah
};

// ----------------------
// 2. Type guard
// ----------------------
function isJemaat(obj: unknown): obj is Jemaat {
  if (typeof obj !== "object" || obj === null) return false;

  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.foto === "string" &&
    typeof o.nama === "string" &&
    (o.kehadiran === "Hadir" || o.kehadiran === "Tidak Hadir") &&
    typeof o.jabatan === "string" &&
    (o.status === "Aktif" || o.status === "Tidak Aktif") && // ✅ pastikan ada &&
    (o.kehadiranSesi === "Pagi" ||
     o.kehadiranSesi === "Siang" ||
     o.kehadiranSesi === "Sore")
  );
}

function isJemaatArray(data: unknown): data is Jemaat[] {
  return Array.isArray(data) && data.every(isJemaat);
}

// ----------------------
// 3. Data awal (contoh dummy)
// ----------------------
let jemaat: Jemaat[] = [
  {
    id: "GKI_01",
    foto: "/avatar1.png",
    nama: "Toing Sidayat",
    kehadiran: "Hadir",
    jabatan: "Pendeta",
    status: "Aktif",
    kehadiranSesi: "Pagi",
  },
  {
    id: "GKI_02",
    foto: "/avatar2.png",
    nama: "Abdul Sulaiman",
    kehadiran: "Hadir",
    jabatan: "Pengurus A",
    status: "Aktif",
    kehadiranSesi: "Siang",
  },
  {
    id: "GKI_03",
    foto: "/avatar3.png",
    nama: "Steve Johnson",
    kehadiran: "Tidak Hadir",
    jabatan: "Pengurus B",
    status: "Aktif",
    kehadiranSesi: "Pagi",
  },
  {
    id: "GKI_04",
    foto: "/avatar4.png",
    nama: "Supriad Ismail",
    kehadiran: "Hadir",
    jabatan: "Pengurus C",
    status: "Aktif",
    kehadiranSesi: "Sore",
  },
  {
    id: "GKI_05",
    foto: "/avatar5.png",
    nama: "Suti Sutantari",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Tidak Aktif",
    kehadiranSesi: "Sore",
  },
  {
    id: "GKI_06",
    foto: "/avatar6.png",
    nama: "Siti Andarasari",
    kehadiran: "Tidak Hadir",
    jabatan: "Jemaat",
    status: "Aktif",
    kehadiranSesi: "Pagi",
  },
  {
    id: "GKI_07",
    foto: "/avatar7.png",
    nama: "Putri Elizabeth",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Aktif",
    kehadiranSesi: "Siang",
  },
  {
    id: "GKI_08",
    foto: "/avatar8.png",
    nama: "Indah Purnawisari",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Tidak Aktif",
    kehadiranSesi: "Pagi",
  },
  {
    id: "GKI_09",
    foto: "/avatar9.png",
    nama: "Kathleen Jo",
    kehadiran: "Hadir",
    jabatan: "Pengurus A",
    status: "Aktif",
    kehadiranSesi: "Siang",
  },
  {
    id: "GKI_10",
    foto: "/avatar10.png",
    nama: "Carl Stevens",
    kehadiran: "Tidak Hadir",
    jabatan: "Pengurus B",
    status: "Aktif",
    kehadiranSesi: "Pagi",
  },
  {
    id: "GKI_11",
    foto: "/avatar11.png",
    nama: "Benaya Suwilis",
    kehadiran: "Hadir",
    jabatan: "Pengurus C",
    status: "Aktif",
    kehadiranSesi: "Sore",
  },
  {
    id: "GKI_12",
    foto: "/avatar12.png",
    nama: "Siti Bandarwih",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Tidak Aktif",
    kehadiranSesi: "Sore",
  },
  {
    id: "GKI_13",
    foto: "/avatar13.png",
    nama: "Lia Manoban",
    kehadiran: "Tidak Hadir",
    jabatan: "Jemaat",
    status: "Aktif",
    kehadiranSesi: "Pagi",
  },
  {
    id: "GKI_14",
    foto: "/avatar14.png",
    nama: "Tofik",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Aktif",
    kehadiranSesi: "Siang",
  },
  {
    id: "GKI_15",
    foto: "/avatar15.png",
    nama: "Adi",
    kehadiran: "Hadir",
    jabatan: "Jemaat",
    status: "Tidak Aktif",
    kehadiranSesi: "Pagi",
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
