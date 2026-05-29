import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { rodarAgora, getStatus } from "@/lib/api";
import type { UltimoResultado } from "@/lib/api";
import { toast } from "sonner";

interface PipelineContextType {
  pipelineRodando:    boolean;
  ultimoResultado:    UltimoResultado | null;
  iniciadoEm:         number | null;
  iniciarPipeline:    (opcoes?: { periodos?: number[]; gestor_id?: number }) => Promise<void>;
  descartarResultado: () => void;
}

const PipelineContext = createContext<PipelineContextType | null>(null);

export function usePipelineContext() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipelineContext must be inside PipelineProvider");
  return ctx;
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [pipelineRodando, setPipelineRodando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<UltimoResultado | null>(null);
  const [iniciadoEm, setIniciadoEm] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  async function checarStatus() {
    try {
      const data = await getStatus();
      if (!data.pipeline_rodando) {
        setPipelineRodando(false);
        if (data.ultimo_resultado) {
          setUltimoResultado(data.ultimo_resultado);
          if (data.ultimo_resultado.totalErros === 0) {
            toast.success(`Coleta concluída! ${data.ultimo_resultado.totalSucessos} farmácias atualizadas.`);
          } else {
            toast.warning(`Coleta concluída com ${data.ultimo_resultado.totalErros} erro(s). Veja o painel.`);
          }
        }
        stopPolling();
      }
    } catch { /* silent */ }
  }

  // Polling a cada 5s enquanto pipeline roda
  useEffect(() => {
    if (!pipelineRodando) { stopPolling(); return; }
    checarStatus();
    pollingRef.current = setInterval(checarStatus, 5000);
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineRodando]);

  // Verificação ao montar (pipeline pode ter sido disparado em outra aba ou pelo cron)
  useEffect(() => {
    getStatus().then((data) => {
      if (data.pipeline_rodando) setPipelineRodando(true);
      if (data.ultimo_resultado) setUltimoResultado(data.ultimo_resultado);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function iniciarPipeline(opcoes: { periodos?: number[]; gestor_id?: number } = {}) {
    try {
      await rodarAgora(opcoes);
      setIniciadoEm(Date.now());
      setPipelineRodando(true);
      setUltimoResultado(null);
    } catch (err) {
      toast.error((err as Error).message ?? "Erro ao iniciar pipeline");
    }
  }

  return (
    <PipelineContext.Provider value={{
      pipelineRodando,
      ultimoResultado,
      iniciadoEm,
      iniciarPipeline,
      descartarResultado: () => setUltimoResultado(null),
    }}>
      {children}
    </PipelineContext.Provider>
  );
}
