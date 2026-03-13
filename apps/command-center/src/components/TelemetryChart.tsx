"use client";
// TelemetryChart — Live Dual-Axis Line Chart
// Streams vibration (mm/s) and temperature (°C)
// Uses Recharts for lightweight, responsive rendering

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TelemetryReading } from "@/hooks/useSocket";

interface TelemetryChartProps {
  machineId: string;
  machineName: string;
  readings: TelemetryReading[];
}

export default function TelemetryChart({
  machineName,
  readings,
}: TelemetryChartProps) {
  // Transform data for Recharts — extract time label + numeric values
  const chartData = readings.map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
    }),
    vibration: r.vibrationRms,
    temperature: r.tempC,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="text-center">
          <div className="mb-2 text-3xl">📊</div>
          <p className="text-sm text-zinc-500">
            Waiting for data from {machineName.replace(/_/g, " ")}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
      {}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">
          📈 {machineName.replace(/_/g, " ")} — Live Telemetry
        </h3>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
          ● LIVE
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            stroke="#52525b"
            fontSize={10}
            tickLine={false}
            interval="preserveStartEnd"
          />
          {}
          <YAxis
            yAxisId="vib"
            stroke="#52525b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={40}
            label={{
              value: "mm/s",
              position: "insideTopLeft",
              offset: -5,
              style: { fontSize: 9, fill: "#71717a" },
            }}
          />
          {}
          <YAxis
            yAxisId="temp"
            orientation="right"
            stroke="#52525b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={35}
            label={{
              value: "°C",
              position: "insideTopRight",
              offset: -5,
              style: { fontSize: 9, fill: "#71717a" },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "0.75rem",
              fontSize: "12px",
              color: "#d4d4d8",
            }}
          />
          <Legend iconType="circle" iconSize={8} />
          <Line
            yAxisId="vib"
            type="monotone"
            dataKey="vibration"
            name="Vibration (mm/s)"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            name="Temp (°C)"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
