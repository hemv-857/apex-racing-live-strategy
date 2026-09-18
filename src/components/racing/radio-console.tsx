"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Send, Volume2, CheckCircle2, Loader2 } from "lucide-react";
import type { RadioCall } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

interface RadioConsoleProps {
  calls: RadioCall[];
  onSend: (call: Omit<RadioCall, "id" | "createdAt" | "status">) => void;
  selectedDriverCode: string | null;
  selectedDriverName: string | null;
}

const STATUS_STYLES = {
  queued: { icon: Loader2, text: "text-amber-400", label: "Queued", spin: true },
  transmitting: { icon: Volume2, text: "text-cyan-400", label: "Transmitting", spin: false },
  delivered: { icon: CheckCircle2, text: "text-green-400", label: "Delivered", spin: false },
};

const QUICK_MESSAGES = [
  "Box this lap, copy. Soft compound, push on out-lap.",
  "Push now, DRS active. We're going for the overtake.",
  "Conserve fuel, lift and coast T1-T2. Target +0.3s.",
  "Box, box. Switch to mediums. Target lap 1:32.0.",
  "Rival pitting next lap. Push for two laps, then box.",
];

export function RadioConsole({ calls, onSend, selectedDriverCode, selectedDriverName }: RadioConsoleProps) {
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");

  const handleSend = () => {
    if (!selectedDriverCode || !message.trim()) return;
    onSend({
      sessionId: "live",
      driverCode: selectedDriverCode,
      driverName: selectedDriverName ?? selectedDriverCode,
      message: message.trim(),
      priority,
    });
    setMessage("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Radio className="h-4 w-4 text-red-500" />
          Pit Radio Console
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-green-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Link Active
        </span>
      </div>

      {/* call log */}
      <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: "thin" }}>
        {calls.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <Radio className="h-7 w-7 text-slate-700" />
            <p className="text-sm text-slate-500">No radio calls yet</p>
            <p className="text-xs text-slate-600">Export a strategy or send a quick call</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {calls.map((call) => {
              const s = STATUS_STYLES[call.status];
              const Icon = s.icon;
              return (
                <motion.div
                  key={call.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "mb-2 rounded-lg border p-2.5",
                    call.priority === "urgent"
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-border/60 bg-slate-900/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-200">{call.driverCode}</span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <Icon className={cn("h-3 w-3", s.text, s.spin && "animate-spin")} />
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-slate-300">{call.message}</p>
                  <div className="mt-1 flex items-center justify-between text-[9px] text-slate-600">
                    <span>{new Date(call.createdAt).toLocaleTimeString()}</span>
                    {call.priority === "urgent" && (
                      <span className="font-bold uppercase text-red-400">URGENT</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-border/50 p-3">
        {!selectedDriverCode && (
          <p className="mb-2 text-[10px] text-amber-400">Select a driver to compose a call</p>
        )}
        <div className="mb-2 flex flex-wrap gap-1">
          {QUICK_MESSAGES.map((m, i) => (
            <button
              key={i}
              onClick={() => setMessage(m)}
              disabled={!selectedDriverCode}
              className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40"
            >
              {m.split(",")[0]}…
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!selectedDriverCode}
          rows={2}
          placeholder="Type radio message to pit box…"
          className="mb-2 w-full resize-none rounded-md border border-border bg-slate-900/60 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-red-500/50 focus:outline-none disabled:opacity-40"
        />
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-slate-900/60 p-0.5">
            {(["normal", "urgent"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-semibold uppercase transition-colors",
                  priority === p
                    ? p === "urgent"
                      ? "bg-red-600 text-white"
                      : "bg-slate-700 text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={handleSend}
            disabled={!selectedDriverCode || !message.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            Transmit
          </button>
        </div>
      </div>
    </div>
  );
}
