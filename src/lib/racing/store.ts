"use client";

import { create } from "zustand";
import type {
  AlertData,
  RaceSessionData,
  RadioCall,
  SimulationResult,
  TrackData,
} from "./types";
import { TRACKS, getTrack } from "./data";

interface RacingStore {
  // session
  session: RaceSessionData | null;
  track: TrackData;
  setSession: (s: RaceSessionData) => void;
  setTrack: (t: TrackData) => void;

  // connection
  wsConnected: boolean;
  setWsConnected: (b: boolean) => void;

  // simulation
  simulation: SimulationResult | null;
  simulating: boolean;
  setSimulation: (s: SimulationResult | null) => void;
  setSimulating: (b: boolean) => void;

  // alerts
  alerts: AlertData[];
  setAlerts: (a: AlertData[]) => void;
  acknowledgeAlert: (id: string) => void;
  pushAlert: (a: AlertData) => void;

  // radio
  radioCalls: RadioCall[];
  pushRadioCall: (c: RadioCall) => void;
  updateRadioCall: (id: string, patch: Partial<RadioCall>) => void;

  // active driver focus (for strategy tree)
  activeDriverId: string | null;
  setActiveDriver: (id: string | null) => void;

  // selected strategy option
  selectedOptionId: string | null;
  setSelectedOption: (id: string | null) => void;

  // live tick control
  live: boolean;
  setLive: (b: boolean) => void;
}

export const useRacingStore = create<RacingStore>((set) => ({
  session: null,
  track: TRACKS[0],
  setSession: (s) => set({ session: s }),
  setTrack: (t) => set({ track: t }),

  wsConnected: false,
  setWsConnected: (b) => set({ wsConnected: b }),

  simulation: null,
  simulating: false,
  setSimulation: (s) => set({ simulation: s }),
  setSimulating: (b) => set({ simulating: b }),

  alerts: [],
  setAlerts: (a) => set({ alerts: a }),
  acknowledgeAlert: (id) =>
    set((st) => ({
      alerts: st.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),
  pushAlert: (a) =>
    set((st) => ({ alerts: [a, ...st.alerts.filter((x) => x.id !== a.id)].slice(0, 50) })),

  radioCalls: [],
  pushRadioCall: (c) =>
    set((st) => ({ radioCalls: [c, ...st.radioCalls].slice(0, 30) })),
  updateRadioCall: (id, patch) =>
    set((st) => ({
      radioCalls: st.radioCalls.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  activeDriverId: null,
  setActiveDriver: (id) => set({ activeDriverId: id }),

  selectedOptionId: null,
  setSelectedOption: (id) => set({ selectedOptionId: id }),

  live: true,
  setLive: (b) => set({ live: b }),
}));

export { getTrack };
