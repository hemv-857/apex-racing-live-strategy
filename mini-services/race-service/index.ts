// Race Service — WebSocket mini-service
// Broadcasts live race state ticks to connected command-center clients
// and simulates a radio link protocol for one-click strategy calls to the pit box.
//
// Port: 3003 (forwarded via Caddy with ?XTransformPort=3003)

import { createServer } from "http";
import { Server } from "socket.io";

// --- Inline race-state engine (mirrors src/lib/racing) ---
// Kept self-contained so the mini-service runs independently.

type Compound = "soft" | "medium" | "hard" | "inter" | "wet";
type PaceMode = "push" | "balanced" | "conserve";
type Weather = "dry" | "damp" | "wet";

interface Driver {
  id: string;
  name: string;
  code: string;
  number: number;
  team: string;
  teamColor: string;
  isOurs: boolean;
  paceRating: number;
  tireMgmt: number;
  fuelMgmt: number;
}

interface Track {
  id: string;
  name: string;
  totalLaps: number;
  degradation: "low" | "medium" | "high";
  layoutPath: string;
  sectors: [number, number, number];
  pitLossSec: number;
}

interface Calibration {
  fuelPerLapKg: number;
  baselineLapSec: number;
  tireDeg: Record<string, { baseLapSec: number; perLapDegradation: number; cliffLap: number; cliffMultiplier: number }>;
}

interface DriverState {
  id: string;
  driverId: string;
  position: number;
  lap: number;
  tireCompound: Compound;
  tireAgeLaps: number;
  tireWearPct: number;
  fuelKg: number;
  stintLap: number;
  pitStops: number;
  drsActive: boolean;
  drsAvailable: boolean;
  gapAheadSec: number | null;
  gapBehindSec: number | null;
  lastLapSec: number | null;
  bestLapSec: number | null;
  avgLapSec: number | null;
  paceMode: PaceMode;
  retired: boolean;
  trackProgress: number;
}

interface RaceSession {
  id: string;
  trackId: string;
  name: string;
  status: "scheduled" | "running" | "finished" | "red-flag";
  currentLap: number;
  totalLaps: number;
  airTempC: number;
  trackTempC: number;
  weather: Weather;
  rainProb: number;
  windKph: number;
  humidity: number;
  startedAt: string | null;
  driverStates: DriverState[];
}

interface RadioCall {
  id: string;
  sessionId: string;
  driverCode: string;
  driverName: string;
  message: string;
  strategyRef?: string;
  status: "queued" | "transmitting" | "delivered";
  priority: "normal" | "urgent";
  createdAt: string;
}

interface AlertData {
  id: string;
  sessionId: string;
  severity: "info" | "warning" | "critical" | "opportunity";
  category: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionPayload?: string;
  acknowledged: boolean;
  createdAt: string;
}

const DRIVERS: Driver[] = [
  { id: "drv-ts", name: "T. Saito", code: "SAI", number: 22, team: "Apex Racing", teamColor: "#1e3a8a", isOurs: true, paceRating: 1.0, tireMgmt: 0.78, fuelMgmt: 0.72 },
  { id: "drv-lr", name: "L. Romano", code: "ROM", number: 14, team: "Apex Racing", teamColor: "#dc2626", isOurs: true, paceRating: 0.99, tireMgmt: 0.82, fuelMgmt: 0.75 },
  { id: "drv-mv", name: "M. Voss", code: "VOS", number: 1, team: "Red Phoenix", teamColor: "#0ea5e9", isOurs: false, paceRating: 1.03, tireMgmt: 0.85, fuelMgmt: 0.8 },
  { id: "drv-jc", name: "J. Carter", code: "CAR", number: 16, team: "Scuderia Leone", teamColor: "#f59e0b", isOurs: false, paceRating: 1.02, tireMgmt: 0.8, fuelMgmt: 0.78 },
  { id: "drv-ak", name: "A. Kim", code: "KIM", number: 4, team: "Silver Arrows", teamColor: "#10b981", isOurs: false, paceRating: 1.01, tireMgmt: 0.76, fuelMgmt: 0.82 },
  { id: "drv-nh", name: "N. Holm", code: "HOL", number: 7, team: "Apex GP", teamColor: "#a855f7", isOurs: false, paceRating: 1.0, tireMgmt: 0.79, fuelMgmt: 0.77 },
  { id: "drv-ep", name: "E. Petrov", code: "PET", number: 27, team: "Astro Racing", teamColor: "#ec4899", isOurs: false, paceRating: 0.98, tireMgmt: 0.74, fuelMgmt: 0.7 },
  { id: "drv-rf", name: "R. Ferreira", code: "FER", number: 55, team: "Velocity Works", teamColor: "#14b8a6", isOurs: false, paceRating: 0.99, tireMgmt: 0.77, fuelMgmt: 0.73 },
];

