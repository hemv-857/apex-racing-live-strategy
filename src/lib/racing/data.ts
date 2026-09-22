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
    // Figure-8 with crossover — S-curves, Degner, hairpin, Spoon, 130R, chicane
    layoutPath:
      "M 160,515 C 240,545 350,550 450,535 C 510,527 555,505 575,475 C 595,445 590,418 568,415 C 546,412 535,438 558,462 C 581,486 625,500 668,497 C 711,494 745,472 755,443 C 765,414 752,392 730,395 C 708,398 705,430 732,448 C 759,466 800,468 828,452 C 856,436 868,410 864,382 C 860,354 844,346 828,360 C 812,374 824,402 852,412 C 880,422 902,408 908,384 C 914,360 904,344 888,350 L 812,278 C 798,262 778,265 772,288 C 766,311 784,332 808,334 C 832,336 858,322 866,302 C 874,282 862,270 848,282 C 834,294 848,314 870,322 C 892,330 912,320 918,302 L 465,540 C 370,562 270,558 160,515 Z",
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
    // Long straights, Prima Variante/Roggia/Ascari chicanes, Lesmos, Parabolica
    layoutPath:
      "M 180,535 L 690,535 C 748,535 795,515 810,478 C 825,448 805,425 780,435 C 755,445 760,475 790,485 C 820,495 855,478 870,448 C 898,390 892,322 872,282 C 862,262 842,268 839,293 C 836,318 858,333 876,316 C 894,299 891,268 871,248 C 851,228 826,240 821,268 C 816,295 796,310 768,323 L 588,378 C 558,389 538,378 540,352 C 542,326 514,320 501,345 C 488,370 518,392 550,375 L 370,535 C 350,563 315,575 275,572 C 235,569 180,558 180,535 Z",
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
    // Abbey/Village loop, Wellington straight, Brooklands/Luffield, Copse, Maggotts-Becketts, Hangar, Stowe, Vale
    layoutPath:
      "M 200,500 C 170,470 175,435 210,420 C 245,405 290,425 310,460 C 330,495 310,530 275,538 C 240,546 210,535 205,510 C 200,490 225,478 255,485 C 320,500 400,490 460,465 C 520,440 560,405 575,375 C 590,345 575,325 550,335 C 525,345 530,380 565,395 C 600,410 655,405 700,385 C 745,365 775,335 785,305 C 795,275 778,255 755,268 C 732,281 740,315 775,330 C 810,345 865,340 905,310 C 945,280 955,245 940,225 C 925,205 895,215 895,245 C 895,275 925,295 960,295 C 990,295 998,275 990,255 L 750,185 C 730,170 705,175 695,200 C 685,225 705,250 740,255 C 775,260 810,245 825,225 C 840,205 825,190 810,200 C 795,210 805,240 840,255 C 875,270 925,275 955,265 C 985,255 995,235 985,220 L 720,140 C 680,120 620,125 570,145 C 520,165 490,195 485,235 C 480,275 510,310 555,330 L 400,410 C 360,430 340,465 345,500 C 350,535 385,558 430,555 L 250,535 C 215,530 200,520 200,500 Z",
    sectors: [0.34, 0.67, 1.0],
  },
  {
    id: "spa",
    name: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    city: "Stavelot",
    lapLengthKm: 7.004,
    totalLaps: 44,
    corners: 19,
    drsZones: 2,
    degradation: "medium",
    overtaking: "medium",
    aeroDemand: "high",
    fuelSensitivity: 0.034,
    pitLossSec: 21.0,
    // La Source, Eau Rouge/Raidillon, Kemmel, Pouhon, Fagnes, Stavelot, Blanchimont
    layoutPath:
      "M 160,530 C 145,510 150,485 175,478 C 200,471 230,490 235,520 C 240,550 220,570 190,568 C 160,566 155,545 170,530 L 300,500 C 340,492 370,475 385,455 C 400,435 395,415 375,420 C 355,425 355,460 390,475 C 425,490 480,485 530,465 C 580,445 615,415 630,385 C 645,355 635,335 610,345 C 585,355 595,395 640,415 C 685,435 755,435 815,410 C 875,385 915,350 925,315 C 935,280 920,260 895,270 C 870,280 878,320 920,340 C 962,360 995,355 1005,330 L 895,210 C 880,188 855,190 845,215 C 835,240 855,265 890,270 C 925,275 960,260 975,240 C 990,220 978,205 962,215 C 946,225 958,255 990,270 C 1020,285 1045,275 1050,255 L 780,130 C 740,110 680,115 630,135 C 580,155 550,185 545,225 C 540,265 570,300 620,325 L 420,415 C 380,435 355,470 360,510 C 365,550 400,575 450,575 L 220,555 C 185,550 165,545 160,530 Z",
    sectors: [0.30, 0.62, 1.0],
  },
  {
    id: "bahrain",
    name: "Bahrain International Circuit",
    country: "Bahrain",
    city: "Sakhir",
    lapLengthKm: 5.412,
    totalLaps: 57,
    corners: 15,
    drsZones: 3,
    degradation: "high",
    overtaking: "easy",
    aeroDemand: "medium",
    fuelSensitivity: 0.036,
    pitLossSec: 22.0,
    // Main straight, T1 hairpin, S-curves, T10 hairpin, back straight, T11-12, T13-14
    layoutPath:
      "M 170,520 L 700,520 C 755,520 795,505 810,475 C 825,445 815,425 795,435 C 775,445 785,475 815,485 C 845,495 880,485 895,455 C 910,425 900,400 880,405 C 860,410 865,440 895,455 L 700,310 C 680,295 655,295 645,318 C 635,341 655,368 690,375 C 725,382 765,370 785,345 C 805,320 795,300 775,308 C 755,316 760,345 795,360 C 830,375 885,370 930,345 C 975,320 995,285 990,255 C 985,225 960,220 950,245 C 940,270 965,300 1010,315 L 720,155 C 690,138 655,145 645,175 C 635,205 660,235 705,245 C 750,255 810,245 850,220 C 890,195 895,170 875,165 C 855,160 855,195 900,220 L 420,495 C 395,520 365,530 330,530 C 295,530 250,530 215,530 C 195,530 175,535 170,520 Z",
    sectors: [0.35, 0.67, 1.0],
  },
  {
    id: "interlagos",
    name: "Autódromo José Carlos Pace",
    country: "Brazil",
    city: "São Paulo",
    lapLengthKm: 4.309,
    totalLaps: 71,
    corners: 15,
    drsZones: 2,
    degradation: "medium",
    overtaking: "medium",
    aeroDemand: "medium",
    fuelSensitivity: 0.030,
    pitLossSec: 17.5,
    // Counter-clockwise: Senna S, Curva do Sol, Descida do Lago, Ferradura, Junção, Subida dos Boxes
    layoutPath:
      "M 200,520 C 175,500 170,475 195,465 C 220,455 255,475 260,505 C 265,535 245,555 220,552 C 195,549 195,530 215,520 L 350,470 C 395,453 445,450 485,465 C 525,480 555,510 570,545 C 585,580 575,610 550,618 C 525,626 505,610 515,585 C 525,560 565,555 605,570 C 645,585 695,585 735,565 C 775,545 795,515 790,485 C 785,455 760,450 745,470 C 730,490 750,525 795,540 C 840,555 900,545 935,515 C 970,485 975,450 955,440 C 935,430 920,455 945,485 L 700,265 C 685,248 660,250 652,275 C 644,300 665,330 705,340 C 745,350 795,340 830,315 C 865,290 870,265 850,260 C 830,255 830,290 875,315 L 400,495 C 365,515 330,525 295,528 C 260,531 230,535 200,520 Z",
    sectors: [0.31, 0.65, 1.0],
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
  {
    trackId: "spa",
    aeroMap: [
      { downforce: "low", dragDeltaSec: 0.3, downforceGainSec: -1.0, topSpeedKph: 358 },
      { downforce: "medium", dragDeltaSec: 0.8, downforceGainSec: -1.6, topSpeedKph: 340 },
      { downforce: "high", dragDeltaSec: 1.5, downforceGainSec: -2.4, topSpeedKph: 324 },
    ],
    fuelPerLapKg: 1.70,
    baselineLapSec: 104.5,
    tireDegradation: {
      soft: makeTireCurve(104.0, 0.16, 15, 2.3),
      medium: makeTireCurve(104.5, 0.09, 22, 2.0),
      hard: makeTireCurve(105.2, 0.05, 30, 1.7),
    },
    notes: "Long lap, high aero. Kemmel straight rewards low drag; Pouhon needs downforce.",
  },
  {
    trackId: "bahrain",
    aeroMap: [
      { downforce: "low", dragDeltaSec: 0.2, downforceGainSec: -0.5, topSpeedKph: 355 },
      { downforce: "medium", dragDeltaSec: 0.7, downforceGainSec: -1.0, topSpeedKph: 340 },
      { downforce: "high", dragDeltaSec: 1.3, downforceGainSec: -1.6, topSpeedKph: 326 },
    ],
    fuelPerLapKg: 1.48,
    baselineLapSec: 90.8,
    tireDegradation: {
      soft: makeTireCurve(90.3, 0.22, 10, 2.6),
      medium: makeTireCurve(90.8, 0.14, 18, 2.2),
      hard: makeTireCurve(91.5, 0.08, 26, 1.8),
    },
    notes: "Very high deg on abrasive surface. Rear tires critical — 2-stop almost mandatory.",
  },
  {
    trackId: "interlagos",
    aeroMap: [
      { downforce: "low", dragDeltaSec: 0.4, downforceGainSec: -0.9, topSpeedKph: 342 },
      { downforce: "medium", dragDeltaSec: 0.8, downforceGainSec: -1.4, topSpeedKph: 330 },
      { downforce: "high", dragDeltaSec: 1.4, downforceGainSec: -2.2, topSpeedKph: 316 },
    ],
    fuelPerLapKg: 1.52,
    baselineLapSec: 70.5,
    tireDegradation: {
      soft: makeTireCurve(70.1, 0.15, 14, 2.3),
      medium: makeTireCurve(70.5, 0.09, 20, 1.9),
      hard: makeTireCurve(71.1, 0.06, 28, 1.6),
    },
    notes: "Counter-clockwise, short lap. Downhill into Senna S; weather changes fast.",
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
