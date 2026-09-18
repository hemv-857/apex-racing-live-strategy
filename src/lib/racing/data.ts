import type { TrackData, DriverData, PracticeCalibration, TireDegCurve } from "./types";

// Circuit catalogue — each track includes an SVG layout path on a 1000x600 viewBox
// plus calibration data derived from Friday/Saturday practice.

export const TRACKS: TrackData[] = [
  {
    id: "suzuka",
    name: "Suzuka International Racing Course",
    country: "Japan",
    city: "Suzuka",
    lapLengthKm: 5.807,
    totalLaps: 53,
    corners: 18,
    drsZones: 2,
    degradation: "high",
    overtaking: "hard",
    aeroDemand: "high",
    fuelSensitivity: 0.032,
    pitLossSec: 21.5,
    // Figure-8 layout approximated
    layoutPath:
      "M 120,460 C 90,420 110,360 170,350 C 230,340 270,360 300,320 C 330,280 300,230 340,200 C 390,160 460,190 480,240 C 500,290 460,330 500,360 C 540,390 600,360 640,330 C 690,290 760,300 800,340 C 840,380 870,360 880,300 C 890,240 860,190 800,180 C 740,170 700,200 660,170 C 620,140 640,90 690,80 C 740,70 800,90 820,140 C 840,190 880,180 880,140 C 880,100 840,80 790,90 C 740,100 700,140 650,160 C 600,180 560,150 520,130 C 480,110 430,130 410,170 C 390,210 350,200 320,230 C 290,260 260,250 230,280 C 200,310 180,350 150,370 C 120,390 100,420 120,460 Z",
    sectors: [0.36, 0.68, 1.0],
  },
  {
    id: "monza",
    name: "Autodromo Nazionale Monza",
    country: "Italy",
    city: "Monza",
    lapLengthKm: 5.793,
    totalLaps: 53,
    corners: 11,
    drsZones: 2,
    degradation: "low",
    overtaking: "easy",
    aeroDemand: "low",
    fuelSensitivity: 0.028,
    pitLossSec: 23.0,
    layoutPath:
      "M 140,180 C 200,170 260,180 320,200 C 380,220 440,210 500,200 C 560,190 620,200 680,220 C 740,240 800,260 840,240 C 880,220 870,180 830,160 C 790,140 740,160 700,170 C 660,180 620,160 580,140 C 540,120 480,110 420,120 C 360,130 300,150 240,150 C 180,150 120,160 140,180 Z",
    sectors: [0.33, 0.66, 1.0],
  },
  {
    id: "silverstone",
    name: "Silverstone Circuit",
    country: "Great Britain",
    city: "Silverstone",
    lapLengthKm: 5.891,
    totalLaps: 52,
    corners: 18,
    drsZones: 2,
    degradation: "medium",
    overtaking: "medium",
    aeroDemand: "medium",
    fuelSensitivity: 0.030,
    pitLossSec: 20.5,
    layoutPath:
      "M 150,200 C 200,180 260,170 320,180 C 380,190 420,220 460,250 C 500,280 540,260 580,240 C 620,220 680,210 740,220 C 800,230 850,260 880,310 C 900,350 880,400 830,420 C 780,440 720,430 680,400 C 640,370 600,380 560,400 C 520,420 480,440 440,430 C 400,420 360,390 330,360 C 300,330 260,320 220,310 C 180,300 140,290 150,250 C 155,225 150,200 150,200 Z",
    sectors: [0.34, 0.67, 1.0],
  },
];

