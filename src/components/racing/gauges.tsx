"use client";

import { motion } from "framer-motion";
import type { Compound } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

const COMPOUND_COLORS: Record<Compound, { ring: string; bg: string; text: string; label: string }> = {
  soft: { ring: "#ef4444", bg: "bg-red-500/15", text: "text-red-400", label: "S" },
  medium: { ring: "#facc15", bg: "bg-yellow-400/15", text: "text-yellow-300", label: "M" },
  hard: { ring: "#f1f5f9", bg: "bg-slate-200/15", text: "text-slate-200", label: "H" },
  inter: { ring: "#22c55e", bg: "bg-green-500/15", text: "text-green-400", label: "I" },
  wet: { ring: "#3b82f6", bg: "bg-blue-500/15", text: "text-blue-400", label: "W" },
};

export function TireGauge({ compound, wearPct, ageLaps }: { compound: Compound; wearPct: number; ageLaps: number }) {
  const c = COMPOUND_COLORS[compound];
  const wear = Math.min(100, Math.max(0, wearPct));
  const status = wear >= 85 ? "critical" : wear >= 65 ? "warning" : "ok";
  const statusColor = status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      {/* tire visual */}
      <div className="relative h-10 w-10 shrink-0">
        <svg viewBox="0 0 40 40" className="h-full w-full">
          <circle cx={20} cy={20} r={16} fill="#0f172a" stroke={c.ring} strokeWidth={2.5} />
          <circle cx={20} cy={20} r={10} fill="none" stroke={c.ring} strokeWidth={1} opacity={0.5} />
          {/* tread marks */}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={20 + Math.cos(a) * 10}
                y1={20 + Math.sin(a) * 10}
                x2={20 + Math.cos(a) * 15}
                y2={20 + Math.sin(a) * 15}
                stroke={c.ring}
                strokeWidth={1}
                opacity={1 - wear / 130}
              />
            );
          })}
          {/* wear arc */}
          <circle
            cx={20}
            cy={20}
            r={18}
            fill="none"
            stroke={statusColor}
            strokeWidth={2.5}
            strokeDasharray={`${(wear / 100) * 113} 113`}
            transform="rotate(-90 20 20)"
            strokeLinecap="round"
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center font-mono text-xs font-bold", c.text)}>
          {c.label}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-bold capitalize text-slate-100">{compound}</span>
          <span className="text-[10px] uppercase text-slate-500">tire</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span style={{ color: statusColor }} className="font-mono font-semibold">
            {wear.toFixed(0)}%
          </span>
          <span className="text-slate-600">·</span>
          <span className="font-mono">{ageLaps}L age</span>
        </div>
      </div>
    </div>
  );
}

export function FuelGauge({ fuelKg, totalLaps, currentLap }: { fuelKg: number; totalLaps: number; currentLap: number }) {
  const startFuel = totalLaps * 1.55 + 5;
  const pct = Math.min(100, Math.max(0, (fuelKg / startFuel) * 100));
  const lapsLeft = Math.floor(fuelKg / 1.55);
  const remainingLaps = totalLaps - currentLap;
  const tight = lapsLeft < remainingLaps;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Fuel</span>
        <span className={cn("font-mono text-xs font-semibold", tight ? "text-amber-400" : "text-slate-300")}>
          {fuelKg.toFixed(1)} kg
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className={cn("h-full rounded-full", tight ? "bg-gradient-to-r from-amber-500 to-red-500" : "bg-gradient-to-r from-cyan-500 to-emerald-400")}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>~{lapsLeft}L fuel left</span>
        <span>{remainingLaps}L to finish</span>
      </div>
    </div>
  );
}

export function DRSIndicator({ available, active }: { available: boolean; active: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
        active
          ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/40"
          : available
          ? "bg-slate-700/50 text-slate-300 ring-1 ring-slate-600"
          : "bg-slate-800/40 text-slate-600"
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", active ? "bg-green-400" : available ? "bg-slate-400" : "bg-slate-700")} />
      DRS {active ? "ON" : available ? "Avail" : "Off"}
    </div>
  );
}
