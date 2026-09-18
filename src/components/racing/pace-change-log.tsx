"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Gauge, Snowflake, History } from "lucide-react";
import type { PaceChangeEntry } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

const PACE_ICON = { push: Zap, balanced: Gauge, conserve: Snowflake };
const PACE_COLOR = {
  push: "text-red-400 bg-red-500/15",
  balanced: "text-slate-300 bg-slate-700/40",
  conserve: "text-cyan-400 bg-cyan-500/15",
};

export function PaceChangeLog({ sessionId, refreshKey }: { sessionId: string; refreshKey: number }) {
  const [changes, setChanges] = useState<PaceChangeEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/pace-log?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.changes) setChanges(d.changes);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sessionId, refreshKey]);

  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <History className="h-3.5 w-3.5 text-red-500" />
          Pace-Mode Decision Log
        </h3>
        <span className="text-[10px] text-slate-500">{changes.length} changes</span>
      </div>

      <p className="mb-3 text-[11px] leading-snug text-slate-500">
        Timeline of pace-mode changes made by the strategy team during the race. Useful for post-race review of decision timing.
      </p>

      {changes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Gauge className="h-6 w-6 text-slate-700" />
          <p className="text-xs text-slate-500">No pace changes recorded yet</p>
          <p className="text-[10px] text-slate-600">Use the Push / Bal / Save buttons on RB driver cards to log decisions</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1.5" style={{ scrollbarWidth: "thin" }}>
          <AnimatePresence initial={false}>
            {[...changes].reverse().map((c) => {
              const FromIcon = PACE_ICON[c.fromPace] ?? Gauge;
              const ToIcon = PACE_ICON[c.toPace] ?? Gauge;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-border/40 bg-slate-900/60 p-2"
                >
                  <div className="flex items-center gap-1">
                    <span className={cn("flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", PACE_COLOR[c.fromPace])}>
                      <FromIcon className="h-2.5 w-2.5" />
                      {c.fromPace}
                    </span>
                    <span className="text-slate-500">→</span>
                    <span className={cn("flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", PACE_COLOR[c.toPace])}>
                      <ToIcon className="h-2.5 w-2.5" />
                      {c.toPace}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-100">{c.driverCode}</span>
                      <span className="truncate text-[10px] text-slate-500">{c.driverName}</span>
                    </div>
                    <div className="text-[9px] text-slate-600">
                      L{c.lap} · P{c.position} · {c.reason}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] text-slate-600">
                    {new Date(c.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