const TRACKS: Track[] = [
  {
    id: "suzuka",
    name: "Suzuka International Racing Course",
    totalLaps: 53,
    degradation: "high",
    pitLossSec: 21.5,
    layoutPath: "M 120,460 C 90,420 110,360 170,350 C 230,340 270,360 300,320 C 330,280 300,230 340,200 C 390,160 460,190 480,240 C 500,290 460,330 500,360 C 540,390 600,360 640,330 C 690,290 760,300 800,340 C 840,380 870,360 880,300 C 890,240 860,190 800,180 C 740,170 700,200 660,170 C 620,140 640,90 690,80 C 740,70 800,90 820,140 C 840,190 880,180 880,140 C 880,100 840,80 790,90 C 740,100 700,140 650,160 C 600,180 560,150 520,130 C 480,110 430,130 410,170 C 390,210 350,200 320,230 C 290,260 260,250 230,280 C 200,310 180,350 150,370 C 120,390 100,420 120,460 Z",
    sectors: [0.36, 0.68, 1.0],
  },
  {
    id: "monza",
    name: "Autodromo Nazionale Monza",
    totalLaps: 53,
    degradation: "low",
    pitLossSec: 23.0,
    layoutPath: "M 140,180 C 200,170 260,180 320,200 C 380,220 440,210 500,200 C 560,190 620,200 680,220 C 740,240 800,260 840,240 C 880,220 870,180 830,160 C 790,140 740,160 700,170 C 660,180 620,160 580,140 C 540,120 480,110 420,120 C 360,130 300,150 240,150 C 180,150 120,160 140,180 Z",
    sectors: [0.33, 0.66, 1.0],
  },
  {
    id: "silverstone",
    name: "Silverstone Circuit",
    totalLaps: 52,
    degradation: "medium",
    pitLossSec: 20.5,
    layoutPath: "M 150,200 C 200,180 260,170 320,180 C 380,190 420,220 460,250 C 500,280 540,260 580,240 C 620,220 680,210 740,220 C 800,230 850,260 880,310 C 900,350 880,400 830,420 C 780,440 720,430 680,400 C 640,370 600,380 560,400 C 520,420 480,440 440,430 C 400,420 360,390 330,360 C 300,330 260,320 220,310 C 180,300 140,290 150,250 C 155,225 150,200 150,200 Z",
    sectors: [0.34, 0.67, 1.0],
  },
];

const CALIBRATIONS: Record<string, Calibration> = {
  suzuka: {
    fuelPerLapKg: 1.62,
    baselineLapSec: 91.5,
    tireDeg: {
      soft: { baseLapSec: 91.0, perLapDegradation: 0.18, cliffLap: 12, cliffMultiplier: 2.4 },
      medium: { baseLapSec: 91.5, perLapDegradation: 0.1, cliffLap: 20, cliffMultiplier: 2.0 },
      hard: { baseLapSec: 92.2, perLapDegradation: 0.06, cliffLap: 28, cliffMultiplier: 1.7 },
    },
  },
  monza: {
    fuelPerLapKg: 1.45,
    baselineLapSec: 81.2,
    tireDeg: {
      soft: { baseLapSec: 80.8, perLapDegradation: 0.1, cliffLap: 16, cliffMultiplier: 2.0 },
      medium: { baseLapSec: 81.2, perLapDegradation: 0.06, cliffLap: 24, cliffMultiplier: 1.8 },
      hard: { baseLapSec: 81.8, perLapDegradation: 0.04, cliffLap: 34, cliffMultiplier: 1.5 },
    },
  },
  silverstone: {
    fuelPerLapKg: 1.55,
    baselineLapSec: 87.4,
    tireDeg: {
      soft: { baseLapSec: 87.0, perLapDegradation: 0.14, cliffLap: 14, cliffMultiplier: 2.2 },
      medium: { baseLapSec: 87.4, perLapDegradation: 0.08, cliffLap: 22, cliffMultiplier: 1.9 },
      hard: { baseLapSec: 88.0, perLapDegradation: 0.05, cliffLap: 30, cliffMultiplier: 1.6 },
    },
  },
};

