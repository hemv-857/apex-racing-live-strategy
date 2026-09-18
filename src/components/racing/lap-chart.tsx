"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import type { LapHistoryEntry, RaceSessionData } from "@/lib/racing/types";
import { getDriver } from "@/lib/racing/data";

interface LapChartProps {
  session: RaceSessionData;
  focusDriverId?: string | null;
}

// Real lap-time history from /api/history, with pit markers and tire compound bands.
export function LapChart({ session, focusDriverId }: LapChartProps) {
  const [history, setHistory] = useState<LapHistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/history?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.history) setHistory(d.history);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.id, session.currentLap]);

  const data = buildChartData(history);

  // Build per-driver color map
  const driverMap: Record<string, { code: string; color: string; isOurs: boolean }> = {};
  for (const h of history) {
    if (!driverMap[h.driverId]) {
      const drv = getDriver(h.driverId);
      driverMap[h.driverId] = { code: drv.code, color: drv.teamColor, isOurs: drv.isOurs };
    }
  }
  const lineEntries = Object.values(driverMap);

  // pit lap markers for focus driver (or all RB drivers)
  const focusIds = focusDriverId ? [focusDriverId] : Object.keys(driverMap).filter((id) => driverMap[id].isOurs);
  const pitMarkers: number[] = [];
  for (const id of focusIds) {
    for (const h of history) {
      if (h.driverId === id && h.pitThisLap) pitMarkers.push(h.lap);
    }
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
          <XAxis
            dataKey="lap"
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            label={{ value: "Lap", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={["dataMin - 0.5", "dataMax + 0.5"]}
            tickFormatter={(v) => `${Number(v).toFixed(1)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid rgba(220,38,38,0.3)",
              borderRadius: 8,
              fontSize: 11,
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
            formatter={(value: number, name: string) => [`${value.toFixed(3)}s`, name]}
            labelFormatter={(l) => `Lap ${l}`}
          />
          {pitMarkers.map((l) => (
            <ReferenceLine
              key={l}
              x={l}
              stroke="#ef4444"
              strokeDasharray="3 3"
              opacity={0.5}
              label={{ value: "P", fill: "#ef4444", fontSize: 8, position: "top" }}
            />
          ))}
          {lineEntries.map((l) => (
            <Line
              key={l.code}
              type="monotone"
              dataKey={l.code}
              stroke={l.color}
              strokeWidth={l.isOurs ? 2.5 : focusDriverId ? 1 : 1.2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
              opacity={focusDriverId && !l.isOurs ? 0.3 : l.isOurs ? 1 : 0.6}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildChartData(history: LapHistoryEntry[]): { lap: number; [k: string]: number | string }[] {
  const byLap: Record<number, { lap: number; [k: string]: number | string }> = {};
  for (const h of history) {
    if (!byLap[h.lap]) byLap[h.lap] = { lap: h.lap };
    byLap[h.lap][h.driverCode] = h.lapTimeSec;
  }
  return Object.values(byLap).sort((a, b) => (a.lap as number) - (b.lap as number));
}
