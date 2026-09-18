import { NextRequest, NextResponse } from "next/server";
import type { RaceSessionData, WhatIfConfig } from "@/lib/racing/types";
import { getTrack } from "@/lib/racing/data";
import { simulateWhatIf } from "@/lib/racing/simulation-engine";

export const dynamic = "force-dynamic";

// POST /api/whatif
// Body: { session: RaceSessionData, config: WhatIfConfig, baselineOption?: PitStrategyOption }
// Returns: WhatIfResult with live-recomputed outcome + lap trace.
export async function POST(req: NextRequest) {
  let body: { session: RaceSessionData; config: WhatIfConfig; baselineOption?: any };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session || !body?.config) {
    return NextResponse.json({ error: "Missing session or config" }, { status: 400 });
  }
  const track = getTrack(body.session.trackId);
  const result = simulateWhatIf({
    session: body.session,
    track,
    config: body.config,
    baselineOption: body.baselineOption ?? null,
  });
  return NextResponse.json({ result });
}
