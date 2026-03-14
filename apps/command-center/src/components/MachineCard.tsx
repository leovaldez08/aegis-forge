"use client";
// MachineCard — Compact machine status overview
// Shows name, type, current readings, and health status

import StatusBadge from "./StatusBadge";
import {
  Settings,
  Wrench,
  Link as LinkIcon,
  Bot,
  MapPin,
  Factory,
} from "lucide-react";
import type { TelemetryReading } from "@/hooks/useSocket";

interface MachineCardProps {
  machine: {
    id: string;
    name: string;
    type: string;
    location: string | null;
    status: string;
    maxVibration: string;
    maxTemp: string;
    baselineVibration: string;
  };
  latestReading?: TelemetryReading;
}

export default function MachineCard({
  machine,
  latestReading,
}: MachineCardProps) {
  const status = (machine.status || "healthy") as
    | "healthy"
    | "warning"
    | "critical";
  const vibration = latestReading?.vibrationRms ?? 0;
  const temp = latestReading?.tempC ?? 0;
  const maxVib = parseFloat(machine.maxVibration);
  const maxTemp = parseFloat(machine.maxTemp);
  const vibPercent = maxVib > 0 ? (vibration / maxVib) * 100 : 0;
  const tempPercent = maxTemp > 0 ? (temp / maxTemp) * 100 : 0;

  const getBarColor = (percent: number) => {
    if (percent > 100) return "bg-red-500";
    if (percent > 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  // Machine type → icon mapping
  const icons: Record<string, React.ReactNode> = {
    "CNC Lathe": <Settings className="h-6 w-6 text-foreground" />,
    "Hydraulic Press": <Wrench className="h-6 w-6 text-foreground" />,
    "Conveyor System": <LinkIcon className="h-6 w-6 text-foreground" />,
    "Robotic Welder": <Bot className="h-6 w-6 text-foreground" />,
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
        status === "critical"
          ? "border-red-500/40 bg-red-500/5 shadow-lg shadow-red-500/10"
          : status === "warning"
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
    >
      {}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative p-5">
        {}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center p-2 rounded-lg bg-background border border-border text-foreground">
              {icons[machine.type] || <Factory className="h-6 w-6" />}
            </span>
            <div>
              <h3 className="font-semibold text-foreground">
                {machine.name.replace(/_/g, " ")}
              </h3>
              <p className="text-xs text-zinc-500">{machine.type}</p>
            </div>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        {}
        <p className="mb-4 text-xs flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" /> {machine.location || "Unknown"}
        </p>

        {}
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">Vibration</span>
            <span className="font-mono text-foreground opacity-90">
              {vibration > 0 ? `${vibration.toFixed(2)} mm/s` : "—"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(vibPercent)}`}
              style={{ width: `${Math.min(vibPercent, 100)}%` }}
            />
          </div>
        </div>

        {}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">Temperature</span>
            <span className="font-mono text-foreground opacity-90">
              {temp > 0 ? `${temp.toFixed(1)}°C` : "—"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(tempPercent)}`}
              style={{ width: `${Math.min(tempPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
