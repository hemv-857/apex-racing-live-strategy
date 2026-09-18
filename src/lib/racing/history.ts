// Sector timing + lap history + championship standings engine.
// Splits a lap time into S1/S2/S3 using track sector fractions, with
// per-driver variation, and persists lap history for charts and head-to-head.

import type { Compound, LapHistoryEntry, PaceMode, PaceChangeEntry, SectorTimes, Weather, ChampionshipTimeline, StrategyRecommendation, AlertData } from "./types";
import { DRIVERS, getTrack, TRACKS } from "./data";
import type { RaceSessionData } from "./types";
import { db } from "@/lib/db";

// In-memory lap history store keyed by sessionId
const historyStore = new Map<string, LapHistoryEntry[]>();

// In-memory pace change log keyed by sessionId
const paceChangeStore = new Map<string, PaceChangeEntry[]>();

// Track which sessions have been loaded from DB to avoid repeated loads
const loadedFromDb = new Set<string>();

function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// Deterministic per-driver sector bias derived from driver id hash
function sectorBias(driverId: string, sectorIdx: number): number {
  let h = 0;
  for (let i = 0; i < driverId.length; i++) h = (h * 31 + driverId.charCodeAt(i)) >>> 0;
  // bias in range -0.3 .. +0.3 per sector
  const v = ((h >> (sectorIdx * 4)) & 0xf) / 0xf; // 0..1
  return round((v - 0.5) * 0.6, 3);
}

// Track sector fractions define relative length of S1/S2/S3.
// Time is distributed by sector length with driver bias + small noise.
export function computeSectors(opts: {
  lapTimeSec: number;
  trackId: string;
  driverId: string;
  sectors: [number, number, number];
}): SectorTimes {
  const { lapTimeSec, trackId, driverId, sectors } = opts;
  // sector fractions e.g. [0.36, 0.68, 1.0] -> lengths [0.36, 0.32, 0.32]
  const s1Frac = sectors[0];
  const s2Frac = sectors[1] - sectors[0];
  const s3Frac = 1 - sectors[1];
  const bias1 = sectorBias(driverId + trackId, 0);
  const bias2 = sectorBias(driverId + trackId, 1);
  const bias3 = sectorBias(driverId + trackId, 2);
  const noise = () => (Math.random() - 0.5) * 0.15;
  const s1 = round(lapTimeSec * s1Frac + bias1 + noise(), 3);
  const s2 = round(lapTimeSec * s2Frac + bias2 + noise(), 3);
  const s3 = round(lapTimeSec * s3Frac + bias3 + noise(), 3);
  return { s1, s2, s3 };
}

// Mark purple (fastest) sectors per lap across the field
export function markPurpleSectors(entries: LapHistoryEntry[]): void {
  if (entries.length === 0) return;
  const bestS1 = Math.min(...entries.map((e) => e.sectors.s1));
  const bestS2 = Math.min(...entries.map((e) => e.sectors.s2));
  const bestS3 = Math.min(...entries.map((e) => e.sectors.s3));
  for (const e of entries) {
    e.sectors.s1Purple = Math.abs(e.sectors.s1 - bestS1) < 0.001;
    e.sectors.s2Purple = Math.abs(e.sectors.s2 - bestS2) < 0.001;
    e.sectors.s3Purple = Math.abs(e.sectors.s3 - bestS3) < 0.001;
  }
}

