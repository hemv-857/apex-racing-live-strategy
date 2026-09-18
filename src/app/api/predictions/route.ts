import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RaceSessionData } from "@/lib/racing/types";

export const dynamic = "force-dynamic";

// POST /api/predictions
// Body: { session: RaceSessionData, predictions: { driverCode, position }[], recommendedOptionId?: string }
// Stores pre-race predictions for accuracy tracking
export async function POST(req: NextRequest) {
  let body: {
    session: RaceSessionData;
    predictions: { driverCode: string; position: number }[];
    recommendedOptionId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session || !body?.predictions) {
    return NextResponse.json({ error: "Missing session or predictions" }, { status: 400 });
  }

  try {
    await db.predictionRun.create({
      data: {
        sessionId: body.session.id,
        predictions: JSON.stringify(body.predictions),
        recommendedOptionId: body.recommendedOptionId ?? null,
      },
    });
    return NextResponse.json({ stored: true });
  } catch {
    return NextResponse.json({ error: "Failed to store predictions" }, { status: 500 });
  }
}

// GET /api/predictions?sessionId=...
// Returns stored predictions for a session
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const run = await db.predictionRun.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    if (!run) {
      return NextResponse.json({ predictions: null });
    }
    const predictions = JSON.parse(run.predictions) as { driverCode: string; position: number }[];
    return NextResponse.json({ predictions, recommendedOptionId: run.recommendedOptionId });
  } catch {
    return NextResponse.json({ error: "Failed to load predictions" }, { status: 500 });
  }
}