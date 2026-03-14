// Socket.io Handler — Real-Time Event Dispatch
//
// Manages WebSocket connections for the Command Center
// dashboard. Clients join rooms to receive:
//   • telemetry:live   → Streaming sensor readings
//   • alerts:live      → AI-generated maintenance alerts

import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";

export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*", // Permissive for dev; lock to dashboard URL in production
      methods: ["GET", "POST"],
    },
    // Transport config optimized for factory-floor network conditions:
    // Start with polling (more reliable on spotty networks), upgrade to websocket
    transports: ["polling", "websocket"],
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [SOCKET] Client connected: ${socket.id}`);

    // Clients self-select which data streams they want.

    socket.on("join:telemetry", () => {
      socket.join("telemetry:live");
      console.log(`  → ${socket.id} joined telemetry:live`);
    });

    socket.on("join:alerts", () => {
      socket.join("alerts:live");
      console.log(`  → ${socket.id} joined alerts:live`);
    });

    socket.on("join:all", () => {
      socket.join("telemetry:live");
      socket.join("alerts:live");
      console.log(`  → ${socket.id} joined all rooms`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 [SOCKET] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("✅ [SOCKET] Socket.io server initialized");
  return io;
}
