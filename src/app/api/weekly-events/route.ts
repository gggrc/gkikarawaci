// src/app/api/weekly-events/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// ==============================
// CONSTANTS
// ==============================
const MAX_RECURRENCE_DAYS = 365;

// ==============================
// TYPES
// ==============================
type WeeklyEventRequestBody = {
  title: string;
  description?: string;
  jenis_kebaktian: string;
  sesi_ibadah: number;
  start_date: string;
  repetition_type: "Once" | "Weekly" | "Monthly";
  end_date?: string | null;
};

// ==============================
// TYPE GUARD (ANTI any ✅)
// ==============================
function isWeeklyEventRequestBody(data: unknown): data is WeeklyEventRequestBody {
  if (typeof data !== "object" || data === null) return false;

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.title === "string" &&
    typeof obj.jenis_kebaktian === "string" &&
    typeof obj.sesi_ibadah === "number" &&
    typeof obj.start_date === "string" &&
    (obj.repetition_type === "Once" ||
      obj.repetition_type === "Weekly" ||
      obj.repetition_type === "Monthly") &&
    (obj.description === undefined || typeof obj.description === "string") &&
    (obj.end_date === undefined ||
      typeof obj.end_date === "string" ||
      obj.end_date === null)
  );
}

// ==============================
// POST HANDLER
// ==============================
export async function POST(req: Request) {
  try {
    const rawBody: unknown = await req.json();

    if (!isWeeklyEventRequestBody(rawBody)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      jenis_kebaktian,
      sesi_ibadah,
      start_date,
      repetition_type,
      end_date,
    } = rawBody;

    if (!title || !start_date || !jenis_kebaktian || !sesi_ibadah) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const parsedStartDate = new Date(start_date);
    const parsedEndDate = end_date ? new Date(end_date) : null;

    if (parsedEndDate && parsedEndDate <= parsedStartDate) {
      return NextResponse.json(
        { error: "End date must be after start date." },
        { status: 400 }
      );
    }

    // ✅ CREATE PARENT EVENT
    const newWeeklyEvent = await prisma.weeklyEvent.create({
      data: {
        title,
        description,
        jenis_kebaktian,
        sesi_ibadah,
        start_date: parsedStartDate,
        repetition_type,
        end_date: parsedEndDate,
      },
    });

    const ibadahInstances: {
      id_ibadah: string;
      jenis_kebaktian: string;
      sesi_ibadah: number;
      tanggal_ibadah: Date;
      weeklyEventId: string;
    }[] = [];

    const loopDate = new Date(parsedStartDate);
    let counter = 0;

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + MAX_RECURRENCE_DAYS);

    // ==============================
    // ONCE
    // ==============================
    if (repetition_type === "Once") {
      ibadahInstances.push({
        id_ibadah: crypto.randomUUID(),
        jenis_kebaktian,
        sesi_ibadah,
        tanggal_ibadah: loopDate,
        weeklyEventId: newWeeklyEvent.id,
      });
    }

    // ==============================
    // WEEKLY
    // ==============================
    else if (repetition_type === "Weekly") {
      while (
        (!parsedEndDate || loopDate <= parsedEndDate) &&
        loopDate <= maxDate &&
        counter < 52
      ) {
        ibadahInstances.push({
          id_ibadah: crypto.randomUUID(),
          jenis_kebaktian,
          sesi_ibadah,
          tanggal_ibadah: new Date(loopDate),
          weeklyEventId: newWeeklyEvent.id,
        });

        loopDate.setDate(loopDate.getDate() + 7);
        counter++;
      }
    }

    // ==============================
    // MONTHLY
    // ==============================
    else if (repetition_type === "Monthly") {
      while (
        (!parsedEndDate || loopDate <= parsedEndDate) &&
        loopDate <= maxDate &&
        counter < 12
      ) {
        ibadahInstances.push({
          id_ibadah: crypto.randomUUID(),
          jenis_kebaktian,
          sesi_ibadah,
          tanggal_ibadah: new Date(loopDate),
          weeklyEventId: newWeeklyEvent.id,
        });

        loopDate.setMonth(loopDate.getMonth() + 1);
        counter++;
      }
    }

    if (ibadahInstances.length > 0) {
      await prisma.ibadah.createMany({
        data: ibadahInstances,
      });
    }

    return NextResponse.json(
      {
        message: `${repetition_type} Event created successfully`,
        weeklyEvent: newWeeklyEvent,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("❌ Error in POST /api/weekly-events:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==============================
// GET HANDLER
// ==============================
export async function GET() {
  try {
    const weeklyEvents = await prisma.weeklyEvent.findMany({
      include: {
        Ibadah: {
          select: {
            id_ibadah: true,
            tanggal_ibadah: true,
          },
          orderBy: {
            tanggal_ibadah: "asc",
          },
        },
      },
      orderBy: {
        start_date: "asc",
      },
    });

    return NextResponse.json(weeklyEvents);
  } catch (error: unknown) {
    console.error("❌ Error in GET /api/weekly-events:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
