export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const MAX_MONTHLY = 120;
const MAX_WEEKLY = 520;

/* =======================
   TYPES
======================= */

type RepetitionType = "Once" | "Weekly" | "Monthly";

type PostBody = {
  title: string;
  description?: string;
  jenis_kebaktian: string;
  sesi_ibadah: number;
  start_date: string;
  repetition_type: RepetitionType;
  end_date?: string | null;
};

type PutSingleBody = {
  type: "single";
  dateKey: string;
  oldTitle: string;
  newTitle: string;
};

type PutPeriodicalBody = {
  type: "periodical";
  weeklyEventId: string;
  newTitle: string;
};

type PutSinglePeriodicalBody = {
  type: "single-periodical";
  weeklyEventId: string;
  dateKey: string;
  newTitle: string;
};

type PutBody =
  | PutSingleBody
  | PutPeriodicalBody
  | PutSinglePeriodicalBody;

type IbadahCreateInput = {
  id_ibadah: string;
  jenis_kebaktian: string;
  sesi_ibadah: number;
  tanggal_ibadah: Date;
  weeklyEventId: string | null;
};

/* =======================
   TYPE GUARDS
======================= */

function isPostBody(data: unknown): data is PostBody {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  return (
    typeof d.title === "string" &&
    typeof d.jenis_kebaktian === "string" &&
    typeof d.sesi_ibadah === "number" &&
    typeof d.start_date === "string" &&
    (d.repetition_type === "Once" ||
      d.repetition_type === "Weekly" ||
      d.repetition_type === "Monthly")
  );
}

function isPutBody(data: unknown): data is PutBody {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  if (d.type === "single") {
    return (
      typeof d.dateKey === "string" &&
      typeof d.oldTitle === "string" &&
      typeof d.newTitle === "string"
    );
  }

  if (d.type === "periodical") {
    return (
      typeof d.weeklyEventId === "string" &&
      typeof d.newTitle === "string"
    );
  }

  if (d.type === "single-periodical") {
    return (
      typeof d.weeklyEventId === "string" &&
      typeof d.dateKey === "string" &&
      typeof d.newTitle === "string"
    );
  }

  return false;
}

