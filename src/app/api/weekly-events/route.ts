/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import type { WeeklyEvent } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ GET: Fetch all weekly events
export async function GET() {
  const events: WeeklyEvent[] = await prisma.weeklyEvent.findMany({
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json(events);
}

// ✅ POST: Create a new weekly event
export async function POST(req: Request) {
  const body = (await req.json()) as {
    nama_event: string;
    day_of_week: number;
    repeat_forever?: boolean;
    repeat_weeks?: number | null;
    start_date?: string;
  };

  const { nama_event, day_of_week, repeat_forever, repeat_weeks, start_date } = body;

  if (!nama_event || day_of_week === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const newEvent = await prisma.weeklyEvent.create({
    data: {
      nama_event,
      day_of_week: Number(day_of_week),
      repeat_forever: repeat_forever ?? true,
      repeat_weeks: repeat_weeks ?? null,
      start_date: start_date ? new Date(start_date) : new Date(),
    },
  });

  return NextResponse.json(newEvent, { status: 201 });
}

// ✅ PATCH: Update event name
export async function PATCH(req: Request) {
  const body = (await req.json()) as { id: string; nama_event: string };
  const { id, nama_event } = body;

  if (!id || !nama_event) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const updated = await prisma.weeklyEvent.update({
    where: { id },
    data: { nama_event },
  });

  return NextResponse.json(updated);
}

// ✅ DELETE: Delete event by ID
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.weeklyEvent.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}