"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, TrendingDown, TrendingUp, Trophy, Minus } from "lucide-react";
import type { ChampionshipStanding } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

interface StandingsPanelProps {
  refreshKey: number; // changes when session ticks
}

export function StandingsPanel({ refreshKey }: StandingsPanelProps) {
  const [standings, setStandings] = useState<ChampionshipStanding[]>([]);
  const [liveRound, setLiveRound] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/standings")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d?.standings) {
          setStandings(d.standings);
          setLiveRound(d.liveRound ?? "");
        }
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const leader = standings[0];
  const ourBest = standings.find((s) => s.isOurs);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Crown className="h-4 w-4 text-amber-400" />
          Championship Standings
        </h3>
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
          Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
              <tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 text-left">Pos</th>
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-2 py-2 text-center">Wins</th>
                <th className="px-2 py-2 text-center">Pod.</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="px-2 py-2 text-center">Δ</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const isLeader = i === 0;
                const gapToLeader = leader ? leader.points - s.points : 0;
                return (
                  <motion.tr
                    key={s.driverId}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "border-b border-border/20 transition-colors",
                      s.isOurs && "bg-red-500/5",
                      isLeader && "bg-amber-500/5"
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {isLeader ? (
                          <Trophy className="h-3 w-3 text-amber-400" />
                        ) : (
                          <span className="font-mono text-xs text-slate-400">{s.position}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s.teamColor }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-100">{s.driverCode}</span>
                            {s.isOurs && (
                              <span className="rounded bg-red-500/20 px-1 text-[9px] font-bold uppercase text-red-400">RB</span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-slate-500">{s.team}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-slate-300">{s.wins}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs text-slate-300">{s.podiums}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-mono text-sm font-bold text-slate-100">{s.points}</div>
                      {gapToLeader > 0 && (
                        <div className="text-[9px] text-slate-500">-{gapToLeader}</div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {s.deltaPrev > 0 ? (
                        <span className="flex items-center justify-center gap-0.5 text-green-400">
                          <TrendingUp className="h-3 w-3" />+{s.deltaPrev}
                        </span>
                      ) : s.deltaPrev < 0 ? (
                        <span className="flex items-center justify-center gap-0.5 text-red-400">
                          <TrendingDown className="h-3 w-3" />{s.deltaPrev}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center text-slate-500">
                          <Minus className="h-3 w-3" />
                        </span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {ourBest && (
        <div className="border-t border-border/50 bg-red-500/5 px-4 py-2 text-xs">
          <span className="text-slate-400">Best RB: </span>
          <span className="font-mono font-bold text-red-400">{ourBest.driverCode}</span>
          <span className="text-slate-400"> · P{ourBest.position} · </span>
          <span className="font-mono font-semibold text-slate-100">{ourBest.points} pts</span>
        </div>
      )}
    </div>
  );
}
