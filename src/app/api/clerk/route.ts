// src/app/api/clerk/route.ts
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { UserJSON } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";

// --- START: PRISMA CLIENT SINGLETON FIX ---
declare global {
  var prisma: PrismaClient | undefined;
}
const prisma = globalThis.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
// --- END: PRISMA CLIENT SINGLETON FIX ---

// Helper: cek apakah data event adalah user lengkap
function isUserEvent(data: unknown): data is UserJSON {
  if (!data || typeof data !== "object") return false;
  const user = data as UserJSON;
  return typeof user.id === "string" && Array.isArray(user.email_addresses);
}

// Helper: cek user deleted
function isDeletedUser(data: unknown): data is { id: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof (data as { id?: unknown }).id === "string"
  );
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set.");
    return new NextResponse("Missing Clerk webhook secret", { status: 500 });
  }

  // Ambil headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id") ?? "";
  const svix_timestamp = headerPayload.get("svix-timestamp") ?? "";
  const svix_signature = headerPayload.get("svix-signature") ?? "";

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse("Missing Svix headers", { status: 400 });
  }

  // Ambil body
  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook verification failed:", message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // Destructuring evt setelah berhasil verifikasi
  const { type: eventType, data: eventData } = evt;
  console.log("Webhook event verified:", eventType, eventData);

  try {
    // user.created / user.updated
    if ((eventType === "user.created" || eventType === "user.updated") && isUserEvent(eventData)) {
      const userData = eventData as UserJSON & { gender?: string | null };
      const { id, first_name, last_name, email_addresses, gender } = userData;

      const email = email_addresses?.[0]?.email_address ?? "";
      const name = `${first_name ?? ""} ${last_name ?? ""}`.trim();
      const genderValue = gender ?? "unknown";

      await prisma.user.upsert({
        where: { clerkId: id } as Prisma.UserWhereUniqueInput,
        update: {
          nama: name,
          email: email,
          gender: genderValue,
        },
        create: {
          clerkId: id,
          nama: name,
          email: email,
          gender: genderValue,
          jabatan: "Jemaat",
          role: "user",
          isVerified: true,
          tanggal_lahir: null,
        } as Prisma.UserCreateInput,
      });
    }
    // user.deleted
    else if (eventType === "user.deleted" && isDeletedUser(eventData)) {
      await prisma.user.delete({
        where: { clerkId: eventData.id },
      });
    }
  } catch (dbError: unknown) {
    const message = dbError instanceof Error ? dbError.message : "Unknown DB error";
    console.error(`Database operation failed for event ${eventType}:`, message);
    return new NextResponse("Database operation failed", { status: 500 });
  }

  return NextResponse.json({ success: true });
}