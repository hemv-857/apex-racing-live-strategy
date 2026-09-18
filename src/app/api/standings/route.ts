import { NextResponse } from "next/server";
import { getChampionshipStandingsAsync } from "@/lib/racing/history";
import { getSession } from "@/lib/racing/race-state";

export const dynamic = "force-dynamic";

// GET /api/standings
// Returns championship standings including live in-progress race projection (DB-backed).
export async function GET() {
  const session = getSession();
  const standings = await getChampionshipStandingsAsync({ currentSession: session });
  return NextResponse.json({ standings, liveRound: session.trackId });
}
