// src/app/api/jemaat/route.ts

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import type { Database } from "~/types/database.types";

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
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
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
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return undefined;

  const today = new Date();
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

const normalizeDate = (dateString?: string | null): string => {
  if (!dateString) return "";
  const part = dateString.split("T")[0];
  return part ?? "";
};


const toKey = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
};

// ✅ FIX UTAMA: null → undefined (UNTUK PATCH)
const toUndefined = <T>(v: T | null | undefined): T | undefined =>
  v ?? undefined;

// ==============================
// GET HANDLER
// ==============================
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });

    const { data: jemaatRaw, error: jemaatError } = await supabase
      .from("Jemaat")
      .select("id_jemaat, name, jabatan, email, handphone, tanggal_lahir")
      .order("name", { ascending: true });

    if (jemaatError) {
      return NextResponse.json({
        error: jemaatError.message,
        jemaatData: [],
        attendanceDates: [],
        fullAttendanceRecords: [],
      });
    }

    const jemaatData = (jemaatRaw ?? []) as JemaatDB[];

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: kehRaw } = await supabase
      .from("Kehadiran")
      .select(
        `id_jemaat, waktu_presensi, id_ibadah,
         Ibadah ( id_ibadah, jenis_kebaktian )`
      )
      .gte("waktu_presensi", threeMonthsAgo.toISOString())
      .order("waktu_presensi", { ascending: true });

    const attendanceCount = new Map<string, number>();
    const jemaatSesi = new Map<string, Map<string, number>>();
    const uniqueDates = new Set<string>();

    (kehRaw as KehadiranDB[] | null)?.forEach((k) => {
      if (!k.id_jemaat || !k.waktu_presensi) return;

      const id = toKey(k.id_jemaat);
      const date = normalizeDate(k.waktu_presensi);

      uniqueDates.add(date);
      attendanceCount.set(id, (attendanceCount.get(id) ?? 0) + 1);

      const sesi = k.Ibadah?.jenis_kebaktian ?? "Unknown";
      if (!jemaatSesi.has(id)) jemaatSesi.set(id, new Map());
      jemaatSesi.get(id)!.set(sesi, (jemaatSesi.get(id)!.get(sesi) ?? 0) + 1);
    });

    const processed: JemaatClient[] = jemaatData.map((j) => {
      const id = toKey(j.id_jemaat);
      const sesi = jemaatSesi.get(id);
      let dom = "Belum Ada Ibadah";

      if (sesi) {
        const sorted = [...sesi.entries()].sort((a, b) => b[1] - a[1]);
        dom = sorted[0]?.[0] ?? dom;
      }

      const birth = normalizeDate(j.tanggal_lahir);

      return {
        id,
        foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(j.name)}`,
        nama: j.name,
        jabatan: j.jabatan ?? "Jemaat",
        statusKehadiran: calculateStatusKehadiran(attendanceCount.get(id) ?? 0),
        tanggalLahir: birth || undefined,
        umur: calculateAge(birth),
        keluarga: `Keluarga ${j.name.split(" ").pop()}`,
        email: j.email,
        telepon: j.handphone,
        kehadiranSesi: dom,
        dokumen: null,
      };
    });

    const fullAttendance: JemaatWithAttendanceInfo[] = [];

    (kehRaw as KehadiranDB[] | null)?.forEach((k) => {
      if (!k.id_jemaat || !k.waktu_presensi) return;

      const j = processed.find((x) => x.id === toKey(k.id_jemaat));
      if (!j) return;

      const datePart = normalizeDate(k.waktu_presensi);

      fullAttendance.push({
        ...j,
        id: `${j.id}-${datePart}`,
        tanggalKehadiran: datePart,
        waktuPresensiFull: k.waktu_presensi,
        kehadiranSesi: k.Ibadah?.jenis_kebaktian ?? "Unknown",
      });
    });

    return NextResponse.json({
      jemaatData: processed,
      attendanceDates: [...uniqueDates].sort(),
      fullAttendanceRecords: fullAttendance,
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error", jemaatData: [], attendanceDates: [], fullAttendanceRecords: [] },
      { status: 500 }
    );
  }
}

// ==============================
// PATCH HANDLER — FINAL CLEAN
// ==============================
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (admin?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      id_jemaat: string;
      name?: string;
      jabatan?: string | null;
      email?: string | null;
      handphone?: string | null;
      tanggal_lahir?: string | null;
    };

    if (!body.id_jemaat)
      return NextResponse.json({ error: "Missing id_jemaat" }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient<Database>(url, key);

    // ✅ FIX MUTLAK: null → undefined
    const payload: Database["public"]["Tables"]["Jemaat"]["Update"] = {
      name: toUndefined(body.name),
      jabatan: toUndefined(body.jabatan),
      email: toUndefined(body.email),
      handphone: toUndefined(body.handphone),
      tanggal_lahir: toUndefined(body.tanggal_lahir),
    };

    const { data, error } = await supabase
      .from("Jemaat")
      .update(payload)
      .eq("id_jemaat", body.id_jemaat)
      .select();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data?.length)
      return NextResponse.json({ error: "id_jemaat not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: data[0] });
  } catch {
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
