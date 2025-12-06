import { NextResponse } from 'next/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Add an exported function for an HTTP method, for example, a GET handler.
// This makes the file a valid Next.js Route Handler.
export async function GET() {
  return NextResponse.json({ 
    message: "API Route Handler is running successfully.",
    runtime: runtime, 
    dynamic: dynamic 
  });
}