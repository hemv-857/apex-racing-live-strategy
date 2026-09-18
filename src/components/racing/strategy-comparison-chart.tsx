"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceArea } from "recharts";
import { GitCompare, Trophy, Zap } from "lucide-react";
import type { StrategyComparison, RaceSessionData, PitStrategyOption, Compound } from "@/lib/racing/types";
import { DRIVERS } from "@/lib/racing/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COMPOUND_BAND_COLOR: Record<Compound, string> = {
  soft: "rgba(239,68,68,0.10)",
  medium: "rgba(250,204,21,0.10)",
  hard: "rgba(241,245,249,0.07)",
  inter: "rgba(34,197,94,0.10)",
  wet: "rgba(59,130,246,0.10)",
};

interface StrategyComparisonChartProps {
  session: RaceSessionData | null;
  driverId: string | null;
  options: PitStrategyOption[];
  onExport: (option: PitStrategyOption) => void;
}

export function StrategyComparisonChart({ session, driverId, options, onExport }: StrategyComparisonChartProps) {
  const rbDrivers = DRIVERS.filter((d) => d.isOurs);
  const [activeDriverId, setActiveDriverId] = useState(driverId ?? rbDrivers[0]?.id ?? "");
  const [comparison, setComparison] = useState<StrategyComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleOptionIds, setVisibleOptionIds] = useState<Set<string>>(new Set());
  const [compoundTraceId, setCompoundTraceId] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !activeDriverId) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    const t = setTimeout(() => {
      fetch("/api/comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, driverId: activeDriverId }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!active) return;
          if (d?.comparison) {
            setComparison(d.comparison);
            // default: show top 3 by total race time
            const top3 = [...d.comparison.traces]
              .sort((a, b) => a.totalRaceTime - b.totalRaceTime)
              .slice(0, 3)
              .map((t) => t.optionId);
            setVisibleOptionIds(new Set(top3));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [session, activeDriverId]);

  if (!session) return null;

  const chartData = comparison
    ? Array.from({ length: session.totalLaps - session.currentLap + 1 }, (_, i) => {
        const lap = session.currentLap + 1 + i;
        const row: { lap: number; [k: string]: number | string | null } = { lap };
        for (const trace of comparison.traces) {
          const entry = trace.laps.find((l) => l.lap === lap);
          row[trace.optionId] = entry ? Number(entry.cumulativeTime.toFixed(2)) : null;
        }
        return row;
      })
    : [];

  // compute tire compound bands from the selected compound trace (default: fastest visible)
  const compoundBands = comparison && visibleOptionIds.size > 0
    ? ((): { start: number; end: number; compound: Compound; pitThisLap: boolean }[] => {
        const visibleTraces = [...comparison.traces]
          .filter((t) => visibleOptionIds.has(t.optionId))
          .sort((a, b) => a.totalRaceTime - b.totalRaceTime);
        // use selected trace or default to fastest
        const targetTrace = compoundTraceId
          ? visibleTraces.find((t) => t.optionId === compoundTraceId)
          : visibleTraces[0];
        if (!targetTrace) return [];
        const bands: { start: number; end: number; compound: Compound; pitThisLap: boolean }[] = [];
        let bandStart = targetTrace.laps[0]?.lap ?? session.currentLap + 1;
        let currentCompound = targetTrace.laps[0]?.compound ?? "medium";
        for (let i = 1; i <= targetTrace.laps.length; i++) {
          const lap = targetTrace.laps[i]?.lap;
          const prevLap = targetTrace.laps[i - 1];
          const pitThisLap = prevLap?.pitThisLap ?? false;
          const nextCompound = targetTrace.laps[i]?.compound;
          if (i === targetTrace.laps.length || pitThisLap || (nextCompound && nextCompound !== currentCompound)) {
            bands.push({ start: bandStart, end: prevLap.lap, compound: currentCompound, pitThisLap });
            if (i < targetTrace.laps.length) {
              bandStart = lap ?? prevLap.lap + 1;
              currentCompound = nextCompound ?? currentCompound;
            }
          }
        }
        return bands;
      })()
    : [];

  const activeDriver = DRIVERS.find((d) => d.id === activeDriverId);

  const toggleOption = (id: string) => {
    setVisibleOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <GitCompare className="h-3.5 w-3.5 text-red-500" />
          Strategy Comparison
        </h3>
        <div className="flex items-center gap-2">
          <Select value={activeDriverId} onValueChange={setActiveDriverId}>
            <SelectTrigger className="h-7 w-[120px] border-border/40 bg-slate-900/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rbDrivers.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  <span className="font-mono font-bold" style={{ color: d.teamColor }}>{d.code}</span> · {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mb-3 text-[11px] leading-snug text-slate-500">
        Overlay cumulative race time for each strategy option. Toggle traces on/off to compare outcomes side-by-side. Fastest option highlighted with trophy.
      </p>

      {/* legend / toggles */}
      {comparison && comparison.traces.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[...comparison.traces]
            .sort((a, b) => a.totalRaceTime - b.totalRaceTime)
            .map((t, idx) => {
              const visible = visibleOptionIds.has(t.optionId);
              const isFastest = comparison.summary.fastestOptionId === t.optionId;
              return (
                <button
                  key={t.optionId}
                  onClick={() => toggleOption(t.optionId)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                    visible
                      ? "border-border bg-slate-800/80 text-slate-200"
                      : "border-border/30 bg-slate-900/40 text-slate-600"
                  )}
                  style={visible ? { borderColor: t.color + "80" } : {}}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: visible ? t.color : "#475569" }} />
                  {isFastest && <Trophy className="h-2.5 w-2.5 text-amber-400" />}
                  {t.label.replace(t.driverCode + " · ", "")}
                  <span className="font-mono text-slate-400">{t.totalRaceTime.toFixed(1)}s</span>
                </button>
              );
            })}
        </div>
      )}

      {/* chart */}
      <div className="h-64 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Simulating strategies…</div>
        ) : comparison && comparison.traces.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              {/* tire compound background bands */}
              {compoundBands.map((b, i) => (
                <ReferenceArea
                  key={i}
                  x1={b.start}
                  x2={b.end}
                  strokeOpacity={0}
                  fill={COMPOUND_BAND_COLOR[b.compound]}
                  fillOpacity={1}
                />
              ))}
              <XAxis
                dataKey="lap"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                label={{ value: "Lap", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 5", "dataMax + 5"]}
                tickFormatter={(v) => `${Math.round(Number(v))}s`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }}
                labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
                labelFormatter={(l) => `Lap ${l}`}
                formatter={(value: number, name: string) => {
                  const trace = comparison.traces.find((t) => t.optionId === name);
                  return [`${value}s cumulative`, trace?.label ?? name];
                }}
              />
              {comparison.traces
                .filter((t) => visibleOptionIds.has(t.optionId))
                .map((t) => (
                  <Line
                    key={t.optionId}
                    type="monotone"
                    dataKey={t.optionId}
                    stroke={t.color}
                    strokeWidth={comparison.summary.fastestOptionId === t.optionId ? 2.5 : 1.5}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">No comparison data</div>
        )}
      </div>

      {/* compound band legend + trace selector */}
      {compoundBands.length > 0 && comparison && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-slate-500">
          <span className="uppercase tracking-wide">Stints:</span>
          <select
            value={compoundTraceId ?? ""}
            onChange={(e) => setCompoundTraceId(e.target.value || null)}
            className="rounded border border-border/40 bg-slate-900/60 px-1.5 py-0.5 text-[9px] text-slate-300 focus:border-red-500/50 focus:outline-none"
          >
            <option value="">Fastest visible</option>
            {comparison.traces
              .filter((t) => visibleOptionIds.has(t.optionId))
              .sort((a, b) => a.totalRaceTime - b.totalRaceTime)
              .map((t) => (
                <option key={t.optionId} value={t.optionId}>
                  {t.label.replace(t.driverCode + " · ", "")}
                </option>
              ))}
          </select>
          {compoundBands.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: COMPOUND_BAND_COLOR[b.compound].replace(/0\.\d+\)/, "0.5)") }} />
              <span className="capitalize">{b.compound}</span>
              <span className="font-mono text-slate-600">L{b.start}–{b.end}</span>
            </span>
          ))}
        </div>
      )}

      {/* summary */}
      {comparison && comparison.traces.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border/40 bg-slate-900/40 p-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Fastest</div>
            <div className="mt-0.5 truncate font-mono text-xs font-bold text-green-400">
              {comparison.traces.find((t) => t.optionId === comparison.summary.fastestOptionId)?.label.replace(activeDriver?.code + " · ", "") ?? "—"}
            </div>
          </div>
          <div className="rounded-md border border-border/40 bg-slate-900/40 p-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Spread</div>
            <div className="mt-0.5 font-mono text-xs font-bold text-amber-400">+{comparison.summary.spreadSec.toFixed(2)}s</div>
          </div>
          <div className="rounded-md border border-border/40 bg-slate-900/40 p-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Options</div>
            <div className="mt-0.5 font-mono text-xs font-bold text-slate-200">{comparison.traces.length}</div>
          </div>
        </div>
      )}

      {/* export fastest */}
      {comparison && comparison.summary.fastestOptionId && options.length > 0 && (
        <Button
          onClick={() => {
            const opt = options.find((o) => o.id === comparison.summary.fastestOptionId);
            if (opt) onExport(opt);
          }}
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5 border-green-500/40 bg-green-500/5 text-xs text-green-400 hover:bg-green-500/10"
        >
          <Zap className="h-3.5 w-3.5" />
          Export Fastest Strategy
        </Button>
      )}
    </div>
  );
}
