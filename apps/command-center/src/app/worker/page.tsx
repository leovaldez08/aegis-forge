"use client";

import { useSocket } from "@/hooks/useSocket";
import WorkerFeed from "@/components/WorkerFeed";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";
import { Wrench } from "lucide-react";
import Link from "next/link";

export default function WorkerPWA() {
  const { isConnected, alerts } = useSocket();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground transition-colors duration-300">
      {/* App Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <Image
              src="/logo.webp"
              alt="Aegis Node Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">
              AEGIS NODE
            </h1>
            <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
              Worker Terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${isConnected ? "animate-pulse bg-emerald-500" : "bg-red-500"}`}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Alerts Feed */}
      <main className="flex-1 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <Wrench className="h-5 w-5 text-primary-amber" />
            Active Alerts
          </h2>
          <Link
            href="/"
            className="text-xs font-medium text-blue-500 hover:underline"
          >
            View Dashboard &rarr;
          </Link>
        </div>

        <div className="h-[calc(100dvh-150px)]">
          <WorkerFeed alerts={alerts} />
        </div>
      </main>
    </div>
  );
}
