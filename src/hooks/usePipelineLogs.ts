import { useState, useEffect, useRef } from "react";

// Mesma origem do front — quem alcança a API é o proxy. Ver comentário em @/lib/api.
const BASE_URL = "";
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

    // Same-origin: o EventSource leva o cookie de sessão sozinho — nada de token na URL.
    const url = `${BASE_URL}/api/pipeline/logs/stream`;
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
