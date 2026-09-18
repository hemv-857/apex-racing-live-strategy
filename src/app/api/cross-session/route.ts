import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DRIVERS, TRACKS } from "@/lib/racing/data";

export const dynamic = "force-dynamic";

// GET /api/cross-session?driverId=...
// Returns lap times for a driver across all sessions (for cross-session comparison).
// Now uses trackId from LapHistory for accurate track identification.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get("driverId");

  try {
    // Get all distinct sessionIds with their trackIds from LapHistory
    const allRows = await db.lapHistory.findMany({
      where: driverId ? { driverId } : {},
      select: { sessionId: true, trackId: true, lap: true },
    });
    // group by sessionId -> trackId
    const sessionMap = new Map<string, string>();
    for (const r of allRows) {
      if (!sessionMap.has(r.sessionId)) {
        sessionMap.set(r.sessionId, r.trackId);
      }
    }
    const sessionIds = Array.from(sessionMap.keys()).slice(0, 6);

    // For each session, get lap times for the driver
    const sessionsData = await Promise.all(
      sessionIds.map(async (sessionId) => {
        const laps = await db.lapHistory.findMany({
          where: { sessionId, ...(driverId ? { driverId } : {}) },
          orderBy: { lap: "asc" },
        });
        const trackId = sessionMap.get(sessionId) ?? "suzuka";
        const track = TRACKS.find((t) => t.id === trackId);
        return {
          sessionId,
          trackId,
          trackName: track?.name.split(" ")[0] ?? trackId,
          laps: laps.map((l) => ({
            lap: l.lap,
            lapTimeSec: l.lapTimeSec,
            driverCode: DRIVERS.find((d) => d.id === l.driverId)?.code ?? l.driverId,
            compound: l.compound,
          })),
        };
      })
    );

    return NextResponse.json({ sessions: sessionsData, driverId });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch cross-session data", sessions: [] }, { status: 200 });
  }
}
