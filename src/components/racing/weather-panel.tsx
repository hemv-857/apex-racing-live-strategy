"use client";

import { useEffect, useState } from "react";
import { CloudRain, CloudSun, Droplets, Sun, Thermometer, Wind } from "lucide-react";
import type { RaceSessionData } from "@/lib/racing/types";
import { cn } from "@/lib/utils";

interface WeatherPanelProps {
  session: RaceSessionData;
}

// Animated weather radar overlay — a sweeping radial sweep with rain cells
// whose intensity reflects rainProb.
export function WeatherPanel({ session }: WeatherPanelProps) {
  const WeatherIcon = session.weather === "wet" ? CloudRain : session.weather === "damp" ? CloudSun : Sun;
  const weatherColor =
    session.weather === "wet" ? "text-blue-400" : session.weather === "damp" ? "text-amber-400" : "text-yellow-400";
  const rainHigh = session.rainProb > 0.5;
  const rainCells = generateRainCells(session.rainProb, session.id);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {/* Weather + radar */}
      <div className={cn("relative col-span-2 overflow-hidden rounded-lg border bg-slate-900/40 p-2.5 sm:col-span-1", rainHigh ? "border-blue-500/30 ring-1 ring-blue-500/20" : "border-border/60")}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Weather</span>
          <WeatherIcon className={cn("h-4 w-4", weatherColor)} />
        </div>
        <div className="mt-1 font-mono text-sm font-bold capitalize text-slate-100">{session.weather}</div>
        <div className="mt-0.5 text-[10px] text-slate-500">
          Rain: <span className={cn("font-semibold", rainHigh ? "text-blue-400" : "text-slate-400")}>{Math.round(session.rainProb * 100)}%</span>
        </div>

        {/* mini radar */}
        <div className="pointer-events-none mt-2 h-14 w-full">
          <svg viewBox="0 0 120 60" className="h-full w-full">
            <defs>
              <radialGradient id="radar-grad" cx="50%" cy="100%" r="100%">
                <stop offset="0%" stopColor={rainHigh ? "#3b82f6" : "#64748b"} stopOpacity={rainHigh ? 0.25 : 0.12} />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            {/* sweep circles */}
            {[15, 30, 45].map((r) => (
              <circle key={r} cx={60} cy={60} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={0.5} strokeDasharray="2 2" />
            ))}
            {/* rain cells */}
            {rainCells.map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={c.r}
                fill={rainHigh ? "#3b82f6" : "#64748b"}
                opacity={c.opacity}
              >
                <animate
                  attributeName="opacity"
                  values={`${c.opacity};${c.opacity * 0.4};${c.opacity}`}
                  dur={`${2 + (i % 3)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
            {/* sweep line */}
            <line x1={60} y1={60} x2={60} y2={10} stroke={rainHigh ? "#60a5fa" : "#94a3b8"} strokeWidth={1}>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 60 60"
                to="360 60 60"
                dur="3s"
                repeatCount="indefinite"
              />
            </line>
          </svg>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-slate-900/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Track Temp</span>
          <Thermometer className="h-4 w-4 text-orange-400" />
        </div>
        <div className="mt-1 font-mono text-sm font-bold text-slate-100">{session.trackTempC.toFixed(1)}°C</div>
        <div className="mt-0.5 text-[10px] text-slate-500">Air: {session.airTempC.toFixed(1)}°C</div>
      </div>

      <div className="rounded-lg border border-border/60 bg-slate-900/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Wind</span>
          <Wind className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-1 font-mono text-sm font-bold text-slate-100">{session.windKph.toFixed(1)} kph</div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
          <Droplets className="h-3 w-3" /> {session.humidity.toFixed(0)}%
        </div>
      </div>

      {/* Rain probability trend bar */}
      <div className="rounded-lg border border-border/60 bg-slate-900/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Rain Risk</span>
          <span className={cn("text-[10px] font-bold uppercase", rainHigh ? "text-blue-400" : "text-slate-400")}>
            {rainHigh ? "Elevated" : "Low"}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn("h-full rounded-full transition-all", rainHigh ? "bg-gradient-to-r from-blue-500 to-cyan-400" : "bg-gradient-to-r from-slate-600 to-slate-400")}
            style={{ width: `${session.rainProb * 100}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          {session.rainProb > 0.7 ? "Inter/Wet prep advised" : session.rainProb > 0.45 ? "Monitor closely" : "Dry strategy stable"}
        </div>
      </div>
    </div>
  );
}

// Deterministic rain cells based on session id + rain prob
function generateRainCells(rainProb: number, seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const cells: { x: number; y: number; r: number; opacity: number }[] = [];
  const count = Math.round(rainProb * 8);
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const x = 20 + (h % 80);
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const y = 20 + (h % 40);
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const r = 3 + (h % 7);
    cells.push({ x, y, r, opacity: 0.3 + rainProb * 0.5 });
  }
  return cells;
}