// Driver roster — 2 RB drivers (isOurs) + 6 rivals
export const DRIVERS: DriverData[] = [
  {
    id: "drv-ts",
    name: "T. Saito",
    code: "SAI",
    number: 22,
    team: "Apex Racing",
    teamColor: "#1e3a8a",
    isOurs: true,
    paceRating: 1.00,
    tireMgmt: 0.78,
    fuelMgmt: 0.72,
  },
  {
    id: "drv-lr",
    name: "L. Romano",
    code: "ROM",
    number: 14,
    team: "Apex Racing",
    teamColor: "#dc2626",
    isOurs: true,
    paceRating: 0.99,
    tireMgmt: 0.82,
    fuelMgmt: 0.75,
  },
  {
    id: "drv-mv",
    name: "M. Voss",
    code: "VOS",
    number: 1,
    team: "Red Phoenix",
    teamColor: "#0ea5e9",
    isOurs: false,
    paceRating: 1.03,
    tireMgmt: 0.85,
    fuelMgmt: 0.80,
  },
  {
    id: "drv-jc",
    name: "J. Carter",
    code: "CAR",
    number: 16,
    team: "Scuderia Leone",
    teamColor: "#f59e0b",
    isOurs: false,
    paceRating: 1.02,
    tireMgmt: 0.80,
    fuelMgmt: 0.78,
  },
  {
    id: "drv-ak",
    name: "A. Kim",
    code: "KIM",
    number: 4,
    team: "Silver Arrows",
    teamColor: "#10b981",
    isOurs: false,
    paceRating: 1.01,
    tireMgmt: 0.76,
    fuelMgmt: 0.82,
  },
  {
    id: "drv-nh",
    name: "N. Holm",
    code: "HOL",
    number: 7,
    team: "Apex GP",
    teamColor: "#a855f7",
    isOurs: false,
    paceRating: 1.00,
    tireMgmt: 0.79,
    fuelMgmt: 0.77,
  },
  {
    id: "drv-ep",
    name: "E. Petrov",
    code: "PET",
    number: 27,
    team: "Astro Racing",
    teamColor: "#ec4899",
    isOurs: false,
    paceRating: 0.98,
    tireMgmt: 0.74,
    fuelMgmt: 0.70,
  },
  {
    id: "drv-rf",
    name: "R. Ferreira",
    code: "FER",
    number: 55,
    team: "Velocity Works",
    teamColor: "#14b8a6",
    isOurs: false,
    paceRating: 0.99,
    tireMgmt: 0.77,
    fuelMgmt: 0.73,
  },
];

// Practice calibration per track (aero maps + tire degradation curves)
function makeTireCurve(base: number, perLap: number, cliff: number, mult: number): TireDegCurve {
  return { baseLapSec: base, perLapDegradation: perLap, cliffLap: cliff, cliffMultiplier: mult };
}

export const PRACTICE_CALIBRATION: PracticeCalibration[] = [
  {
    trackId: "suzuka",
    aeroMap: [
      { downforce: "low", dragDeltaSec: 0.4, downforceGainSec: -1.2, topSpeedKph: 348 },
      { downforce: "medium", dragDeltaSec: 0.9, downforceGainSec: -1.8, topSpeedKph: 332 },
      { downforce: "high", dragDeltaSec: 1.6, downforceGainSec: -2.6, topSpeedKph: 318 },
    ],
    fuelPerLapKg: 1.62,
    baselineLapSec: 91.5,
    tireDegradation: {
      soft: makeTireCurve(91.0, 0.18, 12, 2.4),
      medium: makeTireCurve(91.5, 0.10, 20, 2.0),
      hard: makeTireCurve(92.2, 0.06, 28, 1.7),
    },
    notes: "High-deg circuit; medium compound favors 2-stop. Soft cliff at lap 12.",
  },
  {
    trackId: "monza",
    aeroMap: [
      { downforce: "low", dragDeltaSec: 0.2, downforceGainSec: -0.4, topSpeedKph: 362 },
      { downforce: "medium", dragDeltaSec: 0.8, downforceGainSec: -0.7, topSpeedKph: 344 },
      { downforce: "high", dragDeltaSec: 1.4, downforceGainSec: -1.0, topSpeedKph: 330 },
    ],
    fuelPerLapKg: 1.45,
    baselineLapSec: 81.2,
    tireDegradation: {
      soft: makeTireCurve(80.8, 0.10, 16, 2.0),
      medium: makeTireCurve(81.2, 0.06, 24, 1.8),
      hard: makeTireCurve(81.8, 0.04, 34, 1.5),
    },
    notes: "Low deg; one-stop viable. Slipstream critical on long straights.",
  },
  {
    trackId: "silverstone",
    aeroMap: [
      { downforce: "low", dragDeltaSec: 0.3, downforceGainSec: -0.8, topSpeedKph: 352 },
      { downforce: "medium", dragDeltaSec: 0.7, downforceGainSec: -1.3, topSpeedKph: 338 },
      { downforce: "high", dragDeltaSec: 1.3, downforceGainSec: -2.0, topSpeedKph: 322 },
    ],
    fuelPerLapKg: 1.55,
    baselineLapSec: 87.4,
    tireDegradation: {
      soft: makeTireCurve(87.0, 0.14, 14, 2.2),
      medium: makeTireCurve(87.4, 0.08, 22, 1.9),
      hard: makeTireCurve(88.0, 0.05, 30, 1.6),
    },
    notes: "Medium deg; 2-stop standard. Watch for sudden weather shifts.",
  },
];

export function getTrack(id: string): TrackData {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

export function getDriver(id: string): DriverData {
  return DRIVERS.find((d) => d.id === id) ?? DRIVERS[0];
}

export function getCalibration(trackId: string): PracticeCalibration {
  return PRACTICE_CALIBRATION.find((p) => p.trackId === trackId) ?? PRACTICE_CALIBRATION[0];
}
