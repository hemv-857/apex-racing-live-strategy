"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Flag, Gauge } from "lucide-react";
import type { LapHistoryEntry } from "@/lib/racing/types";
import { DRIVERS } from "@/lib/racing/data";
import { cn } from "@/lib/utils";

interface SectorTimesPanelProps {
  sessionId: string;
  refreshKey: number;
}

export function SectorTimesPanel({ sessionId, refreshKey }: SectorTimesPanelProps) {
  const [history, setHistory] = useState<LapHistoryEntry[]>([]);
  const [selectedLap, setSelectedLap] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/history?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.history) {
          setHistory(d.history);
          // default to latest lap
          const latestLap = d.history.length > 0 ? Math.max(...d.history.map((e: LapHistoryEntry) => e.lap)) : null;
          setSelectedLap(latestLap);
        }
      })
      .catch(() => {});
  }, [sessionId, refreshKey]);

  const laps = [...new Set(history.map((h) => h.lap))].sort((a, b) => a - b);
  const currentLap = selectedLap ?? laps[laps.length - 1] ?? null;
  const entries = history.filter((h) => h.lap === currentLap).sort((a, b) => a.position - b.position);

  // purple times per sector (overall best in session)
  const purpleS1 = history.length > 0 ? Math.min(...history.map((h) => h.sectors.s1)) : null;
  const purpleS2 = history.length > 0 ? Math.min(...history.map((h) => h.sectors.s2)) : null;
  const purpleS3 = history.length > 0 ? Math.min(...history.map((h) => h.sectors.s3)) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Gauge className="h-4 w-4 text-red-500" />
          Sector Times
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">purple = session best</span>
      </div>

      {/* lap picker */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border/40 px-3 py-2" style={{ scrollbarWidth: "thin" }}>
        {laps.length === 0 && <span className="px-2 text-[11px] text-slate-500">No laps recorded yet</span>}
        {laps.map((l) => (
          <button
            key={l}
            onClick={() => setSelectedLap(l)}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] font-semibold transition-colors",
              currentLap === l
                ? "bg-red-600 text-white"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/60"
            )}
          >
            L{l}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        <AnimatePresence mode="popLayout">
          {entries.map((e) => {
            const driver = DRIVERS.find((d) => d.id === e.driverId);
            if (!driver) return null;
            const s1P = purpleS1 !== null && Math.abs(e.sectors.s1 - purpleS1) < 0.001;
            const s2P = purpleS2 !== null && Math.abs(e.sectors.s2 - purpleS2) < 0.001;
            const s3P = purpleS3 !== null && Math.abs(e.sectors.s3 - purpleS3) < 0.001;
            return (
              <motion.div
                key={e.driverId + "-" + e.lap}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "border-b border-border/20 px-4 py-2.5",
                  driver.isOurs && "bg-red-500/5",
                  e.pitThisLap && "bg-amber-500/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 font-mono text-xs font-bold text-slate-300">P{e.position}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: driver.teamColor }} />
                  <span className="font-mono text-xs font-bold text-slate-100">{driver.code}</span>
                  {driver.isOurs && (
                    <span className="rounded bg-red-500/20 px-1 text-[9px] font-bold uppercase text-red-400">RB</span>
                  )}
                  {e.pitThisLap && (
                    <span className="flex items-center gap-0.5 rounded bg-amber-500/20 px-1 text-[9px] font-bold uppercase text-amber-400">
                      <Flag className="h-2.5 w-2.5" /> Pit
                    </span>
                  )}
                  <span className="ml-auto font-mono text-sm font-bold text-slate-100">{e.lapTimeSec.toFixed(3)}s</span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <SectorCell label="S1" value={e.sectors.s1} purple={s1P} compound={e.compound} />
                  <SectorCell label="S2" value={e.sectors.s2} purple={s2P} compound={e.compound} />
                  <SectorCell label="S3" value={e.sectors.s3} purple={s3P} compound={e.compound} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-500">
                  <span className="uppercase tracking-wide">{e.compound}</span>
                  <span>·</span>
                  <span>age {e.tireAgeLaps}L</span>
                  <span>·</span>
                  <span>{e.tireWearPct.toFixed(0)}% wear</span>
                  <span>·</span>
                  <span>{e.fuelKg.toFixed(1)}kg</span>
                  <span className="ml-auto capitalize">{e.paceMode}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SectorCell({ label, value, purple, compound }: { label: string; value: number; purple: boolean; compound: string }) {
  const compoundColor = compound === "soft" ? "#ef4444" : compound === "medium" ? "#facc15" : compound === "hard" ? "#f1f5f9" : compound === "inter" ? "#22c55e" : "#3b82f6";
  return (
    <div className={cn("rounded border px-1.5 py-1", purple ? "border-purple-500/50 bg-purple-500/10" : "border-border/40 bg-slate-900/40")}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-slate-500">{label}</span>
        {purple && <span className="text-[9px] font-bold text-purple-400">P</span>}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-xs font-semibold text-slate-100">{value.toFixed(3)}</span>
        <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: compoundColor }} />
      </div>
    </div>
  );
}
