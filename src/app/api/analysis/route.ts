import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RaceSessionData } from "@/lib/racing/types";
import { buildPostRaceAnalysis } from "@/lib/racing/analysis";

export const dynamic = "force-dynamic";

// POST /api/analysis
// Body: { session: RaceSessionData }
// Returns: PostRaceAnalysisData comparing actual vs STORED pre-race predictions.
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

  // Load stored predictions from DB
  const run = await db.predictionRun.findFirst({
    where: { sessionId: body.session.id },
    orderBy: { createdAt: "desc" },
  });
  const predicted = run?.predictions
    ? (JSON.parse(run.predictions) as { driverCode: string; position: number }[])
    : body.session.driverStates.map((d) => ({ driverCode: d.driverId, position: d.position }));

  const analysis = buildPostRaceAnalysis({
    session: body.session,
    predictedPositions: predicted,
  });
  return NextResponse.json({ analysis });
}
