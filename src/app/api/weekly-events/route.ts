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
    if (!isPostBody(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
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

    // ===== SINGLE =====
    if (repetition_type === "Once") {
      const ibadah = await prisma.ibadah.create({
        data: {
          id_ibadah: crypto.randomUUID(),
          jenis_kebaktian,
          sesi_ibadah,
          tanggal_ibadah: startDate,
          weeklyEventId: null,
        },
      });

      return NextResponse.json({ success: true, ibadah });
    }

    // ===== PERIODICAL PARENT =====
    const weeklyEvent = await prisma.weeklyEvent.create({
      data: {
        title,
        description,
        jenis_kebaktian,
        sesi_ibadah,
        start_date: startDate,
        end_date: endDate,
        repetition_type,
      },
    });

    const ibadahList: IbadahCreateInput[] = [];
    const cursor = new Date(startDate);

    if (repetition_type === "Weekly") {
      let count = 0;
      while ((!endDate || cursor <= endDate) && count < MAX_WEEKLY) {
        ibadahList.push({
          id_ibadah: crypto.randomUUID(),
          jenis_kebaktian,
          sesi_ibadah,
          tanggal_ibadah: new Date(cursor),
          weeklyEventId: weeklyEvent.id,
        });
        cursor.setDate(cursor.getDate() + 7);
        count++;
      }
    }

    if (repetition_type === "Monthly") {
      let count = 0;
      const targetDay = startDate.getDate();

      while ((!endDate || cursor <= endDate) && count < MAX_MONTHLY) {
        const date = new Date(cursor);
        date.setDate(targetDay);

        ibadahList.push({
          id_ibadah: crypto.randomUUID(),
          jenis_kebaktian,
          sesi_ibadah,
          tanggal_ibadah: date,
          weeklyEventId: weeklyEvent.id,
        });

        cursor.setMonth(cursor.getMonth() + 1);
        count++;
      }
    }

    await prisma.ibadah.createMany({ data: ibadahList });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* =======================
   PUT
======================= */

export async function PUT(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!isPutBody(body)) {
      return NextResponse.json({ error: "Invalid PUT body" }, { status: 400 });
    }

    // ===== SINGLE EVENT =====
    if (body.type === "single") {
      await prisma.ibadah.updateMany({
        where: {
          tanggal_ibadah: new Date(body.dateKey),
          jenis_kebaktian: body.oldTitle,
          weeklyEventId: null,
        },
        data: { jenis_kebaktian: body.newTitle },
      });

      return NextResponse.json({ success: true });
    }

    // ===== SINGLE DATE OF PERIODICAL =====
    if (body.type === "single-periodical") {
      await prisma.ibadah.updateMany({
        where: {
          weeklyEventId: body.weeklyEventId,
          tanggal_ibadah: new Date(body.dateKey),
        },
        data: { jenis_kebaktian: body.newTitle },
      });

      return NextResponse.json({ success: true });
    }

    // ===== PERIODICAL ALL =====
    await prisma.weeklyEvent.update({
      where: { id: body.weeklyEventId },
      data: { title: body.newTitle },
    });

    await prisma.ibadah.updateMany({
      where: { weeklyEventId: body.weeklyEventId },
      data: { jenis_kebaktian: body.newTitle },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT error:", err);
    return NextResponse.json({ error: "PUT failed" }, { status: 500 });
  }
}

/* =======================
   DELETE
======================= */

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.weeklyEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
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