/* =======================
   POST
======================= */

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    
    // Validasi body menggunakan type guard yang sudah Anda buat
    if (!isPostBody(body)) {
      return NextResponse.json({ error: "Data input tidak valid" }, { status: 400 });
    }

    const {
      title,
      description,
      jenis_kebaktian,
      sesi_ibadah,
      start_date,
      repetition_type,
      end_date,
    } = body;

    const startDate = new Date(start_date);
    const endDate = end_date ? new Date(end_date) : null;

    // 1. PENAMBAHAN EVENT SATUAN (Once)
    if (repetition_type === "Once") {
      const ibadah = await prisma.ibadah.create({
        data: {
          id_ibadah: crypto.randomUUID(),
          // Pastikan menggunakan title jika jenis_kebaktian kosong
          jenis_kebaktian: jenis_kebaktian || title, 
          sesi_ibadah,
          tanggal_ibadah: startDate,
          weeklyEventId: null,
        },
      });

      return NextResponse.json({ success: true, data: ibadah });
    }

    // 2. PENAMBAHAN EVENT PERIODIK (Weekly / Monthly)
    // Buat Parent Event di tabel WeeklyEvent
    const weeklyEvent = await prisma.weeklyEvent.create({
      data: {
        title,
        description,
        jenis_kebaktian: jenis_kebaktian || title,
        sesi_ibadah,
        start_date: startDate,
        end_date: endDate,
        repetition_type,
      },
    });

    const ibadahList: IbadahCreateInput[] = [];
    const cursor = new Date(startDate);

    // Logika Pengulangan Mingguan
    if (repetition_type === "Weekly") {
      let count = 0;
      while ((!endDate || cursor <= endDate) && count < MAX_WEEKLY) {
        ibadahList.push({
          id_ibadah: crypto.randomUUID(),
          jenis_kebaktian: jenis_kebaktian || title,
          sesi_ibadah,
          tanggal_ibadah: new Date(cursor),
          weeklyEventId: weeklyEvent.id,
        });
        cursor.setDate(cursor.getDate() + 7);
        count++;
      }
    }

    // Logika Pengulangan Bulanan
    if (repetition_type === "Monthly") {
      let count = 0;
      const targetDay = startDate.getDate();
      while ((!endDate || cursor <= endDate) && count < MAX_MONTHLY) {
        const date = new Date(cursor);
        date.setDate(targetDay);
        
        // Validasi agar tidak lompat bulan jika tanggal > 28
        if (date.getDate() === targetDay) {
          ibadahList.push({
            id_ibadah: crypto.randomUUID(),
            jenis_kebaktian: jenis_kebaktian || title,
            sesi_ibadah,
            tanggal_ibadah: date,
            weeklyEventId: weeklyEvent.id,
          });
        }
        cursor.setMonth(cursor.getMonth() + 1);
        count++;
      }
    }

    // Eksekusi createMany untuk performa
    if (ibadahList.length > 0) {
      await prisma.ibadah.createMany({ data: ibadahList });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${ibadahList.length} jadwal berhasil ditambahkan` 
    });

  } catch (err) {
    console.error("POST error detail:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan data ke database", detail: err instanceof Error ? err.message : String(err) }, 
      { status: 500 }
    );
  }
}

/* =======================
   PUT
======================= */

export async function PUT(req: Request) {
  try {
    const body: unknown = await req.json();

    if (!isPutBody(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

<<<<<<< HEAD
=======
    // Update satu hari pada jadwal rutin
>>>>>>> 0cc1cd1a45d0cec169bc077631aa9f011a07b9a2
    if (body.type === "single-periodical") {
      await prisma.ibadah.updateMany({
        where: {
          weeklyEventId: body.weeklyEventId,
          tanggal_ibadah: {
            gte: new Date(`${body.dateKey}T00:00:00Z`),
            lte: new Date(`${body.dateKey}T23:59:59Z`),
          }
        },
        data: { jenis_kebaktian: body.newTitle },
      });
      return NextResponse.json({ success: true });
    }

<<<<<<< HEAD
=======
    // Update event satuan (Fleksibel untuk data SQL)
>>>>>>> 0cc1cd1a45d0cec169bc077631aa9f011a07b9a2
    if (body.type === "single") {
      await prisma.ibadah.updateMany({
        where: {
          jenis_kebaktian: body.oldTitle,
          tanggal_ibadah: {
            gte: new Date(`${body.dateKey}T00:00:00Z`),
            lte: new Date(`${body.dateKey}T23:59:59Z`),
          }
        },
        data: { jenis_kebaktian: body.newTitle },
      });
      return NextResponse.json({ success: true });
    }

<<<<<<< HEAD
=======
    // Update induk (Diterapkan ke semua anak)
>>>>>>> 0cc1cd1a45d0cec169bc077631aa9f011a07b9a2
    if (body.type === "periodical") {
      await prisma.weeklyEvent.update({
        where: { id: body.weeklyEventId },
        data: {
          title: body.newTitle,
          jenis_kebaktian: body.newTitle,
        },
      });
      // Sinkronkan semua nama di tabel Ibadah
      await prisma.ibadah.updateMany({
        where: { weeklyEventId: body.weeklyEventId },
        data: { jenis_kebaktian: body.newTitle },
      });
      return NextResponse.json({ success: true });
    }
<<<<<<< HEAD
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });

=======

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
>>>>>>> 0cc1cd1a45d0cec169bc077631aa9f011a07b9a2
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server gagal memproses update" },
      { status: 500 }
    );
  }
}

/* =======================
   DELETE
======================= */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); 
    const id = searchParams.get("id"); // Bisa berupa ID atau Nama
    const dateKey = searchParams.get("dateKey");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // 1. Hapus Seluruh Rangkaian (Induk + Semua Anak)
    if (type === "all-periodical") {
      await prisma.weeklyEvent.delete({ 
        where: { id: id } 
      });
      return NextResponse.json({ success: true });
    }

    // 2. Hapus Satu Tanggal dari Event Rutin
    if (type === "single-periodical" && dateKey) {
      await prisma.ibadah.deleteMany({
        where: {
          weeklyEventId: id,
          tanggal_ibadah: {
            gte: new Date(`${dateKey}T00:00:00Z`),
            lte: new Date(`${dateKey}T23:59:59Z`),
          }
        },
      });
      return NextResponse.json({ success: true });
    }

    // 3. Hapus Event Satuan (Dibuat fleksibel untuk data SQL)
    if (type === "once") {
      await prisma.ibadah.deleteMany({
        where: {
          jenis_kebaktian: decodeURIComponent(id),
          tanggal_ibadah: dateKey ? {
            gte: new Date(`${dateKey}T00:00:00Z`),
            lte: new Date(`${dateKey}T23:59:59Z`),
          } : undefined,
          // Jika ditambahkan via SQL, weeklyEventId biasanya NULL
        },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("DELETE error:", err);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}
/* =======================
   GET
======================= */

export async function GET() {
  const weeklyEvents = await prisma.weeklyEvent.findMany({
    include: { Ibadah: true },
    orderBy: { start_date: "asc" },
  });

  const singleEvents = await prisma.ibadah.findMany({
    where: { weeklyEventId: null },
    orderBy: { tanggal_ibadah: "asc" },
  });

  return NextResponse.json({ weeklyEvents, singleEvents });
}
