// src/app/api/jemaat/route.ts

export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import type { Database } from "~/types/database.types";

// --- Tipe Data ---
type JemaatDB = Database['public']['Tables']['Jemaat']['Row'];
type KehadiranDB = {
  id_jemaat: string;
  waktu_presensi: string | null; 
};

// --- Tipe Data Klien ---
export type StatusKehadiran = "Aktif" | "Jarang Hadir" | "Tidak Aktif";

export interface JemaatClient {
  id: string;
  foto: string;
  nama: string;
  jabatan: string | null;
  statusKehadiran: StatusKehadiran;
  tanggalLahir: string | undefined; 
  umur: string | undefined;
  keluarga: string | undefined;
  email: string | null;
  telepon: string | null;
  kehadiranSesi: string;
  dokumen: unknown;
  tanggalKehadiran: string; // Format: YYYY-MM-DD (TANPA waktu)
}

// ------------------------------------
// --- Utility Functions ---
// ------------------------------------

const calculateAge = (dobString: string | undefined | null): string | undefined => {
  if (!dobString) return undefined;
  const today = new Date();
  const birthDate = new Date(dobString);

  if (isNaN(birthDate.getTime())) return undefined;

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age.toString();
};

const calculateStatusKehadiran = (
  attendanceCount: number
): JemaatClient["statusKehadiran"] => {
  if (attendanceCount >= 9) return "Aktif";
  if (attendanceCount >= 5) return "Jarang Hadir";
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

// Fungsi untuk normalisasi tanggal ke format YYYY-MM-DD
const normalizeDateToYYYYMMDD = (dateString: string): string => {
  return dateString.split('T')[0]!; // Ambil bagian tanggal saja
};

// ------------------------------------
// --- Main Handler ---
// ------------------------------------
export async function GET() {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoISO = threeMonthsAgo.toISOString();

    // 1. Fetch Jemaat Data
    const { data: jemaatData, error: jemaatError } = await supabase
      .from("Jemaat")
      .select("id_jemaat, name, jabatan, email, handphone, tanggal_lahir") 
      .order("name", { ascending: true });

    if (jemaatError) {
      console.error("❌ Supabase Error fetching jemaat:", jemaatError.message);
      return NextResponse.json(
        { error: `Failed to fetch Jemaat data: ${jemaatError.message}` },
        { status: 500 }
      );
    }

    // 2. Fetch Kehadiran Data (3 bulan terakhir, diurutkan)
    const { data: rawKehadiranData, error: kehadiranError } = await supabase
      .from("Kehadiran")
      .select("id_jemaat, waktu_presensi") 
      .order("waktu_presensi", { ascending: true }) 
      .gte("waktu_presensi", threeMonthsAgoISO);

    if (kehadiranError) {
      console.error(
        "❌ Supabase Error fetching kehadiran:",
        kehadiranError.message
      );
      return NextResponse.json(
        { error: `Failed to fetch Kehadiran data: ${kehadiranError.message}` },
        { status: 500 }
      );
    }

    // --- LOGIKA FILTER: Ambil hanya satu presensi per jemaat per tanggal ---
    const seenDatesPerJemaatPerDay = new Set<string>();
    const uniqueDatesWithAttendance = new Set<string>();
    const jemaatKehadiranMap = new Map<string, Map<string, boolean>>(); // id_jemaat -> Map<dateKey, true>

    const filteredKehadiranData: KehadiranDB[] = (rawKehadiranData as KehadiranDB[]).filter(k => {
        if (!k.id_jemaat || !k.waktu_presensi) return false;

        // PENTING: Normalisasi tanggal ke format YYYY-MM-DD
        const datePart = normalizeDateToYYYYMMDD(k.waktu_presensi);
        const uniqueKey = `${k.id_jemaat}-${datePart}`;

        if (seenDatesPerJemaatPerDay.has(uniqueKey)) {
            return false; // Skip duplikat
        }

        seenDatesPerJemaatPerDay.add(uniqueKey);
        uniqueDatesWithAttendance.add(datePart);
        
        // Track tanggal kehadiran per jemaat
        if (!jemaatKehadiranMap.has(k.id_jemaat)) {
          jemaatKehadiranMap.set(k.id_jemaat, new Map());
        }
        jemaatKehadiranMap.get(k.id_jemaat)!.set(datePart, true);
        
        return true;
    });

    // 3. Hitung jumlah kehadiran per jemaat
    const attendanceCountMap = new Map<string, number>();
    filteredKehadiranData.forEach((k) => {
      if (k.id_jemaat) {
        attendanceCountMap.set(
          k.id_jemaat,
          (attendanceCountMap.get(k.id_jemaat) || 0) + 1
        );
      }
    });

    // 4. Buat array data jemaat PER TANGGAL KEHADIRAN dengan format tanggal konsisten
    const processedData: JemaatClient[] = [];
    
    (jemaatData as unknown as JemaatDB[]).forEach((j) => {
      const jemaatId = j.id_jemaat;
      const name = j.name;
      const birthDateString = j.tanggal_lahir?.split("T")[0] ?? undefined; 
      const attendanceCount = attendanceCountMap.get(jemaatId) || 0;
      
      // Dapatkan semua tanggal kehadiran untuk jemaat ini
      const jemaatDates = jemaatKehadiranMap.get(jemaatId);
      
      if (jemaatDates && jemaatDates.size > 0) {
        // Buat entry terpisah untuk setiap tanggal kehadiran
        jemaatDates.forEach((_, dateKey) => {
          processedData.push({
            id: `${jemaatId}-${dateKey}`, // ID unik per jemaat per tanggal
            foto: `https://ui-avatars.com/api/?name=${name.replace(
              /\s/g,
              "+"
            )}&background=4F46E5&color=fff&size=128`,
            nama: name,
            jabatan: j.jabatan ?? 'Jemaat',
            statusKehadiran: calculateStatusKehadiran(attendanceCount),
            tanggalLahir: birthDateString,
            umur: calculateAge(birthDateString),
            keluarga: `Keluarga ${name.split(" ").pop()}`, 
            email: j.email ?? null,
            telepon: j.handphone ?? null,
            kehadiranSesi: getDefaultKehadiranSesi(jemaatId),
            dokumen: undefined,
            tanggalKehadiran: dateKey, // Format: YYYY-MM-DD (TANPA waktu)
          });
        });
      }
    });

    console.log(`✅ Processed ${processedData.length} attendance records from ${uniqueDatesWithAttendance.size} unique dates`);

    // 5. Return data dengan tanggal dalam format konsisten
    return NextResponse.json({
        jemaatData: processedData,
        attendanceDates: Array.from(uniqueDatesWithAttendance).sort(),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unexpected server error occurred";
    console.error("🚨 UNEXPECTED API ERROR:", message, e);
    return NextResponse.json(
      { error: `Internal Server Error: ${message}` },
      { status: 500 }
    );
  }
}