// Record a lap for every driver after a tick
export function recordLapHistory(opts: {
  session: RaceSessionData;
  pitThisLapByDriver: Record<string, boolean>;
}): LapHistoryEntry[] {
  const { session, pitThisLapByDriver } = opts;
  const track = getTrack(session.trackId);
  const list = historyStore.get(session.id) ?? [];
  const newEntries: LapHistoryEntry[] = [];
  for (const ds of session.driverStates) {
    if (ds.retired) continue;
    const driver = DRIVERS.find((d) => d.id === ds.driverId)!;
    if (ds.lastLapSec === null) continue;
    // skip if already recorded for this lap
    const existing = list.find((e) => e.driverId === ds.driverId && e.lap === ds.lap);
    if (existing) continue;
    const sectors = computeSectors({
      lapTimeSec: ds.lastLapSec,
      trackId: session.trackId,
      driverId: ds.driverId,
      sectors: track.sectors,
    });
    const entry: LapHistoryEntry = {
      sessionId: session.id,
      trackId: session.trackId,
      driverId: ds.driverId,
      driverCode: driver.code,
      lap: ds.lap,
      position: ds.position,
      lapTimeSec: ds.lastLapSec,
      compound: ds.tireCompound,
      tireAgeLaps: ds.tireAgeLaps,
      tireWearPct: ds.tireWearPct,
      fuelKg: ds.fuelKg,
      pitThisLap: pitThisLapByDriver[ds.driverId] ?? false,
      paceMode: ds.paceMode,
      sectors,
      weather: session.weather,
      recordedAt: new Date().toISOString(),
    };
    list.push(entry);
    newEntries.push(entry);
  }
  // mark purple across the whole session history
  markPurpleSectors(list);
  historyStore.set(session.id, list);

  // fire-and-forget DB persistence (non-blocking)
  if (newEntries.length > 0) {
    persistLapHistoryToDb(newEntries).catch(() => {});
  }

  return newEntries;
}

// Persist lap history entries to Prisma (non-blocking, fire-and-forget)
async function persistLapHistoryToDb(entries: LapHistoryEntry[]): Promise<void> {
  try {
    for (const e of entries) {
      await db.lapHistory.upsert({
        where: {
          sessionId_driverId_lap: {
            sessionId: e.sessionId,
            driverId: e.driverId,
            lap: e.lap,
          },
        },
        update: {},
        create: {
          sessionId: e.sessionId,
          trackId: e.trackId,
          driverId: e.driverId,
          lap: e.lap,
          position: e.position,
          lapTimeSec: e.lapTimeSec,
          compound: e.compound,
          tireAgeLaps: e.tireAgeLaps,
          tireWearPct: e.tireWearPct,
          fuelKg: e.fuelKg,
          pitThisLap: e.pitThisLap,
          paceMode: e.paceMode,
          s1: e.sectors.s1,
          s2: e.sectors.s2,
          s3: e.sectors.s3,
          weather: e.weather,
        },
      });
    }
  } catch {
    // DB persistence is best-effort; in-memory store is primary
  }
}

// Load lap history from DB (used when in-memory store is empty, e.g. after restart)
async function loadLapHistoryFromDb(sessionId: string): Promise<LapHistoryEntry[]> {
  try {
    const rows = await db.lapHistory.findMany({
      where: { sessionId },
      orderBy: { lap: "asc" },
    });
    const entries: LapHistoryEntry[] = rows.map((r) => {
      const driver = DRIVERS.find((d) => d.id === r.driverId);
      return {
        sessionId: r.sessionId,
        trackId: r.trackId,
        driverId: r.driverId,
        driverCode: driver?.code ?? r.driverId,
        lap: r.lap,
        position: r.position,
        lapTimeSec: r.lapTimeSec,
        compound: r.compound as Compound,
        tireAgeLaps: r.tireAgeLaps,
        tireWearPct: r.tireWearPct,
        fuelKg: r.fuelKg,
        pitThisLap: r.pitThisLap,
        paceMode: r.paceMode as PaceMode,
        sectors: { s1: r.s1, s2: r.s2, s3: r.s3 },
        weather: r.weather as Weather,
        recordedAt: r.recordedAt.toISOString(),
      };
    });
    return entries;
  } catch {
    return [];
  }
}

export function getLapHistory(sessionId: string, driverId?: string): LapHistoryEntry[] {
  const list = historyStore.get(sessionId) ?? [];
  if (driverId) return list.filter((e) => e.driverId === driverId);
  return list;
}

// Async version: loads from DB if in-memory store is empty (survives restarts)
export async function getLapHistoryAsync(sessionId: string, driverId?: string): Promise<LapHistoryEntry[]> {
  let list = historyStore.get(sessionId);
  if (!list && !loadedFromDb.has(sessionId)) {
    loadedFromDb.add(sessionId);
    list = await loadLapHistoryFromDb(sessionId);
    if (list.length > 0) {
      markPurpleSectors(list);
      historyStore.set(sessionId, list);
    }
  }
  const finalList = list ?? [];
  if (driverId) return finalList.filter((e) => e.driverId === driverId);
  return finalList;
}

