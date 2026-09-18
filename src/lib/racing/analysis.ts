// Post-Race Analysis Suite
// Compares actual vs simulated race outcomes, identifies deviation events
// (safety cars, yellow flags, tire wear variance, weather changes), and
// builds actionable playbooks fed back into simulator calibration.

import type { PostRaceAnalysisData, RaceSessionData, PlaybookData, TrackData } from "./types";
import { getDriver, getTrack } from "./data";

function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export function buildPostRaceAnalysis(opts: {
  session: RaceSessionData;
  predictedPositions: { driverCode: string; position: number }[];
}): PostRaceAnalysisData {
  const { session, predictedPositions } = opts;

  const driverDeltas = session.driverStates.map((ds) => {
    const driver = getDriver(ds.driverId);
    const predicted = predictedPositions.find((p) => p.driverCode === driver.code)?.position ?? ds.position;
    const actualPosition = ds.position;
    const delta = actualPosition - predicted;
    const actualTime = (ds.avgLapSec ?? 90) * session.totalLaps;
    const predictedTime = actualTime - delta * 1.8;
    return {
      driverCode: driver.code,
      driverName: driver.name,
      actualPosition,
      predictedPosition: predicted,
      delta,
      withinOne: Math.abs(delta) <= 1,
      actualTime: round(actualTime, 1),
      predictedTime: round(predictedTime, 1),
    };
  });

  const accuracyScore = driverDeltas.filter((d) => d.withinOne).length / driverDeltas.length;

  // Generate deviation events (synthesized retrospective)
  const deviations: PostRaceAnalysisData["deviations"] = [];
  const midLap = Math.round(session.totalLaps / 2);
  if (session.weather !== "dry") {
    deviations.push({
      lap: midLap,
      type: "weather-change",
      description: `Weather shifted to ${session.weather} mid-race, forcing unplanned tire stop for 4 cars.`,
      impactSec: 23.5,
    });
  }
  // safety car probability based on field
  if (session.driverStates.some((d) => d.retired)) {
    deviations.push({
      lap: midLap - 3,
      type: "safety-car",
      description: "Safety car deployed after incident at T1. Bunched field erased 8s gap for lead RB car.",
      impactSec: -12.4,
    });
  }
  // tire variance
  const highWear = session.driverStates.find((d) => d.tireWearPct > 75);
  if (highWear) {
    const drv = getDriver(highWear.driverId);
    deviations.push({
      lap: Math.round(session.totalLaps * 0.6),
      type: "tire-variance",
      description: `${drv.code} experienced +15% tire wear vs simulator prediction. Cliff arrived 3 laps early.`,
      impactSec: 6.8,
    });
  }
  // yellow flag
  deviations.push({
    lap: Math.round(session.totalLaps * 0.4),
    type: "yellow-flag",
    description: "Sector 2 yellow flag for 2 laps. Sector times +1.2s above green-flag prediction.",
    impactSec: 2.4,
  });
  // rival stop
  const rival = session.driverStates.find((d) => !getDriver(d.driverId).isOurs && d.pitStops > 0);
  if (rival) {
    const r = getDriver(rival.driverId);
    deviations.push({
      lap: Math.round(session.totalLaps * 0.35),
      type: "rival-stop",
      description: `${r.code} (${r.team}) pitted 2 laps earlier than predicted — undercut gained 1 position on our car.`,
      impactSec: 4.1,
    });
  }

  return {
    id: "analysis_" + session.id,
    sessionId: session.id,
    driverDeltas: driverDeltas.sort((a, b) => a.actualPosition - b.actualPosition),
    deviations,
    accuracyScore: round(accuracyScore, 3),
    notes: `Simulator predicted finishing order within 1 position for ${(accuracyScore * 100).toFixed(0)}% of field.`,
  };
}

export function buildPlaybooks(opts: {
  session: RaceSessionData;
  analysis: PostRaceAnalysisData;
}): PlaybookData[] {
  const track: TrackData = getTrack(opts.session.trackId);
  const playbooks: PlaybookData[] = [];

  // Playbook 1: based on track deg characteristic
  const twoStopWinRate = track.degradation === "high" ? 0.68 : track.degradation === "medium" ? 0.55 : 0.42;
  playbooks.push({
    id: "pb_" + track.id + "_2stop",
    trackId: track.id,
    title: `${track.name.split(" ")[0]}: 2-Stop on ${track.degradation}-deg`,
    scenario: `2-stop race on ${track.degradation}-degradation circuit, dry conditions`,
    ruleText: `In a 2-stop race on ${track.degradation}-deg circuits like ${track.name}, Strategy A (medium-medium, balanced pace) wins ${twoStopWinRate * 100}% of the time. Pit windows: 35% and 70% of race distance. Avoid soft compound beyond lap ${track.degradation === "high" ? 12 : 18}.`,
    winRate: twoStopWinRate,
  });

  // Playbook 2: undercut trigger
  playbooks.push({
    id: "pb_" + track.id + "_undercut",
    trackId: track.id,
    title: `${track.name.split(" ")[0]}: Undercut Trigger`,
    scenario: `Defending position under DRS pressure from rival within 1.2s`,
    ruleText: `When rival closes to within 1.2s on DRS-enabled lap and current stint ≥ 12 laps, execute undercut within 2 laps. Aggressive pace on fresh soft for 8-lap burst. Net gain: 1 position in 71% of cases.`,
    winRate: 0.71,
  });

  // Playbook 3: weather adaptation
  if (opts.session.rainProb > 0.3) {
    playbooks.push({
      id: "pb_" + track.id + "_weather",
      trackId: track.id,
      title: `${track.name.split(" ")[0]}: Wet Transition`,
      scenario: `Rain probability > 30%, transitioning dry → damp`,
      ruleText: `At rain prob > 60% with track temp < 30°C, switch to inters at next stop. Delay stop by 1-2 laps to bank dry pace. Pit both cars within same lap window to avoid double-stack delay > 3s.`,
      winRate: 0.64,
    });
  }

  // Playbook 4: derived from analysis accuracy
  const acc = opts.analysis.accuracyScore;
  playbooks.push({
    id: "pb_" + track.id + "_calibration",
    trackId: track.id,
    title: `${track.name.split(" ")[0]}: Calibration Update`,
    scenario: `Simulator accuracy feedback loop`,
    ruleText: `Simulator achieved ${(acc * 100).toFixed(0)}% within-1-position accuracy this race. ${acc >= 0.75 ? "Calibration healthy — maintain current tire deg model." : "Update tire degradation cliff multiplier by +0.2 and fuel sensitivity by +0.002 for next calibration cycle."}`,
    winRate: acc,
  });

  return playbooks;
}
