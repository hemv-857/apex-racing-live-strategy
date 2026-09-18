import { NextRequest, NextResponse } from "next/server";
import type { RaceSessionData } from "@/lib/racing/types";
import { getTrack } from "@/lib/racing/data";
import { buildSimulationResult } from "@/lib/racing/simulation-engine";

export const dynamic = "force-dynamic";

// POST /api/simulation/run
// Body: { session: RaceSessionData, horizonLaps?: number }
// Returns: SimulationResult with strategy options + probabilities for both RB drivers.
export async function POST(req: NextRequest) {
  let body: { session: RaceSessionData; horizonLaps?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }
  const track = getTrack(body.session.trackId);
  const horizonLaps = body.horizonLaps ?? 20;
  const result = buildSimulationResult({
    session: body.session,
    track,
    horizonLaps,
  });
  return NextResponse.json({ result });
}
