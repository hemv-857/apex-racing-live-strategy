// Race Simulation Engine
// A discrete-event simulator modeling the next N laps for both RB drivers
// across fuel loads, pit strategies, tire compounds, weather, and rivals.
//
// Adapted from the C#/Unity spec into a deterministic TypeScript engine
// calibrated by Friday/Saturday practice data (aero maps + tire deg curves).

import type {
  Compound,
  DriverState,
  PaceMode,
  PitStrategyOption,
  PracticeCalibration,
  RaceSessionData,
  SimulationResult,
  TrackData,
  Weather,
} from "./types";
import { getCalibration, getDriver } from "./data";

const COMPOUND_BASELINE: Record<Compound, number> = {
  soft: -0.4,
  medium: 0,
  hard: 0.6,
  inter: 1.2,
  wet: 2.4,
};

const PACE_MODE_FACTOR: Record<PaceMode, number> = {
  push: -0.25,
  balanced: 0,
  conserve: 0.35,
};

const PACE_MODE_FUEL: Record<PaceMode, number> = {
  push: 1.08,
  balanced: 1.0,
  conserve: 0.9,
};

const PACE_MODE_TIRE: Record<PaceMode, number> = {
  push: 1.25,
  balanced: 1.0,
  conserve: 0.8,
};

export interface LapPrediction {
  lap: number;
  lapTimeSec: number;
  fuelKg: number;
  tireAge: number;
  tireWearPct: number;
  compound: Compound;
  pitThisLap: boolean;
  cumulativeTime: number;
}

