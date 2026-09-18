import { NextRequest, NextResponse } from "next/server";
import type { RaceSessionData } from "@/lib/racing/types";
import { getTrack } from "@/lib/racing/data";
import { generateAlerts } from "@/lib/racing/alerts";

export const dynamic = "force-dynamic";

// POST /api/alerts
// Body: { session: RaceSessionData }
// Returns: AlertData[] rules-based alerts.
export async function POST(req: NextRequest) {
  let body: { session: RaceSessionData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }
  const track = getTrack(body.session.trackId);
  const alerts = generateAlerts({ session: body.session, track });
  return NextResponse.json({ alerts });
}