export function clearLapHistory(sessionId: string) {
  historyStore.delete(sessionId);
}

// ---- Head-to-head ----
export function buildHeadToHead(opts: {
  session: RaceSessionData;
  driverAId: string;
  driverBId: string;
}): import("./types").HeadToHeadComparison | null {
  const { session, driverAId, driverBId } = opts;
  const driverA = DRIVERS.find((d) => d.id === driverAId);
  const driverB = DRIVERS.find((d) => d.id === driverBId);
  if (!driverA || !driverB) return null;
  const histA = getLapHistory(session.id, driverAId);
  const histB = getLapHistory(session.id, driverBId);
  const maxLap = Math.max(
    histA.length > 0 ? histA[histA.length - 1].lap : 0,
    histB.length > 0 ? histB[histB.length - 1].lap : 0
  );
  const laps: import("./types").HeadToHeadComparison["laps"] = [];
  let lapsAheadA = 0;
  let lapsAheadB = 0;
  let totalDelta = 0;
  let countedLaps = 0;
  for (let l = 1; l <= maxLap; l++) {
    const a = histA.find((e) => e.lap === l);
    const b = histB.find((e) => e.lap === l);
    if (!a || !b) continue;
    const delta = round(a.lapTimeSec - b.lapTimeSec, 3);
    if (delta < 0) lapsAheadA++;
    else if (delta > 0) lapsAheadB++;
    totalDelta += delta;
    countedLaps++;
    laps.push({
      lap: l,
      timeA: a.lapTimeSec,
      timeB: b.lapTimeSec,
      delta,
      sectorsA: a.sectors,
      sectorsB: b.sectors,
    });
  }
  const avgDelta = countedLaps > 0 ? round(totalDelta / countedLaps, 3) : 0;
  // race gap = avg delta * laps counted
  const raceGapSec = round(avgDelta * countedLaps, 2);
  // qualifying gap: position diff at lap 1
  const aState = session.driverStates.find((s) => s.driverId === driverAId);
  const bState = session.driverStates.find((s) => s.driverId === driverBId);
  const qualifyingGap =
    aState && bState
      ? round((aState.position - bState.position) * 0.15, 3)
      : 0;
  const winnerCode = lapsAheadA === lapsAheadB ? null : lapsAheadA > lapsAheadB ? driverA.code : driverB.code;
  return {
    driverA: { driverId: driverA.id, code: driverA.code, name: driverA.name, teamColor: driverA.teamColor },
    driverB: { driverId: driverB.id, code: driverB.code, name: driverB.name, teamColor: driverB.teamColor },
    laps,
    summary: {
      avgDelta,
      lapsAheadA,
      lapsAheadB,
      qualifyingGap,
      raceGapSec,
      winnerCode,
    },
  };
}

// ---- Championship standings ----

// F1-style points: 25-18-15-12-10-8-6-4-2-1 + 1 for fastest lap (if top 10)
const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Seed a few prior rounds so the standings are interesting at race start
const SEED_ROUNDS: { trackId: string; positions: string[] }[] = [
  {
    trackId: "monza",
    // driverIds in finishing order P1..P8
    positions: ["drv-mv", "drv-ts", "drv-jc", "drv-lr", "drv-ak", "drv-nh", "drv-rf", "drv-ep"],
  },
  {
    trackId: "silverstone",
    positions: ["drv-ts", "drv-mv", "drv-jc", "drv-ak", "drv-lr", "drv-nh", "drv-ep", "drv-rf"],
  },
];

let championshipSeeded = false;
const championshipStore: { trackId: string; round: number; results: { driverId: string; position: number; points: number }[] }[] = [];

