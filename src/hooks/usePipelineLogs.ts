import { useState, useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:8000";
const TIMEOUT_MS = 45 * 60 * 1000; // segurança: fecha após 45 min

export interface LogEntry {
  ts:    string;
  level: "info" | "warn" | "error";
  msg:   string;
  data?: Record<string, unknown>;
}

export function usePipelineLogs(ativo: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [concluido, setConcluido] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!ativo) return;

    setLogs([]);
    setConcluido(false);

    const token = getToken() ?? "";
    const url = `${BASE_URL}/api/pipeline/logs/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const timeoutId = setTimeout(() => {
      source.close();
      sourceRef.current = null;
    }, TIMEOUT_MS);

    source.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setLogs((prev) => [...prev, entry]);
      } catch { /* ignora linhas malformadas */ }
    };

    source.addEventListener("done", () => {
      setConcluido(true);
      source.close();
      clearTimeout(timeoutId);
      sourceRef.current = null;
    });

    // EventSource reconecta automaticamente em erro de rede — não fechar manualmente
    source.onerror = () => {};

    sourceRef.current = source;

    return () => {
      source.close();
      clearTimeout(timeoutId);
      sourceRef.current = null;
    };
  }, [ativo]);

  function limparLogs() {
    setLogs([]);
    setConcluido(false);
  }

  return { logs, concluido, limparLogs };
}
