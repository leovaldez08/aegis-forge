import { io, Socket } from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });
  }
  return socket;
}
