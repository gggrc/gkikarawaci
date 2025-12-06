// src/app/api/jemaat/route.ts

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// ==============================
// TYPES
// ==============================
type JemaatDB = {
  id_jemaat: string;
  name: string;
  jabatan: string | null;
  email: string | null;
  handphone: string | null;
  tanggal_lahir: string | null;
};

interface KehadiranDB {
  id_jemaat: string | null;
  waktu_presensi: string | null;
  id_ibadah: string | null;
  Ibadah?: {
    id_ibadah?: string | null;
    jenis_kebaktian: string | null;
  } | null;
}

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
}

export interface JemaatWithAttendanceInfo extends JemaatClient {
  tanggalKehadiran: string;
  waktuPresensiFull: string;
}

export interface JemaatAPIResponse {
  jemaatData: JemaatClient[];
  attendanceDates: string[];
  fullAttendanceRecords: JemaatWithAttendanceInfo[];
  error?: string;
}

// ==============================
// UTILITIES
// ==============================
const calculateAge = (dobString?: string | null): string | undefined => {
  if (!dobString) return undefined;
  const today = new Date();
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return undefined;

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

  return age.toString();
};

const calculateStatusKehadiran = (attendanceCount: number): StatusKehadiran => {
  if (attendanceCount >= 9) return "Aktif";
  if (attendanceCount >= 5) return "Jarang Hadir";
  return "Tidak Aktif";
};

const normalizeDateToYYYYMMDD = (dateString: string): string => {
  if (!dateString) return "";
  const match = /^\d{4}-\d{2}-\d{2}/.exec(dateString);
  if (match) return match[0];
  return dateString.split(/[\sT]/)[0] ?? "";
};

const toKey = (val: unknown) =>
  val === null || val === undefined ? "" : String(val);

// ==============================
// GET HANDLER
// ==============================
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient<Database>(
      supabaseUrl,
      supabaseServiceRoleKey,
      { auth: { persistSession: false } }
    );

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoISO = threeMonthsAgo.toISOString();

    // 1. Fetch Jemaat
    const { data: jemaatData, error: jemaatError } = await supabase
      .from("Jemaat")
      .select("id_jemaat, name, jabatan, email, handphone, tanggal_lahir")
      .order("name", { ascending: true });

    if (jemaatError) {
      return NextResponse.json({
        error: jemaatError.message,
        jemaatData: [],
        attendanceDates: [],
        fullAttendanceRecords: [],
      } as JemaatAPIResponse);
    }

    const safeJemaatData = (jemaatData ?? []) as JemaatDB[];

    // 2. Fetch Kehadiran + Join Ibadah
    const { data: rawKehadiranData } = await supabase
      .from("Kehadiran")
      .select(
        `id_jemaat, waktu_presensi, id_ibadah,
         Ibadah ( id_ibadah, jenis_kebaktian )`
      )
      .gte("waktu_presensi", threeMonthsAgoISO)
      .order("waktu_presensi", { ascending: true });

    const attendanceCountMap = new Map<string, number>();
    const jemaatSesiMap = new Map<string, Map<string, number>>();
    const uniqueDatesWithAttendance = new Set<string>();

    (rawKehadiranData as KehadiranDB[] | null)?.forEach((k) => {
      if (!k?.id_jemaat || !k.waktu_presensi) return;

      const jemaatId = toKey(k.id_jemaat);
      const datePart = normalizeDateToYYYYMMDD(k.waktu_presensi);

      uniqueDatesWithAttendance.add(datePart);

      attendanceCountMap.set(
        jemaatId,
        (attendanceCountMap.get(jemaatId) ?? 0) + 1
      );

      const jenis = k.Ibadah?.jenis_kebaktian ?? "Sesi Tidak Diketahui";

      if (!jemaatSesiMap.has(jemaatId)) {
        jemaatSesiMap.set(jemaatId, new Map());
      }

      const sesiCounter = jemaatSesiMap.get(jemaatId)!;
      sesiCounter.set(jenis, (sesiCounter.get(jenis) ?? 0) + 1);
    });

    // 3. Process Jemaat
    const processedJemaatData: JemaatClient[] = safeJemaatData.map((j) => {
      const jemaatId = toKey(j.id_jemaat);
      const sesiMap = jemaatSesiMap.get(jemaatId);

      let dominantSesi = "Belum Ada Ibadah";
      if (sesiMap && sesiMap.size > 0) {
        dominantSesi = Array.from(sesiMap.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0][0];
      }

      const birth = j.tanggal_lahir
        ? normalizeDateToYYYYMMDD(j.tanggal_lahir)
        : undefined;

      return {
        id: jemaatId,
        foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          j.name
        )}&background=4F46E5&color=fff`,
        nama: j.name,
        jabatan: j.jabatan ?? "Jemaat",
        statusKehadiran: calculateStatusKehadiran(
          attendanceCountMap.get(jemaatId) ?? 0
        ),
        tanggalLahir: birth,
        umur: calculateAge(birth),
        keluarga: `Keluarga ${j.name?.split(" ").pop()}`,
        email: j.email,
        telepon: j.handphone,
        kehadiranSesi: dominantSesi,
        dokumen: null,
      };
    });

    // 4. Full Attendance Records
    const fullAttendanceRecords: JemaatWithAttendanceInfo[] = [];

    (rawKehadiranData as KehadiranDB[] | null)?.forEach((k) => {
      if (!k?.id_jemaat || !k.waktu_presensi) return;

      const jemaat = processedJemaatData.find(
        (x) => x.id === toKey(k.id_jemaat)
      );

      if (!jemaat) return;

      const datePart = normalizeDateToYYYYMMDD(k.waktu_presensi);

      fullAttendanceRecords.push({
        ...jemaat,
        id: `${jemaat.id}-${datePart}`,
        tanggalKehadiran: datePart,
        waktuPresensiFull: k.waktu_presensi,
        kehadiranSesi:
          k.Ibadah?.jenis_kebaktian ?? "Sesi Tidak Diketahui",
      });
    });

    return NextResponse.json({
      jemaatData: processedJemaatData,
      attendanceDates: Array.from(uniqueDatesWithAttendance).sort(),
      fullAttendanceRecords,
    } as JemaatAPIResponse);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Unexpected server error",
        jemaatData: [],
        attendanceDates: [],
        fullAttendanceRecords: [],
      },
      { status: 500 }
    );
  }
}

// ==============================
// PATCH HANDLER ✅ FINAL FIX
// ==============================
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (admin?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id_jemaat, name, jabatan, email, handphone, tanggal_lahir } = body;

    console.log("PATCH PAYLOAD:", body);

    if (!id_jemaat || typeof id_jemaat !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing id_jemaat" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient<Database>(
      supabaseUrl,
      supabaseServiceRoleKey,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from("Jemaat")
      .update({
        name,
        jabatan,
        email,
        handphone,
        tanggal_lahir,
      })
      .eq("id_jemaat", id_jemaat)
      .select(); // ✅ TANPA .single()

    if (error) {
      console.error("Supabase Update Error:", error);

      return NextResponse.json(
        {
          error: error.message,
          code: error.code ?? null,
          details: error.details ?? null,
        },
        { status: 500 }
      );
    }

    // ✅ VALIDASI HASIL UPDATE
    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          error: "Update gagal: id_jemaat tidak ditemukan di database",
        },
        { status: 404 }
      );
    }

    if (data.length > 1) {
      return NextResponse.json(
        {
          error:
            "Update gagal: id_jemaat tidak unik (lebih dari satu row terupdate)",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data[0],
    });
  } catch (e) {
    console.error("PATCH /api/jemaat error:", e);

    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
