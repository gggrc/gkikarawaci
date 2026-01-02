export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const MAX_MONTHLY = 120;
const MAX_WEEKLY = 520;

type WeeklyEventRequestBody = {
  title: string;
  description?: string;
  jenis_kebaktian: string;
  sesi_ibadah: number;
  start_date: string;
  repetition_type: "Once" | "Weekly" | "Monthly";
  end_date?: string | null;
};

type IbadahCreateInput = {
  id_ibadah: string;
  jenis_kebaktian: string;
  sesi_ibadah: number;
  tanggal_ibadah: Date;
  weeklyEventId: string;
};

function isValidBody(data: unknown): data is WeeklyEventRequestBody {
  if (typeof data !== "object" || !data) return false;
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

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (!isValidBody(body)) {
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

    // ======================
    // ONCE
    // ======================
    if (repetition_type === "Once") {
      const ibadah = await prisma.ibadah.create({
        data: {
          id_ibadah: crypto.randomUUID(),
          jenis_kebaktian,
          sesi_ibadah,
          tanggal_ibadah: startDate,
          weeklyEventId: null, // ⬅️ PENTING
        },
      });

      return NextResponse.json(
        { message: "Single event created", ibadah },
        { status: 201 }
      );
    }

    // ======================
    // WEEKLY / MONTHLY (PARENT)
    // ======================
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
    let cursor = new Date(startDate);

    // ======================
    // WEEKLY
    // ======================
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

        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + 7);
        count++;
      }
    }

    // ======================
    // MONTHLY
    // ======================
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

        cursor = new Date(cursor);
        cursor.setMonth(cursor.getMonth() + 1);
        count++;
      }
    }

    await prisma.ibadah.createMany({ data: ibadahList });

    return NextResponse.json(
      {
        message: `${repetition_type} event created`,
        total: ibadahList.length,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("❌ weekly-events POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ======================
// PUT (Update Event)
// ======================

export async function PUT(req: Request) {
  try {
    // Tentukan tipe data PUT
    interface UpdateWeeklyEventBody {
      id: string;
      title: string;
      description?: string | null;
      start_date: string;
      end_date?: string | null;
      repetition_type: "Once" | "Weekly" | "Monthly";
    }

    const body = (await req.json()) as UpdateWeeklyEventBody;

    const updated = await prisma.weeklyEvent.update({
      where: { id: body.id },
      data: {
        title: body.title,
        description: body.description ?? null,
        start_date: new Date(body.start_date),
        end_date: body.end_date ? new Date(body.end_date) : null,
        repetition_type: body.repetition_type,
      },
    });

    return NextResponse.json(updated, { status: 200 });

  } catch (err) {
    console.error("❌ weekly-events PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update event" }, 
      { status: 500 }
    );
  }
}


export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    await prisma.weeklyEvent.delete({
      where: { id: id! },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ weekly-events DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const weekly = await prisma.weeklyEvent.findMany({
    include: {
      Ibadah: {
        orderBy: { tanggal_ibadah: "asc" },
      },
    },
    orderBy: { start_date: "asc" },
  });

  const singleEvents = await prisma.ibadah.findMany({
    where: { weeklyEventId: null },
    orderBy: { tanggal_ibadah: "asc" },
  });

  return NextResponse.json({
    weeklyEvents: weekly,
    singleEvents: singleEvents,
  });
}