function seedChampionship() {
  if (championshipSeeded) return;
  championshipSeeded = true;
  for (let i = 0; i < SEED_ROUNDS.length; i++) {
    const r = SEED_ROUNDS[i];
    const results = r.positions.map((driverId, pos) => ({
      driverId,
      position: pos + 1,
      points: POINTS_TABLE[pos] ?? 0,
    }));
    championshipStore.push({
      trackId: r.trackId,
      round: i + 1,
      results,
    });
    // fire-and-forget DB persistence for seed rounds
    persistChampionshipRoundToDb(r.trackId, i + 1, results).catch(() => {});
  }
}

async function persistChampionshipRoundToDb(trackId: string, round: number, results: { driverId: string; position: number; points: number }[]): Promise<void> {
  try {
    await db.championshipRound.upsert({
      where: { trackId_round: { trackId, round } },
      update: {},
      create: {
        trackId,
        round,
        results: JSON.stringify(results),
      },
    });
  } catch {
    // best-effort
  }
}

async function loadChampionshipRoundsFromDb(): Promise<{ trackId: string; round: number; results: { driverId: string; position: number; points: number }[] }[]> {
  try {
    const rows = await db.championshipRound.findMany({
      orderBy: { round: "asc" },
    });
    return rows.map((r) => ({
      trackId: r.trackId,
      round: r.round,
      results: JSON.parse(r.results) as { driverId: string; position: number; points: number }[],
    }));
  } catch {
    return [];
  }
}

export async function recordChampionshipRound(opts: {
  session: RaceSessionData;
}): Promise<void> {
  // record current race's results when finished
  if (opts.session.status !== "finished") return;
  
  // Check DB first to avoid duplicate rounds after restart
  const existingDbRounds = await db.championshipRound.findMany({
    where: { trackId: opts.session.trackId },
    orderBy: { round: "asc" },
  });
  
  const existingStoreRounds = championshipStore.filter((r) => r.trackId === opts.session.trackId);
  const maxDbRound = existingDbRounds.length > 0 ? Math.max(...existingDbRounds.map(r => r.round)) : 0;
  const maxStoreRound = existingStoreRounds.length > 0 ? Math.max(...existingStoreRounds.map(r => r.round)) : 0;
  const nextRound = Math.max(maxDbRound, maxStoreRound) + 1;
  
  // Check if this session's results are already recorded (by checking if a round with these exact positions exists)
  const sessionResults = [...opts.session.driverStates]
    .sort((a, b) => a.position - b.position)
    .map((ds, idx) => ({
      driverId: ds.driverId,
      position: idx + 1,
      points: POINTS_TABLE[idx] ?? 0,
    }));
  
  // Check if a round with same track and same results already exists in DB
  const duplicateInDb = existingDbRounds.some((r) => {
    try {
      const dbResults = JSON.parse(r.results) as { driverId: string; position: number; points: number }[];
      return dbResults.length === sessionResults.length &&
        dbResults.every((dr, i) => dr.driverId === sessionResults[i].driverId && dr.position === sessionResults[i].position);
    } catch { return false; }
  });
  
  // Also check in-memory store
  const duplicateInStore = existingStoreRounds.some((r) =>
    r.results.length === sessionResults.length &&
    r.results.every((dr, i) => dr.driverId === sessionResults[i].driverId && dr.position === sessionResults[i].position)
  );
  
  if (duplicateInDb || duplicateInStore) return;
  
  championshipStore.push({ trackId: opts.session.trackId, round: nextRound, results: sessionResults });
  // fire-and-forget DB persistence
  persistChampionshipRoundToDb(opts.session.trackId, nextRound, sessionResults).catch(() => {});
}

