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
            repetition_type: 'Once' | 'Weekly'; // New field
            end_date?: string | null; // New field
        };

        const { title, description, jenis_kebaktian, sesi_ibadah, start_date, repetition_type, end_date } = body;

        // 1. Validasi Input
        if (!title || !start_date || !jenis_kebaktian || !sesi_ibadah) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        
        const parsedStartDate = new Date(start_date);
        const parsedEndDate = end_date ? new Date(end_date) : null;

        if (parsedEndDate && parsedEndDate <= parsedStartDate) {
            return NextResponse.json({ error: "End date must be after start date for recurring events." }, { status: 400 });
        }

        // 2. Buat entri di WeeklyEvent (Parent Event)
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

        // 3. Buat entri di Ibadah (Event Instances)
        const ibadahInstances: {
            id_ibadah: string;
            jenis_kebaktian: string;
            sesi_ibadah: number;
            tanggal_ibadah: Date;
            weeklyEventId: string;
        }[] = [];

        let currentDate = parsedStartDate;
        let counter = 0;

        if (repetition_type === 'Once') {
            // Event Satu Kali: hanya buat 1 entri Ibadah
            ibadahInstances.push({
                id_ibadah: uuidv4(),
                jenis_kebaktian,
                sesi_ibadah,
                tanggal_ibadah: currentDate,
                weeklyEventId: newWeeklyEvent.id,
            });

        } else if (repetition_type === 'Weekly') {
            // Event Periodik Mingguan
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + MAX_RECURRENCE_DAYS); // Batas 1 tahun

            let loopDate = new Date(parsedStartDate.getTime());

            while (
                (!parsedEndDate || loopDate <= parsedEndDate) && 
                loopDate <= maxDate &&
                counter < 52 // Max 52 instances (1 year)
            ) {
                ibadahInstances.push({
                    id_ibadah: uuidv4(),
                    jenis_kebaktian,
                    sesi_ibadah,
                    tanggal_ibadah: new Date(loopDate.getTime()), // Salin tanggal
                    weeklyEventId: newWeeklyEvent.id,
                });

                // Lanjut ke minggu berikutnya
                loopDate.setDate(loopDate.getDate() + 7);
                counter++;
            }
        }
        
        if (ibadahInstances.length > 0) {
            await prisma.ibadah.createMany({
                data: ibadahInstances,
            });
        }


        console.log(`Successfully created WeeklyEvent and ${ibadahInstances.length} Ibadah instances.`);
        return NextResponse.json(
            { message: "Weekly Event and Ibadah instances created successfully", weeklyEvent: newWeeklyEvent }, 
            { status: 201 }
        );

    } catch (e) {
        console.error("Error in POST /api/weekly-events:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
