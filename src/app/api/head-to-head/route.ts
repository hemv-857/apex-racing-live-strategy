import { NextRequest, NextResponse } from "next/server";
import { buildHeadToHead } from "@/lib/racing/history";
import { getSession } from "@/lib/racing/race-state";

export const dynamic = "force-dynamic";

// GET /api/head-to-head?driverAId=...&driverBId=...
// Returns head-to-head comparison between two drivers.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverAId = url.searchParams.get("driverAId");
  const driverBId = url.searchParams.get("driverBId");
  if (!driverAId || !driverBId) {
    return NextResponse.json({ error: "Missing driverAId or driverBId" }, { status: 400 });
  }
  const session = getSession();
  const comparison = buildHeadToHead({ session, driverAId, driverBId });
  if (!comparison) {
    return NextResponse.json({ error: "Could not build comparison" }, { status: 404 });
  }
  return NextResponse.json({ comparison });
}
