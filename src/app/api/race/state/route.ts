import { NextResponse } from "next/server";
import { getSession } from "@/lib/racing/race-state";

export const dynamic = "force-dynamic";

// GET /api/race/state — returns the in-process live race session (REST fallback).
export async function GET() {
  const session = getSession();
  return NextResponse.json({ session });
}
