import { useEffect, useRef } from "react";
import { usePipelineLogs, type LogEntry } from "@/hooks/usePipelineLogs";

interface PipelineLogTerminalProps {
  ativo:       boolean;
  onConcluir?: () => void;
}

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  info:  "#E2E8F0",
  warn:  "#FCD34D",
  error: "#F87171",
};

function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function PipelineLogTerminal({ ativo, onConcluir }: PipelineLogTerminalProps) {
  const { logs, concluido, limparLogs } = usePipelineLogs(ativo);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ao chegar novo log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  // Notificar pai quando pipeline terminar
  useEffect(() => {
    if (concluido) onConcluir?.();
  }, [concluido, onConcluir]);

  return (
    <div
      style={{
        background: "#0F172A",
        borderRadius: 8,
        padding: "12px 16px",
        fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.7,
        color: "#E2E8F0",
        maxHeight: 360,
        overflowY: "auto",
        border: "1px solid #1E293B",
      }}
    >
      {/* Cabeçalho */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #1E293B",
      }}>
        <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          📋 Log da coleta em tempo real
        </span>
        <button
          onClick={limparLogs}
          style={{ color: "#475569", fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
        >
          limpar
        </button>
      </div>

      {/* Linhas de log */}
      {logs.length === 0 ? (
        <div style={{ color: "#334155", fontStyle: "italic", padding: "8px 0" }}>
          Aguardando início da coleta...
        </div>
      ) : (
        logs.map((entry, i) => (
          <div key={i} style={{ color: LEVEL_COLOR[entry.level], marginBottom: 1, wordBreak: "break-word" }}>
            <span style={{ color: "#334155", marginRight: 8, userSelect: "none" }}>
              [{formatTs(entry.ts)}]
            </span>
            {entry.msg}
          </div>
        ))
      )}

      <div ref={bottomRef} />

      {/* Rodapé de status */}
      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: "1px solid #1E293B",
        display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569",
      }}>
        <span>
          {ativo && !concluido && (
            <span style={{ color: "#10B981" }}>
              <span style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}>●</span>
              {" "}Transmitindo ao vivo
            </span>
          )}
          {concluido && <span style={{ color: "#6B7280" }}>■ Concluído</span>}
          {!ativo && !concluido && <span style={{ color: "#334155" }}>Inativo</span>}
        </span>
        {logs.length > 0 && (
          <span>Última: {formatTs(logs[logs.length - 1].ts)}</span>
        )}
      </div>
    </div>
  );
}
