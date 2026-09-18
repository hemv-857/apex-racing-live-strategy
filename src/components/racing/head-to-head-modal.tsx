"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Swords, X, User, ArrowRight } from "lucide-react";
import type { HeadToHeadComparison } from "@/lib/racing/types";
import { DRIVERS } from "@/lib/racing/data";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeadToHeadModalProps {
  open: boolean;
  onClose: () => void;
  defaultDriverAId?: string;
  defaultDriverBId?: string;
}

export function HeadToHeadModal({ open, onClose, defaultDriverAId, defaultDriverBId }: HeadToHeadModalProps) {
  const rbDrivers = DRIVERS.filter((d) => d.isOurs);
  const [driverAId, setDriverAId] = useState(defaultDriverAId ?? rbDrivers[0]?.id ?? DRIVERS[0].id);
  const [driverBId, setDriverBId] = useState(defaultDriverBId ?? rbDrivers[1]?.id ?? DRIVERS[1].id);
  const [comparison, setComparison] = useState<HeadToHeadComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    // defer setLoading to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    fetch(`/api/head-to-head?driverAId=${driverAId}&driverBId=${driverBId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.comparison) setComparison(d.comparison);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, driverAId, driverBId]);

  if (!open) return null;

  const driverA = DRIVERS.find((d) => d.id === driverAId)!;
  const driverB = DRIVERS.find((d) => d.id === driverBId)!;

  const chartData =
    comparison?.laps.map((l) => ({
      lap: `L${l.lap}`,
      delta: Number(l.delta.toFixed(3)),
      faster: l.delta < 0 ? "A" : l.delta > 0 ? "B" : "tie",
    })) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-2xl"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-bold text-slate-100">Driver Head-to-Head</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* driver pickers */}
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Driver A</label>
            <Select value={driverAId} onValueChange={setDriverAId}>
              <SelectTrigger className="bg-slate-900/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVERS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="font-mono font-bold">{d.code}</span> · {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="mt-5 h-4 w-4 text-slate-600" />
          <div className="flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Driver B</label>
            <Select value={driverBId} onValueChange={setDriverBId}>
              <SelectTrigger className="bg-slate-900/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVERS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="font-mono font-bold">{d.code}</span> · {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* body */}
        <div className="max-h-[60vh] overflow-y-auto p-5" style={{ scrollbarWidth: "thin" }}>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">Analyzing…</div>
          ) : !comparison ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">No data yet</div>
          ) : (
            <div className="space-y-4">
              {/* summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <DriverSummaryCard
                  driver={driverA}
                  lapsAhead={comparison.summary.lapsAheadA}
                  isWinner={comparison.summary.winnerCode === driverA.code}
                />
                <DriverSummaryCard
                  driver={driverB}
                  lapsAhead={comparison.summary.lapsAheadB}
                  isWinner={comparison.summary.winnerCode === driverB.code}
                />
              </div>

              {/* key stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Avg Δ (A−B)" value={`${comparison.summary.avgDelta > 0 ? "+" : ""}${comparison.summary.avgDelta.toFixed(3)}s`} accent={comparison.summary.avgDelta < 0 ? driverA.teamColor : driverB.teamColor} />
                <StatBox label="Race Gap" value={`${comparison.summary.raceGapSec > 0 ? "+" : ""}${comparison.summary.raceGapSec.toFixed(2)}s`} />
                <StatBox label="Quali Gap" value={`${comparison.summary.qualifyingGap > 0 ? "+" : ""}${comparison.summary.qualifyingGap.toFixed(3)}s`} />
              </div>

              {/* lap-by-lap delta chart */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lap-by-Lap Delta</h4>
                  <span className="text-[10px] text-slate-500">negative = A faster</span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="lap" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}s`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }}
                        cursor={{ fill: "rgba(220,38,38,0.05)" }}
                        formatter={(v: number) => [`${v > 0 ? "+" : ""}${v.toFixed(3)}s`, "Δ (A−B)"]}
                      />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" />
                      <Bar dataKey="delta" radius={[2, 2, 2, 2]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.delta < 0 ? driverA.teamColor : d.delta > 0 ? driverB.teamColor : "#64748b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* sector-by-sector comparison */}
              {comparison.laps.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sector Comparison (avg)</h4>
                    <span className="text-[10px] text-slate-500">lower = faster</span>
                  </div>
                  {(() => {
                    const lapsWithSectors = comparison.laps.filter((l) => l.sectorsA && l.sectorsB);
                    if (lapsWithSectors.length === 0) return <p className="text-xs text-slate-500">No sector data available</p>;
                    const avgS1A = lapsWithSectors.reduce((a, b) => a + (b.sectorsA?.s1 ?? 0), 0) / lapsWithSectors.length;
                    const avgS2A = lapsWithSectors.reduce((a, b) => a + (b.sectorsA?.s2 ?? 0), 0) / lapsWithSectors.length;
                    const avgS3A = lapsWithSectors.reduce((a, b) => a + (b.sectorsA?.s3 ?? 0), 0) / lapsWithSectors.length;
                    const avgS1B = lapsWithSectors.reduce((a, b) => a + (b.sectorsB?.s1 ?? 0), 0) / lapsWithSectors.length;
                    const avgS2B = lapsWithSectors.reduce((a, b) => a + (b.sectorsB?.s2 ?? 0), 0) / lapsWithSectors.length;
                    const avgS3B = lapsWithSectors.reduce((a, b) => a + (b.sectorsB?.s3 ?? 0), 0) / lapsWithSectors.length;
                    const radarData = [
                      { sector: "S1", [driverA.code]: Number(avgS1A.toFixed(3)), [driverB.code]: Number(avgS1B.toFixed(3)) },
                      { sector: "S2", [driverA.code]: Number(avgS2A.toFixed(3)), [driverB.code]: Number(avgS2B.toFixed(3)) },
                      { sector: "S3", [driverA.code]: Number(avgS3A.toFixed(3)), [driverB.code]: Number(avgS3B.toFixed(3)) },
                    ];
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        {/* radar chart */}
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="rgba(148,163,184,0.15)" />
                              <PolarAngleAxis dataKey="sector" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                              <PolarRadiusAxis tick={{ fill: "#64748b", fontSize: 8 }} />
                              <Radar name={driverA.code} dataKey={driverA.code} stroke={driverA.teamColor} fill={driverA.teamColor} fillOpacity={0.3} strokeWidth={2} />
                              <Radar name={driverB.code} dataKey={driverB.code} stroke={driverB.teamColor} fill={driverB.teamColor} fillOpacity={0.2} strokeWidth={2} />
                              <Tooltip
                                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6, fontSize: 10, color: "#e2e8f0" }}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* sector delta bars */}
                        <div className="space-y-2">
                          {[
                            { label: "S1", a: avgS1A, b: avgS1B },
                            { label: "S2", a: avgS2A, b: avgS2B },
                            { label: "S3", a: avgS3A, b: avgS3B },
                          ].map((s) => {
                            const delta = s.a - s.b;
                            const aFaster = delta < -0.01;
                            const bFaster = delta > 0.01;
                            return (
                              <div key={s.label} className="rounded-md border border-border/40 bg-slate-900/40 p-2">
                                <div className="mb-1 flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-slate-300">{s.label}</span>
                                  <span className={cn("font-mono font-bold", aFaster ? "text-green-400" : bFaster ? "text-red-400" : "text-slate-400")}>
                                    {delta > 0 ? "+" : ""}{delta.toFixed(3)}s
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-8 text-right font-mono text-[9px]" style={{ color: driverA.teamColor }}>{s.a.toFixed(2)}</span>
                                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                                    <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
                                    <div
                                      className="absolute top-0 h-full rounded-full"
                                      style={{
                                        backgroundColor: aFaster ? driverA.teamColor : driverB.teamColor,
                                        left: aFaster ? `${50 - Math.min(50, Math.abs(delta) * 20)}%` : "50%",
                                        width: `${Math.min(50, Math.abs(delta) * 20)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="w-8 font-mono text-[9px]" style={{ color: driverB.teamColor }}>{s.b.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* lap table */}
              <div className="rounded-lg border border-border/40">
                <div className="max-h-48 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900/95">
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-1.5 text-left">Lap</th>
                        <th className="px-3 py-1.5 text-right" style={{ color: driverA.teamColor }}>A · {driverA.code}</th>
                        <th className="px-3 py-1.5 text-right" style={{ color: driverB.teamColor }}>B · {driverB.code}</th>
                        <th className="px-3 py-1.5 text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.laps.map((l) => (
                        <tr key={l.lap} className="border-t border-border/20">
                          <td className="px-3 py-1.5 font-mono text-slate-400">L{l.lap}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-200">{l.timeA.toFixed(3)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-200">{l.timeB.toFixed(3)}</td>
                          <td className={cn("px-3 py-1.5 text-right font-mono font-bold", l.delta < 0 ? "text-green-400" : l.delta > 0 ? "text-red-400" : "text-slate-500")}>
                            {l.delta > 0 ? "+" : ""}{l.delta.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function DriverSummaryCard({
  driver,
  lapsAhead,
  isWinner,
}: {
  driver: { name: string; code: string; teamColor: string; team: string };
  lapsAhead: number;
  isWinner: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border p-3", isWinner ? "border-green-500/40 bg-green-500/5" : "border-border/50 bg-slate-900/40")}>
      {isWinner && (
        <div className="absolute right-2 top-2 rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-400">
          Winner
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: driver.teamColor }} />
        <span className="font-mono text-lg font-bold" style={{ color: driver.teamColor }}>{driver.code}</span>
      </div>
      <div className="mt-0.5 text-xs text-slate-300">{driver.name}</div>
      <div className="text-[10px] text-slate-500">{driver.team}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold text-slate-100">{lapsAhead}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">laps faster</span>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-slate-900/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-base font-bold" style={{ color: accent ?? "#e2e8f0" }}>{value}</div>
    </div>
  );
}