export interface StintSim {
  laps: LapPrediction[];
  totalTime: number;
  finalFuelKg: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Predict a single lap time given state + calibration
export function predictLapTime(opts: {
  calibration: PracticeCalibration;
  tireAgeLaps: number;
  compound: Compound;
  fuelKg: number;
  paceMode: PaceMode;
  weather: Weather;
  driverPaceRating: number;
  driverTireMgmt: number;
}): number {
  const {
    calibration,
    tireAgeLaps,
    compound,
    fuelKg,
    paceMode,
    weather,
    driverPaceRating,
    driverTireMgmt,
  } = opts;
  const curve = calibration.tireDegradation[compound === "inter" ? "medium" : compound === "wet" ? "hard" : compound];
  const baseline = curve.baseLapSec + COMPOUND_BASELINE[compound];
  // tire degradation — driver skill mitigates
  const ageFactor = tireAgeLaps <= curve.cliffLap
    ? tireAgeLaps * curve.perLapDegradation
    : curve.cliffLap * curve.perLapDegradation +
      (tireAgeLaps - curve.cliffLap) * curve.perLapDegradation * curve.cliffMultiplier;
  const tirePenalty = ageFactor * (1 - driverTireMgmt * 0.25);
  // fuel effect: lighter car = faster
  const fuelPenalty = fuelKg * 0.03; // ~0.03s per kg
  // pace mode
  const paceDelta = PACE_MODE_FACTOR[paceMode];
  // weather penalty
  const weatherDelta = weather === "wet" ? 5.5 : weather === "damp" ? 2.0 : 0;
  // driver pace rating
  const driverDelta = (1 - driverPaceRating) * 2.0;
  return baseline + tirePenalty + fuelPenalty + paceDelta + weatherDelta + driverDelta;
}

function simulateStint(opts: {
  startLap: number;
  lapCount: number;
  compound: Compound;
  startTireAge: number;
  startFuelKg: number;
  paceMode: PaceMode;
  weather: Weather;
  calibration: PracticeCalibration;
  driverPaceRating: number;
  driverTireMgmt: number;
  driverFuelMgmt: number;
  pitLossSec: number;
  isFirstStint: boolean;
}): StintSim {
  const laps: LapPrediction[] = [];
  let cumulative = 0;
  let fuel = opts.startFuelKg;
  let tireAge = opts.startTireAge;
  const fuelPerLap = opts.calibration.fuelPerLapKg * PACE_MODE_FUEL[opts.paceMode] * (1 - opts.driverFuelMgmt * 0.08);
  const tireWearRate = PACE_MODE_TIRE[opts.paceMode] * (1 - opts.driverTireMgmt * 0.15);
  for (let i = 0; i < opts.lapCount; i++) {
    const lap = opts.startLap + i;
    const lapTime = predictLapTime({
      calibration: opts.calibration,
      tireAgeLaps: tireAge,
      compound: opts.compound,
      fuelKg: fuel,
      paceMode: opts.paceMode,
      weather: opts.weather,
      driverPaceRating: opts.driverPaceRating,
      driverTireMgmt: opts.driverTireMgmt,
    });
    fuel = Math.max(0, fuel - fuelPerLap);
    tireAge += 1;
    const tireWearPct = clamp(
      (tireAge / (opts.compound === "soft" ? 18 : opts.compound === "medium" ? 26 : 36)) * 100 * tireWearRate,
      0,
      100
    );
    cumulative += lapTime;
    laps.push({
      lap,
      lapTimeSec: round(lapTime, 3),
      fuelKg: round(fuel, 2),
      tireAge,
      tireWearPct: round(tireWearPct, 1),
      compound: opts.compound,
      pitThisLap: false,
      cumulativeTime: round(cumulative, 3),
    });
  }
  return {
    laps,
    totalTime: round(cumulative, 3),
    finalFuelKg: round(fuel, 2),
  };
}

function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export interface StrategyPlan {
  id: string;
  label: string;
  description: string;
  stops: number;
  pitLaps: number[];
  compounds: Compound[];
  paceMode: PaceMode;
}

// Generate candidate strategy plans for a driver given current state
export function generateStrategyPlans(opts: {
  currentLap: number;
  totalLaps: number;
  currentCompound: Compound;
  currentTireAge: number;
  tireWearPct: number;
  weather: Weather;
  track: TrackData;
}): StrategyPlan[] {
  const { currentLap, totalLaps, currentCompound, currentTireAge, tireWearPct, weather, track } = opts;
  const lapsRemaining = totalLaps - currentLap;
  const plans: StrategyPlan[] = [];
  const isWet = weather === "wet" || weather === "damp";

  const compoundsFor: Compound[] = isWet
    ? ["inter", "wet", "inter"]
    : ["medium", "hard", "soft"];

  // 1-stop conservative
  if (lapsRemaining > 20) {
    const pitAt = currentLap + Math.round(lapsRemaining * 0.5);
    plans.push({
      id: "1stop-conservative",
      label: "1-Stop · Conservative",
      description: `Pit lap ${pitAt} for ${compoundsFor[1]}. Conserve pace, extend stint. Low risk, defends track position.`,
      stops: 1,
      pitLaps: [pitAt],
      compounds: [currentCompound, compoundsFor[1]],
      paceMode: "conserve",
    });
  }

  // 1-stop balanced
  if (lapsRemaining > 18) {
    const pitAt = currentLap + Math.round(lapsRemaining * 0.55);
    plans.push({
      id: "1stop-balanced",
      label: "1-Stop · Balanced",
      description: `Pit lap ${pitAt} for ${compoundsFor[0]}. Balanced pace throughout. Best for low-deg circuits.`,
      stops: 1,
      pitLaps: [pitAt],
      compounds: [currentCompound, compoundsFor[0]],
      paceMode: "balanced",
    });
  }

  // 2-stop aggressive (softs)
  if (lapsRemaining > 16 && !isWet) {
    const s1 = currentLap + Math.max(4, Math.round(lapsRemaining * 0.3));
    const s2 = currentLap + Math.round(lapsRemaining * 0.65);
    plans.push({
      id: "2stop-aggressive",
      label: "2-Stop · Aggressive",
      description: `Pit lap ${s1} (soft) and ${s2} (soft). Push pace, undercut rivals. High reward, higher risk.`,
      stops: 2,
      pitLaps: [s1, s2],
      compounds: [currentCompound, "soft", "soft"],
      paceMode: "push",
    });
  }

  // 2-stop balanced
  if (lapsRemaining > 16) {
    const s1 = currentLap + Math.round(lapsRemaining * 0.35);
    const s2 = currentLap + Math.round(lapsRemaining * 0.7);
    plans.push({
      id: "2stop-balanced",
      label: "2-Stop · Balanced",
      description: `Pit lap ${s1} (${compoundsFor[0]}) and ${s2} (${compoundsFor[0]}). Balanced medium-medium, robust to weather.`,
      stops: 2,
      pitLaps: [s1, s2],
      compounds: [currentCompound, compoundsFor[0], compoundsFor[0]],
      paceMode: "balanced",
    });
  }

  // Stay out — extend current stint (only if tire wear low)
  if (tireWearPct < 55 && lapsRemaining <= 24) {
    plans.push({
      id: "stay-out",
      label: "Stay Out · No Stop",
      description: `Continue on ${currentCompound} to the end. Track position over fresh rubber. Viable if tire age ${currentTireAge} manageable.`,
      stops: 0,
      pitLaps: [],
      compounds: [currentCompound],
      paceMode: "balanced",
    });
  }

  // Undercut now
  if (lapsRemaining > 14 && currentTireAge >= 8) {
    plans.push({
      id: "undercut-now",
      label: "Undercut · Pit Now",
      description: `Pit immediately for ${compoundsFor[2] || "soft"}. Aggressive undercut to jump rival ahead. Triggered by DRS window closing.`,
      stops: 1,
      pitLaps: [currentLap + 1],
      compounds: [currentCompound, compoundsFor[2] || "soft"],
      paceMode: "push",
    });
  }

  return plans;
}

// Run a full simulation of a strategy plan for a single driver
export function simulateStrategy(opts: {
  plan: StrategyPlan;
  startLap: number;
  totalLaps: number;
  startFuelKg: number;
  currentCompound: Compound;
  currentTireAge: number;
  weather: Weather;
  calibration: PracticeCalibration;
  track: TrackData;
  driverPaceRating: number;
  driverTireMgmt: number;
  driverFuelMgmt: number;
}): { laps: LapPrediction[]; totalTime: number; finalPosition: number; tireWearFinal: number } {
  const {
    plan,
    startLap,
    totalLaps,
    startFuelKg,
    currentCompound,
    currentTireAge,
    weather,
    calibration,
    track,
    driverPaceRating,
    driverTireMgmt,
    driverFuelMgmt,
  } = opts;

  const allLaps: LapPrediction[] = [];
  let fuel = startFuelKg;
  let tireAge = currentTireAge;
  let compound = currentCompound;
  let lapCursor = startLap;
  let cumulative = 0;

  const pitLaps = [...plan.pitLaps].sort((a, b) => a - b);
  let stopIndex = 0;

  while (lapCursor <= totalLaps) {
    const isPitLap = stopIndex < pitLaps.length && lapCursor === pitLaps[stopIndex];
    // simulate one stint up to next pit or end
    const nextPit = stopIndex < pitLaps.length ? pitLaps[stopIndex] : totalLaps + 1;
    const stintEnd = Math.min(nextPit - 1, totalLaps);
    const stintLapCount = stintEnd - lapCursor + 1;
    if (stintLapCount > 0) {
      const stint = simulateStint({
        startLap: lapCursor,
        lapCount: stintLapCount,
        compound,
        startTireAge: tireAge,
        startFuelKg: fuel,
        paceMode: plan.paceMode,
        weather,
        calibration,
        driverPaceRating,
        driverTireMgmt,
        driverFuelMgmt,
        pitLossSec: track.pitLossSec,
        isFirstStint: stopIndex === 0,
      });
      for (const l of stint.laps) {
        allLaps.push({ ...l, pitThisLap: false });
        cumulative = l.cumulativeTime;
      }
      fuel = stint.finalFuelKg;
      tireAge = stint.laps[stint.laps.length - 1]?.tireAge ?? tireAge;
    }
    if (isPitLap && stopIndex < pitLaps.length) {
      // pit stop: change compound, reset tire age, add pit loss
      const nextCompound = plan.compounds[stopIndex + 1] ?? plan.compounds[plan.compounds.length - 1];
      compound = nextCompound;
      tireAge = 0;
      cumulative += track.pitLossSec;
      // add a synthetic pit-lap entry so the cumulative trace shows the pit loss
      const pitLapNumber = stintEnd;
      if (allLaps.length > 0) {
        const prev = allLaps[allLaps.length - 1];
        allLaps.push({
          lap: pitLapNumber,
          lapTimeSec: round(track.pitLossSec, 3),
          fuelKg: round(fuel, 2),
          tireAge: 0,
          tireWearPct: 0,
          compound: nextCompound,
          pitThisLap: true,
          cumulativeTime: round(cumulative, 3),
        });
        // also mark the previous lap as pit lap
        prev.pitThisLap = true;
      }
      stopIndex += 1;
      lapCursor = stintEnd + 1;
    } else {
      lapCursor = stintEnd + 1;
    }
  }

  const finalWear = allLaps.length > 0 ? allLaps[allLaps.length - 1].tireWearPct : 0;
  return {
    laps: allLaps,
    totalTime: round(cumulative, 3),
    finalPosition: 0, // filled by race context
    tireWearFinal: finalWear,
  };
}

// Build full race outcome probabilities by simulating each strategy plan
// against a reference model of rivals (who run a balanced 2-stop).
export function simulateRaceOutcomes(opts: {
  session: RaceSessionData;
  track: TrackData;
  calibration: PracticeCalibration;
  driverId: string;
  horizonLaps: number;
}): PitStrategyOption[] {
  const { session, track, calibration, driverId, horizonLaps } = opts;
  const driver = getDriver(driverId);
  const driverState = session.driverStates.find((d) => d.driverId === driverId);
  if (!driverState) return [];

  const plans = generateStrategyPlans({
    currentLap: session.currentLap,
    totalLaps: session.totalLaps,
    currentCompound: driverState.tireCompound,
    currentTireAge: driverState.tireAgeLaps,
    tireWearPct: driverState.tireWearPct,
    weather: session.weather,
    track,
  });

  // Reference rival times: each rival runs balanced 2-stop
  const rivals = session.driverStates.filter((d) => d.driverId !== driverId);
  const rivalTotalTimes = rivals.map((r) => {
    const rivalDriver = getDriver(r.driverId);
    const refPlan: StrategyPlan = {
      id: "rival-ref",
      label: "Rival Reference",
      description: "",
      stops: 2,
      pitLaps: [
        session.currentLap + Math.round((session.totalLaps - session.currentLap) * 0.35),
        session.currentLap + Math.round((session.totalLaps - session.currentLap) * 0.7),
      ],
      compounds: [r.tireCompound, "medium", "medium"],
      paceMode: "balanced",
    };
    const sim = simulateStrategy({
      plan: refPlan,
      startLap: session.currentLap + 1,
      totalLaps: session.totalLaps,
      startFuelKg: r.fuelKg,
      currentCompound: r.tireCompound,
      currentTireAge: r.tireAgeLaps,
      weather: session.weather,
      calibration,
      track,
      driverPaceRating: rivalDriver.paceRating,
      driverTireMgmt: rivalDriver.tireMgmt,
      driverFuelMgmt: rivalDriver.fuelMgmt,
    });
    return { driverId: r.driverId, time: sim.totalTime };
  });

  return plans.map((plan) => {
    const sim = simulateStrategy({
      plan,
      startLap: session.currentLap + 1,
      totalLaps: session.totalLaps,
      startFuelKg: driverState.fuelKg,
      currentCompound: driverState.tireCompound,
      currentTireAge: driverState.tireAgeLaps,
      weather: session.weather,
      calibration,
      track,
      driverPaceRating: driver.paceRating,
      driverTireMgmt: driver.tireMgmt,
      driverFuelMgmt: driver.fuelMgmt,
    });

    // Compute expected position: count rivals with better total time + 1
    const rivalMeans = rivalTotalTimes.map((r) => r.time);
    const allTimes = [...rivalMeans, sim.totalTime].sort((a, b) => a - b);
    const expectedPosition = allTimes.indexOf(sim.totalTime) + 1;

    // Probabilistic outcome: sample from normal distributions around simulated times
    const riskScore = computeRisk(plan, track, driverState.tireWearPct, session.weather);
    const variance = 1.5 + riskScore * 2.5;
    const probs = computeFinishProbabilities(sim.totalTime, rivalMeans, variance);
    // risk penalty on win probability only
    const winProb = clamp(probs.win * (1 - riskScore * 0.3), 0, 0.95);
    const podiumProb = clamp(probs.podium, 0, 0.98);
    const top5Prob = clamp(probs.top5, 0, 0.99);
    const pointsProb = clamp(probs.points, 0, 1);

    const deltaToLeader = sim.totalTime - (allTimes[0] || sim.totalTime);

    return {
      id: plan.id,
      label: plan.label,
      description: plan.description,
      stops: plan.stops,
      pitLaps: plan.pitLaps,
      compounds: plan.compounds,
      paceMode: plan.paceMode,
      expectedPosition,
      finishProbabilities: {
        win: round(winProb, 3),
        podium: round(podiumProb, 3),
        top5: round(top5Prob, 3),
        points: round(pointsProb, 3),
      },
      riskScore: round(riskScore, 2),
      estimatedRaceTime: sim.totalTime,
      deltaToLeader: round(deltaToLeader, 2),
      reasoning: buildReasoning(plan, expectedPosition, riskScore, driverState, session.weather, track),
    };
  });
}

function computeRisk(plan: StrategyPlan, track: TrackData, tireWearPct: number, weather: Weather): number {
  let risk = plan.stops * 0.12;
  if (plan.paceMode === "push") risk += 0.22;
  if (plan.paceMode === "conserve") risk -= 0.08;
  if (track.overtaking === "hard") risk += 0.1;
  if (weather !== "dry") risk += 0.12;
  if (tireWearPct > 60) risk += 0.08;
  return clamp(risk, 0.05, 0.92);
}

// Compute finish probabilities by sampling from normal distributions around simulated total times.
// ourTime ~ N(ourMean, variance^2), rivalTime ~ N(rivalMean, variance^2).
// Returns { win, podium, top5, points } probabilities that sum correctly.
function computeFinishProbabilities(
  ourMean: number,
  rivalMeans: number[],
  variance: number
): { win: number; podium: number; top5: number; points: number } {
  const samples = 3000;
  let win = 0, podium = 0, top5 = 0, points = 0;
  for (let i = 0; i < samples; i++) {
    const ourTime = ourMean + (Math.random() - 0.5) * 2 * variance; // approx normal
    let pos = 1;
    for (const r of rivalMeans) {
      const rivalTime = r + (Math.random() - 0.5) * 2 * variance;
      if (rivalTime < ourTime) pos++;
    }
    if (pos === 1) win++;
    if (pos <= 3) podium++;
    if (pos <= 5) top5++;
    if (pos <= 10) points++;
  }
  return {
    win: win / samples,
    podium: podium / samples,
    top5: top5 / samples,
    points: points / samples,
  };
}

function buildReasoning(
  plan: StrategyPlan,
  expectedPosition: number,
  risk: number,
  state: DriverState,
  weather: Weather,
  track: TrackData
): string {
  const parts: string[] = [];
  if (expectedPosition <= 3) parts.push("Projects a podium finish on pace alone.");
  else if (expectedPosition <= 6) parts.push("Projects a points-scoring finish in the top 6.");
  else parts.push("Projects a finish outside the top 6 — consider higher-risk undercut.");
  if (plan.paceMode === "push") parts.push("Aggressive pace maximizes undercut but accelerates tire wear.");
  if (plan.stops === 1) parts.push(`Single stop exploits ${track.degradation} deg characteristic of ${track.name.split(" ")[0]}.`);
  if (weather !== "dry") parts.push("Weather adds variance; favor compounds with wider operating window.");
  if (state.tireWearPct > 60) parts.push(`Current tire wear ${state.tireWearPct.toFixed(0)}% — pit window opening now.`);
  if (risk > 0.6) parts.push("High risk profile: execute only with clear track position upside.");
  return parts.join(" ");
}

// Build a SimulationResult for both RB drivers
export function buildSimulationResult(opts: {
  session: RaceSessionData;
  track: TrackData;
  horizonLaps: number;
}): SimulationResult {
  const calibration = getCalibration(opts.track.id);
  const rbDrivers = opts.session.driverStates.filter((d) => {
    const drv = getDriver(d.driverId);
    return drv.isOurs;
  });

  const allOptions: PitStrategyOption[] = [];
  for (const ds of rbDrivers) {
    const options = simulateRaceOutcomes({
      session: opts.session,
      track: opts.track,
      calibration,
      driverId: ds.driverId,
      horizonLaps: opts.horizonLaps,
    });
    // tag each option with driver code for grouping
    const drv = getDriver(ds.driverId);
    for (const o of options) {
      allOptions.push({ ...o, id: `${drv.code}::${o.id}`, label: `${drv.code} · ${o.label}` });
    }
  }

  // pick best by podium probability
  const best = allOptions.reduce(
    (acc, o) =>
      o.finishProbabilities.podium > (acc?.finishProbabilities.podium ?? -1)
        ? o
        : acc,
    allOptions[0]
  );

  const expectedPositions = rbDrivers.map((ds) => {
    const drvOptions = allOptions.filter((o) => o.id.startsWith(getDriver(ds.driverId).code + "::"));
    const best = drvOptions.reduce(
      (a, o) => (o.finishProbabilities.podium > (a?.finishProbabilities.podium ?? -1) ? o : a),
      drvOptions[0]
    );
    return {
      driverCode: getDriver(ds.driverId).code,
      position: best?.expectedPosition ?? ds.position,
      confidence: clamp(1 - (best?.riskScore ?? 0.5), 0, 1),
    };
  });

  return {
    sessionId: opts.session.id,
    label: `L${opts.session.currentLap} → L${opts.session.currentLap + opts.horizonLaps} forecast`,
    horizonLaps: opts.horizonLaps,
    options: allOptions,
    summary: {
      bestOptionId: best?.id ?? "",
      winProbability: best?.finishProbabilities.win ?? 0,
      podiumProbability: best?.finishProbabilities.podium ?? 0,
      expectedPositions,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---- What-if simulator: custom config → live recomputed outcome ----
export function simulateWhatIf(opts: {
  session: RaceSessionData;
  track: TrackData;
  config: import("./types").WhatIfConfig;
  baselineOption?: PitStrategyOption | null;
}): import("./types").WhatIfResult {
  const calibration = getCalibration(opts.track.id);
  const driver = getDriver(opts.config.driverId);
  const driverState = opts.session.driverStates.find((d) => d.driverId === opts.config.driverId);
  if (!driverState) {
    return {
      config: opts.config,
      estimatedRaceTime: 0,
      expectedPosition: 0,
      finishProbabilities: { win: 0, podium: 0, top5: 0, points: 0 },
      riskScore: 0,
      lapTrace: [],
      deltaToBaseline: 0,
    };
  }

  // validate pit laps: must be > current lap, sorted, distinct
  const pitLaps = [...opts.config.pitLaps]
    .filter((l) => l > opts.session.currentLap && l <= opts.session.totalLaps)
    .sort((a, b) => a - b)
    .filter((l, i, arr) => i === 0 || l !== arr[i - 1])
    .slice(0, opts.config.stops);

  const plan: StrategyPlan = {
    id: "whatif",
    label: "What-If",
    description: "",
    stops: opts.config.stops,
    pitLaps,
    compounds: opts.config.compounds,
    paceMode: opts.config.paceMode,
  };

  const sim = simulateStrategy({
    plan,
    startLap: opts.session.currentLap + 1,
    totalLaps: opts.session.totalLaps,
    startFuelKg: driverState.fuelKg,
    currentCompound: driverState.tireCompound,
    currentTireAge: driverState.tireAgeLaps,
    weather: opts.session.weather,
    calibration,
    track: opts.track,
    driverPaceRating: driver.paceRating,
    driverTireMgmt: driver.tireMgmt,
    driverFuelMgmt: driver.fuelMgmt,
  });

  // rivals reference (balanced 2-stop)
  const rivals = opts.session.driverStates.filter((d) => d.driverId !== opts.config.driverId);
  const rivalTimes = rivals.map((r) => {
    const rd = getDriver(r.driverId);
    const refPlan: StrategyPlan = {
      id: "ref",
      label: "",
      description: "",
      stops: 2,
      pitLaps: [
        opts.session.currentLap + Math.round((opts.session.totalLaps - opts.session.currentLap) * 0.35),
        opts.session.currentLap + Math.round((opts.session.totalLaps - opts.session.currentLap) * 0.7),
      ],
      compounds: [r.tireCompound, "medium", "medium"],
      paceMode: "balanced",
    };
    const rs = simulateStrategy({
      plan: refPlan,
      startLap: opts.session.currentLap + 1,
      totalLaps: opts.session.totalLaps,
      startFuelKg: r.fuelKg,
      currentCompound: r.tireCompound,
      currentTireAge: r.tireAgeLaps,
      weather: opts.session.weather,
      calibration,
      track: opts.track,
      driverPaceRating: rd.paceRating,
      driverTireMgmt: rd.tireMgmt,
      driverFuelMgmt: rd.fuelMgmt,
    });
    return rs.totalTime;
  });

  const rivalMeans = rivalTimes;
  const allTimes = [...rivalMeans, sim.totalTime].sort((a, b) => a - b);
  const expectedPosition = allTimes.indexOf(sim.totalTime) + 1;
  const riskScore = computeRisk(plan, opts.track, driverState.tireWearPct, opts.session.weather);
  const variance = 1.5 + riskScore * 2.5;

  const lapTrace = sim.laps.map((l) => ({
    lap: l.lap,
    lapTimeSec: l.lapTimeSec,
    cumulativeTime: l.cumulativeTime,
    compound: l.compound,
    pitThisLap: l.pitThisLap,
  }));

  const baselineTime = opts.baselineOption?.estimatedRaceTime ?? sim.totalTime;
  const deltaToBaseline = round(sim.totalTime - baselineTime, 3);

  const probs = computeFinishProbabilities(sim.totalTime, rivalMeans, variance);
  const winProb = clamp(probs.win * (1 - riskScore * 0.3), 0, 0.95);
  const podiumProb = clamp(probs.podium, 0, 0.98);
  const top5Prob = clamp(probs.top5, 0, 0.99);
  const pointsProb = clamp(probs.points, 0, 1);

  return {
    config: opts.config,
    estimatedRaceTime: sim.totalTime,
    expectedPosition,
    finishProbabilities: {
      win: round(winProb, 3),
      podium: round(podiumProb, 3),
      top5: round(top5Prob, 3),
      points: round(pointsProb, 3),
    },
    riskScore: round(riskScore, 2),
    lapTrace,
    deltaToBaseline,
  };
}

// ---- Strategy comparison: overlay multiple options on a single lap-trace chart ----
export function buildStrategyComparison(opts: {
  session: RaceSessionData;
  track: TrackData;
  driverId: string;
  optionIds?: string[]; // if provided, compare only these; else compare all generated
}): import("./types").StrategyComparison {
  const calibration = getCalibration(opts.track.id);
  const driver = getDriver(opts.driverId);
  const driverState = opts.session.driverStates.find((d) => d.driverId === opts.driverId);
  const colors = ["#dc2626", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#06b6d4"];
  const traces: import("./types").StrategyComparisonTrace[] = [];

  if (!driverState) {
    return { driverCode: driver.code, traces: [], summary: { fastestOptionId: "", slowestOptionId: "", spreadSec: 0 } };
  }

  const plans = generateStrategyPlans({
    currentLap: opts.session.currentLap,
    totalLaps: opts.session.totalLaps,
    currentCompound: driverState.tireCompound,
    currentTireAge: driverState.tireAgeLaps,
    tireWearPct: driverState.tireWearPct,
    weather: opts.session.weather,
    track: opts.track,
  }).filter((p) => (opts.optionIds ? opts.optionIds.includes(p.id) : true));

  let fastestTime = Infinity;
  let fastestId = "";
  let slowestTime = -Infinity;
  let slowestId = "";

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const sim = simulateStrategy({
      plan,
      startLap: opts.session.currentLap + 1,
      totalLaps: opts.session.totalLaps,
      startFuelKg: driverState.fuelKg,
      currentCompound: driverState.tireCompound,
      currentTireAge: driverState.tireAgeLaps,
      weather: opts.session.weather,
      calibration,
      track: opts.track,
      driverPaceRating: driver.paceRating,
      driverTireMgmt: driver.tireMgmt,
      driverFuelMgmt: driver.fuelMgmt,
    });
    const allRivalTimes = opts.session.driverStates
      .filter((d) => d.driverId !== opts.driverId)
      .map((r) => {
        const rd = getDriver(r.driverId);
        const refPlan: StrategyPlan = {
          id: "ref", label: "", description: "",
          stops: 2,
          pitLaps: [
            opts.session.currentLap + Math.round((opts.session.totalLaps - opts.session.currentLap) * 0.35),
            opts.session.currentLap + Math.round((opts.session.totalLaps - opts.session.currentLap) * 0.7),
          ],
          compounds: [r.tireCompound, "medium", "medium"],
          paceMode: "balanced",
        };
        return simulateStrategy({
          plan: refPlan,
          startLap: opts.session.currentLap + 1,
          totalLaps: opts.session.totalLaps,
          startFuelKg: r.fuelKg,
          currentCompound: r.tireCompound,
          currentTireAge: r.tireAgeLaps,
          weather: opts.session.weather,
          calibration,
          track: opts.track,
          driverPaceRating: rd.paceRating,
          driverTireMgmt: rd.tireMgmt,
          driverFuelMgmt: rd.fuelMgmt,
        }).totalTime;
      });
    const rivalMeans = allRivalTimes;
    const allTimes = [...rivalMeans, sim.totalTime].sort((a, b) => a - b);
    const expectedPosition = allTimes.indexOf(sim.totalTime) + 1;
    const riskScore = computeRisk(plan, opts.track, driverState.tireWearPct, opts.session.weather);
    const variance = 1.5 + riskScore * 2.5;

    const laps = sim.laps.map((l) => ({
      lap: l.lap,
      cumulativeTime: l.cumulativeTime,
      lapTimeSec: l.lapTimeSec,
      compound: l.compound,
      pitThisLap: l.pitThisLap,
    }));

    if (sim.totalTime < fastestTime) {
      fastestTime = sim.totalTime;
      fastestId = `${driver.code}::${plan.id}`;
    }
    if (sim.totalTime > slowestTime) {
      slowestTime = sim.totalTime;
      slowestId = `${driver.code}::${plan.id}`;
    }

    const probs = computeFinishProbabilities(sim.totalTime, rivalMeans, variance);
    const podiumProb = clamp(probs.podium, 0, 0.98);

    traces.push({
      optionId: `${driver.code}::${plan.id}`,
      label: plan.label,
      color: colors[i % colors.length],
      driverCode: driver.code,
      laps,
      totalRaceTime: sim.totalTime,
      expectedPosition,
      podiumProb: round(podiumProb, 3),
    });
  }

  return {
    driverCode: driver.code,
    traces,
    summary: {
      fastestOptionId: fastestId,
      slowestOptionId: slowestId,
      spreadSec: round(slowestTime - fastestTime, 3),
    },
  };
}