const COMPOUND_BASELINE: Record<Compound, number> = { soft: -0.4, medium: 0, hard: 0.6, inter: 1.2, wet: 2.4 };
const PACE_FACTOR: Record<PaceMode, number> = { push: -0.25, balanced: 0, conserve: 0.35 };
const PACE_FUEL: Record<PaceMode, number> = { push: 1.08, balanced: 1.0, conserve: 0.9 };
const PACE_TIRE: Record<PaceMode, number> = { push: 1.25, balanced: 1.0, conserve: 0.8 };
const START_COMPOUNDS: Compound[] = ["medium", "medium", "soft", "medium", "soft", "medium", "hard", "medium"];

function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function uid(p: string) {
  return p + "_" + Math.random().toString(36).slice(2, 9);
}

let session: RaceSession = createSession(TRACKS[0]);
const radioCalls: RadioCall[] = [];
const alertLog: AlertData[] = [];

function createSession(track: Track): RaceSession {
  const cal = CALIBRATIONS[track.id];
  const startFuel = track.totalLaps * cal.fuelPerLapKg + 5;
  const driverStates: DriverState[] = DRIVERS.map((drv, i) => {
    const compound = START_COMPOUNDS[i];
    return {
      id: uid("ds"),
      driverId: drv.id,
      position: i + 1,
      lap: 1,
      tireCompound: compound,
      tireAgeLaps: 1,
      tireWearPct: round(2 + Math.random() * 3, 1),
      fuelKg: round(startFuel - cal.fuelPerLapKg, 2),
      stintLap: 1,
      pitStops: 0,
      drsActive: false,
      drsAvailable: i % 2 === 0,
      gapAheadSec: i === 0 ? null : round(0.4 + Math.random() * 1.2, 2),
      gapBehindSec: i === DRIVERS.length - 1 ? null : round(0.4 + Math.random() * 1.2, 2),
      lastLapSec: round(cal.baselineLapSec + (1 - drv.paceRating) * 2 + Math.random() * 0.6, 3),
      bestLapSec: round(cal.baselineLapSec + (1 - drv.paceRating) * 2, 3),
      avgLapSec: round(cal.baselineLapSec + (1 - drv.paceRating) * 2 + 0.3, 3),
      paceMode: "balanced",
      retired: false,
      trackProgress: round((i + 1) / DRIVERS.length, 3),
    };
  });
  return {
    id: uid("ses"),
    trackId: track.id,
    name: `${track.name.split(" ")[0]} GP — Race`,
    status: "running",
    currentLap: 1,
    totalLaps: track.totalLaps,
    airTempC: round(22 + Math.random() * 6, 1),
    trackTempC: round(28 + Math.random() * 10, 1),
    weather: "dry",
    rainProb: round(0.05 + Math.random() * 0.15, 3),
    windKph: round(8 + Math.random() * 12, 1),
    humidity: round(50 + Math.random() * 20, 1),
    startedAt: new Date().toISOString(),
    driverStates,
  };
}

function predictLap(d: DriverState, cal: Calibration, weather: Weather): number {
  const drv = DRIVERS.find((x) => x.id === d.driverId)!;
  const compoundKey = d.tireCompound === "inter" ? "medium" : d.tireCompound === "wet" ? "hard" : d.tireCompound;
  const curve = cal.tireDeg[compoundKey] ?? cal.tireDeg.medium;
  const baseline = curve.baseLapSec + COMPOUND_BASELINE[d.tireCompound];
  const ageFactor =
    d.tireAgeLaps <= curve.cliffLap
      ? d.tireAgeLaps * curve.perLapDegradation
      : curve.cliffLap * curve.perLapDegradation +
        (d.tireAgeLaps - curve.cliffLap) * curve.perLapDegradation * curve.cliffMultiplier;
  const tirePenalty = ageFactor * (1 - drv.tireMgmt * 0.25);
  const fuelPenalty = d.fuelKg * 0.03;
  const paceDelta = PACE_FACTOR[d.paceMode];
  const weatherDelta = weather === "wet" ? 5.5 : weather === "damp" ? 2.0 : 0;
  const driverDelta = (1 - drv.paceRating) * 2.0;
  return baseline + tirePenalty + fuelPenalty + paceDelta + weatherDelta + driverDelta;
}

