import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserJSON } from "@clerk/nextjs/server";

// 🧠 Prisma client singleton
declare global {
  var prisma: PrismaClient | undefined;
}
const prisma = globalThis.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

// 🪄 Supabase client (not used here but available for future)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Type guards
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

// 🚀 Main webhook handler
export async function POST(req: Request) {
  console.log("✅ Clerk webhook route triggered");

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("❌ Missing Clerk webhook secret.");
    return new NextResponse("Missing Clerk webhook secret", { status: 500 });
  }

  // Extract headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id") ?? "";
  const svix_timestamp = headerPayload.get("svix-timestamp") ?? "";
  const svix_signature = headerPayload.get("svix-signature") ?? "";

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("❌ Missing Svix headers");
    return new NextResponse("Missing Svix headers", { status: 400 });
  }

  // Verify webhook
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
    console.error("❌ Webhook verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const { type: eventType, data: eventData } = evt;
  console.log("🔔 Webhook event verified:", eventType);

  try {
    // Handle user.created / user.updated
    if ((eventType === "user.created" || eventType === "user.updated") && isUserEvent(eventData)) {
      console.log("🧩 Processing user event:", eventData.id);

      const userData = eventData;
      const id = userData.id;
      const firstName = userData.first_name ?? "";
      const lastName = userData.last_name ?? "";
      const email =
        Array.isArray(userData.email_addresses) && userData.email_addresses.length > 0
          ? userData.email_addresses[0]?.email_address ?? `noemail_${id}@placeholder.local`
          : `noemail_${id}@placeholder.local`;
      const name = `${firstName} ${lastName}`.trim();
      const genderValue = "unknown";

      console.log("📝 Upserting user:", { id, name, email });

      await prisma.user.upsert({
        where: { clerkId: id },
        update: { nama: name, email, gender: genderValue },
        create: {
          clerkId: id,
          nama: name,
          email,
          gender: genderValue,
          jabatan: "Jemaat",
          role: "user",
          isVerified: true,
          tanggal_lahir: null,
        },
      });

      console.log("✅ User upsert successful");
    }

    // Handle user.deleted
    else if (eventType === "user.deleted" && isDeletedUser(eventData)) {
      console.log("🗑 Deleting user:", eventData.id);
      await prisma.user.delete({ where: { clerkId: eventData.id } });
      console.log("✅ User delete successful");
    }

    // Unknown event
    else {
      console.log("⚠️ Unhandled event type:", eventType);
    }

    return NextResponse.json({ success: true });
  } catch (dbError: unknown) {
    console.error("❌ Database operation failed:", dbError);
    const message =
      dbError instanceof Error ? dbError.message : JSON.stringify(dbError);
    return NextResponse.json(
      { error: "Database operation failed", details: message },
      { status: 500 }
    );
  }
}
