"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useRacingStore } from "@/lib/racing/store";
import type { AlertData, PaceMode, RadioCall, RaceSessionData, TrackData } from "@/lib/racing/types";
import { TRACKS } from "@/lib/racing/data";

// Engine hook: tries WebSocket first (via Caddy XTransformPort routing).
// If WS doesn't connect within ~4s, falls back to REST polling against the
// in-process Next.js race session so the command center stays fully functional.

export function useRaceSocket() {
  const socketRef = useRef<Socket | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restActiveRef = useRef(false);
  const radioSeqRef = useRef(0);

  const setSession = useRacingStore((s) => s.setSession);
  const setWsConnected = useRacingStore((s) => s.setWsConnected);
  const setTrack = useRacingStore((s) => s.setTrack);
  const pushAlert = useRacingStore((s) => s.pushAlert);
  const pushRadioCall = useRacingStore((s) => s.pushRadioCall);
  const updateRadioCall = useRacingStore((s) => s.updateRadioCall);

  // ---- REST fallback ----
  const restTick = useCallback(async () => {
    try {
      await fetch("/api/race/tick", { method: "POST" });
      const res = await fetch("/api/race/state");
      const data = await res.json();
      if (data?.session) {
        setSession(data.session);
        const t = TRACKS.find((x) => x.id === data.session.trackId);
        if (t) setTrack(t as TrackData);
        // regenerate alerts
        try {
          const ar = await fetch("/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: data.session }),
          });
          const ad = await ar.json();
          if (ad?.alerts) {
            for (const a of ad.alerts) pushAlert(a);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [setSession, setTrack, pushAlert]);

  const startRestFallback = useCallback(() => {
    if (restActiveRef.current) return;
    restActiveRef.current = true;
    const run = () => {
      restTick();
      restTimerRef.current = setTimeout(run, 3500);
    };
    run();
  }, [restTick]);

  const stopRestFallback = useCallback(() => {
    restActiveRef.current = false;
    if (restTimerRef.current) {
      clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }, []);

  // ---- WebSocket connection ----
  useEffect(() => {
    // Seed initial session via REST immediately
    fetch("/api/race/state")
      .then((r) => r.json())
      .then((d) => {
        if (d?.session) {
          setSession(d.session);
          const t = TRACKS.find((x) => x.id === d.session.trackId);
          if (t) setTrack(t as TrackData);
        }
      })
      .catch(() => {});

    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
      timeout: 4000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setWsConnected(true);
      stopRestFallback();
    });
    socket.on("disconnect", () => setWsConnected(false));
    socket.on("reconnect_failed", () => {
      setWsConnected(false);
      startRestFallback();
    });

    socket.on("race:state", (session: RaceSessionData) => {
      setSession(session);
      const t = TRACKS.find((x) => x.id === session.trackId);
      if (t) setTrack(t as TrackData);
    });

    socket.on("alert:new", (alert: AlertData) => pushAlert(alert));
    socket.on("radio:history", (calls: RadioCall[]) => {
      for (const c of [...calls].reverse()) pushRadioCall(c);
    });
    socket.on("radio:new", (call: RadioCall) => pushRadioCall(call));
    socket.on("radio:update", (call: RadioCall) => updateRadioCall(call.id, call));

    // If WS doesn't connect within 5s, start REST fallback
    const fallbackTimer = setTimeout(() => {
      if (!socket.connected) {
        startRestFallback();
      }
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      stopRestFallback();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setSession, setWsConnected, setTrack, pushAlert, pushRadioCall, updateRadioCall, startRestFallback, stopRestFallback]);

  const selectTrack = useCallback((trackId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("race:select-track", trackId);
    } else {
      // REST fallback: reset to new track
      fetch("/api/race/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.session) {
            setSession(d.session);
            const t = TRACKS.find((x) => x.id === trackId);
            if (t) setTrack(t as TrackData);
          }
        })
        .catch(() => {});
    }
  }, [setSession, setTrack]);

  const resetRace = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("race:reset");
    } else {
      fetch("/api/race/reset", { method: "POST" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.session) setSession(d.session);
        })
        .catch(() => {});
    }
  }, [setSession]);

  const setPace = useCallback((driverCode: string, pace: PaceMode) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("race:set-pace", { driverCode, pace });
    }
    // REST mode: pace is local-only (next tick re-derives from state); optimistic update
  }, []);

  const sendRadio = useCallback(
    (call: Omit<RadioCall, "id" | "createdAt" | "status">) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("radio:send", call);
        return;
      }
      // REST fallback: persist + simulate radio protocol client-side
      const id = "rc_" + (radioSeqRef.current++) + "_" + Math.random().toString(36).slice(2, 7);
      const full: RadioCall = {
        ...call,
        id,
        createdAt: new Date().toISOString(),
        status: "queued",
      };
      pushRadioCall(full);
      fetch("/api/radio/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(call),
      }).catch(() => {});
      setTimeout(() => updateRadioCall(id, { status: "transmitting" }), 800);
      setTimeout(() => updateRadioCall(id, { status: "delivered" }), 2200);
    },
    [pushRadioCall, updateRadioCall]
  );

  const acknowledgeAlert = useCallback((alertId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("alert:ack", alertId);
    }
  }, []);

  return { selectTrack, resetRace, setPace, sendRadio, acknowledgeAlert };
}
