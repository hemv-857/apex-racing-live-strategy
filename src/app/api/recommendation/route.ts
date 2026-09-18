import { NextRequest, NextResponse } from "next/server";
import type { AlertData, PitStrategyOption, RaceSessionData } from "@/lib/racing/types";
import { buildStrategyRecommendations } from "@/lib/racing/history";

export const dynamic = "force-dynamic";

// POST /api/recommendation
// Body: { session: RaceSessionData, alerts: AlertData[], options: PitStrategyOption[] }
// Returns: StrategyRecommendation[] — one per RB driver, auto-suggested from live alerts.
export async function POST(req: NextRequest) {
  let body: { session: RaceSessionData; alerts: AlertData[]; options: PitStrategyOption[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }
  const recommendations = buildStrategyRecommendations({
    session: body.session,
    alerts: body.alerts ?? [],
    options: body.options ?? [],
  });
  return NextResponse.json({ recommendations });
}
