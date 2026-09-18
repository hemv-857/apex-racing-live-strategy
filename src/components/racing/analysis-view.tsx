"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, Clock, Flag, Gauge, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { PostRaceAnalysisData, PlaybookData, RaceSessionData } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

interface AnalysisViewProps {
  session: RaceSessionData;
  analysis: PostRaceAnalysisData | null;
  playbooks: PlaybookData[];
  onRunAnalysis: () => void;
  loading: boolean;
}

export function AnalysisView({ session, analysis, playbooks, onRunAnalysis, loading }: AnalysisViewProps) {
  const [tab, setTab] = useState<"deltas" | "deviations" | "playbook">("deltas");

  if (!analysis) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="rounded-full bg-red-500/10 p-4">
          <Target className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-100">Post-Race Analysis</h3>
          <p className="mt-1 text-sm text-slate-500">Compare actual vs simulated race outcome</p>
        </div>
        <button
          onClick={onRunAnalysis}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Generate Analysis"}
        </button>
      </div>
    );
  }

  const chartData = analysis.driverDeltas.map((d) => ({
    name: d.driverCode,
    actual: d.actualPosition,
    predicted: d.predictedPosition,
    withinOne: d.withinOne,
  }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Gauge className="h-4 w-4 text-red-500" />
          Post-Race Analysis Suite
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Simulator Accuracy</div>
            <div className={cn("font-mono text-lg font-bold", analysis.accuracyScore >= 0.75 ? "text-green-400" : "text-amber-400")}>
              {Math.round(analysis.accuracyScore * 100)}%
            </div>
          </div>
          <button
            onClick={onRunAnalysis}
            disabled={loading}
            className="rounded-md border border-border bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* accuracy banner */}
      <div className={cn("border-b px-4 py-2 text-xs", analysis.accuracyScore >= 0.75 ? "bg-green-500/5 text-green-400" : "bg-amber-500/5 text-amber-400")}>
        {analysis.accuracyScore >= 0.75
          ? `✓ Target met: predicted finishing order within 1 position for ${Math.round(analysis.accuracyScore * 100)}% of field`
          : `⚠ Below target (${Math.round(analysis.accuracyScore * 100)}% vs 75% goal). Calibration update recommended.`}
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-border/50 px-3 py-2">
        {([
          ["deltas", "Actual vs Predicted"],
          ["deviations", "Deviations"],
          ["playbook", "Playbook"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              tab === k ? "bg-red-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "thin" }}>
        {tab === "deltas" && (
          <div className="space-y-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} label={{ value: "Pos", angle: -90, position: "insideLeft", fontSize: 10, fill: "#64748b" }} reversed />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }}
                    cursor={{ fill: "rgba(220,38,38,0.05)" }}
                  />
                  <Bar dataKey="predicted" fill="#64748b" radius={[3, 3, 0, 0]} name="Predicted" />
                  <Bar dataKey="actual" radius={[3, 3, 0, 0]} name="Actual">
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.withinOne ? "#22c55e" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5">
              {analysis.driverDeltas.map((d) => (
                <motion.div
                  key={d.driverCode}
                  layout
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-slate-900/40 p-2.5"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 font-mono text-xs font-bold text-slate-200">
                    P{d.actualPosition}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-100">{d.driverCode}</span>
                      <span className="truncate text-xs text-slate-400">{d.driverName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Predicted P{d.predictedPosition} · Actual P{d.actualPosition}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("flex items-center gap-1 font-mono text-sm font-bold", d.withinOne ? "text-green-400" : "text-red-400")}>
                      {d.delta === 0 ? "—" : d.delta > 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      {d.delta > 0 ? `+${d.delta}` : d.delta}
                    </div>
                    <div className="text-[10px] text-slate-500">{d.withinOne ? "within 1" : "off by >1"}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {tab === "deviations" && (
          <div className="space-y-2">
            {analysis.deviations.map((dev, i) => (
              <motion.div
                key={i}
                layout
                className="rounded-lg border border-border/50 bg-slate-900/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className={cn("h-4 w-4", dev.impactSec >= 0 ? "text-red-400" : "text-green-400")} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                      {dev.type.replace("-", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-mono text-xs text-slate-400">
                      <Flag className="h-3 w-3" /> Lap {dev.lap}
                    </span>
                    <span className={cn("flex items-center gap-1 font-mono text-xs font-bold", dev.impactSec >= 0 ? "text-red-400" : "text-green-400")}>
                      <Clock className="h-3 w-3" />
                      {dev.impactSec >= 0 ? "+" : ""}{dev.impactSec.toFixed(1)}s
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-xs leading-snug text-slate-400">{dev.description}</p>
              </motion.div>
            ))}
          </div>
        )}

        {tab === "playbook" && (
          <div className="space-y-2">
            {playbooks.map((pb) => (
              <motion.div
                key={pb.id}
                layout
                className="rounded-lg border border-border/50 bg-slate-900/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">{pb.title}</h4>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{pb.scenario}</p>
                  </div>
                  <div className="text-right">
                    <div className={cn("font-mono text-lg font-bold", pb.winRate >= 0.6 ? "text-green-400" : "text-amber-400")}>
                      {Math.round(pb.winRate * 100)}%
                    </div>
                    <div className="text-[10px] text-slate-500">win rate</div>
                  </div>
                </div>
                <p className="mt-2 border-t border-border/40 pt-2 text-xs leading-snug text-slate-400">{pb.ruleText}</p>
              </motion.div>
            ))}
            {playbooks.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No playbooks generated yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
