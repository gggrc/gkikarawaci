export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

// ------------------------------------
// --- Tipe Data Klien ---
// ------------------------------------
export interface JemaatClient {
  id: number | string;
  foto: string;
  nama: string;
  jabatan: string;
  statusKehadiran: "Aktif" | "Jarang Hadir" | "Tidak Aktif";
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string;
  dokumen?: string;
}

// ------------------------------------
// --- Tipe Data Database (Supabase) ---
// ------------------------------------
interface JemaatDB {
  id_jemaat: string;
  name: string;
  jabatan: string;
  status: string;
  tanggal_lahir: string | null;
  gender: string;
  email: string;
  dateOfBirth: string | null;
  age: number | null;
  handphone: string;
}

interface KehadiranDB {
  id_jemaat: string;
  waktu_presensi: string | null;
}

// ------------------------------------
// --- UTILITY FUNCTIONS ---
// ------------------------------------
const calculateAge = (dobString: string | undefined | null): string => {
  if (!dobString) return "";
  const today = new Date();
  const birthDate = new Date(dobString);

  if (isNaN(birthDate.getTime())) return "";

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age.toString();
};

const calculateStatusKehadiran = (
  attendanceCount: number
): JemaatClient["statusKehadiran"] => {
  if (attendanceCount >= 10) return "Aktif";
  if (attendanceCount >= 3) return "Jarang Hadir";
  return "Tidak Aktif";
};

const getDefaultKehadiranSesi = (id: string | number): string => {
  const sessions = [
    "Kebaktian I : 07:00",
    "Kebaktian II : 10:00",
    "Kebaktian III : 17:00",
    "Ibadah Anak : Minggu, 10:00",
    "Ibadah Remaja : Minggu, 10:00",
    "Ibadah Pemuda : Minggu, 10:00",
    "Ibadah Lansia : Sabtu, 10:00",
    "Ibadah Dewasa : Sabtu, 17:00",
  ];
  const hash = String(id)
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return sessions[hash % sessions.length] ?? "Kebaktian I : 07:00";
};

// ------------------------------------
// --- Main Handler ---
// ------------------------------------
export async function GET() {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoISO = threeMonthsAgo.toISOString();

    // 1. Fetch Jemaat
    const { data: jemaatData, error: jemaatError } = await supabase
      .from("Jemaat")
      .select("*")
      .order("name", { ascending: true });

    if (jemaatError) {
      console.error("❌ Supabase Error fetching jemaat:", jemaatError.message);
      return NextResponse.json(
        { error: "Failed to fetch Jemaat data. Check server logs." },
        { status: 500 }
      );
    }

    // 2. Fetch Kehadiran (3 bulan terakhir)
    const { data: kehadiranData, error: kehadiranError } = await supabase
      .from("Kehadiran")
      .select("id_jemaat, waktu_presensi")
      .gte("waktu_presensi", threeMonthsAgoISO);

    if (kehadiranError) {
      console.error(
        "❌ Supabase Error fetching kehadiran:",
        kehadiranError.message
      );
      return NextResponse.json(
        { error: "Failed to fetch Kehadiran data. Check server logs." },
        { status: 500 }
      );
    }

    // 3. Hitung jumlah kehadiran per jemaat
    const attendanceCountMap = new Map<string, number>();
    (kehadiranData as KehadiranDB[])?.forEach((k) => {
      if (k.id_jemaat) {
        attendanceCountMap.set(
          k.id_jemaat,
          (attendanceCountMap.get(k.id_jemaat) || 0) + 1
        );
      }
    });

    // 4. Gabungkan data
    const processedData: JemaatClient[] = (jemaatData as JemaatDB[]).map(
      (j) => {
        const jemaatId = j.id_jemaat;
        const name = j.name;
        const birthDateString = j.tanggal_lahir?.split("T")[0] ?? undefined;
        const attendanceCount = attendanceCountMap.get(jemaatId) || 0;

        return {
          id: jemaatId,
          foto: `https://ui-avatars.com/api/?name=${name.replace(
            /\s/g,
            "+"
          )}&background=4F46E5&color=fff&size=128`,
          nama: name,
          jabatan: j.jabatan,
          statusKehadiran: calculateStatusKehadiran(attendanceCount),
          tanggalLahir: birthDateString,
          umur: calculateAge(birthDateString),
          keluarga: `Keluarga ${name.split(" ").pop()}`,
          email: j.email,
          telepon: j.handphone,
          kehadiranSesi: getDefaultKehadiranSesi(jemaatId),
          dokumen: undefined,
        };
      }
    );

    return NextResponse.json(processedData);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unexpected server error occurred";
    console.error("🚨 UNEXPECTED API ERROR:", message, e);
    return NextResponse.json(
      { error: "Failed to fetch data (Unexpected server error)." },
      { status: 500 }
    );
  }
}