export function getChampionshipStandings(opts: {
  currentSession?: RaceSessionData;
}): import("./types").ChampionshipStanding[] {
  seedChampionship();
  const driverPoints: Record<string, number> = {};
  const driverWins: Record<string, number> = {};
  const driverPodiums: Record<string, number> = {};
  const driverTopTens: Record<string, number> = {};
  const driverRounds: Record<string, { trackId: string; points: number; position: number }[]> = {};

  for (const drv of DRIVERS) {
    driverPoints[drv.id] = 0;
    driverWins[drv.id] = 0;
    driverPodiums[drv.id] = 0;
    driverTopTens[drv.id] = 0;
    driverRounds[drv.id] = [];
  }

  const allRounds = [...championshipStore];
  // include in-progress current session as a "live" projection
  if (opts.currentSession && opts.currentSession.status === "running") {
    const liveResults = [...opts.currentSession.driverStates]
      .sort((a, b) => a.position - b.position)
      .map((ds, idx) => ({
        driverId: ds.driverId,
        position: idx + 1,
        points: POINTS_TABLE[idx] ?? 0,
      }));
    allRounds.push({
      trackId: opts.currentSession.trackId,
      round: 999, // live projection
      results: liveResults,
    });
  }

  // track previous total for delta
  const prevTotals: Record<string, number> = {};
  for (const drv of DRIVERS) prevTotals[drv.id] = 0;

  for (const round of allRounds) {
    for (const res of round.results) {
      driverPoints[res.driverId] = (driverPoints[res.driverId] ?? 0) + res.points;
      if (res.position === 1) driverWins[res.driverId] = (driverWins[res.driverId] ?? 0) + 1;
      if (res.position <= 3) driverPodiums[res.driverId] = (driverPodiums[res.driverId] ?? 0) + 1;
      if (res.position <= 10) driverTopTens[res.driverId] = (driverTopTens[res.driverId] ?? 0) + 1;
      driverRounds[res.driverId].push({ trackId: round.trackId, points: res.points, position: res.position });
    }
  }

  // delta vs previous total (excluding live projection)
  for (const drv of DRIVERS) {
    let prev = 0;
    for (const round of championshipStore) {
      const r = round.results.find((x) => x.driverId === drv.id);
      if (r) prev += r.points;
    }
    prevTotals[drv.id] = prev;
  }

  const standings: import("./types").ChampionshipStanding[] = DRIVERS.map((drv) => ({
    driverId: drv.id,
    driverCode: drv.code,
    driverName: drv.name,
    team: drv.team,
    teamColor: drv.teamColor,
    isOurs: drv.isOurs,
    points: driverPoints[drv.id] ?? 0,
    wins: driverWins[drv.id] ?? 0,
    podiums: driverPodiums[drv.id] ?? 0,
    topTens: driverTopTens[drv.id] ?? 0,
    position: 0,
    rounds: driverRounds[drv.id],
    deltaPrev: (driverPoints[drv.id] ?? 0) - (prevTotals[drv.id] ?? 0),
  }));

  standings.sort((a, b) => b.points - a.points);
  standings.forEach((s, i) => (s.position = i + 1));
  return standings;
}

// Async version: loads championship rounds from DB if in-memory store is empty (survives restarts)
export async function getChampionshipStandingsAsync(opts: {
  currentSession?: RaceSessionData;
}): Promise<import("./types").ChampionshipStanding[]> {
  seedChampionship();
  // If in-memory store has rounds, use it; otherwise try loading from DB
  if (championshipStore.length === 0 && !loadedFromDb.has("championship")) {
    loadedFromDb.add("championship");
    const dbRounds = await loadChampionshipRoundsFromDb();
    for (const r of dbRounds) {
      if (!championshipStore.some((s) => s.trackId === r.trackId && s.round === r.round)) {
        championshipStore.push(r);
      }
    }
  }
  return getChampionshipStandings(opts);
}

// ---- Championship timeline (points progression across rounds) ----
export function getChampionshipTimeline(opts: {
  currentSession?: RaceSessionData;
}): ChampionshipTimeline {
  seedChampionship();
  const rounds = [...championshipStore].sort((a, b) => a.round - b.round);
  const trackName = (id: string) => TRACKS.find((t) => t.id === id)?.name.split(" ")[0] ?? id;

  const roundList = rounds.map((r) => ({ round: r.round, trackId: r.trackId, trackName: trackName(r.trackId) }));

  // include live projection as a final "round"
  if (opts.currentSession && opts.currentSession.status === "running") {
    roundList.push({ round: 999, trackId: opts.currentSession.trackId, trackName: trackName(opts.currentSession.trackId) + " (live)" });
  }

  // build cumulative points per driver across rounds
  const series: ChampionshipTimeline["series"] = DRIVERS.map((drv) => {
    const points: { round: number; cumulative: number }[] = [];
    let cumulative = 0;
    for (const r of rounds) {
      const res = r.results.find((x) => x.driverId === drv.id);
      cumulative += res?.points ?? 0;
      points.push({ round: r.round, cumulative });
    }
    // live projection
    if (opts.currentSession && opts.currentSession.status === "running") {
      const liveRes = [...opts.currentSession.driverStates]
        .sort((a, b) => a.position - b.position)
        .findIndex((d) => d.driverId === drv.id);
      const livePts = liveRes >= 0 && liveRes < 10 ? [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][liveRes] : 0;
      points.push({ round: 999, cumulative: cumulative + livePts });
    }
    return {
      driverCode: drv.code,
      driverName: drv.name,
      teamColor: drv.teamColor,
      isOurs: drv.isOurs,
      points,
    };
  });

  return { rounds: roundList, series };
}

