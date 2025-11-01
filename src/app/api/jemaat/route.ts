// src/app/api/jemaat/route.ts

export const runtime = "nodejs";
import { NextResponse } from "next/server";
// Hapus import dari '@/lib/supabase-server' karena kita akan inisialisasi lokal
import { createClient } from "@supabase/supabase-js"; 
import type { Database } from "~/types/database.types";

// --- Tipe Data Supabase ---
type JemaatDB = {
  id_jemaat: string;
  name: string;
  jabatan: string | null;
  email: string | null;
  handphone: string | null;
  tanggal_lahir: string | null; // ISO string
};

// --- Tipe Data Kehadiran Mentah ---
interface KehadiranDB {
  id_jemaat: string | null;
  waktu_presensi: string | null;
}

// --- Tipe Data Klien (Overall Unique Jemaat) ---
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
  kehadiranSesi: string; // Mocked session for unique jemaat list
  dokumen: unknown;
}

// --- Tipe Data Klien (Attendance Instance) ---
// Ini adalah data yang digunakan untuk filter tabel
export interface JemaatWithAttendanceInfo extends JemaatClient {
    tanggalKehadiran: string; // YYYY-MM-DD (Date part only, used for table filtering)
    waktuPresensiFull: string; // Full ISO string (Time of attendance)
}

// --- Tipe Data Response API Baru ---
interface JemaatAPIResponse {
    jemaatData: JemaatClient[]; // Overall list of unique Jemaat (for overall status/detail)
    attendanceDates: string[]; // Unique dates (for calendar dots)
    fullAttendanceRecords: JemaatWithAttendanceInfo[]; // The actual attendance instances (for tables/stats per day)
    error?: string; // Menangkap error dari database
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

// Fungsi ini MOCKING sesi karena data DB tidak memiliki id_ibadah/sesi
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
  const safeId = String(id ?? '');
  const hash = safeId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return sessions[hash % sessions.length] ?? "Kebaktian I : 07:00";
};

/**
 * Memastikan ekstraksi tanggal YYYY-MM-DD dari string ISO
 */
const normalizeDateToYYYYMMDD = (dateString: string): string => {
  if (!dateString) return '';
  
  const match = dateString.match(/^\d{4}-\d{2}-\d{2}/);
  
  if (match) {
    return match[0]; 
  }
  
  const parts = dateString.split(/[\sT]/);
  return parts[0] ?? '';
};

