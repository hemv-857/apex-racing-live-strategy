// Racing domain types — Live Race Strategy Optimization Platform

export type Compound = "soft" | "medium" | "hard" | "inter" | "wet";
export type PaceMode = "push" | "balanced" | "conserve";
export type Weather = "dry" | "damp" | "wet";
export type DegLevel = "low" | "medium" | "high";
export type Overtaking = "easy" | "medium" | "hard";
export type AeroDemand = "low" | "medium" | "high";
export type AlertSeverity = "info" | "warning" | "critical" | "opportunity";
export type AlertCategory = "drs" | "tire" | "weather" | "pit" | "fuel" | "rival";

export interface TrackData {
  id: string;
  name: string;
  country: string;
  city: string;
  lapLengthKm: number;
  totalLaps: number;
  corners: number;
  drsZones: number;
  degradation: DegLevel;
  overtaking: Overtaking;
  aeroDemand: AeroDemand;
  fuelSensitivity: number; // sec per 10kg
  pitLossSec: number;
  // SVG path describing the circuit layout (normalized 0..1000 viewBox)
  layoutPath: string;
  // Sectors start fractions [0..1] for 3 sectors
  sectors: [number, number, number];
}

export interface DriverData {
  id: string;
  name: string;
  code: string;
  number: number;
  team: string;
  teamColor: string;
  isOurs: boolean;
  paceRating: number; // 0.95..1.05 multiplier
  tireMgmt: number; // 0..1
  fuelMgmt: number; // 0..1
}

export interface PracticeCalibration {
  trackId: string;
  aeroMap: AeroMapPoint[];
  fuelPerLapKg: number;
  baselineLapSec: number;
  tireDegradation: Record<"soft" | "medium" | "hard", TireDegCurve>;
  notes?: string;
}

export interface AeroMapPoint {
  downforce: "low" | "medium" | "high";
  dragDeltaSec: number; // lap time added by drag
  downforceGainSec: number; // lap time gained in corners
  topSpeedKph: number;
}

export interface TireDegCurve {
  baseLapSec: number;
  perLapDegradation: number; // sec added per lap
  cliffLap: number; // lap where degradation accelerates
  cliffMultiplier: number; // multiplier after cliff
}

export interface DriverState {
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
  trackProgress: number; // 0..1 for rendering
}