function tick() {
  if (session.status !== "running") return;
  const track = TRACKS.find((t) => t.id === session.trackId)!;
  const cal = CALIBRATIONS[track.id];
  session.currentLap += 1;
  if (session.currentLap > session.totalLaps) {
    session.status = "finished";
    return;
  }
  session.rainProb = clamp(round(session.rainProb + (Math.random() - 0.5) * 0.08, 3), 0.02, 0.9);
  if (session.rainProb > 0.75 && session.weather === "dry") session.weather = "damp";
  else if (session.rainProb > 0.9 && session.weather === "damp") session.weather = "wet";
  else if (session.rainProb < 0.3 && session.weather === "wet") session.weather = "damp";
  else if (session.rainProb < 0.15 && session.weather === "damp") session.weather = "dry";
  session.trackTempC = clamp(round(session.trackTempC + (Math.random() - 0.5) * 1.2, 1), 18, 52);
  session.airTempC = clamp(round(session.airTempC + (Math.random() - 0.5) * 0.8, 1), 14, 36);

  const times: { ds: DriverState; t: number }[] = [];
  for (const ds of session.driverStates) {
    if (ds.retired) {
      times.push({ ds, t: Infinity });
      continue;
    }
    const drv = DRIVERS.find((x) => x.id === ds.driverId)!;
    const lapTime = predictLap(ds, cal, session.weather);
    const noise = (Math.random() - 0.5) * 0.5;
    const finalTime = round(lapTime + noise, 3);
    ds.lastLapSec = finalTime;
    if (ds.bestLapSec === null || finalTime < ds.bestLapSec) ds.bestLapSec = finalTime;
    ds.fuelKg = round(Math.max(0, ds.fuelKg - cal.fuelPerLapKg * PACE_FUEL[ds.paceMode]), 2);
    ds.tireAgeLaps += 1;
    ds.stintLap += 1;
    const wearRate = PACE_TIRE[ds.paceMode] * (1 - drv.tireMgmt * 0.15);
    const baseLife = ds.tireCompound === "soft" ? 18 : ds.tireCompound === "medium" ? 26 : 36;
    ds.tireWearPct = round(clamp((ds.tireAgeLaps / baseLife) * 100 * wearRate, 0, 100), 1);
    ds.lap = session.currentLap;
    ds.trackProgress = round(((session.currentLap - 1) + Math.random() * 0.3) / session.totalLaps, 4);
    if (ds.tireWearPct >= 88 && ds.pitStops < 3) {
      ds.pitStops += 1;
      ds.stintLap = 1;
      ds.tireAgeLaps = 1;
      ds.tireWearPct = 2;
      const next: Compound =
        session.weather === "wet" ? "wet" : session.weather === "damp" ? "inter" : ds.pitStops === 1 ? "medium" : "soft";
      ds.tireCompound = next;
      ds.fuelKg = round(ds.fuelKg + 0.5, 2);
    }
    ds.drsAvailable = session.currentLap >= 3 && ds.position % 2 === session.currentLap % 2;
    ds.drsActive = ds.drsAvailable && Math.random() > 0.4;
    times.push({ ds, t: finalTime });
  }
  times.sort((a, b) => a.t - b.t);
  times.forEach((x, i) => (x.ds.position = i + 1));
  // gaps
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
}

// Generate alerts (subset for live broadcast)
function generateAlerts(): AlertData[] {
  const out: AlertData[] = [];
  const now = new Date().toISOString();
  const our = session.driverStates.filter((d) => DRIVERS.find((x) => x.id === d.driverId)?.isOurs);
  for (const ds of our) {
    const drv = DRIVERS.find((x) => x.id === ds.driverId)!;
    if (ds.tireWearPct >= 70) {
      out.push({
        id: uid("al"),
        sessionId: session.id,
        severity: ds.tireWearPct >= 85 ? "critical" : "warning",
        category: "tire",
        title: `${drv.code} tire cliff approaching`,
        message: `${drv.name}'s ${ds.tireCompound} at ${ds.tireWearPct.toFixed(0)}% wear. Pit window opening.`,
        actionLabel: "Open Strategy Tree",
        actionPayload: JSON.stringify({ driverId: ds.driverId, focus: "tire" }),
        acknowledged: false,
        createdAt: now,
      });
    }
    if (ds.gapBehindSec !== null && ds.gapBehindSec <= 1.2) {
      out.push({
        id: uid("al"),
        sessionId: session.id,
        severity: "warning",
        category: "drs",
        title: `${drv.code} under DRS pressure`,
        message: `Rival within ${ds.gapBehindSec.toFixed(2)}s. DRS window closes in ~3 laps.`,
        actionLabel: "Evaluate Undercut",
        actionPayload: JSON.stringify({ driverId: ds.driverId, focus: "undercut" }),
        acknowledged: false,
        createdAt: now,
      });
    }
    if (ds.gapAheadSec !== null && ds.gapAheadSec <= 1.0 && ds.drsAvailable) {
      out.push({
        id: uid("al"),
        sessionId: session.id,
        severity: "opportunity",
        category: "drs",
        title: `${drv.code} DRS attack window open`,
        message: `Within ${ds.gapAheadSec.toFixed(2)}s of P${ds.position - 1}. Overtake opportunity.`,
        actionLabel: "Send Push Pace Call",
        actionPayload: JSON.stringify({ driverCode: drv.code, pace: "push" }),
        acknowledged: false,
        createdAt: now,
      });
    }
  }
  if (session.rainProb > 0.45) {
    out.push({
      id: uid("al"),
      sessionId: session.id,
      severity: session.rainProb > 0.7 ? "critical" : "warning",
      category: "weather",
      title: "Rain probability rising",
      message: `Rain prob at ${(session.rainProb * 100).toFixed(0)}%. Prepare inters/wets.`,
      actionLabel: "View Wet Strategy",
      actionPayload: JSON.stringify({ focus: "weather" }),
      acknowledged: false,
      createdAt: now,
    });
  }
  return out;
}

