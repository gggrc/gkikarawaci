import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new NextResponse("Missing Clerk webhook secret", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id") ?? "";
  const svix_timestamp = headerPayload.get("svix-timestamp") ?? "";
  const svix_signature = headerPayload.get("svix-signature") ?? "";

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  const payload = (await req.json()) as WebhookEvent;
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // Handle Clerk events
  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, first_name, last_name, email_addresses } = evt.data;
    const email = email_addresses?.[0]?.email_address ?? "";
    const name = `${first_name ?? ""} ${last_name ?? ""}`.trim();

    await prisma.user.upsert({
      where: { clerkId: id },
      update: { nama: name, email },
      create: {
        clerkId: id,
        nama: name,
        email,
        jabatan: "Jemaat",
        role: "user",
        isVerified: true,
      },
    });
  }

  function isDeletedUser(data: unknown): data is { id: string } {
  return typeof data === "object" && data !== null && "id" in data;
}

if (evt.type === "user.deleted" && isDeletedUser(evt.data)) {
  await prisma.user.delete({
    where: { clerkId: evt.data.id },
  });
}


  return NextResponse.json({ success: true });
}
