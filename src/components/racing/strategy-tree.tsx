"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Gauge, TrendingUp, Zap } from "lucide-react";
import type { PitStrategyOption, SimulationResult } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

interface StrategyTreeProps {
  simulation: SimulationResult | null;
  selectedOptionId: string | null;
  onSelect: (id: string) => void;
  onExport: (option: PitStrategyOption) => void;
}

const COMPOUND_LABEL: Record<string, string> = {
  soft: "S",
  medium: "M",
  hard: "H",
  inter: "I",
  wet: "W",
};

function ProbabilityBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
        <span className="font-mono text-[11px] font-semibold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function StrategyTree({ simulation, selectedOptionId, onSelect, onExport }: StrategyTreeProps) {
  const options = simulation?.options ?? [];
  const grouped = useMemo(() => {
    const g: Record<string, PitStrategyOption[]> = {};
    for (const o of options) {
      const driverCode = o.id.split("::")[0] ?? "ALL";
      if (!g[driverCode]) g[driverCode] = [];
      g[driverCode].push(o);
    }
    return g;
  }, [options]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Activity className="h-4 w-4 text-red-500" />
            Strategy Tree
          </h3>
          {simulation && (
            <p className="mt-0.5 text-[11px] text-slate-500">{simulation.label}</p>
          )}
        </div>
        {simulation && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Best Podium</div>
            <div className="font-mono text-lg font-bold text-green-400">
              {Math.round(simulation.summary.podiumProbability * 100)}%
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: "thin" }}>
        {!simulation && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <Gauge className="h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-500">No simulation yet</p>
            <p className="text-xs text-slate-600">Run a 20-lap forecast to see strategy options</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {Object.entries(grouped).map(([driverCode, opts]) => (
            <motion.div
              key={driverCode}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4"
            >
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-400">
                  {driverCode}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {opts.length} options
                </span>
              </div>
              <div className="space-y-2">
                {opts
                  .sort((a, b) => b.finishProbabilities.podium - a.finishProbabilities.podium)
                  .map((o) => {
                    const selected = selectedOptionId === o.id;
                    const isBest = simulation?.summary.bestOptionId === o.id;
                    return (
                      <motion.div
                        key={o.id}
                        layout
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(o.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(o.id);
                          }
                        }}
                        whileHover={{ scale: 1.005 }}
                        className={cn(
                          "relative w-full cursor-pointer overflow-hidden rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50",
                          selected
                            ? "border-red-500/70 bg-slate-800/80 shadow-md shadow-red-500/5"
                            : "border-border/60 bg-slate-900/40 hover:border-border hover:bg-slate-800/60"
                        )}
                      >
                        {isBest && (
                          <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-400">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Best
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 pr-12">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-100">{o.label}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                              {o.description}
                            </p>
                          </div>
                        </div>

                        {/* pit plan chips */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Zap className="h-3 w-3" /> {o.stops}-stop
                          </span>
                          {o.pitLaps.map((lap, i) => (
                            <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                              L{lap}
                              <span className="ml-1 text-red-400">
                                {COMPOUND_LABEL[o.compounds[i + 1] ?? "medium"]}
                              </span>
                            </span>
                          ))}
                          <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                            <TrendingUp className="h-3 w-3" /> P{o.expectedPosition}
                          </span>
                          {o.riskScore > 0.55 && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400">
                              <AlertTriangle className="h-3 w-3" /> {Math.round(o.riskScore * 100)}% risk
                            </span>
                          )}
                        </div>

                        {/* probabilities */}
                        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                          <ProbabilityBar label="Win" value={o.finishProbabilities.win} color="#ef4444" />
                          <ProbabilityBar label="Podium" value={o.finishProbabilities.podium} color="#22c55e" />
                          <ProbabilityBar label="Top 5" value={o.finishProbabilities.top5} color="#06b6d4" />
                          <ProbabilityBar label="Points" value={o.finishProbabilities.points} color="#8b5cf6" />
                        </div>

                        {/* reasoning */}
                        <p className="mt-2 border-t border-border/40 pt-1.5 text-[10px] italic leading-snug text-slate-500">
                          {o.reasoning}
                        </p>

                        {/* export */}
                        {selected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-2 overflow-hidden"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExport(o);
                              }}
                              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                            >
                              <Zap className="h-3.5 w-3.5" />
                              Export to Pit Box
                            </button>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
