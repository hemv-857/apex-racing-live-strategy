"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { TrendingUp, Crown, Filter } from "lucide-react";
import type { ChampionshipTimeline } from "@/lib/racing/types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChampionshipTimelineChartProps {
  refreshKey: number;
}

export function ChampionshipTimelineChart({ refreshKey }: ChampionshipTimelineChartProps) {
  const [timeline, setTimeline] = useState<ChampionshipTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleRounds, setVisibleRounds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    fetch("/api/timeline")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d?.timeline) {
          setTimeline(d.timeline);
          // default: all rounds visible
          setVisibleRounds(new Set(d.timeline.rounds.map((r: any) => r.trackName)));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const toggleRound = (trackName: string) => {
    setVisibleRounds((prev) => {
      const next = new Set(prev);
      if (next.has(trackName)) next.delete(trackName);
      else next.add(trackName);
      return next;
    });
  };

  // filter chart data by visible rounds
  const chartData = timeline
    ? timeline.rounds
        .filter((r) => visibleRounds.has(r.trackName))
        .map((r) => {
          const row: { round: string; [k: string]: number | string } = { round: r.trackName };
          for (const s of timeline.series) {
            const pt = s.points.find((p) => p.round === r.round);
            row[s.driverCode] = pt ? pt.cumulative : 0;
          }
          return row;
        })
    : [];

  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
          Points Progression
        </h3>
        <span className="text-[10px] text-slate-500">cumulative across rounds</span>
      </div>

      {/* round filter chips */}
      {timeline && timeline.rounds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-500">
            <Filter className="h-2.5 w-2.5" />
            Rounds:
          </span>
          {timeline.rounds.map((r) => {
            const visible = visibleRounds.has(r.trackName);
            return (
              <button
                key={r.round}
                onClick={() => toggleRound(r.trackName)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  visible
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-border/30 bg-slate-900/40 text-slate-600"
                )}
              >
                {r.trackName}
              </button>
            );
          })}
        </div>
      )}

      <div className="h-64 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Loading…</div>
        ) : timeline && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis
                dataKey="round"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }}
                labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
                formatter={(value: number, name: string) => [`${value} pts`, name]}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                iconType="circle"
              />
              {timeline.series.map((s) => (
                <Line
                  key={s.driverCode}
                  type="monotone"
                  dataKey={s.driverCode}
                  stroke={s.teamColor}
                  strokeWidth={s.isOurs ? 2.5 : 1.5}
                  dot={{ r: s.isOurs ? 4 : 2, fill: s.teamColor }}
                  isAnimationActive={false}
                  opacity={s.isOurs ? 1 : 0.6}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            {timeline && chartData.length === 0 ? "Select at least one round" : "No timeline data"}
          </div>
        )}
      </div>

      {/* current leader badge */}
      {timeline && timeline.series.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="text-xs text-slate-400">Championship leader:</span>
          {(() => {
            const leader = [...timeline.series]
              .map((s) => ({ code: s.driverCode, name: s.driverName, color: s.teamColor, isOurs: s.isOurs, pts: s.points[s.points.length - 1]?.cumulative ?? 0 }))
              .sort((a, b) => b.pts - a.pts)[0];
            return (
              <>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: leader.color }} />
                <span className="font-mono text-sm font-bold" style={{ color: leader.color }}>{leader.code}</span>
                <span className="text-xs text-slate-300">{leader.name}</span>
                <span className="ml-auto font-mono text-lg font-bold text-amber-400">{leader.pts} pts</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
