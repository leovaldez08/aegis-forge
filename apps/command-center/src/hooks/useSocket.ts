"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface TelemetryReading {
  machineId: string;
  vibrationRms: number;
  tempC: number;
  timestamp: string;
}

export interface AlertEvent {
  id: string;
  machineId: string;
  machineName: string;
  machineType: string;
  workerName: string;
  severity: "warning" | "critical";
  agentMessage: string;
  anomalyData: Record<string, number>;
  timestamp: string;
}

const MAX_READINGS_PER_MACHINE = 60; // Keep last 60 data points per chart

export function useSocket() {
  const [isConnected, setIsConnected] = useState(() => getSocket().connected);
  const [telemetryMap, setTelemetryMap] = useState<
    Record<string, TelemetryReading[]>
  >({});
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const telemetryRef = useRef<Record<string, TelemetryReading[]>>({});

  // Batch update telemetry to avoid excessive re-renders
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushTelemetry = useCallback(() => {
    setTelemetryMap({ ...telemetryRef.current });
  }, []);

  useEffect(() => {
    // 1. Fetch historical alerts immediately
    fetch(`${BACKEND_URL}/api/alerts?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (data.alerts && Array.isArray(data.alerts)) {
          // Map DB records to AlertEvent shape
          const history = data.alerts.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            machineId: a.machineId as string,
            machineName: a.machineName as string,
            machineType: a.machineType as string,
            workerName: a.workerName as string,
            severity: a.severity as "warning" | "critical",
            agentMessage: a.agentMessage as string,
            anomalyData: a.anomalyData as Record<string, number>,
            timestamp: a.createdAt as string,
          }));
          setAlerts(history);
        }
      })
      .catch((err) => console.error("Failed to fetch alert history:", err));

    const socket = getSocket();

    // 2. If already connected (e.g., navigating from Dashboard -> PWA)
    if (socket.connected) {
      socket.emit("join:all");
    }

    socket.on("connect", () => {
      setIsConnected(true);
      // Join both data streams
      socket.emit("join:all");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("telemetry:reading", (data: TelemetryReading) => {
      const machineId = data.machineId;
      if (!telemetryRef.current[machineId]) {
        telemetryRef.current[machineId] = [];
      }
      telemetryRef.current[machineId].push(data);

      // Trim to max window size
      if (telemetryRef.current[machineId].length > MAX_READINGS_PER_MACHINE) {
        telemetryRef.current[machineId] = telemetryRef.current[machineId].slice(
          -MAX_READINGS_PER_MACHINE,
        );
      }

      // Debounce: flush to state every 500ms
      if (!flushRef.current) {
        flushRef.current = setTimeout(() => {
          flushTelemetry();
          flushRef.current = null;
        }, 500);
      }
    });

    socket.on("alert:new", (alert: AlertEvent) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
    });

    socket.connect();

    return () => {
      if (flushRef.current) clearTimeout(flushRef.current);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("telemetry:reading");
      socket.off("alert:new");
      socket.disconnect();
    };
  }, [flushTelemetry]);

  return { isConnected, telemetryMap, alerts };
}