// Async version: loads from DB if in-memory is empty
export async function getChampionshipTimelineAsync(opts: {
  currentSession?: RaceSessionData;
}): Promise<ChampionshipTimeline> {
  seedChampionship();
  if (championshipStore.length === 0 && !loadedFromDb.has("championship")) {
    loadedFromDb.add("championship");
    const dbRounds = await loadChampionshipRoundsFromDb();
    for (const r of dbRounds) {
      if (!championshipStore.some((s) => s.trackId === r.trackId && s.round === r.round)) {
        championshipStore.push(r);
      }
    }
  }
  return getChampionshipTimeline(opts);
}

// ---- Strategy recommendation engine ----
// Given live alerts + current strategy options, recommend the best action per RB driver.
export function buildStrategyRecommendations(opts: {
  session: RaceSessionData;
  alerts: AlertData[];
  options: import("./types").PitStrategyOption[];
}): StrategyRecommendation[] {
  const { session, alerts, options } = opts;
  const rbDrivers = session.driverStates.filter((ds) => DRIVERS.find((d) => d.id === ds.driverId)?.isOurs);
  const recs: StrategyRecommendation[] = [];

  for (const ds of rbDrivers) {
    const driver = DRIVERS.find((d) => d.id === ds.driverId)!;
    const driverOptions = options.filter((o) => o.id.startsWith(driver.code + "::"));
    if (driverOptions.length === 0) continue;

    // active alerts for this driver
    const driverAlerts = alerts.filter((a) => !a.acknowledged && a.title.includes(driver.code));
    const allActiveAlerts = alerts.filter((a) => !a.acknowledged && (a.title.includes(driver.code) || a.category === "weather"));

    // scoring: base = podium prob, boosted by alert triggers
    const scored = driverOptions.map((o) => {
      let score = o.finishProbabilities.podium;
      const triggerAlerts: { severity: string; category: string; title: string }[] = [];
      const reasons: string[] = [];

      // tire cliff alert → favor undercut / early stop
      const tireAlert = driverAlerts.find((a) => a.category === "tire");
      if (tireAlert && (o.id.includes("undercut") || o.id.includes("2stop-aggressive"))) {
        score += 0.15;
        triggerAlerts.push({ severity: tireAlert.severity, category: tireAlert.category, title: tireAlert.title });
        reasons.push("tire cliff detected — favors early stop");
      }
      // DRS pressure → favor undercut
      const drsAlert = driverAlerts.find((a) => a.category === "drs");
      if (drsAlert && o.id.includes("undercut")) {
        score += 0.1;
        triggerAlerts.push({ severity: drsAlert.severity, category: drsAlert.category, title: drsAlert.title });
        reasons.push("DRS pressure — undercut defends position");
      }
      // weather alert → favor robust medium-medium
      const weatherAlert = allActiveAlerts.find((a) => a.category === "weather");
      if (weatherAlert && o.id.includes("2stop-balanced")) {
        score += 0.08;
        triggerAlerts.push({ severity: weatherAlert.severity, category: weatherAlert.category, title: weatherAlert.title });
        reasons.push("weather risk — balanced 2-stop robust to rain");
      }
      // fuel alert → favor conserve
      const fuelAlert = driverAlerts.find((a) => a.category === "fuel");
      if (fuelAlert && o.paceMode === "conserve") {
        score += 0.05;
        triggerAlerts.push({ severity: fuelAlert.severity, category: fuelAlert.category, title: fuelAlert.title });
        reasons.push("fuel margin tight — conserve pace extends range");
      }
      // risk penalty: high risk reduces confidence
      score -= o.riskScore * 0.1;

      return { option: o, score, triggerAlerts, reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const second = scored[1];
    if (!best) continue;

    // expected gain text
    const baseline = driverOptions.reduce(
      (acc, o) => (o.finishProbabilities.podium > (acc?.finishProbabilities.podium ?? -1) ? o : acc),
      driverOptions[0]
    );
    const posGain = (baseline?.expectedPosition ?? 0) - best.option.expectedPosition;
    const expectedGain =
      posGain > 0
        ? `+${posGain} position${posGain > 1 ? "s" : ""} vs default best`
        : posGain < 0
        ? `${posGain} position (higher risk for upside)`
        : "holds position with better risk profile";

    recs.push({
      driverCode: driver.code,
      driverName: driver.name,
      recommendedOptionId: best.option.id,
      recommendedLabel: best.option.label,
      reason: best.reasons.length > 0 ? best.reasons.join("; ") : "Highest podium probability with acceptable risk.",
      triggerAlerts: best.triggerAlerts,
      confidence: round(clamp(1 - best.option.riskScore, 0, 1) * (0.6 + best.score * 0.4), 2),
      expectedGain,
      alternativeOptionId: second?.option.id,
      alternativeLabel: second?.option.label,
    });
  }
  return recs;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ---- Pace-mode change log ----
export function recordPaceChange(opts: {
  sessionId: string;
  driverCode: string;
  driverName: string;
  fromPace: PaceMode;
  toPace: PaceMode;
  lap: number;
  position: number;
  reason?: string;
}): void {
  const { sessionId, driverCode, driverName, fromPace, toPace, lap, position, reason } = opts;
  if (fromPace === toPace) return; // no actual change
  const list = paceChangeStore.get(sessionId) ?? [];
  const entry: PaceChangeEntry = {
    id: "pc_" + Math.random().toString(36).slice(2, 9),
    sessionId,
    driverCode,
    driverName,
    fromPace,
    toPace,
    lap,
    position,
    reason: reason ?? "strategist",
    timestamp: new Date().toISOString(),
  };
  list.push(entry);
  paceChangeStore.set(sessionId, list);

  // fire-and-forget DB persistence
  persistPaceChangeToDb(entry).catch(() => {});
}

async function persistPaceChangeToDb(entry: PaceChangeEntry): Promise<void> {
  try {
    await db.paceChange.create({
      data: {
        sessionId: entry.sessionId,
        driverCode: entry.driverCode,
        driverName: entry.driverName,
        fromPace: entry.fromPace,
        toPace: entry.toPace,
        lap: entry.lap,
        position: entry.position,
        reason: entry.reason,
      },
    });
  } catch {
    // best-effort
  }
}

async function loadPaceChangesFromDb(sessionId: string): Promise<PaceChangeEntry[]> {
  try {
    const rows = await db.paceChange.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      driverCode: r.driverCode,
      driverName: r.driverName,
      fromPace: r.fromPace as PaceMode,
      toPace: r.toPace as PaceMode,
      lap: r.lap,
      position: r.position,
      reason: r.reason,
      timestamp: r.timestamp.toISOString(),
    }));
  } catch {
    return [];
  }
}

export function getPaceChanges(sessionId: string): PaceChangeEntry[] {
  return paceChangeStore.get(sessionId) ?? [];
}

export async function getPaceChangesAsync(sessionId: string): Promise<PaceChangeEntry[]> {
  let list = paceChangeStore.get(sessionId);
  if (!list && !loadedFromDb.has("pace_" + sessionId)) {
    loadedFromDb.add("pace_" + sessionId);
    list = await loadPaceChangesFromDb(sessionId);
    if (list.length > 0) paceChangeStore.set(sessionId, list);
  }
  return list ?? [];
}

export function clearPaceChanges(sessionId: string) {
  paceChangeStore.delete(sessionId);
}
