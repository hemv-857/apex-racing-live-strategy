// Live race state generator — produces a realistic race session and ticks
// it forward lap-by-lap. In production this would ingest telemetry feeds;
// here we synthesize a believable race for the command center.

import type { DriverState, RaceSessionData, TrackData, Weather, Compound, PaceMode } from "./types";
import { DRIVERS, getCalibration, getTrack } from "./data";
import { predictLapTime } from "./simulation-engine";
import { recordLapHistory, clearLapHistory, recordChampionshipRound } from "./history";

let sessionCache: RaceSessionData | null = null;
let tickerStarted = false;

function uid(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

const STARTING_COMPOUNDS: Compound[] = ["medium", "medium", "soft", "medium", "soft", "medium", "hard", "medium"];

export function createSession(track: TrackData): RaceSessionData {
  const calibration = getCalibration(track.id);
  const startFuel = track.totalLaps * calibration.fuelPerLapKg + 5; // +5kg margin
  const driverStates: DriverState[] = DRIVERS.map((drv, i) => {
    const compound = STARTING_COMPOUNDS[i];
    return {
      id: uid("ds"),
      driverId: drv.id,
      position: i + 1,
      lap: 1,
      tireCompound: compound,
      tireAgeLaps: 1,
      tireWearPct: 2 + Math.random() * 3,
      fuelKg: round(startFuel - calibration.fuelPerLapKg, 2),
      stintLap: 1,
      pitStops: 0,
      drsActive: false,
      drsAvailable: i % 2 === 0,
      gapAheadSec: i === 0 ? null : round(0.4 + Math.random() * 1.2, 2),
      gapBehindSec: i === DRIVERS.length - 1 ? null : round(0.4 + Math.random() * 1.2, 2),
      lastLapSec: round(calibration.baselineLapSec + (1 - drv.paceRating) * 2 + Math.random() * 0.6, 3),
      bestLapSec: round(calibration.baselineLapSec + (1 - drv.paceRating) * 2, 3),
      avgLapSec: round(calibration.baselineLapSec + (1 - drv.paceRating) * 2 + 0.3, 3),
      paceMode: "balanced" as PaceMode,
      retired: false,
      trackProgress: round((i + 1) / DRIVERS.length, 3),
    };
  });

  const session: RaceSessionData = {
    id: uid("ses"),
    trackId: track.id,
    name: `${track.name.split(" ")[0]} GP — Race`,
    status: "running",
    currentLap: 1,
    totalLaps: track.totalLaps,
    airTempC: 22 + Math.random() * 6,
    trackTempC: 28 + Math.random() * 10,
    weather: "dry",
    rainProb: 0.05 + Math.random() * 0.15,
    windKph: 8 + Math.random() * 12,
    humidity: 50 + Math.random() * 20,
    startedAt: new Date().toISOString(),
    driverStates,
  };
  sessionCache = session;
  return session;
}

export function getSession(): RaceSessionData {
  if (!sessionCache) {
    sessionCache = createSession(getTrack("suzuka"));
    ensureTickerStarted();
  }
  return sessionCache;
}

export function ensureTickerStarted(): void {
  if (tickerStarted) return;
  tickerStarted = true;
  if (typeof setInterval !== "undefined") {
    setInterval(() => {
      tickSessionInternal();
    }, 3500);
  }
}

export function setDriverPace(driverCode: string, paceMode: PaceMode): boolean {
  const session = getSession();
  const driver = DRIVERS.find((d) => d.code === driverCode);
  if (!driver) return false;
  const ds = session.driverStates.find((s) => s.driverId === driver.id);
  if (!ds) return false;
  ds.paceMode = paceMode;
  return true;
}

function tickSessionInternal(): RaceSessionData {
  const session = getSession();
  if (session.status !== "running") return session;
  const track = getTrack(session.trackId);
  const calibration = getCalibration(track.id);

  session.currentLap += 1;
  const isFinished = session.currentLap > session.totalLaps;
  if (isFinished) {
    session.status = "finished";
  }

  // weather drift (only if not finished)
  if (!isFinished) {
    session.rainProb = clamp(session.rainProb + (Math.random() - 0.5) * 0.08, 0.02, 0.9);
    if (session.rainProb > 0.75 && session.weather === "dry") session.weather = "damp";
    else if (session.rainProb > 0.9 && session.weather === "damp") session.weather = "wet";
    else if (session.rainProb < 0.3 && session.weather === "wet") session.weather = "damp";
    else if (session.rainProb < 0.15 && session.weather === "damp") session.weather = "dry";
    session.trackTempC = clamp(session.trackTempC + (Math.random() - 0.5) * 1.2, 18, 52);
    session.airTempC = clamp(session.airTempC + (Math.random() - 0.5) * 0.8, 14, 36);

    // update each driver
    const newTimes: { driverId: string; time: number; state: DriverState }[] = [];
    const pitThisLapByDriver: Record<string, boolean> = {};
    for (const ds of session.driverStates) {
      if (ds.retired) {
        newTimes.push({ driverId: ds.driverId, time: Infinity, state: ds });
        continue;
      }
      const driver = DRIVERS.find((d) => d.id === ds.driverId)!;
      const lapTime = predictLapTime({
        calibration,
        tireAgeLaps: ds.tireAgeLaps,
        compound: ds.tireCompound,
        fuelKg: ds.fuelKg,
        paceMode: ds.paceMode,
        weather: session.weather,
        driverPaceRating: driver.paceRating,
        driverTireMgmt: driver.tireMgmt,
      });
      const noise = (Math.random() - 0.5) * 0.5;
      const finalTime = round(lapTime + noise, 3);
      ds.lastLapSec = finalTime;
      if (ds.bestLapSec === null || finalTime < ds.bestLapSec) ds.bestLapSec = finalTime;
      ds.fuelKg = round(Math.max(0, ds.fuelKg - calibration.fuelPerLapKg * (ds.paceMode === "push" ? 1.08 : ds.paceMode === "conserve" ? 0.9 : 1.0)), 2);
      ds.tireAgeLaps += 1;
      ds.stintLap += 1;
      const wearRate = ds.paceMode === "push" ? 1.25 : ds.paceMode === "conserve" ? 0.8 : 1.0;
      const baseLife = ds.tireCompound === "soft" ? 18 : ds.tireCompound === "medium" ? 26 : 36;
      ds.tireWearPct = round(clamp((ds.tireAgeLaps / baseLife) * 100 * wearRate * (1 - driver.tireMgmt * 0.15), 0, 100), 1);
      ds.lap = session.currentLap;
      ds.trackProgress = round(((session.currentLap - 1) + Math.random() * 0.3) / session.totalLaps, 4);

      // auto pit if tire wear critical
      if (ds.tireWearPct >= 88 && ds.pitStops < 3) {
        ds.pitStops += 1;
        ds.stintLap = 1;
        ds.tireAgeLaps = 1;
        ds.tireWearPct = 2;
        const nextCompound: Compound = session.weather === "wet" ? "wet" : session.weather === "damp" ? "inter" : ds.pitStops === 1 ? "medium" : "soft";
        ds.tireCompound = nextCompound;
        ds.fuelKg = round(ds.fuelKg + 0.5, 2);
        pitThisLapByDriver[ds.driverId] = true;
      } else {
        pitThisLapByDriver[ds.driverId] = false;
      }

      // DRS logic
      ds.drsAvailable = session.currentLap >= 3 && (ds.position % 2 === (session.currentLap % 2));
      ds.drsActive = ds.drsAvailable && Math.random() > 0.4;

      newTimes.push({ driverId: ds.driverId, time: finalTime, state: ds });
    }

    // re-sort positions by cumulative time approx (use last lap as proxy + position)
    newTimes.sort((a, b) => a.time - b.time);
    newTimes.forEach((nt, idx) => {
      nt.state.position = idx + 1;
    });

    // recompute gaps
    const sorted = [...session.driverStates].sort((a, b) => a.position - b.position);
    for (let i = 0; i < sorted.length; i++) {
      const ds = sorted[i];
      if (i === 0) ds.gapAheadSec = null;
      else {
        const ahead = sorted[i - 1];
        ds.gapAheadSec = round((ds.lastLapSec ?? 0) - (ahead.lastLapSec ?? 0) + (ahead.gapAheadSec ?? 0) + 0.3, 2);
      }
      if (i === sorted.length - 1) ds.gapBehindSec = null;
      else {
        const behind = sorted[i + 1];
        ds.gapBehindSec = round((behind.lastLapSec ?? 0) - (ds.lastLapSec ?? 0) + 0.3, 2);
      }
    }

    // record lap history (with sector times) for charts + head-to-head
    recordLapHistory({ session, pitThisLapByDriver });
  }

  // record championship round if race just finished
  if (isFinished) {
    recordChampionshipRound({ session }).catch(() => {});
  }

  return session;
}

export function resetSession(trackId?: string): RaceSessionData {
  if (sessionCache) clearLapHistory(sessionCache.id);
  sessionCache = createSession(getTrack(trackId ?? "suzuka"));
  return sessionCache;
}

export function tickSession(): RaceSessionData {
  return getSession();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
