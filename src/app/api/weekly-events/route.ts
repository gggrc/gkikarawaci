// src/app/api/weekly-events/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export const runtime = "nodejs";

const prisma = new PrismaClient();

// Inisialisasi Supabase Service Role Client
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

// Konstanta untuk batas perulangan (misalnya, 1 tahun ke depan)
const MAX_RECURRENCE_DAYS = 365;

/**
 * Logika utama untuk membuat event dan instance Ibadah terkait
 */
export async function POST(req: Request) {
    try {
        const body = await req.json() as {
            title: string;
            description?: string;
            jenis_kebaktian: string;
            sesi_ibadah: number;
            start_date: string;
            repetition_type: 'Once' | 'Weekly' | 'Monthly'; // ✅ now includes Monthly
            end_date?: string | null;
        };

        const { title, description, jenis_kebaktian, sesi_ibadah, start_date, repetition_type, end_date } = body;

        if (!title || !start_date || !jenis_kebaktian || !sesi_ibadah) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const parsedStartDate = new Date(start_date);
        const parsedEndDate = end_date ? new Date(end_date) : null;

        if (parsedEndDate && parsedEndDate <= parsedStartDate) {
            return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
        }

        // Create parent record
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

        const ibadahInstances = [];
        let loopDate = new Date(parsedStartDate);
        let counter = 0;
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + MAX_RECURRENCE_DAYS);

        if (repetition_type === 'Once') {
            ibadahInstances.push({
                id_ibadah: uuidv4(),
                jenis_kebaktian,
                sesi_ibadah,
                tanggal_ibadah: loopDate,
                weeklyEventId: newWeeklyEvent.id,
            });
        } 
        else if (repetition_type === 'Weekly') {
            while ((!parsedEndDate || loopDate <= parsedEndDate) && loopDate <= maxDate && counter < 52) {
                ibadahInstances.push({
                    id_ibadah: uuidv4(),
                    jenis_kebaktian,
                    sesi_ibadah,
                    tanggal_ibadah: new Date(loopDate),
                    weeklyEventId: newWeeklyEvent.id,
                });
                loopDate.setDate(loopDate.getDate() + 7);
                counter++;
            }
        }
        else if (repetition_type === 'Monthly') { // ✅ NEW LOGIC
            while ((!parsedEndDate || loopDate <= parsedEndDate) && loopDate <= maxDate && counter < 12) {
                ibadahInstances.push({
                    id_ibadah: uuidv4(),
                    jenis_kebaktian,
                    sesi_ibadah,
                    tanggal_ibadah: new Date(loopDate),
                    weeklyEventId: newWeeklyEvent.id,
                });
                // move to next month
                loopDate.setMonth(loopDate.getMonth() + 1);
                counter++;
            }
        }

        if (ibadahInstances.length > 0) {
            await prisma.ibadah.createMany({ data: ibadahInstances });
        }

        console.log(`✅ Created ${ibadahInstances.length} instances for ${repetition_type} event`);
        return NextResponse.json(
            { message: `${repetition_type} Event created successfully`, weeklyEvent: newWeeklyEvent },
            { status: 201 }
        );

    } catch (e: any) {
        console.error("❌ Error in POST /api/weekly-events:", e);
        return NextResponse.json({ error: e.message, details: e }, { status: 500 });
    }
}

// Handler GET, PUT, DELETE (jika ada)

// GET handler (contoh, untuk mengambil semua event)
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
                        tanggal_ibadah: 'asc'
                    }
                }
            },
            orderBy: {
                start_date: 'asc'
            }
        });
        return NextResponse.json(weeklyEvents);
    } catch (e) {
        console.error("Error in GET /api/weekly-events:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
