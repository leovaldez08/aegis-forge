"use client";
// Aegis Node — Command Center Dashboard
//
// Main dashboard page that assembles all components:
//   • Machine status cards (top row)
//   • Live telemetry charts (center)
//   • AI activity feed (right panel)

import { useState, useEffect, useMemo } from "react";
import { useSocket } from "@/hooks/useSocket";
import MachineCard from "@/components/MachineCard";
import TelemetryChart from "@/components/TelemetryChart";
import ActivityFeed from "@/components/ActivityFeed";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";
import { Factory, CheckCircle2, AlertTriangle, WifiOff } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  type: string;
  location: string | null;
  status: string;
  maxVibration: string;
  maxTemp: string;
  baselineVibration: string;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function Dashboard() {
  const { isConnected, telemetryMap, alerts } = useSocket();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch machines from API on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/machines`)
      .then((r) => r.json())
      .then((data) => {
        setMachines(data.machines || []);
        if (data.machines?.length > 0 && !selectedMachine) {
          setSelectedMachine(data.machines[0].name);
        }
      })
      .catch(console.error);
  }, [selectedMachine]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Get latest reading per machine for status cards
  const latestReadings = useMemo(() => {
    const result: Record<string, (typeof telemetryMap)[string][0]> = {};
    for (const [machineId, readings] of Object.entries(telemetryMap)) {
      if (readings.length > 0) {
        result[machineId] = readings[readings.length - 1];
      }
    }
    return result;
  }, [telemetryMap]);

  // Stats counters
  const stats = useMemo(() => {
    const healthy = machines.filter(
      (m) =>
        !latestReadings[m.name] ||
        (m.status !== "warning" && m.status !== "critical"),
    ).length;
    return {
      total: machines.length,
      healthy,
      warning: machines.filter((m) => m.status === "warning").length,
      critical: machines.filter((m) => m.status === "critical").length,
      totalReadings: Object.values(telemetryMap).reduce(
        (sum, r) => sum + r.length,
        0,
      ),
    };
  }, [machines, latestReadings, telemetryMap]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <div className="flex items-center rounded-lg gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-card border border-border shadow-sm">
              <Image
                src="/logo.png"
                alt="Aegis Node Logo"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                AEGIS NODE
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                Command Center
              </p>
            </div>
          </div>

          {}
          <div className="flex items-center gap-6">
            {}
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
              />
              <span className="text-xs text-zinc-400">
                {isConnected ? "Live" : "Disconnected"}
              </span>
            </div>

            {}
            <div className="hidden md:flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-muted border border-border px-3 py-1 text-xs text-muted-foreground font-medium">
                <Factory className="h-3.5 w-3.5" /> {stats.total} machines
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> {stats.healthy} healthy
              </span>
              {stats.critical > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-600 dark:text-red-400 animate-pulse font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> {stats.critical}{" "}
                  critical
                </span>
              )}
            </div>

            <span className="font-mono text-xs text-muted-foreground font-medium">
              {currentTime.toLocaleTimeString("en-US", { hour12: false })}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {}
      <main className="mx-auto max-w-[1600px] p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          {}
          <div className="space-y-6">
            {}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Machine Fleet
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {machines.map((machine) => (
                  <button
                    key={machine.id}
                    onClick={() => setSelectedMachine(machine.name)}
                    className={`text-left transition-all ${
                      selectedMachine === machine.name
                        ? "ring-2 ring-blue-500/50 rounded-2xl"
                        : ""
                    }`}
                  >
                    <MachineCard
                      machine={machine}
                      latestReading={latestReadings[machine.name]}
                    />
                  </button>
                ))}
              </div>
            </section>

            {}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Live Telemetry
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {selectedMachine && telemetryMap[selectedMachine] ? (
                  <div className="lg:col-span-2">
                    <TelemetryChart
                      machineId={selectedMachine}
                      machineName={selectedMachine}
                      readings={telemetryMap[selectedMachine]}
                    />
                  </div>
                ) : null}

                {}
                {Object.entries(telemetryMap)
                  .filter(([id]) => id !== selectedMachine)
                  .map(([machineId, readings]) => (
                    <TelemetryChart
                      key={machineId}
                      machineId={machineId}
                      machineName={machineId}
                      readings={readings}
                    />
                  ))}
              </div>

              {Object.keys(telemetryMap).length === 0 && (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20">
                  <div className="text-center">
                    <WifiOff className="mx-auto mb-2 h-10 w-10 text-muted-foreground opacity-50" />
                    <p className="text-sm text-foreground font-medium">
                      Waiting for telemetry data...
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Start the simulator:{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs border border-border">
                        npx tsx tools/simulator.ts
                      </code>
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {}
          <div className="h-[calc(100vh-120px)] sticky top-[73px]">
            <ActivityFeed alerts={alerts} />
          </div>
        </div>
      </main>
    </div>
  );
}
