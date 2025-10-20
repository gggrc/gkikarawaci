export const runtime = "nodejs";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { UserJSON } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Type guards
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

// Main webhook handler
export async function POST(req: Request) {
  console.log("✅ Clerk webhook route triggered");

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET)
    return new NextResponse("Missing Clerk webhook secret", { status: 500 });

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id") ?? "";
  const svix_timestamp = headerPayload.get("svix-timestamp") ?? "";
  const svix_signature = headerPayload.get("svix-signature") ?? "";

  if (!svix_id || !svix_timestamp || !svix_signature)
    return new NextResponse("Missing Svix headers", { status: 400 });

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
    if (err instanceof Error) {
      console.error("❌ Webhook verification failed:", err.message);
    } else {
      console.error("❌ Webhook verification failed with unknown error:", err);
    }
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const { type: eventType, data: eventData } = evt;
  console.log("🔔 Webhook event verified:", eventType);

  try {
    if ((eventType === "user.created" || eventType === "user.updated") && isUserEvent(eventData)) {
      const userData = eventData;
      const id = userData.id;
      const name = `${userData.first_name ?? ""} ${userData.last_name ?? ""}`.trim();
      const email =
        userData.email_addresses?.[0]?.email_address ?? `noemail_${id}@placeholder.local`;

      await prisma.user.upsert({
        where: { clerkId: id },
        update: { nama: name, email },
        create: {
          clerkId: id,
          nama: name,
          email,
          role: "user",
          isVerified: "pending",
        },
      });

      console.log("✅ User upsert successful");
    } else if (eventType === "user.deleted" && isDeletedUser(eventData)) {
      const id = eventData.id;
      try {
        await prisma.user.delete({ where: { clerkId: id } });
        console.log(`🗑️ User ${id} deleted from DB`);
      } catch {
        console.warn(`⚠️ Tried to delete non-existent user ${id}, ignoring.`);
      }
    } else {
      console.log("⚠️ Unhandled event type:", eventType);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("❌ Database error:", err.message);
    } else {
      console.error("❌ Database error (unknown):", err);
    }
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