export interface RaceSessionData {
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

export interface PitStrategyOption {
  id: string;
  label: string;
  description: string;
  stops: number;
  pitLaps: number[];
  compounds: Compound[];
  paceMode: PaceMode;
  expectedPosition: number;
  finishProbabilities: {
    win: number;
    podium: number;
    points: number;
    top5: number;
  };
  riskScore: number;
  estimatedRaceTime: number;
  deltaToLeader: number;
  reasoning: string;
}

export interface SimulationResult {
  sessionId: string;
  label: string;
  horizonLaps: number;
  options: PitStrategyOption[];
  summary: {
    bestOptionId: string;
    winProbability: number;
    podiumProbability: number;
    expectedPositions: { driverCode: string; position: number; confidence: number }[];
  };
  generatedAt: string;
}

export interface AlertData {
  id: string;
  sessionId: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  actionLabel?: string;
  actionPayload?: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface RadioCall {
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

export interface PostRaceAnalysisData {
  id: string;
  sessionId: string;
  driverDeltas: {
    driverCode: string;
    driverName: string;
    actualPosition: number;
    predictedPosition: number;
    delta: number;
    withinOne: boolean;
    actualTime: number;
    predictedTime: number;
  }[];
  deviations: {
    lap: number;
    type: "safety-car" | "yellow-flag" | "tire-variance" | "weather-change" | "rival-stop";
    description: string;
    impactSec: number;
  }[];
  accuracyScore: number;
  notes?: string;
}

export interface PlaybookData {
  id: string;
  trackId: string;
  title: string;
  scenario: string;
  ruleText: string;
  winRate: number;
}

// ---- New: sector times, lap history, championship, head-to-head, what-if ----

export interface SectorTimes {
  s1: number; // seconds
  s2: number;
  s3: number;
  // mini-sector purple/green flags (0..1 = sectors where this driver was fastest)
  s1Purple?: boolean;
  s2Purple?: boolean;
  s3Purple?: boolean;
}

export interface LapHistoryEntry {
  sessionId: string;
  trackId: string;
  driverId: string;
  driverCode: string;
  lap: number;
  position: number;
  lapTimeSec: number;
  compound: Compound;
  tireAgeLaps: number;
  tireWearPct: number;
  fuelKg: number;
  pitThisLap: boolean;
  paceMode: PaceMode;
  sectors: SectorTimes;
  weather: Weather;
  recordedAt: string;
}

export interface ChampionshipStanding {
  driverId: string;
  driverCode: string;
  driverName: string;
  team: string;
  teamColor: string;
  isOurs: boolean;
  points: number;
  wins: number;
  podiums: number;
  topTens: number;
  position: number;
  // per-round points breakdown
  rounds: { trackId: string; points: number; position: number }[];
  deltaPrev: number; // points change since last round
}

export interface HeadToHeadComparison {
  driverA: { driverId: string; code: string; name: string; teamColor: string };
  driverB: { driverId: string; code: string; name: string; teamColor: string };
  laps: {
    lap: number;
    timeA: number;
    timeB: number;
    delta: number; // A - B (negative = A faster)
    sectorsA?: SectorTimes;
    sectorsB?: SectorTimes;
  }[];
  summary: {
    avgDelta: number; // avg A-B
    lapsAheadA: number; // laps where A faster
    lapsAheadB: number;
    qualifyingGap: number;
    raceGapSec: number;
    winnerCode: string | null; // null if tied
  };
}

export interface WhatIfConfig {
  driverId: string;
  stops: number;
  pitLaps: number[];
  compounds: Compound[];
  paceMode: PaceMode;
}

export interface WhatIfResult {
  config: WhatIfConfig;
  estimatedRaceTime: number;
  expectedPosition: number;
  finishProbabilities: {
    win: number;
    podium: number;
    top5: number;
    points: number;
  };
  riskScore: number;
  lapTrace: { lap: number; lapTimeSec: number; cumulativeTime: number; compound: Compound; pitThisLap: boolean }[];
  deltaToBaseline: number; // vs current best option
}

// ---- New: strategy comparison, recommendation, championship timeline, pace control ----

export interface StrategyComparisonTrace {
  optionId: string;
  label: string;
  color: string;
  driverCode: string;
  laps: { lap: number; cumulativeTime: number; lapTimeSec: number; compound: Compound; pitThisLap: boolean }[];
  totalRaceTime: number;
  expectedPosition: number;
  podiumProb: number;
}

export interface StrategyComparison {
  driverCode: string;
  traces: StrategyComparisonTrace[];
  summary: {
    fastestOptionId: string;
    slowestOptionId: string;
    spreadSec: number; // time gap fastest→slowest
  };
}

export interface StrategyRecommendation {
  driverCode: string;
  driverName: string;
  recommendedOptionId: string;
  recommendedLabel: string;
  reason: string;
  triggerAlerts: { severity: string; category: string; title: string }[];
  confidence: number; // 0..1
  expectedGain: string; // human-readable, e.g. "+1 position vs baseline"
  alternativeOptionId?: string;
  alternativeLabel?: string;
}

export interface ChampionshipTimelinePoint {
  round: number;
  trackId: string;
  trackName: string;
  // cumulative points per driver at this round
  points: { driverCode: string; cumulativePoints: number }[];
}

export interface ChampionshipTimeline {
  rounds: { round: number; trackId: string; trackName: string }[];
  series: { driverCode: string; driverName: string; teamColor: string; isOurs: boolean; points: { round: number; cumulative: number }[] }[];
}

export interface PaceModeControl {
  driverId: string;
  driverCode: string;
  currentPace: PaceMode;
  fuelImpact: string; // human-readable fuel effect
  tireImpact: string; // human-readable tire effect
}

export interface PaceChangeEntry {
  id: string;
  sessionId: string;
  driverCode: string;
  driverName: string;
  fromPace: PaceMode;
  toPace: PaceMode;
  lap: number;
  position: number;
  reason: string; // e.g. "strategist", "alert: tire cliff", "fuel save"
  timestamp: string;
}

