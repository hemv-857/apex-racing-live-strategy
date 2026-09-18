"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Zap, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import type { AlertData, PitStrategyOption, RaceSessionData, StrategyRecommendation } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

interface RecommendationPanelProps {
  session: RaceSessionData | null;
  alerts: AlertData[];
  options: PitStrategyOption[];
  onSelectOption: (id: string) => void;
  onExport: (option: PitStrategyOption) => void;
  refreshKey: number;
}

export function RecommendationPanel({ session, alerts, options, onSelectOption, onExport, refreshKey }: RecommendationPanelProps) {
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    const t = setTimeout(() => {
      fetch("/api/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, alerts, options }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (active && d?.recommendations) setRecommendations(d.recommendations);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [session, alerts, options, refreshKey]);

  if (!session) return null;

  return (
    <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/5 via-slate-900/40 to-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-300">
          <Lightbulb className="h-3.5 w-3.5 text-red-400" />
          Strategy Recommendations
        </h3>
        {loading && <span className="text-[10px] text-slate-500">analyzing…</span>}
      </div>

      <p className="mb-3 text-[11px] leading-snug text-slate-500">
        Auto-suggested best strategy per RB driver, scored by podium probability and triggered by live alerts (tire cliff, DRS pressure, weather, fuel).
      </p>

      <AnimatePresence mode="popLayout">
        {recommendations.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <Sparkles className="h-6 w-6 text-slate-700" />
            <p className="text-xs text-slate-500">Run a simulation to get recommendations</p>
          </motion.div>
        )}
        {recommendations.map((rec) => {
          const opt = options.find((o) => o.id === rec.recommendedOptionId);
          const altOpt = options.find((o) => o.id === rec.alternativeOptionId);
          return (
            <motion.div
              key={rec.driverCode}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-2 overflow-hidden rounded-lg border border-red-500/30 bg-slate-900/60 p-3"
            >
              {/* driver header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-red-400">
                    {rec.driverCode}
                  </span>
                  <span className="text-xs text-slate-400">{rec.driverName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-green-400"
                      style={{ width: `${rec.confidence * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-slate-300">{Math.round(rec.confidence * 100)}%</span>
                </div>
              </div>

              {/* recommendation */}
              <div className="mt-2 flex items-start gap-2">
                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => onSelectOption(rec.recommendedOptionId)}
                    className="text-left text-sm font-semibold text-slate-100 hover:text-red-300"
                  >
                    {rec.recommendedLabel}
                  </button>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{rec.reason}</p>
                </div>
              </div>

              {/* expected gain */}
              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <span className="text-green-400">{rec.expectedGain}</span>
                {opt && (
                  <span className="ml-auto font-mono text-slate-500">
                    P{opt.expectedPosition} · {Math.round(opt.finishProbabilities.podium * 100)}% podium
                  </span>
                )}
              </div>

              {/* trigger alerts */}
              {rec.triggerAlerts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rec.triggerAlerts.map((a, i) => (
                    <span
                      key={i}
                      className={cn(
                        "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        a.severity === "critical" ? "bg-red-500/15 text-red-400" :
                        a.severity === "warning" ? "bg-amber-500/15 text-amber-400" :
                        a.severity === "opportunity" ? "bg-green-500/15 text-green-400" :
                        "bg-slate-500/15 text-slate-400"
                      )}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {a.category}
                    </span>
                  ))}
                </div>
              )}

              {/* alternative */}
              {altOpt && (
                <div className="mt-2 border-t border-border/30 pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="uppercase tracking-wide">Alt:</span>
                    <button
                      onClick={() => onSelectOption(rec.alternativeOptionId!)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      {rec.alternativeLabel}
                    </button>
                  </div>
                </div>
              )}

              {/* export */}
              {opt && (
                <button
                  onClick={() => onExport(opt)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  <Zap className="h-3 w-3" />
                  Export Recommendation
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
