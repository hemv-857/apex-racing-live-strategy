"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceArea } from "recharts";
import { Activity, Zap, Gauge, Snowflake } from "lucide-react";
import type { LapHistoryEntry, PaceChangeEntry, RaceSessionData } from "@/lib/racing/types";
import { DRIVERS } from "@/lib/racing/data";
import { cn } from "@/lib/utils";

const PACE_COLOR = { push: "#ef4444", balanced: "#94a3b8", conserve: "#06b6d4" };

interface PaceImpactChartProps {
  session: RaceSessionData;
  driverId: string | null;
}

export function PaceImpactChart({ session, driverId }: PaceImpactChartProps) {
  const [history, setHistory] = useState<LapHistoryEntry[]>([]);
  const [paceChanges, setPaceChanges] = useState<PaceChangeEntry[]>([]);

  useEffect(() => {
    let active = true;
    const targetDriverId = driverId ?? DRIVERS.find((d) => d.isOurs)?.id ?? DRIVERS[0].id;
    fetch(`/api/history?sessionId=${session.id}&driverId=${targetDriverId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.history) setHistory(d.history);
      })
      .catch(() => {});
    fetch(`/api/pace-log?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.changes) {
          const drv = DRIVERS.find((dd) => dd.id === targetDriverId);
          if (drv) {
            setPaceChanges(d.changes.filter((c: PaceChangeEntry) => c.driverCode === drv.code));
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.id, session.currentLap, driverId]);

  // compute rolling delta from baseline (avg of first 3 laps)
  const baselineLaps = history.slice(0, Math.min(3, history.length));
  const baseline = baselineLaps.length > 0 ? baselineLaps.reduce((a, b) => a + b.lapTimeSec, 0) / baselineLaps.length : 0;
  const chartData = history.map((h) => ({
    lap: h.lap,
    lapTime: Number(h.lapTimeSec.toFixed(3)),
    deltaFromBaseline: baseline > 0 ? Number((h.lapTimeSec - baseline).toFixed(3)) : 0,
    compound: h.compound,
    paceMode: h.paceMode,
  }));

  // compute pace-mode background bands from history
  const paceBands: { start: number; end: number; paceMode: string }[] = [];
  if (history.length > 0) {
    let bandStart = history[0].lap;
    let currentPace = history[0].paceMode;
    for (let i = 1; i <= history.length; i++) {
      const nextPace = history[i]?.paceMode;
      if (i === history.length || (nextPace && nextPace !== currentPace)) {
        paceBands.push({ start: bandStart, end: history[i - 1].lap, paceMode: currentPace });
        if (i < history.length) {
          bandStart = history[i].lap;
          currentPace = nextPace!;
        }
      }
    }
  }

  const driver = driverId ? DRIVERS.find((d) => d.id === driverId) : DRIVERS.find((d) => d.isOurs);

  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Activity className="h-3.5 w-3.5 text-red-500" />
          Pace Impact Analysis
        </h3>
        {driver && (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-400">
            {driver.code}
          </span>
        )}
      </div>

      <p className="mb-3 text-[11px] leading-snug text-slate-500">
        Lap times with pace-change markers overlaid. See how each pace decision (Push/Bal/Save) affected subsequent lap times.
      </p>

      <div className="h-48 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            No lap data yet — race in progress
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              {/* pace-mode background shading */}
              {paceBands.map((b, i) => (
                <ReferenceArea
                  key={i}
                  x1={b.start}
                  x2={b.end}
                  strokeOpacity={0}
                  fill={b.paceMode === "push" ? "rgba(239,68,68,0.07)" : b.paceMode === "conserve" ? "rgba(6,182,212,0.07)" : "rgba(148,163,184,0.03)"}
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
                domain={["dataMin - 0.3", "dataMax + 0.3"]}
                tickFormatter={(v) => `${Number(v).toFixed(1)}`}
              />
              <YAxis
                yAxisId="delta"
                orientation="right"
                stroke="#a855f7"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                domain={[-0.5, 0.5]}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`}
                opacity={0.7}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }}
                labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
                labelFormatter={(l) => `Lap ${l}`}
                formatter={(value: number, _name: string, props: any) => {
                  const pace = props?.payload?.paceMode ?? "—";
                  const compound = props?.payload?.compound ?? "—";
                  return [`${value.toFixed(3)}s · ${pace} · ${compound}`, "Lap Time"];
                }}
              />
              {/* pace change markers */}
              {paceChanges.map((c) => (
                <ReferenceLine
                  key={c.id}
                  x={c.lap}
                  stroke={PACE_COLOR[c.toPace] ?? "#64748b"}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  label={{
                    value: c.toPace.toUpperCase(),
                    fill: PACE_COLOR[c.toPace] ?? "#64748b",
                    fontSize: 8,
                    position: "top",
                  }}
                />
              ))}
              {/* baseline overlay line */}
              {(() => {
                if (paceChanges.length === 0 || history.length === 0) return null;
                const firstChangeLap = Math.min(...paceChanges.map((c) => c.lap));
                const baselineLaps = history.filter((h) => h.lap < firstChangeLap);
                if (baselineLaps.length === 0) return null;
                const baseline = baselineLaps.reduce((a, b) => a + b.lapTimeSec, 0) / baselineLaps.length;
                return (
                  <ReferenceLine
                    y={Number(baseline.toFixed(3))}
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    opacity={0.6}
                    label={{
                      value: `Baseline ${baseline.toFixed(2)}s`,
                      fill: "#fbbf24",
                      fontSize: 8,
                      position: "right",
                    }}
                  />
                );
              })()}
              <Line
                type="monotone"
                dataKey="lapTime"
                stroke={driver?.teamColor ?? "#dc2626"}
                strokeWidth={2}
                dot={{ r: 3, fill: driver?.teamColor ?? "#dc2626" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
              {/* rolling delta-from-baseline line */}
              {baseline > 0 && (
                <Line
                  type="monotone"
                  dataKey="deltaFromBaseline"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                  opacity={0.7}
                  yAxisId="delta"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* pace change delta-from-baseline analysis */}
      {paceChanges.length > 0 && history.length > 0 && (
        <div className="mt-3 rounded-lg border border-border/40 bg-slate-900/40 p-2.5">
          <div className="mb-2 text-[9px] uppercase tracking-wide text-slate-500">
            Delta from baseline (avg before first change)
          </div>
          {(() => {
            const firstChangeLap = Math.min(...paceChanges.map((c) => c.lap));
            const baselineLaps = history.filter((h) => h.lap < firstChangeLap);
            const baseline = baselineLaps.length > 0
              ? baselineLaps.reduce((a, b) => a + b.lapTimeSec, 0) / baselineLaps.length
              : 0;
            return paceChanges.map((c) => {
              // avg of 3 laps after the change
              const afterLaps = history.filter((h) => h.lap > c.lap && h.lap <= c.lap + 3);
              const afterAvg = afterLaps.length > 0
                ? afterLaps.reduce((a, b) => a + b.lapTimeSec, 0) / afterLaps.length
                : 0;
              const delta = baseline > 0 ? afterAvg - baseline : 0;
              const isFaster = delta < -0.05;
              const isSlower = delta > 0.05;
              const Icon = c.toPace === "push" ? Zap : c.toPace === "conserve" ? Snowflake : Gauge;
              return (
                <div key={c.id} className="mb-1.5 flex items-center gap-2 text-[10px] last:mb-0">
                  <Icon className="h-3 w-3 shrink-0" style={{ color: PACE_COLOR[c.toPace] }} />
                  <span className="capitalize" style={{ color: PACE_COLOR[c.toPace] }}>{c.toPace}</span>
                  <span className="font-mono text-slate-500">L{c.lap}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-slate-400">baseline {baseline.toFixed(3)}s</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-slate-400">after {afterAvg.toFixed(3)}s</span>
                  <span
                    className={cn(
                      "ml-auto font-mono font-bold",
                      isFaster ? "text-green-400" : isSlower ? "text-red-400" : "text-slate-400"
                    )}
                  >
                    {delta > 0 ? "+" : ""}{delta.toFixed(3)}s
                    <span className="ml-1 text-[8px] uppercase">
                      {isFaster ? "faster" : isSlower ? "slower" : "neutral"}
                    </span>
                  </span>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* pace change legend */}
      {paceChanges.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] text-slate-500">
          <span className="uppercase tracking-wide">Pace changes:</span>
          {paceChanges.map((c) => {
            const Icon = c.toPace === "push" ? Zap : c.toPace === "conserve" ? Snowflake : Gauge;
            return (
              <span key={c.id} className="flex items-center gap-1 rounded border border-border/40 bg-slate-900/40 px-1.5 py-0.5">
                <Icon className="h-2.5 w-2.5" style={{ color: PACE_COLOR[c.toPace] }} />
                <span className="capitalize" style={{ color: PACE_COLOR[c.toPace] }}>{c.toPace}</span>
                <span className="font-mono text-slate-600">L{c.lap}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
