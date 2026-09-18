import { NextResponse } from "next/server";
import { tickSession } from "@/lib/racing/race-state";

export const dynamic = "force-dynamic";

// POST /api/race/tick — REST fallback: returns current session state.
// The authoritative tick runs server-side via setInterval in race-state.ts.
export async function POST() {
  const session = tickSession();
  return NextResponse.json({ session });
}
