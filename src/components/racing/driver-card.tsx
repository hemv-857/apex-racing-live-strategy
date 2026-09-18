"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Gauge, Snowflake, Swords, ChevronDown } from "lucide-react";
import type { DriverState, LapHistoryEntry, PaceMode, RaceSessionData, SectorTimes } from "@/lib/racing/types";
import { getDriver, DRIVERS } from "@/lib/racing/data";
import { TireGauge, FuelGauge, DRSIndicator } from "./gauges";
import { cn } from "@/lib/utils";

interface DriverCardProps {
  state: DriverState;
  session: RaceSessionData;
  active: boolean;
  onSelect: () => void;
  onSetPace?: (driverCode: string, pace: PaceMode) => void;
  onCompare?: (driverId: string, rivalId?: string) => void;
}

export function DriverCard({ state, session, active, onSelect, onSetPace, onCompare }: DriverCardProps) {
  const driver = getDriver(state.driverId);
  const isOurs = driver.isOurs;
  const paceModeColor =
    state.paceMode === "push"
      ? "text-red-400 bg-red-500/10"
      : state.paceMode === "conserve"
      ? "text-cyan-400 bg-cyan-500/10"
      : "text-slate-300 bg-slate-700/40";
  const [sectors, setSectors] = useState<SectorTimes | null>(null);
  const [showRivalPicker, setShowRivalPicker] = useState(false);
  const rivalPickerRef = useRef<HTMLDivElement | null>(null);

  // close rival picker on outside click
  useEffect(() => {
    if (!showRivalPicker) return;
    const handler = (e: MouseEvent) => {
      if (rivalPickerRef.current && !rivalPickerRef.current.contains(e.target as Node)) {
        setShowRivalPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showRivalPicker]);

  // fetch this driver's latest lap sectors
  useEffect(() => {
    let active = true;
    if (!state.lastLapSec) {
      // defer to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        if (active) setSectors(null);
      });
      return;
    }
    fetch(`/api/history?sessionId=${session.id}&driverId=${state.driverId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const hist: LapHistoryEntry[] = d?.history ?? [];
        const latest = hist.length > 0 ? hist[hist.length - 1] : null;
        setSectors(latest?.sectors ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.id, state.driverId, state.lastLapSec, session.currentLap]);

  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50",
        active
          ? "border-red-500/60 bg-slate-900/80 shadow-lg shadow-red-500/10"
          : "border-border/60 bg-slate-900/40 hover:border-border",
        isOurs && !active && "ring-1 ring-red-500/20"
      )}
    >
      {/* team color bar */}
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: driver.teamColor }} />

      {/* shimmer for ours */}
      {isOurs && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent" />
      )}

      <div className="relative flex items-start justify-between pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-slate-100">P{state.position}</span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-xs font-bold"
              style={{ backgroundColor: driver.teamColor + "33", color: driver.teamColor }}
            >
              {driver.code}
            </span>
            {isOurs && (
              <span className="rounded bg-red-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400">
                RB
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-400">{driver.name}</div>
          <div className="truncate text-[10px] text-slate-500">{driver.team}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {onCompare && (
            <div ref={rivalPickerRef} className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRivalPicker(!showRivalPicker);
                }}
                className="flex items-center gap-0.5 rounded bg-slate-800/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 hover:bg-slate-700 hover:text-red-400"
                title="Compare head-to-head"
              >
                <Swords className="h-2.5 w-2.5" />
                vs
                <ChevronDown className="h-2 w-2" />
              </button>
              <AnimatePresence>
                {showRivalPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-border/60 bg-slate-950 p-1 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-1.5 py-1 text-[8px] uppercase tracking-wide text-slate-500">
                      Compare with:
                    </div>
                    {session.driverStates
                      .filter((d) => d.driverId !== state.driverId)
                      .sort((a, b) => a.position - b.position)
                      .map((rival) => {
                        const rivalDriver = getDriver(rival.driverId);
                        return (
                          <button
                            key={rival.driverId}
                            onClick={() => {
                              onCompare(state.driverId, rival.driverId);
                              setShowRivalPicker(false);
                            }}
                            className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rivalDriver.teamColor }} />
                            <span className="font-mono font-bold" style={{ color: rivalDriver.teamColor }}>
                              {rivalDriver.code}
                            </span>
                            <span className="truncate text-slate-500">{rivalDriver.name}</span>
                            <span className="ml-auto font-mono text-slate-600">P{rival.position}</span>
                          </button>
                        );
                      })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", paceModeColor)}>
            {state.paceMode}
          </span>
          <DRSIndicator available={state.drsAvailable} active={state.drsActive} />
        </div>
      </div>

      <div className="relative mt-3 space-y-2.5 pl-2">
        <TireGauge compound={state.tireCompound} wearPct={state.tireWearPct} ageLaps={state.tireAgeLaps} />
        <FuelGauge fuelKg={state.fuelKg} totalLaps={session.totalLaps} currentLap={session.currentLap} />
      </div>

      {/* sector mini-strip */}
      {sectors && (
        <div className="relative mt-2 grid grid-cols-3 gap-1 pl-2">
          <MiniSector label="S1" value={sectors.s1} purple={sectors.s1Purple} />
          <MiniSector label="S2" value={sectors.s2} purple={sectors.s2Purple} />
          <MiniSector label="S3" value={sectors.s3} purple={sectors.s3Purple} />
        </div>
      )}

      {/* gaps + lap time */}
      <div className="relative mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-2 pl-2 text-center">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Last Lap</div>
          <div className="font-mono text-xs font-semibold text-slate-200">
            {state.lastLapSec ? `${state.lastLapSec.toFixed(3)}s` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Gap Fwd</div>
          <div className="font-mono text-xs font-semibold text-slate-200">
            {state.gapAheadSec !== null ? `${state.gapAheadSec >= 0 ? "+" : ""}${state.gapAheadSec.toFixed(2)}s` : "LEAD"}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Gap Bwd</div>
          <div className="font-mono text-xs font-semibold text-slate-200">
            {state.gapBehindSec !== null ? `${state.gapBehindSec.toFixed(2)}s` : "—"}
          </div>
        </div>
      </div>

      {state.pitStops > 0 && (
        <div className="relative mt-2 pl-2 text-[10px] text-slate-500">
          Stops: <span className="font-mono text-slate-300">{state.pitStops}</span> · Stint lap{" "}
          <span className="font-mono text-slate-300">{state.stintLap}</span>
        </div>
      )}

      {/* pace-mode control (RB drivers only) */}
      {isOurs && onSetPace && (
        <div className="relative mt-2 flex gap-1 pl-2" onClick={(e) => e.stopPropagation()}>
          {([
            { mode: "push" as PaceMode, icon: Zap, label: "Push", color: "red" },
            { mode: "balanced" as PaceMode, icon: Gauge, label: "Bal", color: "slate" },
            { mode: "conserve" as PaceMode, icon: Snowflake, label: "Save", color: "cyan" },
          ]).map((p) => {
            const Icon = p.icon;
            const isActive = state.paceMode === p.mode;
            return (
              <button
                key={p.mode}
                onClick={() => onSetPace(driver.code, p.mode)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors",
                  isActive
                    ? p.color === "red"
                      ? "border-red-500/60 bg-red-500/20 text-red-400"
                      : p.color === "cyan"
                      ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-400"
                      : "border-slate-500/60 bg-slate-700/50 text-slate-100"
                    : "border-border/40 bg-slate-900/40 text-slate-500 hover:border-border hover:text-slate-300"
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function MiniSector({ label, value, purple }: { label: string; value: number; purple?: boolean }) {
  return (
    <div
      className={cn(
        "rounded border px-1 py-0.5 text-center",
        purple ? "border-purple-500/50 bg-purple-500/10" : "border-border/40 bg-slate-900/40"
      )}
    >
      <div className="flex items-center justify-center gap-0.5">
        <span className="text-[8px] uppercase text-slate-500">{label}</span>
        {purple && <span className="text-[8px] font-bold text-purple-400">●</span>}
      </div>
      <div className="font-mono text-[10px] font-semibold text-slate-200">{value.toFixed(2)}</div>
    </div>
  );
}
