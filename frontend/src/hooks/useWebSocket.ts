import { useEffect, useRef, useState } from "react";

export type WsStatus = "connecting" | "connected" | "disconnected";

export function useWebSocket(
  url: string,
  onMessage: (data: unknown) => void,
  enabled: boolean = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const [status, setStatus] = useState<WsStatus>("disconnected");

  // Keep callback ref current without re-connecting
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setStatus("connected");
        // Send periodic ping to keep connection alive
        const ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
          else clearInterval(ping);
        }, 25_000);
      };

      ws.onmessage = (e) => {
        try {
          onMessageRef.current(JSON.parse(e.data));
        } catch {
          // ignore non-JSON (ping/pong)
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          setStatus("disconnected");
          retryTimer = setTimeout(connect, 3_000); // auto-reconnect
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
      setStatus("disconnected");
    };
  }, [url, enabled]);

  return { status };
}
