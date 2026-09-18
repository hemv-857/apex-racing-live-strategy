import { NextRequest, NextResponse } from "next/server";
import type { RaceSessionData } from "@/lib/racing/types";
import { getTrack, getCalibration } from "@/lib/racing/data";
import { simulateRaceOutcomes } from "@/lib/racing/simulation-engine";

export const dynamic = "force-dynamic";

// POST /api/strategies
// Body: { session: RaceSessionData, driverId: string }
// Returns: PitStrategyOption[] for the given driver.
export async function POST(req: NextRequest) {
  let body: { session: RaceSessionData; driverId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session || !body?.driverId) {
    return NextResponse.json({ error: "Missing session or driverId" }, { status: 400 });
  }
  const track = getTrack(body.session.trackId);
  const calibration = getCalibration(track.id);
  const options = simulateRaceOutcomes({
    session: body.session,
    track,
    calibration,
    driverId: body.driverId,
    horizonLaps: 20,
  });
  return NextResponse.json({ options });
}
