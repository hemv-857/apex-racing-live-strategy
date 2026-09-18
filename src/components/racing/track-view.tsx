"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DriverState, LapHistoryEntry, RaceSessionData, TrackData } from "@/lib/racing/types";
import { getDriver } from "@/lib/racing/data";
import { cn } from "@/lib/utils";

interface TrackViewProps {
  session: RaceSessionData;
  track: TrackData;
  activeDriverId: string | null;
  onSelectDriver: (id: string) => void;
}

interface CarPos {
  x: number;
  y: number;
  angle: number;
}

interface PathPoints {
  cars: CarPos[];
  sectors: { x: number; y: number }[];
  startFinish: { x: number; y: number };
}

// SectorPathSegment: colors the actual track segment by sampling points along the path
function SectorPathSegment({
  pathRef,
  pathLen,
  startFrac,
  endFrac,
  color,
  onHover,
}: {
  pathRef: React.RefObject<SVGPathElement | null>;
  pathLen: number;
  startFrac: number;
  endFrac: number;
  color: string;
  onHover?: (data: { x: number; y: number; label: string } | null) => void;
}) {
  const [segPath, setSegPath] = useState<string>("");
  const [mid, setMid] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!pathRef.current || !pathLen) return;
    const path = pathRef.current;
    const startDist = startFrac * pathLen;
    const endDist = endFrac * pathLen;
    // sample ~40 points along the segment for a smooth sub-path
    const samples = 40;
    let d = "";
    for (let i = 0; i <= samples; i++) {
      const dist = startDist + ((endDist - startDist) * i) / samples;
      const pt = path.getPointAtLength(dist);
      d += (i === 0 ? "M" : "L") + pt.x.toFixed(2) + "," + pt.y.toFixed(2) + " ";
    }
    const midDist = ((startFrac + endFrac) / 2) * pathLen;
    const midPt = path.getPointAtLength(midDist);
    Promise.resolve().then(() => {
      setSegPath(d);
      setMid({ x: midPt.x, y: midPt.y });
    });
  }, [pathRef, pathLen, startFrac, endFrac]);

  if (!segPath) return null;
  return (
    <path
      d={segPath}
      fill="none"
      stroke={color}
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.55}
      className="cursor-help transition-opacity hover:opacity-100"
      onMouseEnter={() => mid && onHover?.({ x: mid.x, y: mid.y, label: "" })}
      onMouseLeave={() => onHover?.(null)}
    >
      <animate attributeName="opacity" values="0.4;0.7;0.4" dur="3s" repeatCount="indefinite" />
    </path>
  );
}

// SectorHeatSegment: draws a colored band along a fraction of the track path
function SectorHeatSegment({
  pathRef,
  pathLen,
  startFrac,
  endFrac,
  color,
  label,
  onHover,
}: {
  pathRef: React.RefObject<SVGPathElement | null>;
  pathLen: number;
  startFrac: number;
  endFrac: number;
  color: string;
  label: string;
  onHover?: (data: { x: number; y: number; label: string } | null) => void;
}) {
  const [mid, setMid] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!pathRef.current || !pathLen) return;
    const midDist = ((startFrac + endFrac) / 2) * pathLen;
    const pt = pathRef.current.getPointAtLength(midDist);
    setMid({ x: pt.x, y: pt.y });
  }, [pathRef, pathLen, startFrac, endFrac]);
  if (!mid) return null;
  return (
    <g
      onMouseEnter={() => onHover?.({ x: mid.x, y: mid.y, label })}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: "help" }}
    >
      <circle cx={mid.x} cy={mid.y} r={4} fill={color} opacity={0.85}>
        <animate attributeName="r" values="3;6;3" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <text x={mid.x} y={mid.y - 10} fill={color} fontSize={8} textAnchor="middle" className="font-mono font-bold" opacity={0.9}>
        {label}
      </text>
    </g>
  );
}

