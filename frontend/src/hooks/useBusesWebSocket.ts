import { useEffect, useState, useRef } from "react";
import type { Bus, Incident } from "../types";

export function useBusesWebSocket() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/buses";
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    let socket: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    // Fetch initial active incidents
    async function fetchInitialIncidents() {
      try {
        const response = await fetch(`${apiUrl}/api/incidents`);
        if (response.ok) {
          const data = await response.json();
          setIncidents(data);
        }
      } catch (err) {
        console.error("Failed to fetch initial incidents:", err);
      }
    }

    fetchInitialIncidents();

    function connect() {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        console.log("Connected to buses WebSocket");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "bus_update") {
            setBuses(data.buses);
            if (data.incidents) {
              setIncidents(data.incidents);
            }
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log("Disconnected from buses WebSocket, attempting reconnect in 3s...");
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        socket.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        // Remove close handler to avoid reconnect loop during unmount
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  return { buses, incidents, isConnected };
}
