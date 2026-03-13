"use client";
// StatusBadge — Machine Health Indicator
// Color-coded pill: green/amber/red for healthy/warning/critical

interface StatusBadgeProps {
  status: "healthy" | "warning" | "critical";
  size?: "sm" | "md";
}

const config = {
  healthy: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    label: "Healthy",
  },
  warning: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
    label: "Warning",
  },
  critical: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    dot: "bg-red-400",
    ring: "ring-red-400/30",
    label: "Critical",
  },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const c = config[status] || config.healthy;
  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ${c.bg} ${c.text} ${c.ring} ${sizeClasses}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${c.dot} ${status === "critical" ? "animate-pulse" : ""}`}
      />
      {c.label}
    </span>
  );
}
