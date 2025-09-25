import { Webhook as SvixWebhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    // proses webhook
    res.status(200).json({ ok: true });
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}


/** Prisma singleton (safety for dev hot-reload) */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ["error", "warn"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Minimal Clerk types (sesuaikan bila struktur payload Clerk-mu berbeda) */
interface ClerkEmailAddress { id: string; email_address: string; }
interface ClerkUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: ClerkEmailAddress[] | null;
  gender?: string | null; 
}
interface ClerkUserDeleted { id: string; }
type ClerkWebhookData = ClerkUser | ClerkUserDeleted;

/** Tiping minimum untuk svix webhook yang kita pakai */
type SvixVerifyHeaders = {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
};
interface ISvixWebhook {
  verify(payload: string, headers: SvixVerifyHeaders): unknown;
}

/** runtime guard sederhana untuk WebhookEvent dari Clerk */
function isWebhookEvent(v: unknown): v is WebhookEvent {
  if (typeof v !== "object" || v === null) return false;

  const obj = v as Record<string, unknown>;
  return typeof obj.type === "string" && "data" in obj;
}


/** Helper */
function fullName(u: ClerkUser) {
  return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
}
function primaryEmail(u: ClerkUser) {
  return u.email_addresses?.[0]?.email_address ?? "";
}

/** Route handler */
export async function POST(req: Request): Promise<Response> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) return new Response("Webhook secret not configured", { status: 500 });

  // Ambil headers (await supaya kompatibel dengan variasi typing di environment)
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Error occurred -- no svix headers", { status: 400 });
  }

  // Ambil body (unknown untuk menghindari implicit any)
  const payload = (await req.json()) as unknown;
  const body = JSON.stringify(payload);

  // Buat instance svix, beri tipe minimal supaya ESLint/TS tahu apa yang kita panggil
  const wh = new SvixWebhook(webhookSecret) as unknown as ISvixWebhook;

  let evt: WebhookEvent;
  try {
    const verified = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });

    // runtime-check sebelum cast ke typed WebhookEvent
    if (!isWebhookEvent(verified)) {
      console.error("svix.verify returned unexpected value:", verified);
      return new Response("Invalid webhook payload", { status: 400 });
    }

    evt = verified;
    } catch (err: unknown) {const error = err instanceof Error ? err : new Error(String(err));
        console.error("Error verifying webhook:", error.message);
        return new Response("Error verifying webhook", { status: 400 });
    }


  const eventType = evt.type;
  const eventData = evt.data as ClerkWebhookData;

  try {
    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const userData = eventData as ClerkUser;
        const email = primaryEmail(userData);
        const name = fullName(userData);
        const genderValue = userData.gender ?? "unknown"; // Menggunakan "unknown" jika tidak ada

        // NOTE: saya pakai cast ke Prisma.*Input untuk menghindari type-checking mismatch
        // Jika model Prisma-mu punya field unique selain 'clerkId', ganti di sini.
        await db.user.upsert({
          where: { clerkId: userData.id } as unknown as Prisma.UserWhereUniqueInput,
          update: {
            nama: name,
            email,
            gender: genderValue, // Menggunakan nilai yang diperbaiki
          } as unknown as Prisma.UserUpdateInput,
          create: {
            clerkId: userData.id,
            nama: name,
            email,
            gender: genderValue, // Menggunakan nilai yang diperbaiki
            jabatan: "Jemaat",
            isVerified: true,
            role: "user",
            tanggal_lahir: null, // Menggunakan null untuk tanggal_lahir yang opsional
          } as unknown as Prisma.UserCreateInput,
        });

        return NextResponse.json({ success: true, message: "Webhook received" }, { status: 200 });
      }

      case "user.deleted": {
        const deleted = eventData as ClerkUserDeleted;

        await db.user.delete({
          where: { clerkId: deleted.id } as unknown as Prisma.UserWhereUniqueInput,
        });

        return NextResponse.json({ success: true, message: "Webhook received" }, { status: 200 });
      }

      default:
        return new Response("Event not handled", { status: 200 });
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("DB / handler error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}