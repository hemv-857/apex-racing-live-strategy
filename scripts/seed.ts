// Seed reference data into Prisma database (tracks, drivers, practice data)
import { db } from "../src/lib/db";
import { TRACKS, DRIVERS, PRACTICE_CALIBRATION } from "../src/lib/racing/data";

async function seed() {
  console.log("Seeding reference data...");

  // Tracks
  for (const t of TRACKS) {
    await db.track.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        name: t.name,
        country: t.country,
        city: t.city,
        lapLengthKm: t.lapLengthKm,
        totalLaps: t.totalLaps,
        corners: t.corners,
        drsZones: t.drsZones,
        degradation: t.degradation,
        overtaking: t.overtaking,
        aeroDemand: t.aeroDemand,
        fuelSensitivity: t.fuelSensitivity,
        pitLossSec: t.pitLossSec,
        layout: t.layoutPath,
      },
    });
  }

  // Drivers
  for (const d of DRIVERS) {
    await db.driver.upsert({
      where: { code: d.code },
      update: {},
      create: {
        id: d.id,
        name: d.name,
        code: d.code,
        number: d.number,
        team: d.team,
        teamColor: d.teamColor,
        isOurs: d.isOurs,
        paceRating: d.paceRating,
        tireMgmt: d.tireMgmt,
        fuelMgmt: d.fuelMgmt,
      },
    });
  }

  // Practice data
  for (const p of PRACTICE_CALIBRATION) {
    await db.practiceData.upsert({
      where: { id: "pd_" + p.trackId },
      update: {},
      create: {
        id: "pd_" + p.trackId,
        trackId: p.trackId,
        aeroMap: JSON.stringify(p.aeroMap),
        fuelPerLapKg: p.fuelPerLapKg,
        baselineLapSec: p.baselineLapSec,
        tireDegradation: JSON.stringify(p.tireDegradation),
        notes: p.notes ?? null,
      },
    });
  }

  console.log("Seed complete.");
  const trackCount = await db.track.count();
  const driverCount = await db.driver.count();
  const practiceCount = await db.practiceData.count();
  console.log(`Tracks: ${trackCount}, Drivers: ${driverCount}, PracticeData: ${practiceCount}`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
