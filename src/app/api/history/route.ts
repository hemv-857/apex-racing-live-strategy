import { NextRequest, NextResponse } from "next/server";
import { getLapHistoryAsync } from "@/lib/racing/history";
import { getSession } from "@/lib/racing/race-state";

export const dynamic = "force-dynamic";

// GET /api/history?sessionId=...&driverId=...
// Returns lap-by-lap history with sector times (DB-backed, survives restarts).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionIdParam = url.searchParams.get("sessionId");
  const driverId = url.searchParams.get("driverId") ?? undefined;
  const session = getSession();
  const sessionId = sessionIdParam ?? session.id;
  const history = await getLapHistoryAsync(sessionId, driverId);
  return NextResponse.json({ history, sessionId });
}