// ------------------------------------
// --- Main Handler ---
// ------------------------------------
export async function GET() {
  try {
    console.log("🔄 Starting API request...");

    // ✅ FIX: Inisialisasi klien Supabase Service Role secara lokal
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error("Missing Supabase environment variables for Service Role Key.");
    }
    
    const supabase = createClient<Database>(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
            auth: {
                persistSession: false,
            },
        }
    );
    
    // Batasan waktu 3 bulan
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoISO = threeMonthsAgo.toISOString();

    // 1. Fetch Jemaat Data (untuk detail dan status overall)
    console.log("📊 Fetching jemaat data...");
    const { data: jemaatData, error: jemaatError } = await supabase
      .from("Jemaat")
      .select("id_jemaat, name, jabatan, email, handphone, tanggal_lahir") 
      .order("name", { ascending: true });

    if (jemaatError) {
      console.error("❌ Supabase Error fetching jemaat:", jemaatError);
      return NextResponse.json(
        { 
          error: `Database error: ${jemaatError.message}`, 
          jemaatData: [],
          attendanceDates: [],
          fullAttendanceRecords: []
        } as JemaatAPIResponse,
        { status: 200 }
      );
    }

    if (!jemaatData || jemaatData.length === 0) {
      console.log("⚠️ No jemaat data found");
      return NextResponse.json({
        jemaatData: [],
        attendanceDates: [],
        fullAttendanceRecords: []
      } as JemaatAPIResponse);
    }

    console.log(`✅ Found ${jemaatData.length} jemaat records`);

    // 2. Fetch Kehadiran Data (3 bulan terakhir)
    console.log("📊 Fetching kehadiran data...");
    const { data: rawKehadiranData, error: kehadiranError } = await supabase
      .from("Kehadiran")
      .select("id_jemaat, waktu_presensi") 
      .order("waktu_presensi", { ascending: true }) 
      .gte("waktu_presensi", threeMonthsAgoISO);

    if (kehadiranError) {
      console.error("❌ Supabase Error fetching kehadiran:", kehadiranError);
      return NextResponse.json({
        error: `Database error on Kehadiran: ${kehadiranError.message}`, // Tambahkan error message
        jemaatData: [],
        attendanceDates: [],
        fullAttendanceRecords: []
      } as JemaatAPIResponse, { status: 200 });
    }

    console.log(`✅ Found ${rawKehadiranData?.length ?? 0} kehadiran records`);

    // --- STEP 3: Process attendance data for overall stats ---
    const attendanceCountMap = new Map<string, number>();
    const uniqueDatesWithAttendance = new Set<string>();
    const jemaatMap = new Map<string, JemaatDB>();
    
    const safeKehadiranData = (rawKehadiranData ?? []) as KehadiranDB[];
    const safeJemaatData = (jemaatData ?? []) as unknown as JemaatDB[];

    safeJemaatData.forEach(j => {
        if (j.id_jemaat) jemaatMap.set(j.id_jemaat, j);
    });
    
    safeKehadiranData.forEach(k => {
      if (!k || !k.id_jemaat || !k.waktu_presensi) return;

      try {
        const datePart = normalizeDateToYYYYMMDD(k.waktu_presensi);
        if (!datePart) return;
        
        // Track unique dates
        uniqueDatesWithAttendance.add(datePart);
        
        // Count attendance per jemaat
        attendanceCountMap.set(
          k.id_jemaat,
          (attendanceCountMap.get(k.id_jemaat) ?? 0) + 1
        );
      } catch (err) {
        console.error("❌ Error processing kehadiran record:", err, k);
      }
    });

    // --- STEP 4: Process unique jemaat data (for overall list) ---
    const processedJemaatData: JemaatClient[] = [];
    
    safeJemaatData.forEach((j) => {
      try {
        const jemaatId = j.id_jemaat;
        if (!jemaatId) return;

        const name = j.name ?? 'Jemaat'; 
        const birthDateString = j.tanggal_lahir ? normalizeDateToYYYYMMDD(j.tanggal_lahir) : undefined; 
        const attendanceCount = attendanceCountMap.get(jemaatId) ?? 0;

        processedJemaatData.push({
          id: jemaatId,
          foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&size=128`,
          nama: name, 
          jabatan: j.jabatan ?? 'Jemaat',
          statusKehadiran: calculateStatusKehadiran(attendanceCount),
          tanggalLahir: birthDateString,
          umur: calculateAge(birthDateString),
          keluarga: `Keluarga ${name.split(" ").pop() ?? 'N/A'}`, 
          email: j.email ?? null,
          telepon: j.handphone ?? null,
          kehadiranSesi: getDefaultKehadiranSesi(jemaatId), // Mocked overall session
          dokumen: undefined,
        });
      } catch (err) {
        console.error("❌ Error processing jemaat record:", err, j);
      }
    });
    
    // --- STEP 5: Create fullAttendanceRecords (The source of truth for tables) ---
    const fullAttendanceRecords: JemaatWithAttendanceInfo[] = [];

    safeKehadiranData.forEach(k => {
        if (!k || !k.id_jemaat || !k.waktu_presensi) return;
        
        const jemaatId = k.id_jemaat!;
        const overallJemaat = processedJemaatData.find(j => j.id === jemaatId);

        if (overallJemaat) {
            const datePart = normalizeDateToYYYYMMDD(k.waktu_presensi!);
            const attendanceSession = getDefaultKehadiranSesi(jemaatId);

            fullAttendanceRecords.push({
                ...overallJemaat, 
                tanggalKehadiran: datePart, 
                waktuPresensiFull: k.waktu_presensi!,
                kehadiranSesi: attendanceSession,
            });
        }
    });

    const sortedDates = Array.from(uniqueDatesWithAttendance).sort();
    
    console.log(`✅ Processed ${processedJemaatData.length} unique jemaat records. Total attendance instances: ${fullAttendanceRecords.length}`);

    // 6. Return data
    return NextResponse.json({
        jemaatData: processedJemaatData,
        attendanceDates: sortedDates,
        fullAttendanceRecords: fullAttendanceRecords
    } as JemaatAPIResponse);
    
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected server error occurred";
    const stack = e instanceof Error ? e.stack : undefined;
    
    console.error("🚨 UNEXPECTED API ERROR:", message);
    console.error("Stack trace:", stack);
    
    return NextResponse.json(
      { 
        error: message,
        jemaatData: [],
        attendanceDates: [],
        fullAttendanceRecords: []
      } as JemaatAPIResponse,
      { status: 200 }
    );
  }
}