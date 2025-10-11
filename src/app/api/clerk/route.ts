import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserJSON } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";

// Prisma client singleton
declare global { var prisma: PrismaClient | undefined; }
const prisma = globalThis.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

// Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isUserEvent(data: unknown): data is UserJSON {
  if (!data || typeof data !== "object") return false;
  const user = data as UserJSON;
  return typeof user.id === "string" && Array.isArray(user.email_addresses);
}

function isDeletedUser(data: unknown): data is { id: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof (data as { id?: unknown }).id === "string"
  );
}

export async function POST(req: Request) {
  console.log("✅ Clerk webhook route triggered");
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) return new NextResponse("Missing Clerk webhook secret", { status: 500 });

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id") ?? "";
  const svix_timestamp = headerPayload.get("svix-timestamp") ?? "";
  const svix_signature = headerPayload.get("svix-signature") ?? "";

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse("Missing Svix headers", { status: 400 });
  }

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
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const { type: eventType, data: eventData } = evt;
  console.log("Webhook event verified:", eventType);

  try {
    if ((eventType === "user.created" || eventType === "user.updated") && isUserEvent(eventData)) {
      const userData = eventData;
      const id = userData.id;
      const firstName = userData.first_name ?? "";
      const lastName = userData.last_name ?? "";
      const email =
        userData.email_addresses && userData.email_addresses.length > 0
          ? userData.email_addresses[0].email_address
          : `noemail_${id}@placeholder.local`;

      const name = `${firstName} ${lastName}`.trim();
      const genderValue = "unknown"; // Clerk doesn't send gender by default

      await prisma.user.upsert({
        where: { clerkId: id },
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
        },
      });
    } else if (eventType === "user.deleted" && isDeletedUser(eventData)) {
      await prisma.user.delete({
        where: { clerkId: eventData.id },
      });
    }
  } catch (dbError: unknown) {
    const message = dbError instanceof Error ? dbError.message : "Unknown DB error";
    console.error(`Database operation failed for event ${eventType}:`, message);
    return new NextResponse("Database operation failed", { status: 500 });
  }
}
