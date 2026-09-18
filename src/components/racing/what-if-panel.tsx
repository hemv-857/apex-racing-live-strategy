"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { Sliders, Zap, RotateCcw, Gauge } from "lucide-react";
import type { Compound, PaceMode, PitStrategyOption, RaceSessionData, WhatIfConfig, WhatIfResult } from "@/lib/racing/types";
import { DRIVERS } from "@/lib/racing/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WhatIfPanelProps {
  session: RaceSessionData | null;
  driverId: string | null;
  baselineOption: PitStrategyOption | null;
  onExport: (config: WhatIfConfig, result: WhatIfResult) => void;
}

const COMPOUND_LABEL: Record<Compound, string> = {
  soft: "Soft",
  medium: "Medium",
  hard: "Hard",
  inter: "Inter",
  wet: "Wet",
};
const COMPOUND_COLOR: Record<Compound, string> = {
  soft: "#ef4444",
  medium: "#facc15",
  hard: "#f1f5f9",
  inter: "#22c55e",
  wet: "#3b82f6",
};

export function WhatIfPanel({ session, driverId, baselineOption, onExport }: WhatIfPanelProps) {
  const rbDrivers = DRIVERS.filter((d) => d.isOurs);
  const [activeDriverId, setActiveDriverId] = useState(driverId ?? rbDrivers[0]?.id ?? "");
  const [stops, setStops] = useState(2);
  const [pitLap1, setPitLap1] = useState(18);
  const [pitLap2, setPitLap2] = useState(37);
  const [compound1, setCompound1] = useState<Compound>("medium");
  const [compound2, setCompound2] = useState<Compound>("medium");
  const [paceMode, setPaceMode] = useState<PaceMode>("balanced");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);

  // clamped pit laps derived from session bounds (no setState needed in effect)
  const safePitLap1 = session
    ? Math.max(session.currentLap + 2, Math.min(session.totalLaps - 2, pitLap1))
    : pitLap1;
  const safePitLap2 = session
    ? Math.max(safePitLap1 + 5, Math.min(session.totalLaps - 1, pitLap2))
    : pitLap2;

  const config: WhatIfConfig = useMemo(
    () => ({
      driverId: activeDriverId,
      stops,
      pitLaps: stops === 0 ? [] : stops === 1 ? [safePitLap1] : [safePitLap1, safePitLap2],
      compounds: stops === 0 ? ["medium"] : stops === 1 ? ["medium", compound1] : ["medium", compound1, compound2],
      paceMode,
    }),
    [activeDriverId, stops, safePitLap1, safePitLap2, compound1, compound2, paceMode]
  );

  // debounce-run the what-if when config changes
  useEffect(() => {
    if (!session || !activeDriverId) return;
    let active = true;
    // defer setLoading to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    const t = setTimeout(() => {
      fetch("/api/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, config, baselineOption }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (active && d?.result) setResult(d.result);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [session, config, baselineOption, activeDriverId]);

  const lapChartData = useMemo(
    () =>
      result?.lapTrace.map((l) => ({
        lap: l.lap,
        time: l.lapTimeSec,
        pit: l.pitThisLap,
        compound: l.compound,
      })) ?? [],
    [result]
  );

  const activeDriver = DRIVERS.find((d) => d.id === activeDriverId);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Sliders className="h-3.5 w-3.5 text-red-500" />
          What-If Strategy Builder
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStops(2);
            setPitLap1(session ? session.currentLap + 4 : 18);
            setPitLap2(session ? session.currentLap + 22 : 37);
            setCompound1("medium");
            setCompound2("medium");
            setPaceMode("balanced");
          }}
          className="h-7 gap-1 px-2 text-xs text-slate-400"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      <p className="text-[11px] leading-snug text-slate-500">
        Adjust pit stops, compounds, and pace to instantly recompute the race outcome. Compare against the current best strategy.
      </p>

      {/* driver picker */}
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Driver</label>
        <Select value={activeDriverId} onValueChange={setActiveDriverId}>
          <SelectTrigger className="bg-slate-900/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rbDrivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                <span className="font-mono font-bold" style={{ color: d.teamColor }}>{d.code}</span> · {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* stops selector */}
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Pit Stops</label>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setStops(s)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                stops === s
                  ? "border-red-500/60 bg-red-500/15 text-red-400"
                  : "border-border/60 bg-slate-900/40 text-slate-400 hover:border-border"
              )}
            >
              {s}-Stop
            </button>
          ))}
        </div>
      </div>

      {/* pit lap sliders */}
      {stops >= 1 && session && (
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Pit Lap 1</label>
              <span className="font-mono text-xs font-bold text-slate-200">L{safePitLap1}</span>
            </div>
            <Slider
              value={[safePitLap1]}
              min={session.currentLap + 2}
              max={session.totalLaps - 2}
              step={1}
              onValueChange={(v) => setPitLap1(v[0])}
              className="[&_[role=slider]]:bg-red-500"
            />
            <CompoundPicker value={compound1} onChange={setCompound1} weather={session.weather} />
          </div>
          {stops >= 2 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wide text-slate-500">Pit Lap 2</label>
                <span className="font-mono text-xs font-bold text-slate-200">L{safePitLap2}</span>
              </div>
              <Slider
                value={[safePitLap2]}
                min={safePitLap1 + 3}
                max={session.totalLaps - 1}
                step={1}
                onValueChange={(v) => setPitLap2(v[0])}
                className="[&_[role=slider]]:bg-red-500"
              />
              <CompoundPicker value={compound2} onChange={setCompound2} weather={session.weather} />
            </div>
          )}
        </div>
      )}

      {/* pace mode */}
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Pace Mode</label>
        <div className="flex gap-1.5">
          {(["push", "balanced", "conserve"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPaceMode(p)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                paceMode === p
                  ? p === "push"
                    ? "border-red-500/60 bg-red-500/15 text-red-400"
                    : p === "conserve"
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-400"
                    : "border-slate-500/60 bg-slate-700/40 text-slate-200"
                  : "border-border/60 bg-slate-900/40 text-slate-400 hover:border-border"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* result */}
      {result && activeDriver && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 border-t border-border/40 pt-3">
          <div className="grid grid-cols-4 gap-2">
            <Metric label="Exp. Pos" value={`P${result.expectedPosition}`} color="#e2e8f0" />
            <Metric label="Win" value={`${Math.round(result.finishProbabilities.win * 100)}%`} color="#ef4444" />
            <Metric label="Podium" value={`${Math.round(result.finishProbabilities.podium * 100)}%`} color="#22c55e" />
            <Metric label="Risk" value={`${Math.round(result.riskScore * 100)}%`} color={result.riskScore > 0.5 ? "#f59e0b" : "#06b6d4"} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border/40 bg-slate-900/40 px-2.5 py-1.5">
              <span className="text-slate-500">Race Time:</span>{" "}
              <span className="font-mono font-semibold text-slate-100">{formatRaceTime(result.estimatedRaceTime)}</span>
            </div>
            <div className={cn("rounded-md border px-2.5 py-1.5", result.deltaToBaseline <= 0 ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5")}>
              <span className="text-slate-500">vs Best:</span>{" "}
              <span className={cn("font-mono font-semibold", result.deltaToBaseline <= 0 ? "text-green-400" : "text-red-400")}>
                {result.deltaToBaseline > 0 ? "+" : ""}{result.deltaToBaseline.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* lap trace */}
          {lapChartData.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Predicted Lap Trace</span>
                <div className="flex items-center gap-2 text-[9px]">
                  {Array.from(new Set(lapChartData.map((d) => d.compound))).map((c) => (
                    <span key={c} className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COMPOUND_COLOR[c as Compound] }} />
                      <span className="text-slate-500">{c}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lapChartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="lap" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} domain={["dataMin - 0.3", "dataMax + 0.3"]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6, fontSize: 10, color: "#e2e8f0" }}
                      formatter={(v: number) => [`${v.toFixed(3)}s`, "Lap"]}
                      labelFormatter={(l) => `Lap ${l}`}
                    />
                    {result.lapTrace.find((l) => l.pitThisLap) && (
                      <ReferenceLine
                        x={result.lapTrace.find((l) => l.pitThisLap)?.lap}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        label={{ value: "PIT", fill: "#ef4444", fontSize: 9, position: "top" }}
                      />
                    )}
                    <Line type="monotone" dataKey="time" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* export */}
          <Button
            onClick={() => onExport(config, result)}
            className="w-full gap-1.5 bg-red-600 text-white hover:bg-red-500"
            size="sm"
          >
            <Zap className="h-3.5 w-3.5" />
            Export What-If to {activeDriver.code}'s Pit Box
          </Button>
        </motion.div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-slate-500">
          <Gauge className="h-3 w-3 animate-spin" />
          Simulating…
        </div>
      )}
    </div>
  );
}

function CompoundPicker({ value, onChange, weather }: { value: Compound; onChange: (c: Compound) => void; weather: string }) {
  const options: Compound[] = weather === "wet" ? ["inter", "wet"] : weather === "damp" ? ["inter", "medium", "soft"] : ["soft", "medium", "hard"];
  return (
    <div className="mt-2 flex gap-1">
      {options.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            "flex-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
            value === c ? "border-transparent text-slate-900" : "border-border/60 bg-slate-900/40 text-slate-400 hover:border-border"
          )}
          style={value === c ? { backgroundColor: COMPOUND_COLOR[c] } : {}}
        >
          {COMPOUND_LABEL[c]}
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-slate-900/40 p-2 text-center">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-base font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function formatRaceTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
