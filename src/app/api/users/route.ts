import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      // Initialize clerk client
      const client = await clerkClient();
      
      // Get user data
      const user = await client.users.getUser(userId);

      if (!user.id) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? null,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        imageUrl: user.imageUrl ?? null,
      });

    } catch (clerkError) {
      console.error("Clerk API Error:", clerkError);
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

  } catch (err) {
    console.error("Authentication error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}