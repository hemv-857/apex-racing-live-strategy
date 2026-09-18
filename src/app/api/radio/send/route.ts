import { NextRequest, NextResponse } from "next/server";
import type { RadioCall } from "@/lib/racing/types";

export const dynamic = "force-dynamic";

// POST /api/radio/send
// Body: RadioCall (without id/createdAt/status, which are assigned)
// Records the radio call. The WebSocket service handles the live radio protocol;
// this endpoint persists a record and returns the full call.
export async function POST(req: NextRequest) {
  let body: Partial<RadioCall>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.driverCode || !body?.message) {
    return NextResponse.json({ error: "Missing driverCode or message" }, { status: 400 });
  }
  const call: RadioCall = {
    id: "rc_" + Math.random().toString(36).slice(2, 11),
    sessionId: body.sessionId ?? "unknown",
    driverCode: body.driverCode,
    driverName: body.driverName ?? body.driverCode,
    message: body.message,
    strategyRef: body.strategyRef,
    status: "queued",
    priority: body.priority ?? "normal",
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json({ call });
}
