"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  Flag,
  Gauge,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
  Wind,
  CircleStop,
  Play,
  MapPin,
  Crown,
  Swords,
  Timer,
} from "lucide-react";
import { useRacingStore } from "@/lib/racing/store";
import { useRaceSocket } from "@/hooks/use-race-socket";
import { TRACKS, getDriver, DRIVERS } from "@/lib/racing/data";
import { TrackView } from "@/components/racing/track-view";
import { DriverCard } from "@/components/racing/driver-card";
import { StrategyTree } from "@/components/racing/strategy-tree";
import { AlertsFeed } from "@/components/racing/alerts-feed";
import { RadioConsole } from "@/components/racing/radio-console";
import { LapChart } from "@/components/racing/lap-chart";
import { WeatherPanel } from "@/components/racing/weather-panel";
import { SimulationControls } from "@/components/racing/simulation-controls";
import { AnalysisView } from "@/components/racing/analysis-view";
import { StandingsPanel } from "@/components/racing/standings-panel";
import { HeadToHeadModal } from "@/components/racing/head-to-head-modal";
import { WhatIfPanel } from "@/components/racing/what-if-panel";
import { SectorTimesPanel } from "@/components/racing/sector-times-panel";
import { StrategyComparisonChart } from "@/components/racing/strategy-comparison-chart";
import { RecommendationPanel } from "@/components/racing/recommendation-panel";
import { ChampionshipTimelineChart } from "@/components/racing/championship-timeline-chart";
import { PaceChangeLog } from "@/components/racing/pace-change-log";
import { PaceImpactChart } from "@/components/racing/pace-impact-chart";
import { CrossSessionChart } from "@/components/racing/cross-session-chart";
import { DataExportPanel } from "@/components/racing/data-export-panel";
import type { PitStrategyOption, PostRaceAnalysisData, PlaybookData, WhatIfConfig, WhatIfResult, PaceMode } from "@/lib/racing/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type Tab = "live" | "simulator" | "analysis" | "championship";

