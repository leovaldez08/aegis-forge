"use client";
import React, { useEffect, useRef, useState } from "react";
import { BellOff, Volume2, CheckCircle, Check, XCircle, Clock, Activity } from "lucide-react";
import type { AlertEvent } from "@/hooks/useSocket";

interface WorkerFeedProps {
  alerts: AlertEvent[];
}

type Tab = "active" | "history";

interface LocalAlert extends AlertEvent {
  status?: "pending" | "acknowledged" | "resolved" | "false_alarm";
}

export default function WorkerFeed({ alerts: initialAlerts }: WorkerFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [localAlerts, setLocalAlerts] = useState<LocalAlert[]>([]);

  // Smoothly sync new socket alerts into our local state
  useEffect(() => {
    setLocalAlerts(prev => {
      const newFromInitial = initialAlerts.filter(a => !prev.some(p => p.id === a.id));
      if (newFromInitial.length === 0) return prev;
      return [...newFromInitial, ...prev];
    });
  }, [initialAlerts]);

  // Handle scroll to top on new alerts or tab change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [localAlerts.length, activeTab]);

  const speak = (message: string, id: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    if (playingId === id) {
      setPlayingId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.onstart = () => setPlayingId(id);
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleAction = async (id: string, status: "acknowledged" | "resolved" | "false_alarm") => {
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      
      // OPTIMISTIC UPDATE: Move item locally for instant feedback
      setLocalAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));

      // Quietly update backend
      await fetch(`${BACKEND_URL}/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error("Action failed:", e);
    }
  };

  const filteredAlerts = localAlerts.filter(alert => {
    const status = alert.status || "pending";
    if (activeTab === "active") {
      return status === "pending" || status === "acknowledged";
    } else {
      return status === "resolved" || status === "false_alarm";
    }
  }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl relative">
      {/* TABS SEGREGATION */}
      <div className="flex border-b border-border bg-muted/20">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-tighter transition-all ${
            activeTab === "active" 
            ? "text-primary border-b-2 border-primary bg-background shadow-inner" 
            : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Activity className="h-4 w-4" />
          Live Alerts
          {localAlerts.filter(a => !['resolved', 'false_alarm'].includes(a.status || 'pending')).length > 0 && (
            <span className="ml-1 rounded-full bg-primary/20 px-2 py-0.5 text-[9px] text-primary animate-pulse">
              {localAlerts.filter(a => !['resolved', 'false_alarm'].includes(a.status || 'pending')).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-tighter transition-all ${
            activeTab === "history" 
            ? "text-primary border-b-2 border-primary bg-background shadow-inner" 
            : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Clock className="h-4 w-4" />
          History
        </button>
      </div>

      {/* FEED AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 bg-gradient-to-b from-transparent to-muted/10">
        {filteredAlerts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center opacity-40">
            <BellOff className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {activeTab === "active" ? "All Clear, Boss" : "Nothing Stored"}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const time = new Date(alert.timestamp).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            const isCritical = alert.severity === "critical";
            const borderClass = isCritical ? "border-red-500/40 shadow-red-500/5" : "border-amber-500/40 shadow-amber-500/5";
            const bgClass = isCritical ? "bg-red-500/10" : "bg-amber-500/10";
            const currentStatus = alert.status || "pending";
            
            return (
              <div
                key={alert.id}
                className={`flex flex-col rounded-[2rem] border-2 ${borderClass} ${bgClass} p-5 shadow-xl relative transition-all duration-300 animate-in zoom-in-95 slide-in-from-top-4`}
              >
                {/* MESSAGE HEADER */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 border-2 ${isCritical ? 'border-red-500/50 bg-red-500' : 'border-amber-500/50 bg-amber-500'} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                      <span className="font-black text-sm uppercase">
                        {alert.machineName.substring(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black tracking-tight text-foreground uppercase">
                        {alert.machineName.replace(/_/g, " ")}
                      </h4>
                      <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">
                        {alert.machineType} • {time}
                      </p>
                    </div>
                  </div>
                  
                  {/* MANUAL VOICE BUTTON */}
                  <button
                    onClick={() => speak(alert.agentMessage, alert.id)}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all shadow-md group ${
                      playingId === alert.id 
                      ? "bg-primary text-primary-foreground animate-bounce" 
                      : "bg-background border border-border text-muted-foreground hover:bg-primary/20 hover:text-primary hover:scale-105 active:scale-95"
                    }`}
                  >
                    <Volume2 className={`h-6 w-6 ${playingId === alert.id ? 'animate-pulse' : 'group-hover:rotate-12 transition-transform'}`} />
                  </button>
                </div>

                {/* SENTIENT MESSAGE BODY */}
                <div className="pl-1 pr-2 pb-5">
                  <p className="text-lg leading-tight text-foreground font-black tracking-tight drop-shadow-sm italic">
                    &quot;{alert.agentMessage}&quot;
                  </p>
                </div>

                {/* ACTION BAR */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/20">
                  <div className="flex items-center gap-2 uppercase text-[10px] font-black tracking-[0.2em] text-muted-foreground italic">
                    {currentStatus === 'pending' && <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />}
                    {currentStatus === 'acknowledged' && <Check className="h-3 w-3 text-blue-500" />}
                    {currentStatus === 'resolved' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                    {currentStatus.replace('_', ' ')}
                  </div>

                  {activeTab === "active" && (
                    <div className="flex gap-2">
                      {currentStatus === 'pending' && (
                        <button 
                          onClick={() => handleAction(alert.id, "acknowledged")}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 px-4 py-2 text-[10px] font-black text-blue-500 hover:bg-blue-500 hover:text-white transition-all uppercase shadow-sm active:scale-90"
                        >
                          <Check className="h-4 w-4" /> Ack
                        </button>
                      )}
                      <button 
                        onClick={() => handleAction(alert.id, "resolved")}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-[10px] font-black text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all uppercase shadow-sm active:scale-90"
                      >
                        <CheckCircle className="h-4 w-4" /> Resolve
                      </button>
                      <button 
                        onClick={() => handleAction(alert.id, "false_alarm")}
                        className="flex items-center gap-1.5 rounded-xl bg-zinc-500/10 px-4 py-2 text-[10px] font-black text-zinc-500 hover:bg-zinc-500 hover:text-white transition-all uppercase shadow-sm active:scale-90"
                      >
                        <XCircle className="h-4 w-4" /> False
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
