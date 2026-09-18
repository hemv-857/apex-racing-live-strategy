import { NextResponse } from "next/server";
import { getChampionshipTimelineAsync } from "@/lib/racing/history";
import { getSession } from "@/lib/racing/race-state";

export const dynamic = "force-dynamic";

// GET /api/timeline
// Returns: ChampionshipTimeline — cumulative points per driver across rounds (DB-backed).
export async function GET() {
  const session = getSession();
  const timeline = await getChampionshipTimelineAsync({ currentSession: session });
  return NextResponse.json({ timeline });
}
