import { NextRequest, NextResponse } from "next/server";
import { resetSession } from "@/lib/racing/race-state";

export const dynamic = "force-dynamic";

// POST /api/race/reset — reset the in-process session (optionally to a new track).
export async function POST(req: NextRequest) {
  let body: { trackId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const session = resetSession(body.trackId);
  return NextResponse.json({ session });
}
