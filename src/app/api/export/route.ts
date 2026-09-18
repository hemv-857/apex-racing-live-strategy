import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DRIVERS, TRACKS } from "@/lib/racing/data";

export const dynamic = "force-dynamic";

// GET /api/export?format=csv|json&type=laps|pace|championship|all&driverId=...&trackId=...
// Exports telemetry data as CSV or JSON for external analysis. Supports driver + track filters.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";
  const type = url.searchParams.get("type") ?? "all";
  const driverFilter = url.searchParams.get("driverId");
  const trackFilter = url.searchParams.get("trackId");

  try {
    const data: Record<string, any> = {};

    if (type === "laps" || type === "all") {
      const where: any = {};
      if (driverFilter) where.driverId = driverFilter;
      if (trackFilter) where.trackId = trackFilter;
      const laps = await db.lapHistory.findMany({ where, orderBy: [{ sessionId: "asc" }, { lap: "asc" }] });
      data.laps = laps.map((l) => {
        const driver = DRIVERS.find((d) => d.id === l.driverId);
        const track = TRACKS.find((t) => t.id === l.trackId);
        return {
          sessionId: l.sessionId,
          track: track?.name.split(" ")[0] ?? l.trackId,
          driverCode: driver?.code ?? l.driverId,
          driverName: driver?.name ?? l.driverId,
          team: driver?.team ?? "",
          lap: l.lap,
          position: l.position,
          lapTimeSec: l.lapTimeSec,
          compound: l.compound,
          tireAgeLaps: l.tireAgeLaps,
          tireWearPct: l.tireWearPct,
          fuelKg: l.fuelKg,
          pitThisLap: l.pitThisLap,
          paceMode: l.paceMode,
          s1: l.s1,
          s2: l.s2,
          s3: l.s3,
          weather: l.weather,
          recordedAt: l.recordedAt.toISOString(),
        };
      });
    }

    if (type === "pace" || type === "all") {
      const paceWhere: any = {};
      if (driverFilter) {
        const drv = DRIVERS.find((d) => d.id === driverFilter);
        if (drv) paceWhere.driverCode = drv.code;
      }
      const changes = await db.paceChange.findMany({ where: paceWhere, orderBy: { timestamp: "asc" } });
      data.paceChanges = changes.map((c) => ({
        sessionId: c.sessionId,
        driverCode: c.driverCode,
        driverName: c.driverName,
        fromPace: c.fromPace,
        toPace: c.toPace,
        lap: c.lap,
        position: c.position,
        reason: c.reason,
        timestamp: c.timestamp.toISOString(),
      }));
    }

    if (type === "championship" || type === "all") {
      const champWhere: any = {};
      if (trackFilter) champWhere.trackId = trackFilter;
      const rounds = await db.championshipRound.findMany({ where: champWhere, orderBy: { round: "asc" } });
      data.championshipRounds = rounds.map((r) => ({
        trackId: r.trackId,
        round: r.round,
        results: JSON.parse(r.results),
        recordedAt: r.recordedAt.toISOString(),
      }));
    }

    if (format === "json") {
      return NextResponse.json(data, {
        headers: {
          "Content-Disposition": `attachment; filename="racing-bulls-export-${type}.json"`,
        },
      });
    }

    // CSV format
    const csvParts: string[] = [];
    for (const [key, rows] of Object.entries(data)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      csvParts.push(`\n# ${key}`);
      const headers = Object.keys(rows[0]);
      csvParts.push(headers.join(","));
      for (const row of rows) {
        csvParts.push(headers.map((h) => {
          const v = row[h];
          if (typeof v === "string" && v.includes(",")) return `"${v.replace(/"/g, '""')}"`;
          if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
          return String(v ?? "");
        }).join(","));
      }
    }

    const csv = csvParts.join("\n") || "No data available";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="racing-bulls-export-${type}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
