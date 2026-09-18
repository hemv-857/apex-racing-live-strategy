"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { GitCompare, Layers, Filter } from "lucide-react";
import { DRIVERS, TRACKS } from "@/lib/racing/data";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CrossSessionData {
  sessionId: string;
  trackId: string;
  trackName: string;
  laps: { lap: number; lapTimeSec: number; driverCode: string; compound: string }[];
}

const SESSION_COLORS = ["#dc2626", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7"];

export function CrossSessionChart() {
  const rbDrivers = DRIVERS.filter((d) => d.isOurs);
  const [driverId, setDriverId] = useState(rbDrivers[0]?.id ?? DRIVERS[0].id);
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [sessions, setSessions] = useState<CrossSessionData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    fetch(`/api/cross-session?driverId=${driverId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d?.sessions) setSessions(d.sessions);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [driverId]);

  // filter sessions by track
  const filteredSessions = trackFilter === "all"
    ? sessions
    : sessions.filter((s) => s.trackId === trackFilter);

  // Build chart data: lap -> { sessionId1: lapTime, sessionId2: lapTime, ... }
  const maxLap = filteredSessions.length > 0
    ? Math.max(...filteredSessions.flatMap((s) => s.laps.map((l) => l.lap)))
    : 0;
  const chartData = Array.from({ length: maxLap }, (_, i) => {
    const lap = i + 1;
    const row: { lap: number; [k: string]: number | string } = { lap };
    for (const s of filteredSessions) {
      const entry = s.laps.find((l) => l.lap === lap);
      row[s.sessionId] = entry ? Number(entry.lapTimeSec.toFixed(3)) : 0;
    }
    return row;
  });

  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Layers className="h-3.5 w-3.5 text-red-500" />
          Cross-Session Lap Comparison
        </h3>
        <div className="flex items-center gap-2">
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="h-7 w-[100px] border-border/40 bg-slate-900/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Tracks</SelectItem>
              {TRACKS.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.name.split(" ")[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={driverId} onValueChange={setDriverId}>
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
        Compare lap times across multiple race sessions from the database. See how pace evolves across different tracks and conditions.
      </p>

      <div className="h-56 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Loading cross-session data…</div>
        ) : filteredSessions.length > 0 && maxLap > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
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
                domain={["dataMin - 0.5", "dataMax + 0.5"]}
                tickFormatter={(v) => `${Number(v).toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }}
                labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
                labelFormatter={(l) => `Lap ${l}`}
                formatter={(value: number, name: string) => {
                  const s = sessions.find((sess) => sess.sessionId === name);
                  return [`${value}s`, s?.trackName ?? name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                iconType="circle"
                formatter={(value) => {
                  const s = sessions.find((sess) => sess.sessionId === value);
                  return s?.trackName ?? value;
                }}
              />
              {filteredSessions.map((s, i) => (
                <Line
                  key={s.sessionId}
                  type="monotone"
                  dataKey={s.sessionId}
                  stroke={SESSION_COLORS[i % SESSION_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <GitCompare className="h-6 w-6 text-slate-700" />
            <p className="text-xs text-slate-500">No cross-session data yet</p>
            <p className="text-[10px] text-slate-600">Lap history persists to DB — data appears after sessions run</p>
          </div>
        )}
      </div>

      {/* session stats summary */}
      {filteredSessions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="grid grid-cols-5 gap-2 text-[9px] uppercase tracking-wide text-slate-500">
            <span>Session</span>
            <span className="text-right">Avg Lap</span>
            <span className="text-right">Best Lap</span>
            <span className="text-right">Consistency</span>
            <span className="text-right">Δ Prev</span>
          </div>
          {filteredSessions.map((s, i) => {
            const times = s.laps.map((l) => l.lapTimeSec).filter((t) => t > 0);
            const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
            const best = times.length > 0 ? Math.min(...times) : 0;
            const mean = avg;
            const variance = times.length > 0 ? times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length : 0;
            const stddev = Math.sqrt(variance);
            const consistency = stddev > 0 ? Math.max(0, 100 - stddev * 50) : 100;
            // delta vs previous session's avg
            let delta: number | null = null;
            if (i > 0) {
              const prevTimes = filteredSessions[i - 1].laps.map((l) => l.lapTimeSec).filter((t) => t > 0);
              const prevAvg = prevTimes.length > 0 ? prevTimes.reduce((a, b) => a + b, 0) / prevTimes.length : 0;
              delta = prevAvg > 0 ? avg - prevAvg : null;
            }
            return (
              <div
                key={s.sessionId}
                className="grid grid-cols-5 items-center gap-2 rounded-md border border-border/40 bg-slate-900/40 px-2 py-1.5 text-[10px]"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SESSION_COLORS[i % SESSION_COLORS.length] }} />
                  <span className="truncate font-mono text-slate-300">{s.trackName}</span>
                  <span className="text-slate-600">·{s.laps.length}L</span>
                </div>
                <span className="text-right font-mono text-slate-200">{avg.toFixed(3)}s</span>
                <span className="text-right font-mono font-bold text-green-400">{best.toFixed(3)}s</span>
                <div className="flex items-center justify-end gap-1">
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={cn("h-full rounded-full", consistency > 80 ? "bg-green-500" : consistency > 60 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${consistency}%` }}
                    />
                  </div>
                  <span className="font-mono text-slate-400">{consistency.toFixed(0)}%</span>
                </div>
                <span className={cn(
                  "text-right font-mono font-bold",
                  delta === null ? "text-slate-600" : delta < -0.05 ? "text-green-400" : delta > 0.05 ? "text-red-400" : "text-slate-400"
                )}>
                  {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(3)}s`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
