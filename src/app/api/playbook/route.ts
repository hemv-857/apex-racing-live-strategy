import { NextRequest, NextResponse } from "next/server";
import type { RaceSessionData, PostRaceAnalysisData } from "@/lib/racing/types";
import { buildPlaybooks } from "@/lib/racing/analysis";

export const dynamic = "force-dynamic";

// POST /api/playbook
// Body: { session: RaceSessionData, analysis: PostRaceAnalysisData }
// Returns: PlaybookData[] generated from session + analysis.
export async function POST(req: NextRequest) {
  let body: { session: RaceSessionData; analysis: PostRaceAnalysisData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.session || !body?.analysis) {
    return NextResponse.json({ error: "Missing session or analysis" }, { status: 400 });
  }
  const playbooks = buildPlaybooks({ session: body.session, analysis: body.analysis });
  return NextResponse.json({ playbooks });
}
