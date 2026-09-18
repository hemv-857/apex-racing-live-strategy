import { NextRequest, NextResponse } from "next/server";
import { getPaceChangesAsync, recordPaceChange } from "@/lib/racing/history";
import { DRIVERS } from "@/lib/racing/data";
import { getSession, setDriverPace } from "@/lib/racing/race-state";
import type { PaceMode } from "@/lib/racing/types";

export const dynamic = "force-dynamic";

// GET /api/pace-log?sessionId=... — returns pace change history (DB-backed)
// POST /api/pace-log — records a pace change { driverCode, fromPace, toPace, reason? }
//   and mutates the in-process session so REST-mode pace calls take effect.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionIdParam = url.searchParams.get("sessionId");
  const session = getSession();
  const sessionId = sessionIdParam ?? session.id;
  const changes = await getPaceChangesAsync(sessionId);
  return NextResponse.json({ changes, sessionId });
}

export async function POST(req: NextRequest) {
  let body: { driverCode: string; fromPace: PaceMode; toPace: PaceMode; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.driverCode || !body?.fromPace || !body?.toPace) {
    return NextResponse.json({ error: "Missing driverCode, fromPace, or toPace" }, { status: 400 });
  }
  const session = getSession();
  const driver = DRIVERS.find((d) => d.code === body.driverCode);
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }
  const driverState = session.driverStates.find((ds) => ds.driverId === driver.id);
  const applied = setDriverPace(body.driverCode, body.toPace);
  recordPaceChange({
    sessionId: session.id,
    driverCode: body.driverCode,
    driverName: driver.name,
    fromPace: body.fromPace,
    toPace: body.toPace,
    lap: session.currentLap,
    position: driverState?.position ?? 0,
    reason: body.reason,
  });
  const changes = await getPaceChangesAsync(session.id);
  return NextResponse.json({ changes, recorded: true, applied });
}