// --- HTTP + Socket.IO server ---
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, lap: session.currentLap, status: session.status }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[race-service] client connected: ${socket.id}`);
  // send current state immediately
  socket.emit("race:state", session);
  socket.emit("radio:history", radioCalls.slice(0, 20));

  socket.on("race:select-track", (trackId: string) => {
    const t = TRACKS.find((x) => x.id === trackId);
    if (t) {
      session = createSession(t);
      radioCalls.length = 0;
      io.emit("race:state", session);
      io.emit("radio:history", []);
      console.log(`[race-service] track switched → ${t.name}, race restarted`);
    }
  });

  socket.on("race:reset", () => {
    const t = TRACKS.find((x) => x.id === session.trackId)!;
    session = createSession(t);
    radioCalls.length = 0;
    io.emit("race:state", session);
    io.emit("radio:history", []);
    console.log("[race-service] race reset");
  });

  socket.on("race:set-pace", (data: { driverCode: string; pace: PaceMode }) => {
    const drv = DRIVERS.find((d) => d.code === data.driverCode);
    if (!drv) return;
    const ds = session.driverStates.find((s) => s.driverId === drv.id);
    if (!ds) return;
    ds.paceMode = data.pace;
    io.emit("race:state", session);
    console.log(`[race-service] pace set ${data.driverCode} → ${data.pace}`);
  });

  // Radio link: send strategy call to pit box
  socket.on("radio:send", (call: Omit<RadioCall, "id" | "createdAt" | "status">) => {
    const full: RadioCall = {
      ...call,
      id: uid("rc"),
      createdAt: new Date().toISOString(),
      status: "queued",
    };
    radioCalls.unshift(full);
    if (radioCalls.length > 50) radioCalls.pop();
    io.emit("radio:new", full);
    console.log(`[race-service] radio queued → ${call.driverCode}: ${call.message}`);

    // simulate radio protocol: queued → transmitting → delivered
    setTimeout(() => {
      full.status = "transmitting";
      io.emit("radio:update", full);
    }, 800);
    setTimeout(() => {
      full.status = "delivered";
      io.emit("radio:update", full);
      // emit confirmation back to pit wall
      io.emit("radio:ack", {
        callId: full.id,
        driverCode: full.driverCode,
        acknowledgedAt: new Date().toISOString(),
      });
    }, 2200);
  });

  socket.on("alert:ack", (alertId: string) => {
    const a = alertLog.find((x) => x.id === alertId);
    if (a) a.acknowledged = true;
    io.emit("alert:ack", alertId);
  });

  socket.on("disconnect", () => {
    console.log(`[race-service] client disconnected: ${socket.id}`);
  });
});

// Tick the race forward every 4 seconds (≈ a race lap for demo pacing)
setInterval(() => {
  if (session.status === "running") {
    tick();
    io.emit("race:state", session);
    const newAlerts = generateAlerts();
    for (const a of newAlerts) {
      // dedupe by title within last 60s
      const exists = alertLog.some((x) => x.title === a.title && Date.now() - new Date(x.createdAt).getTime() < 60000);
      if (!exists) {
        alertLog.unshift(a);
        if (alertLog.length > 100) alertLog.pop();
        io.emit("alert:new", a);
      }
    }
  }
}, 4000);

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`[race-service] WebSocket server running on port ${PORT}`);
  console.log(`[race-service] Race: ${session.name} | Lap ${session.currentLap}/${session.totalLaps}`);
});

process.on("SIGTERM", () => {
  console.log("[race-service] SIGTERM, shutting down...");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[race-service] SIGINT, shutting down...");
  httpServer.close(() => process.exit(0));
});
