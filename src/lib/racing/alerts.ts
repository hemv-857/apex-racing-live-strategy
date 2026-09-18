// Rules-based alert engine — generates strategy notifications from live race state.
// Examples: "DRS window closes in 3 laps—pit now or gain 2 positions"

import type { AlertData, AlertCategory, AlertSeverity, DriverState, RaceSessionData, TrackData } from "./types";
import { getDriver } from "./data";

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export function generateAlerts(opts: {
  session: RaceSessionData;
  track: TrackData;
}): AlertData[] {
  const { session, track } = opts;
  const alerts: AlertData[] = [];
  const now = new Date().toISOString();

  const ourDrivers = session.driverStates.filter((d) => getDriver(d.driverId).isOurs);

  for (const ds of ourDrivers) {
    const driver = getDriver(ds.driverId);

    // Tire wear alerts
    if (ds.tireWearPct >= 70) {
      const lapsLeft = Math.max(1, Math.round((100 - ds.tireWearPct) / (ds.tireWearPct / Math.max(1, ds.tireAgeLaps))));
      alerts.push({
        id: uid(),
        sessionId: session.id,
        severity: ds.tireWearPct >= 85 ? "critical" : "warning",
        category: "tire",
        title: `${driver.code} tire cliff approaching`,
        message: `${driver.name}'s ${ds.tireCompound} tire at ${ds.tireWearPct.toFixed(0)}% wear (age ${ds.tireAgeLaps}L). Estimated ${lapsLeft} lap${lapsLeft === 1 ? "" : "s"} to cliff. Pit window opening.`,
        actionLabel: "Open Strategy Tree",
        actionPayload: JSON.stringify({ driverId: ds.driverId, focus: "tire" }),
        acknowledged: false,
        createdAt: now,
      });
    }

    // DRS window alerts
    if (ds.gapAheadSec !== null) {
      if (ds.gapAheadSec <= 1.0 && ds.drsAvailable) {
        alerts.push({
          id: uid(),
          sessionId: session.id,
          severity: "opportunity",
          category: "drs",
          title: `${driver.code} DRS attack window open`,
          message: `${driver.name} within ${ds.gapAheadSec.toFixed(2)}s of P${ds.position - 1}. DRS active — overtake opportunity this lap.`,
          actionLabel: "Send Push Pace Call",
          actionPayload: JSON.stringify({ driverCode: driver.code, pace: "push" }),
          acknowledged: false,
          createdAt: now,
        });
      }
      // DRS closing window — rival behind within DRS range
      if (ds.gapBehindSec !== null && ds.gapBehindSec <= 1.2) {
        alerts.push({
          id: uid(),
          sessionId: session.id,
          severity: "warning",
          category: "drs",
          title: `${driver.code} under DRS pressure`,
          message: `Rival within ${ds.gapBehindSec.toFixed(2)}s behind ${driver.name}. DRS window closes in ~3 laps — pit now or defend position.`,
          actionLabel: "Evaluate Undercut",
          actionPayload: JSON.stringify({ driverId: ds.driverId, focus: "undercut" }),
          acknowledged: false,
          createdAt: now,
        });
      }
    }

    // Fuel alerts
    const lapsRemaining = session.totalLaps - session.currentLap;
    const fuelPerLapEst = 1.55;
    const fuelNeeded = lapsRemaining * fuelPerLapEst;
    if (ds.fuelKg < fuelNeeded * 0.95 && ds.fuelKg < fuelNeeded) {
      alerts.push({
        id: uid(),
        sessionId: session.id,
        severity: "warning",
        category: "fuel",
        title: `${driver.code} fuel margin tight`,
        message: `${driver.name} has ${ds.fuelKg.toFixed(1)}kg, needs ~${fuelNeeded.toFixed(1)}kg to finish. Switch to conserve mode to save ${((fuelNeeded - ds.fuelKg) / fuelPerLapEst * 2).toFixed(1)} laps.`,
        actionLabel: "Send Conserve Call",
        actionPayload: JSON.stringify({ driverCode: driver.code, pace: "conserve" }),
        acknowledged: false,
        createdAt: now,
      });
    }

    // Pit window opportunity
    if (ds.stintLap >= 12 && ds.tireWearPct < 70 && ds.gapAheadSec !== null && ds.gapAheadSec > 2.5) {
      alerts.push({
        id: uid(),
        sessionId: session.id,
        severity: "info",
        category: "pit",
        title: `${driver.code} undercut window`,
        message: `${driver.name} on lap ${ds.stintLap} of stint, gap ahead ${ds.gapAheadSec.toFixed(1)}s. Undercut now could gain 1 position before rival stops.`,
        actionLabel: "Run Simulation",
        actionPayload: JSON.stringify({ driverId: ds.driverId, focus: "undercut" }),
        acknowledged: false,
        createdAt: now,
      });
    }
  }

  // Weather alerts
  if (session.rainProb > 0.45) {
    alerts.push({
      id: uid(),
      sessionId: session.id,
      severity: session.rainProb > 0.7 ? "critical" : "warning",
      category: "weather",
      title: "Rain probability rising",
      message: `Rain probability at ${(session.rainProb * 100).toFixed(0)}%. Prepare inter/wet tires. Consider early stop to bank track position.`,
      actionLabel: "View Wet Strategy",
      actionPayload: JSON.stringify({ focus: "weather" }),
      acknowledged: false,
      createdAt: now,
    });
  }

  // Rival pit activity
  const rivalJustPitted = session.driverStates.find(
    (d) => !getDriver(d.driverId).isOurs && d.stintLap <= 2 && d.pitStops >= 1
  );
  if (rivalJustPitted) {
    const rival = getDriver(rivalJustPitted.driverId);
    alerts.push({
      id: uid(),
      sessionId: session.id,
      severity: "info",
      category: "rival",
      title: `${rival.code} pitted — undercut risk`,
      message: `${rival.name} (${rival.team}) on fresh ${rivalJustPitted.tireCompound}. Expect 0.4-0.8s/lap pace advantage for next 5 laps. Cover stop decision needed.`,
      actionLabel: "Simulate Cover Stop",
      actionPayload: JSON.stringify({ rivalCode: rival.code, focus: "cover" }),
      acknowledged: false,
      createdAt: now,
    });
  }

  // sort by severity priority
  const order: Record<AlertSeverity, number> = { critical: 0, opportunity: 1, warning: 2, info: 3 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