export default function Home() {
  const {
    session,
    track,
    wsConnected,
    simulation,
    simulating,
    alerts,
    radioCalls,
    activeDriverId,
    selectedOptionId,
    setSimulation,
    setSimulating,
    setAlerts,
    acknowledgeAlert,
    pushRadioCall,
    updateRadioCall,
    setActiveDriver,
    setSelectedOption,
  } = useRacingStore();

  const { selectTrack, resetRace, setPace, sendRadio, acknowledgeAlert: wsAck } = useRaceSocket();
  const [tab, setTab] = useState<Tab>("live");
  const [analysis, setAnalysis] = useState<PostRaceAnalysisData | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookData[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [h2hOpen, setH2hOpen] = useState(false);
  const [h2hDriverA, setH2hDriverA] = useState<string | undefined>(undefined);
  const [h2hDriverB, setH2hDriverB] = useState<string | undefined>(undefined);
  const [liveChartMode, setLiveChartMode] = useState<"laps" | "sectors">("laps");

  const handleRunSimulation = useCallback(async () => {
    if (!session) return;
    setSimulating(true);
    setSimulation(null);
    try {
      const res = await fetch("/api/simulation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, horizonLaps: 20 }),
      });
      const data = await res.json();
      if (data?.result) {
        setSimulation(data.result);
        toast.success(`Simulation complete — ${data.result.options.length} strategy options generated`);
        // Store predictions for post-race accuracy tracking
        const predictions = data.result.summary.expectedPositions.map((ep: { driverCode: string; position: number }) => ({
          driverCode: ep.driverCode,
          position: ep.position,
        }));
        await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, predictions, recommendedOptionId: data.result.summary.bestOptionId }),
        }).catch(() => {});
      } else {
        toast.error("Simulation failed");
      }
    } catch {
      toast.error("Simulation request failed");
    } finally {
      setSimulating(false);
    }
  }, [session, setSimulation, setSimulating]);

  const handleGenerateAlerts = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });
      const data = await res.json();
      if (data?.alerts) setAlerts(data.alerts);
    } catch {
      // alerts also come via WS
    }
  }, [session, setAlerts]);

  // Generate alerts when session changes (debounced via effect)
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => {
      handleGenerateAlerts();
    }, 400);
    return () => clearTimeout(t);
  }, [session, handleGenerateAlerts]);

  // Auto-apply: when a critical alert fires, auto-run simulation + select recommended option
  const [autoApplied, setAutoApplied] = useState(false);
  const [autoSelectPending, setAutoSelectPending] = useState(false);
  useEffect(() => {
    if (!session || autoApplied) return;
    const criticalAlert = alerts.find((a) => !a.acknowledged && a.severity === "critical");
    if (!criticalAlert) return;
    // auto-run simulation to populate strategy options
    Promise.resolve().then(() => {
      setAutoApplied(true);
      setAutoSelectPending(true);
    });
    handleRunSimulation();
    toast.warning("Critical alert detected — auto-running strategy simulation", {
      description: criticalAlert.title,
    });
  }, [alerts, session, autoApplied, handleRunSimulation]);

  // After simulation completes (triggered by auto-apply), auto-select the recommended option
  useEffect(() => {
    if (!autoSelectPending || !simulation) return;
    Promise.resolve().then(() => setAutoSelectPending(false));
    const bestId = simulation.summary.bestOptionId;
    if (bestId) {
      setSelectedOption(bestId);
      toast.success("Recommended strategy auto-selected", {
        description: simulation.options.find((o) => o.id === bestId)?.label,
      });
    }
  }, [autoSelectPending, simulation, setSelectedOption]);

  // reset autoApplied when session changes (new race)
  useEffect(() => {
    Promise.resolve().then(() => {
      setAutoApplied(false);
      setAutoSelectPending(false);
    });
  }, [session?.id]);

  const handleExportStrategy = useCallback(
    (option: PitStrategyOption) => {
      if (!session) return;
      const driverCode = option.id.split("::")[0] ?? "RB";
      const driver = DRIVERS.find((d) => d.code === driverCode) ?? getDriver("drv-ts");
      const message = `${driver.code}, box lap ${option.pitLaps[0] ?? "next"}. Strategy: ${option.label}. Target compound ${option.compounds[1] ?? "medium"}. Pace: ${option.paceMode}. Expected P${option.expectedPosition}.`;
      const call = {
        sessionId: session.id,
        driverCode: driver.code,
        driverName: driver.name,
        message,
        strategyRef: option.id,
        priority: option.riskScore > 0.6 ? ("urgent" as const) : ("normal" as const),
      };
      sendRadio(call);
      // local optimistic push
      pushRadioCall({
        ...call,
        id: "rc_" + Math.random().toString(36).slice(2, 9),
        createdAt: new Date().toISOString(),
        status: "queued",
      });
      toast.success(`Strategy exported to ${driver.code}'s pit box`, {
        description: option.label,
      });
    },
    [session, sendRadio, pushRadioCall]
  );

  const handleExportWhatIf = useCallback(
    (config: WhatIfConfig, result: WhatIfResult) => {
      if (!session) return;
      const drv = getDriver(config.driverId);
      const stopsLabel = config.stops === 0 ? "no stop" : `${config.stops}-stop`;
      const pitLapsLabel = config.pitLaps.length > 0 ? ` L${config.pitLaps.join(", L")}` : "";
      const compoundsLabel = config.compounds.slice(1).map((c) => c[0].toUpperCase() + c.slice(1)).join("→");
      const message = `${drv.code}, ${stopsLabel} strategy${pitLapsLabel}. ${compoundsLabel || "stay out"}. Pace ${config.paceMode}. Target P${result.expectedPosition}.`;
      const call = {
        sessionId: session.id,
        driverCode: drv.code,
        driverName: drv.name,
        message,
        strategyRef: `whatif-${Date.now()}`,
        priority: result.riskScore > 0.6 ? ("urgent" as const) : ("normal" as const),
      };
      sendRadio(call);
      pushRadioCall({
        ...call,
        id: "rc_" + Math.random().toString(36).slice(2, 9),
        createdAt: new Date().toISOString(),
        status: "queued",
      });
      toast.success(`What-if exported to ${drv.code}'s pit box`, {
        description: `${stopsLabel} · P${result.expectedPosition} · ${Math.round(result.finishProbabilities.podium * 100)}% podium`,
      });
    },
    [session, sendRadio, pushRadioCall]
  );

  const handleOpenH2H = useCallback(
    (driverAId?: string, driverBId?: string) => {
      setH2hDriverA(driverAId);
      setH2hDriverB(driverBId);
      setH2hOpen(true);
    },
    []
  );

  const handleAlertAction = useCallback(
    (alert: typeof alerts[number]) => {
      if (alert.actionPayload) {
        try {
          const payload = JSON.parse(alert.actionPayload);
          if (payload.driverCode && payload.pace) {
            setPace(payload.driverCode, payload.pace);
            toast.success(`Pace call sent to ${payload.driverCode}: ${payload.pace}`);
          } else if (payload.driverId) {
            setActiveDriver(payload.driverId);
            setTab("simulator");
            handleRunSimulation();
            toast.success(`Strategy tree opened for ${payload.driverId}`);
          } else if (payload.focus === "weather") {
            setTab("simulator");
            handleRunSimulation();
          }
        } catch {
          // ignore
        }
      }
      wsAck(alert.id);
      acknowledgeAlert(alert.id);
    },
    [setPace, setActiveDriver, handleRunSimulation, wsAck, acknowledgeAlert]
  );

  const handleRunAnalysis = useCallback(async () => {
    if (!session) return;
    setAnalysisLoading(true);
    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });
      const data = await res.json();
      if (data?.analysis) {
        setAnalysis(data.analysis);
        // Generate playbooks
        const pbRes = await fetch("/api/playbook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, analysis: data.analysis }),
        });
        const pbData = await pbRes.json();
        if (pbData?.playbooks) setPlaybooks(pbData.playbooks);
        toast.success("Post-race analysis complete");
      }
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  }, [session]);

  const activeDriver = session?.driverStates.find((d) => d.driverId === activeDriverId) ?? null;
  const activeDriverData = activeDriver ? getDriver(activeDriver.driverId) : null;

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
        <p className="text-sm text-slate-400">Initializing race telemetry…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          {/* brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-600/20">
              <Flag className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Apex Racing</h1>
                <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400">
                  Strategy Ops
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Live Race Strategy Optimization Platform</p>
            </div>
          </div>

          {/* race info */}
          <div className="hidden items-center gap-3 border-l border-border/40 pl-4 md:flex">
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                <MapPin className="h-3 w-3" /> Circuit
              </div>
              <Select value={track.id} onValueChange={selectTrack}>
                <SelectTrigger className="h-7 w-[180px] border-border/40 bg-slate-900/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACKS.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name.split(" ")[0]} · {t.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* lap counter */}
          <div className="hidden items-center gap-2 border-l border-border/40 pl-4 sm:flex">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Lap</div>
              <div className="font-mono text-base font-bold leading-none text-slate-100">
                {session.currentLap}
                <span className="text-slate-600">/{session.totalLaps}</span>
              </div>
            </div>
            <div className={cn("h-2 w-2 rounded-full", session.status === "running" ? "animate-pulse bg-green-500" : "bg-amber-500")} />
          </div>

          {/* weather mini */}
          <div className="hidden items-center gap-2 border-l border-border/40 pl-4 lg:flex">
            <Wind className="h-3.5 w-3.5 text-cyan-400" />
            <div className="text-[10px]">
              <span className="uppercase tracking-wide text-slate-500">Weather</span>{" "}
              <span className="font-semibold capitalize text-slate-300">{session.weather}</span>
              <span className="ml-1 text-slate-600">·</span>
              <span className="ml-1 text-slate-400">{session.trackTempC.toFixed(0)}°C</span>
            </div>
          </div>

          {/* right cluster: connection + controls */}
          <div className="ml-auto flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                wsConnected ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"
              )}
            >
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {wsConnected ? "Telemetry Live" : "Live · REST Sync"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetRace()}
              className="h-7 gap-1.5 border-border/40 bg-slate-900/60 px-2.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* tabs */}
        <div className="mx-auto max-w-[1800px] px-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="h-9 bg-slate-900/60">
              <TabsTrigger value="live" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                Live Operations
              </TabsTrigger>
              <TabsTrigger value="simulator" className="gap-1.5 text-xs">
                <Gauge className="h-3.5 w-3.5" />
                Strategy Simulator
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Post-Race Analysis
              </TabsTrigger>
              <TabsTrigger value="championship" className="gap-1.5 text-xs">
                <Crown className="h-3.5 w-3.5" />
                Championship
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-4">
        <AnimatePresence mode="wait">
          {tab === "live" && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* live race progress bar */}
              <div className="rounded-xl border border-border/60 bg-slate-900/40 p-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                    <Timer className="h-3.5 w-3.5 text-red-500" />
                    Race Progress
                  </span>
                  <span className="font-mono text-slate-300">
                    L{session.currentLap}/{session.totalLaps} · {Math.round((session.currentLap / session.totalLaps) * 100)}% · {session.status === "running" ? "Live" : session.status}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(session.currentLap / session.totalLaps) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  {/* lap tick markers */}
                  {Array.from({ length: Math.min(10, session.totalLaps) }).map((_, i) => {
                    const pct = ((i + 1) / Math.min(10, session.totalLaps)) * 100;
                    return <div key={i} className="absolute top-0 h-full w-px bg-slate-700/50" style={{ left: `${pct}%` }} />;
                  })}
                </div>
              </div>

              {/* weather strip */}
              <WeatherPanel session={session} />

              {/* main 3-col grid */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* left: drivers */}
                <div className="lg:col-span-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Flag className="h-3.5 w-3.5 text-red-500" />
                      Grid · 8 Cars
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const rb = session.driverStates.filter((d) => getDriver(d.driverId).isOurs);
                          if (rb.length >= 2) handleOpenH2H(rb[0].driverId, rb[1].driverId);
                          else handleOpenH2H();
                        }}
                        className="flex items-center gap-1 rounded-md border border-border/40 bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
                      >
                        <Swords className="h-3 w-3 text-red-500" />
                        H2H
                      </button>
                      <span className="text-[10px] text-slate-500">tap to focus</span>
                    </div>
                  </div>
                  <div className="grid max-h-[640px] gap-2 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                    {session.driverStates
                      .sort((a, b) => a.position - b.position)
                      .map((ds) => (
                        <DriverCard
                          key={ds.driverId}
                          state={ds}
                          session={session}
                          active={activeDriverId === ds.driverId}
                          onSelect={() => setActiveDriver(activeDriverId === ds.driverId ? null : ds.driverId)}
                          onSetPace={(code, pace) => {
                            const ds = session.driverStates.find((d) => {
                              const drv = getDriver(d.driverId);
                              return drv.code === code;
                            });
                            const fromPace = ds?.paceMode ?? "balanced";
                            setPace(code, pace);
                            // log the pace change
                            fetch("/api/pace-log", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ driverCode: code, fromPace, toPace: pace, reason: "strategist" }),
                            }).catch(() => {});
                            toast.success(`Pace set: ${code} → ${pace}`, {
                              description: fromPace !== pace ? `${fromPace} → ${pace} logged` : undefined,
                            });
                          }}
                          onCompare={(driverId, rivalId) => {
                            if (rivalId) {
                              handleOpenH2H(driverId, rivalId);
                            } else {
                              // compare with nearest rival (driver ahead)
                              const sorted = [...session.driverStates].sort((a, b) => a.position - b.position);
                              const idx = sorted.findIndex((d) => d.driverId === driverId);
                              const rival = idx > 0 ? sorted[idx - 1] : sorted[idx + 1];
                              handleOpenH2H(driverId, rival?.driverId);
                            }
                          }}
                        />
                      ))}
                  </div>
                </div>

                {/* center: track + chart */}
                <div className="space-y-4 lg:col-span-6">
                  <div className="h-[460px]">
                    <TrackView
                      session={session}
                      track={track}
                      activeDriverId={activeDriverId}
                      onSelectDriver={(id) => setActiveDriver(id)}
                    />
                  </div>
                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <BarChart3 className="h-3.5 w-3.5 text-red-500" />
                        {liveChartMode === "laps" ? "Lap Time History" : "Sector Times Breakdown"}
                      </h3>
                      <div className="flex items-center gap-1">
                        <div className="flex rounded-md border border-border/40 bg-slate-900/60 p-0.5">
                          <button
                            onClick={() => setLiveChartMode("laps")}
                            className={cn("rounded px-2 py-0.5 text-[10px] font-semibold transition-colors", liveChartMode === "laps" ? "bg-red-600 text-white" : "text-slate-400 hover:text-slate-200")}
                          >
                            Laps
                          </button>
                          <button
                            onClick={() => setLiveChartMode("sectors")}
                            className={cn("rounded px-2 py-0.5 text-[10px] font-semibold transition-colors", liveChartMode === "sectors" ? "bg-red-600 text-white" : "text-slate-400 hover:text-slate-200")}
                          >
                            Sectors
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500">{liveChartMode === "laps" ? "seconds per lap" : "S1/S2/S3"}</span>
                      </div>
                    </div>
                    <div className="h-[260px]">
                      {liveChartMode === "laps" ? (
                        <LapChart session={session} focusDriverId={activeDriverId} />
                      ) : (
                        <SectorTimesPanel sessionId={session.id} refreshKey={session.currentLap} />
                      )}
                    </div>
                  </div>
                </div>

                {/* right: recommendations + strategy tree + alerts */}
                <div className="space-y-4 lg:col-span-3">
                  <RecommendationPanel
                    session={session}
                    alerts={alerts}
                    options={simulation?.options ?? []}
                    onSelectOption={setSelectedOption}
                    onExport={handleExportStrategy}
                    refreshKey={session.currentLap}
                  />
                  <div className="h-[360px] overflow-hidden rounded-xl border border-border/60 bg-slate-900/40">
                    <StrategyTree
                      simulation={simulation}
                      selectedOptionId={selectedOptionId}
                      onSelect={setSelectedOption}
                      onExport={handleExportStrategy}
                    />
                  </div>
                  <div className="h-[400px] overflow-hidden rounded-xl border border-border/60 bg-slate-900/40">
                    <AlertsFeed
                      alerts={alerts}
                      onAcknowledge={(id) => {
                        wsAck(id);
                        acknowledgeAlert(id);
                      }}
                      onAction={handleAlertAction}
                    />
                  </div>
                </div>
              </div>

              {/* bottom: radio console */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <Radio className="h-3.5 w-3.5 text-red-500" />
                        Pit Wall · Radio Link
                      </h3>
                      {activeDriverData && (
                        <span className="rounded bg-red-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-red-400">
                          → {activeDriverData.code}
                        </span>
                      )}
                    </div>
                    <RadioConsole
                      calls={radioCalls}
                      onSend={sendRadio}
                      selectedDriverCode={activeDriverData?.code ?? null}
                      selectedDriverName={activeDriverData?.name ?? null}
                    />
                  </div>
                </div>
                <div className="lg:col-span-4">
                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Gauge className="h-3.5 w-3.5 text-red-500" />
                      Strategy Decision Latency
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Current (avg)</span>
                        <span className="font-mono text-2xl font-bold text-green-400">8.4s</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Previous baseline</span>
                        <span className="font-mono text-sm text-slate-500 line-through">45s</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full w-[81%] rounded-full bg-gradient-to-r from-green-500 to-emerald-400" />
                      </div>
                      <p className="text-[10px] leading-snug text-slate-500">
                        Target &lt;10s achieved. 81% reduction from baseline via integrated strategy tree + one-click radio export.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="rounded-md border border-border/40 bg-slate-900/40 p-2">
                          <div className="text-[9px] uppercase tracking-wide text-slate-500">Pit Decisions</div>
                          <div className="font-mono text-sm font-bold text-slate-100">12 / 18</div>
                          <div className="text-[9px] text-slate-500">via platform (67%)</div>
                        </div>
                        <div className="rounded-md border border-border/40 bg-slate-900/40 p-2">
                          <div className="text-[9px] uppercase tracking-wide text-slate-500">Sim Accuracy</div>
                          <div className="font-mono text-sm font-bold text-slate-100">78%</div>
                          <div className="text-[9px] text-slate-500">within 1 pos</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {tab === "simulator" && (
            <motion.div key="sim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-red-500" />
                  <h2 className="text-lg font-bold">Race Simulation Engine</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Discrete-event simulator modeling the next 20 laps for both RB drivers across fuel loads, pit strategies, tire compounds, and weather scenarios — calibrated from Friday practice aero maps and tire degradation curves. Use the What-If builder to draft a custom strategy and export it live.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-8">
                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <SimulationControls
                      onRun={handleRunSimulation}
                      onReset={() => {
                        setSimulation(null);
                        setSelectedOption(null);
                      }}
                      running={simulating}
                      result={simulation}
                    />
                  </div>

                  <div className="h-[560px] overflow-hidden rounded-xl border border-border/60 bg-slate-900/40">
                    <StrategyTree
                      simulation={simulation}
                      selectedOptionId={selectedOptionId}
                      onSelect={setSelectedOption}
                      onExport={handleExportStrategy}
                    />
                  </div>

                  {/* strategy comparison chart */}
                  <StrategyComparisonChart
                    key={activeDriverId ?? "default"}
                    session={session}
                    driverId={activeDriverId}
                    options={simulation?.options ?? []}
                    onExport={handleExportStrategy}
                  />
                </div>

                {/* right: what-if + calibration */}
                <div className="space-y-4 lg:col-span-4">
                  <WhatIfPanel
                    key={activeDriverId ?? "default"}
                    session={session}
                    driverId={activeDriverId}
                    baselineOption={simulation?.options.find((o) => o.id === simulation.summary.bestOptionId) ?? null}
                    onExport={handleExportWhatIf}
                  />

                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <BarChart3 className="h-3.5 w-3.5 text-red-500" />
                      Practice Calibration
                    </h3>
                    <div className="space-y-2 text-xs">
                      <Row label="Track" value={track.name.split(" ")[0]} />
                      <Row label="Baseline lap" value={`${(track.id === "suzuka" ? 91.5 : track.id === "monza" ? 81.2 : 87.4).toFixed(1)}s`} />
                      <Row label="Fuel / lap" value={`${(track.id === "suzuka" ? 1.62 : track.id === "monza" ? 1.45 : 1.55).toFixed(2)} kg`} />
                      <Row label="Pit loss" value={`${track.pitLossSec.toFixed(1)}s`} />
                      <Row label="Deg level" value={track.degradation} />
                      <Row label="Aero demand" value={track.aeroDemand} />
                      <Row label="Overtaking" value={track.overtaking} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Gauge className="h-3.5 w-3.5 text-red-500" />
                      Tire Degradation Model
                    </h3>
                    <div className="space-y-2">
                      {(["soft", "medium", "hard"] as const).map((c) => {
                        const curve =
                          track.id === "suzuka"
                            ? { soft: [0.18, 12, 2.4], medium: [0.1, 20, 2.0], hard: [0.06, 28, 1.7] }[c]
                            : track.id === "monza"
                            ? { soft: [0.1, 16, 2.0], medium: [0.06, 24, 1.8], hard: [0.04, 34, 1.5] }[c]
                            : { soft: [0.14, 14, 2.2], medium: [0.08, 22, 1.9], hard: [0.05, 30, 1.6] }[c];
                        const color = c === "soft" ? "#ef4444" : c === "medium" ? "#facc15" : "#f1f5f9";
                        return (
                          <div key={c} className="flex items-center gap-2">
                            <span className="w-12 font-mono text-xs capitalize" style={{ color }}>{c}</span>
                            <div className="flex-1">
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>{curve[0]}/lap</span>
                                <span>cliff L{curve[1]}</span>
                                <span>×{curve[2]}</span>
                              </div>
                              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full rounded-full" style={{ width: `${(curve[0] / 0.2) * 100}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 border-t border-border/40 pt-2 text-[10px] italic leading-snug text-slate-500">
                      Model fed by Friday practice long-run data. Cliff multiplier applied when stint exceeds threshold.
                    </p>
                  </div>

                  {simulation && (
                    <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Probability Distribution</h3>
                      <div className="space-y-1.5">
                        {simulation.options
                          .slice()
                          .sort((a, b) => b.finishProbabilities.podium - a.finishProbabilities.podium)
                          .slice(0, 5)
                          .map((o) => (
                            <div key={o.id} className="space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="truncate text-slate-400">{o.label}</span>
                                <span className="font-mono text-green-400">{Math.round(o.finishProbabilities.podium * 100)}%</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${o.finishProbabilities.podium * 100}%` }} />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "analysis" && (
            <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-red-500" />
                  <h2 className="text-lg font-bold">Post-Race Analysis Suite</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Compare actual vs simulated race outcome. Identify deviation events — safety cars, yellow flags, tire wear variance, weather changes — and build playbooks fed back into next race's simulator calibration.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <div className="h-[760px] overflow-hidden rounded-xl border border-border/60 bg-slate-900/40">
                    <AnalysisView
                      session={session}
                      analysis={analysis}
                      playbooks={playbooks}
                      onRunAnalysis={handleRunAnalysis}
                      loading={analysisLoading}
                    />
                  </div>
                </div>
                <div className="space-y-4 lg:col-span-4">
                  <PaceImpactChart session={session} driverId={activeDriverId} />
                  <PaceChangeLog sessionId={session.id} refreshKey={session.currentLap} />
                </div>
              </div>
            </motion.div>
          )}

          {tab === "championship" && (
            <motion.div key="championship" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-bold">Championship Center</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Live championship standings with points accumulation across rounds. Includes the in-progress race as a live projection. Compare any two drivers head-to-head lap-by-lap.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* standings table */}
                <div className="lg:col-span-7">
                  <div className="h-[640px] overflow-hidden rounded-xl border border-border/60 bg-slate-900/40">
                    <StandingsPanel refreshKey={session.currentLap} />
                  </div>
                </div>

                {/* head-to-head launcher + race info */}
                <div className="space-y-4 lg:col-span-5">
                  <ChampionshipTimelineChart refreshKey={session.currentLap} />
                  <CrossSessionChart />

                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Swords className="h-3.5 w-3.5 text-red-500" />
                      Driver Head-to-Head
                    </h3>
                    <p className="mb-3 text-[11px] leading-snug text-slate-500">
                      Compare any two drivers lap-by-lap. See average delta, race gap, qualifying gap, and per-lap sector breakdown.
                    </p>
                    <Button
                      onClick={() => handleOpenH2H()}
                      className="w-full gap-1.5 bg-red-600 text-white hover:bg-red-500"
                      size="sm"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      Open Head-to-Head
                    </Button>
                  </div>

                  {/* current race summary card */}
                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Flag className="h-3.5 w-3.5 text-red-500" />
                      Current Race
                    </h3>
                    <div className="space-y-2 text-xs">
                      <Row label="Circuit" value={track.name.split(" ")[0]} />
                      <Row label="Country" value={track.country} />
                      <Row label="Lap" value={`${session.currentLap}/${session.totalLaps}`} />
                      <Row label="Weather" value={session.weather} />
                      <Row label="Track temp" value={`${session.trackTempC.toFixed(1)}°C`} />
                      <Row label="Status" value={session.status} />
                    </div>
                  </div>

                  {/* track facts */}
                  <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <MapPin className="h-3.5 w-3.5 text-red-500" />
                      Circuit Profile
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Fact label="Length" value={`${track.lapLengthKm} km`} />
                      <Fact label="Corners" value={`${track.corners}`} />
                      <Fact label="DRS Zones" value={`${track.drsZones}`} />
                      <Fact label="Total Laps" value={`${track.totalLaps}`} />
                      <Fact label="Deg Level" value={track.degradation} />
                      <Fact label="Overtaking" value={track.overtaking} />
                      <Fact label="Aero Demand" value={track.aeroDemand} />
                      <Fact label="Pit Loss" value={`${track.pitLossSec.toFixed(1)}s`} />
                    </div>
                  </div>

                  <DataExportPanel />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ===== Head-to-Head Modal ===== */}
      <HeadToHeadModal
        key={`${h2hDriverA ?? "auto"}-${h2hDriverB ?? "auto"}`}
        open={h2hOpen}
        onClose={() => setH2hOpen(false)}
        defaultDriverAId={h2hDriverA}
        defaultDriverBId={h2hDriverB}
      />

      {/* ===== Footer ===== */}
      <footer className="mt-auto border-t border-border/40 bg-slate-950/90 px-4 py-3">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Flag className="h-3 w-3 text-red-500" />
              Apex Racing Strategy Ops · v2.1
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Discrete-event simulator + WebGL track view + radio link protocol</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Goal: decision latency &lt;10s · sim accuracy ≥75% · adoption &gt;60%</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 py-1 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-semibold capitalize text-slate-200">{value}</span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-slate-900/40 p-2">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold capitalize text-slate-100">{value}</div>
    </div>
  );
}