// WeatherRainOverlay: animated rain cells drifting across the track when rainProb is high
function WeatherRainOverlay({
  pathRef,
  pathLen,
  rainProb,
  weather,
  trackId,
}: {
  pathRef: React.RefObject<SVGPathElement | null>;
  pathLen: number;
  rainProb: number;
  weather: string;
  trackId: string;
}) {
  const [cells, setCells] = useState<{ x: number; y: number; r: number; delay: number; duration: number; driftX: number; driftY: number }[]>([]);

  useEffect(() => {
    let active = true;
    if (!pathRef.current || !pathLen || rainProb < 0.3) {
      Promise.resolve().then(() => {
        if (active) setCells([]);
      });
      return;
    }
    const path = pathRef.current;
    // generate rain cells at deterministic positions along the track
    let seed = 0;
    for (let i = 0; i < trackId.length; i++) seed = (seed * 31 + trackId.charCodeAt(i)) >>> 0;
    const count = Math.round(rainProb * 14);
    const newCells: { x: number; y: number; r: number; delay: number; duration: number; driftX: number; driftY: number }[] = [];
    for (let i = 0; i < count; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const frac = (seed % 1000) / 1000;
      const dist = frac * pathLen;
      const pt = path.getPointAtLength(dist);
      // offset the rain cell slightly perpendicular to the track
      const ahead = path.getPointAtLength(Math.min(pathLen, dist + 5));
      const dx = ahead.x - pt.x;
      const dy = ahead.y - pt.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      // perpendicular vector
      const px = -dy / len;
      const py = dx / len;
      // tangent vector (for drift direction)
      const tx = dx / len;
      const ty = dy / len;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const offset = ((seed % 60) - 30);
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const radius = 4 + (seed % 8);
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const driftDist = 8 + (seed % 12); // drift distance along track
      newCells.push({
        x: pt.x + px * offset,
        y: pt.y + py * offset,
        r: radius,
        delay: (seed % 30) / 10,
        duration: 1.5 + (seed % 15) / 10,
        driftX: tx * driftDist,
        driftY: ty * driftDist,
      });
    }
    Promise.resolve().then(() => {
      if (active) setCells(newCells);
    });
    return () => {
      active = false;
    };
  }, [pathRef, pathLen, rainProb, trackId]);

  if (cells.length === 0) return null;
  const isWet = weather === "wet";
  const fillColor = isWet ? "#3b82f6" : weather === "damp" ? "#60a5fa" : "#94a3b8";
  const opacity = isWet ? 0.35 : 0.22;

  return (
    <g className="pointer-events-none">
      {cells.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={fillColor} opacity={opacity}>
          <animate
            attributeName="opacity"
            values={`${opacity};${opacity * 0.2};${opacity}`}
            dur={`${c.duration}s`}
            begin={`${c.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values={`${c.r};${c.r * 1.6};${c.r}`}
            dur={`${c.duration}s`}
            begin={`${c.delay}s`}
            repeatCount="indefinite"
          />
          {/* drift along track direction */}
          <animate
            attributeName="cx"
            values={`${c.x};${c.x + c.driftX};${c.x}`}
            dur={`${c.duration * 2}s`}
            begin={`${c.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values={`${c.y};${c.y + c.driftY};${c.y}`}
            dur={`${c.duration * 2}s`}
            begin={`${c.delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  );
}

export function TrackView({ session, track, activeDriverId, onSelectDriver }: TrackViewProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  const [points, setPoints] = useState<PathPoints>({
    cars: [],
    sectors: [],
    startFinish: { x: 120, y: 460 },
  });
  const [hovered, setHovered] = useState<string | null>(null);
  const [sectorHeatColors, setSectorHeatColors] = useState<string[]>(["#64748b", "#64748b", "#64748b"]);
  const [sectorHover, setSectorHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const [sectorDeltas, setSectorDeltas] = useState<{ s1: number; s2: number; s3: number } | null>(null);

  // fetch lap history to compute sector heat colors + delta times (fastest team per sector)
  useEffect(() => {
    let active = true;
    fetch(`/api/history?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const hist: LapHistoryEntry[] = d?.history ?? [];
        if (hist.length === 0) return;
        // find fastest S1/S2/S3 and their driver's team color
        const bestS1 = hist.reduce((a, b) => (a.sectors.s1 < b.sectors.s1 ? a : b));
        const bestS2 = hist.reduce((a, b) => (a.sectors.s2 < b.sectors.s2 ? a : b));
        const bestS3 = hist.reduce((a, b) => (a.sectors.s3 < b.sectors.s3 ? a : b));
        const c1 = getDriver(bestS1.driverId)?.teamColor ?? "#64748b";
        const c2 = getDriver(bestS2.driverId)?.teamColor ?? "#64748b";
        const c3 = getDriver(bestS3.driverId)?.teamColor ?? "#64748b";
        setSectorHeatColors([c1, c2, c3]);
        setSectorDeltas({ s1: bestS1.sectors.s1, s2: bestS2.sectors.s2, s3: bestS3.sectors.s3 });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.id, session.currentLap]);

  useEffect(() => {
    if (pathRef.current) {
      setPathLen(pathRef.current.getTotalLength());
    }
  }, [track.id]);

  useEffect(() => {
    if (!pathLen || !pathRef.current) return;
    const path = pathRef.current;
    const cars: CarPos[] = session.driverStates.map((ds) => {
      const t = ((ds.trackProgress % 1) + 1) % 1;
      const dist = t * pathLen;
      const pt = path.getPointAtLength(dist);
      const ahead = path.getPointAtLength(Math.min(pathLen, dist + 2));
      const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
      return { x: pt.x, y: pt.y, angle };
    });
    const sectors = track.sectors.map((s) => {
      const pt = path.getPointAtLength(s * pathLen);
      return { x: pt.x, y: pt.y };
    });
    const sf = path.getPointAtLength(0);
    setPoints({ cars, sectors, startFinish: { x: sf.x, y: sf.y } });
  }, [session.driverStates, pathLen, track]);

  const driversById = useMemo(() => {
    const m: Record<string, DriverState> = {};
    for (const d of session.driverStates) m[d.driverId] = d;
    return m;
  }, [session.driverStates]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      {/* grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(220,38,38,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(220,38,38,0.12),transparent_60%)]" />

      <svg viewBox="0 0 1000 540" className="relative h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* track glow */}
        <path
          ref={pathRef}
          d={track.layoutPath}
          fill="none"
          stroke="rgba(220,38,38,0.12)"
          strokeWidth={48}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* track surface */}
        <path
          d={track.layoutPath}
          fill="none"
          stroke="#1e293b"
          strokeWidth={28}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* track inner line */}
        <path
          d={track.layoutPath}
          fill="none"
          stroke="#334155"
          strokeWidth={20}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* racing line */}
        <path
          d={track.layoutPath}
          fill="none"
          stroke="rgba(248,250,252,0.25)"
          strokeWidth={1.5}
          strokeDasharray="6 10"
          strokeLinejoin="round"
        />

        {/* sector path coloring — color the actual track segment by fastest team */}
        {pathLen > 0 && points.sectors.length === 3 && (
          <>
            <SectorPathSegment
              pathRef={pathRef}
              pathLen={pathLen}
              startFrac={0}
              endFrac={track.sectors[0]}
              color={sectorHeatColors[0]}
              onHover={setSectorHover}
            />
            <SectorPathSegment
              pathRef={pathRef}
              pathLen={pathLen}
              startFrac={track.sectors[0]}
              endFrac={track.sectors[1]}
              color={sectorHeatColors[1]}
              onHover={setSectorHover}
            />
            <SectorPathSegment
              pathRef={pathRef}
              pathLen={pathLen}
              startFrac={track.sectors[1]}
              endFrac={1}
              color={sectorHeatColors[2]}
              onHover={setSectorHover}
            />
          </>
        )}

        {/* sector delta heatmap — color each sector segment by fastest team */}
        {pathLen > 0 && points.sectors.length === 3 && (
          <>
            {/* S1 segment: 0 → sectors[0] */}
            <SectorHeatSegment
              pathRef={pathRef}
              pathLen={pathLen}
              startFrac={0}
              endFrac={track.sectors[0]}
              color={sectorHeatColors[0]}
              label="S1"
              onHover={setSectorHover}
            />
            {/* S2 segment */}
            <SectorHeatSegment
              pathRef={pathRef}
              pathLen={pathLen}
              startFrac={track.sectors[0]}
              endFrac={track.sectors[1]}
              color={sectorHeatColors[1]}
              label="S2"
              onHover={setSectorHover}
            />
            {/* S3 segment */}
            <SectorHeatSegment
              pathRef={pathRef}
              pathLen={pathLen}
              startFrac={track.sectors[1]}
              endFrac={1}
              color={sectorHeatColors[2]}
              label="S3"
              onHover={setSectorHover}
            />
          </>
        )}

        {/* weather rain overlay on track */}
        {pathLen > 0 && (
          <WeatherRainOverlay
            pathRef={pathRef}
            pathLen={pathLen}
            rainProb={session.rainProb}
            weather={session.weather}
            trackId={track.id}
          />
        )}

        {/* sector hover tooltip */}
        {sectorHover && sectorDeltas && (
          (() => {
            const idx = sectorHover.label === "S1" ? 0 : sectorHover.label === "S2" ? 1 : 2;
            const deltaVal = idx === 0 ? sectorDeltas.s1 : idx === 1 ? sectorDeltas.s2 : sectorDeltas.s3;
            return (
              <g className="pointer-events-none">
                <rect
                  x={sectorHover.x - 50}
                  y={sectorHover.y - 40}
                  width={100}
                  height={26}
                  rx={4}
                  fill="#0f172a"
                  stroke={sectorHeatColors[idx]}
                  strokeWidth={1}
                  opacity={0.95}
                />
                <text x={sectorHover.x} y={sectorHover.y - 26} textAnchor="middle" fill="#f8fafc" fontSize={10} className="font-mono font-bold">
                  {sectorHover.label} · {deltaVal.toFixed(3)}s
                </text>
                <text x={sectorHover.x} y={sectorHover.y - 14} textAnchor="middle" fill="#94a3b8" fontSize={8} className="font-mono">
                  session best
                </text>
              </g>
            );
          })()
        )}

        {/* sector markers */}
        {points.sectors.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={6} fill="#22c55e" stroke="#022c22" strokeWidth={2} />
            <text x={pt.x} y={pt.y - 12} fill="#86efac" fontSize={11} textAnchor="middle" className="font-mono">
              S{i + 1}
            </text>
          </g>
        ))}

        {/* start/finish line */}
        <g>
          <rect
            x={points.startFinish.x - 14}
            y={points.startFinish.y - 5}
            width={28}
            height={10}
            fill="#f8fafc"
            rx={2}
          />
          <text
            x={points.startFinish.x}
            y={points.startFinish.y + 22}
            fill="#e2e8f0"
            fontSize={10}
            textAnchor="middle"
            className="font-mono"
          >
            S/F
          </text>
        </g>

        {/* cars */}
        {session.driverStates.map((ds, i) => {
          const pos = points.cars[i];
          if (!pos) return null;
          const driver = getDriver(ds.driverId);
          const isActive = activeDriverId === ds.driverId;
          const isHover = hovered === ds.driverId;
          const isOurs = driver.isOurs;
          return (
            <g
              key={ds.driverId}
              transform={`translate(${pos.x} ${pos.y})`}
              className="cursor-pointer"
              onClick={() => onSelectDriver(ds.driverId)}
              onMouseEnter={() => setHovered(ds.driverId)}
              onMouseLeave={() => setHovered(null)}
            >
              {(isActive || isHover) && (
                <circle r={22} fill="none" stroke={driver.teamColor} strokeWidth={2} opacity={0.9}>
                  <animate attributeName="r" values="18;26;18" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <g transform={`rotate(${pos.angle})`}>
                <rect
                  x={-9}
                  y={-5}
                  width={18}
                  height={10}
                  rx={2}
                  fill={driver.teamColor}
                  stroke={isOurs ? "#f8fafc" : "rgba(0,0,0,0.4)"}
                  strokeWidth={isOurs ? 1.6 : 1}
                />
                <rect x={4} y={-3} width={5} height={6} fill="rgba(255,255,255,0.5)" />
                {ds.drsActive && (
                  <circle cx={0} cy={-9} r={3} fill="#22c55e">
                    <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
              <g transform={`translate(${isOurs ? 14 : 12} ${isOurs ? -14 : -12})`}>
                <circle r={10} fill="#0f172a" stroke={driver.teamColor} strokeWidth={1.5} />
                <text textAnchor="middle" y={4} fill="#f8fafc" fontSize={11} className="font-mono font-bold">
                  {ds.position}
                </text>
              </g>
              <text textAnchor="middle" y={24} fill={isOurs ? "#fca5a5" : "#94a3b8"} fontSize={10} className="font-mono font-semibold">
                {driver.code}
              </text>
            </g>
          );
        })}
      </svg>

      {/* overlay: track name */}
      <div className="pointer-events-none absolute left-4 top-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-400/80">Circuit</div>
        <div className="font-semibold text-slate-100">{track.name}</div>
        <div className="mt-0.5 text-xs text-slate-400">
          {track.country} · {track.lapLengthKm} km · {track.corners} corners · {track.drsZones} DRS
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 text-right">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-400/80">Lap</div>
        <div className="font-mono text-3xl font-bold leading-none text-slate-100">
          {session.currentLap}
          <span className="text-slate-500">/{session.totalLaps}</span>
        </div>
        <div className={cn("mt-1 text-xs font-semibold uppercase", session.status === "running" ? "text-green-400" : "text-amber-400")}>
          {session.status === "running" ? "● Live" : session.status}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> RB Drivers</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> DRS Active</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: sectorHeatColors[0] }} />
          Sector heat
        </span>
        {session.rainProb > 0.3 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            Rain {(session.rainProb * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
