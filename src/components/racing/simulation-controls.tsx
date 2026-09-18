"use client";

import { motion } from "framer-motion";
import { Cpu, Play, RotateCcw, Trophy, Target, BarChart3 } from "lucide-react";
import type { SimulationResult } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

interface SimControlsProps {
  onRun: () => void;
  onReset: () => void;
  running: boolean;
  result: SimulationResult | null;
}

export function SimulationControls({ onRun, onReset, running, result }: SimControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {running ? <Cpu className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
          {running ? "Simulating 20 laps…" : "Run 20-Lap Forecast"}
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-md border border-border bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          <SummaryCard
            icon={Trophy}
            label="Best Win Prob"
            value={`${Math.round(result.summary.winProbability * 100)}%`}
            color="text-red-400"
          />
          <SummaryCard
            icon={Target}
            label="Best Podium Prob"
            value={`${Math.round(result.summary.podiumProbability * 100)}%`}
            color="text-green-400"
          />
          <SummaryCard
            icon={BarChart3}
            label="Options Generated"
            value={`${result.options.length}`}
            color="text-cyan-400"
          />
          <SummaryCard
            icon={Cpu}
            label="Horizon"
            value={`${result.horizonLaps} laps`}
            color="text-purple-400"
          />
        </motion.div>
      )}

      {result && result.summary.expectedPositions.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-slate-900/40 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Expected Finishing — RB Drivers</div>
          <div className="flex flex-wrap gap-3">
            {result.summary.expectedPositions.map((ep) => (
              <div key={ep.driverCode} className="flex items-center gap-2">
                <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-xs font-bold text-red-400">
                  {ep.driverCode}
                </span>
                <span className="font-mono text-sm font-bold text-slate-100">P{ep.position}</span>
                <span className="text-[10px] text-slate-500">
                  ({Math.round(ep.confidence * 100)}% conf)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </div>
      <div className={cn("mt-1 font-mono text-xl font-bold", color)}>{value}</div>
    </div>
  );
}
