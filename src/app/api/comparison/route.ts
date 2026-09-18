import { NextRequest, NextResponse } from "next/server";
import type { RaceSessionData } from "@/lib/racing/types";
import { getTrack } from "@/lib/racing/data";
import { buildStrategyComparison } from "@/lib/racing/simulation-engine";

export const dynamic = "force-dynamic";

// POST /api/comparison
// Body: { session: RaceSessionData, driverId: string, optionIds?: string[] }
// Returns: StrategyComparison with overlaid lap traces for charting.
export async function POST(req: NextRequest) {
  let body: { session: RaceSessionData; driverId: string; optionIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session || !body?.driverId) {
    return NextResponse.json({ error: "Missing session or driverId" }, { status: 400 });
  }
  const track = getTrack(body.session.trackId);
  const comparison = buildStrategyComparison({
    session: body.session,
    track,
    driverId: body.driverId,
    optionIds: body.optionIds,
  });
  return NextResponse.json({ comparison });
}
