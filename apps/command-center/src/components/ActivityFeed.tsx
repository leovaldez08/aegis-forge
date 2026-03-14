"use client";
// ActivityFeed — AI-Generated Machine Chat Log
// Auto-scrolling feed of persona-based alert messages

import { useEffect, useRef } from "react";
import { Bot, BellOff, AlertTriangle, ShieldAlert } from "lucide-react";
import type { AlertEvent } from "@/hooks/useSocket";

interface ActivityFeedProps {
  alerts: AlertEvent[];
}

export default function ActivityFeed({ alerts }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new alerts arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [alerts.length]);

  const severityConfig = {
    warning: {
      border: "border-l-amber-500",
      bg: "bg-amber-500/5",
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      badge: "bg-amber-500/20 text-amber-400",
    },
    critical: {
      border: "border-l-red-500",
      bg: "bg-red-500/5",
      icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
      badge: "bg-red-500/20 text-red-400",
    },
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {}
      <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary-amber" />
          <h3 className="text-sm font-medium text-foreground">
            Machine Activity
          </h3>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
          {alerts.length} alerts
        </span>
      </div>

      {}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {alerts.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <BellOff className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
              <p className="text-sm text-foreground font-medium">
                No alerts yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Machines are running smoothly
              </p>
            </div>
          </div>
        ) : (
          alerts.map((alert) => {
            const cfg =
              severityConfig[alert.severity] || severityConfig.warning;
            const time = new Date(alert.timestamp).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            return (
              <div
                key={alert.id}
                className={`rounded-xl border-l-2 ${cfg.border} ${cfg.bg} p-4 transition-all duration-300 animate-in slide-in-from-top-2`}
              >
                {}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cfg.icon}
                    <span className="text-xs font-semibold text-foreground">
                      {alert.machineName.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${cfg.badge}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600">{time}</span>
                </div>

                {}
                <p className="text-sm leading-relaxed text-foreground opacity-90">
                  {alert.agentMessage}
                </p>

                {/* Worker footer */}
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    Notified:{" "}
                    <span className="font-medium text-foreground opacity-80">
                      {alert.workerName}
                    </span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
