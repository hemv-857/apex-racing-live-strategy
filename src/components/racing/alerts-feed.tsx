"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, BellRing, Info, ShieldAlert, Sparkles, Zap } from "lucide-react";
import type { AlertData, AlertSeverity } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<AlertSeverity, { icon: typeof Info; ring: string; bg: string; text: string; border: string }> = {
  critical: { icon: ShieldAlert, ring: "ring-red-500/40", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/40" },
  warning: { icon: AlertTriangle, ring: "ring-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  opportunity: { icon: Sparkles, ring: "ring-green-500/30", bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
  info: { icon: Info, ring: "ring-slate-500/20", bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/30" },
};

interface AlertsFeedProps {
  alerts: AlertData[];
  onAcknowledge: (id: string) => void;
  onAction?: (alert: AlertData) => void;
}

export function AlertsFeed({ alerts, onAcknowledge, onAction }: AlertsFeedProps) {
  const unack = alerts.filter((a) => !a.acknowledged).length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          {unack > 0 ? <BellRing className="h-4 w-4 text-red-500" /> : <Bell className="h-4 w-4 text-slate-400" />}
          Strategy Alerts
          {unack > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unack}</span>
          )}
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{alerts.length} total</span>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {alerts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <Bell className="h-7 w-7 text-slate-700" />
            <p className="text-sm text-slate-500">No active alerts</p>
            <p className="text-xs text-slate-600">System monitoring race state</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {alerts.map((alert) => {
              const s = SEVERITY_STYLES[alert.severity];
              const Icon = s.icon;
              return (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: alert.acknowledged ? 0.5 : 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={cn(
                    "border-b border-border/30 p-3",
                    alert.acknowledged && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn("mt-0.5 rounded-md p-1.5 ring-1", s.bg, s.ring)}>
                      <Icon className={cn("h-3.5 w-3.5", s.text)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="truncate text-xs font-semibold text-slate-100">{alert.title}</h4>
                        <span className="shrink-0 font-mono text-[9px] text-slate-500">
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{alert.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", s.bg, s.text)}>
                          {alert.severity}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                          {alert.category}
                        </span>
                        {alert.actionLabel && !alert.acknowledged && (
                          <button
                            onClick={() => onAction?.(alert)}
                            className="ml-auto flex items-center gap-1 rounded bg-red-600/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500"
                          >
                            <Zap className="h-3 w-3" />
                            {alert.actionLabel}
                          </button>
                        )}
                        {!alert.acknowledged && !alert.actionLabel && (
                          <button
                            onClick={() => onAcknowledge(alert.id)}
                            className="ml-auto rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                          >
                            Dismiss
                          </button>
                        )}
                        {alert.acknowledged && (
                          <span className="ml-auto text-[10px] text-slate-600">Acknowledged</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
