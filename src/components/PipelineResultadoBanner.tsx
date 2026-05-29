import { useState } from "react";
import { CheckCircle2, AlertTriangle, X, RefreshCw, ChevronDown } from "lucide-react";
import { usePipelineContext } from "@/contexts/PipelineContext";
import { PipelineLogTerminal } from "@/components/PipelineLogTerminal";
import type { UltimoResultado } from "@/lib/api";

const CHIP: Record<number, string> = {
  7:  "bg-blue-100 text-blue-700",
  15: "bg-purple-100 text-purple-700",
  30: "bg-emerald-100 text-emerald-700",
};

function agrupar(erros: UltimoResultado["farmaciasComErro"]) {
  return Object.values(
    erros.reduce<Record<string, { nome: string; periodos: number[]; erro: string }>>((acc, e) => {
      if (!acc[e.nome]) acc[e.nome] = { nome: e.nome, periodos: [], erro: e.erro };
      acc[e.nome].periodos.push(e.periodo);
      return acc;
    }, {})
  );
}

function fmtDataHora(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} às ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export function PipelineProgressBar() {
  const { pipelineRodando } = usePipelineContext();
  const [logsAbertos, setLogsAbertos] = useState(false);

  if (!pipelineRodando) return null;

  return (
    <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 space-y-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <RefreshCw className="size-4 text-blue-500 shrink-0 animate-spin" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800">Coletando dados das farmácias...</p>
          <p className="text-xs text-blue-600 mt-0.5">Isso pode levar alguns minutos.</p>
        </div>
        <button
          onClick={() => setLogsAbertos((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 shrink-0"
        >
          {logsAbertos ? "Ocultar logs" : "Ver logs"}
          <ChevronDown className={`size-3.5 transition-transform ${logsAbertos ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full animate-[indeterminate_1.6s_ease-in-out_infinite]" />
      </div>
      {logsAbertos && (
        <PipelineLogTerminal ativo={pipelineRodando} />
      )}
    </div>
  );
}

export function PipelineResultadoBanner() {
  const { pipelineRodando, ultimoResultado, descartarResultado, iniciarPipeline } = usePipelineContext();

  if (pipelineRodando || !ultimoResultado) return null;

  const sucesso = ultimoResultado.totalErros === 0;
  const agrupados = agrupar(ultimoResultado.farmaciasComErro);

  if (sucesso) {
    return (
      <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-50 px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Coleta concluída com sucesso</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {ultimoResultado.totalSucessos} farmácias coletadas · Executado em {fmtDataHora(ultimoResultado.executado_em)}
            </p>
          </div>
        </div>
        <button onClick={descartarResultado} className="text-emerald-400 hover:text-emerald-700 shrink-0">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Coleta concluída com {ultimoResultado.totalErros} {ultimoResultado.totalErros === 1 ? "erro" : "erros"}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {ultimoResultado.totalSucessos} de {ultimoResultado.farmaciasTotais} farmácias coletadas · {fmtDataHora(ultimoResultado.executado_em)}
            </p>
          </div>
        </div>
        <button onClick={descartarResultado} className="text-amber-400 hover:text-amber-700 shrink-0">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Farmácias com falha (após retries):</p>
        {agrupados.map((e) => (
          <div key={e.nome} className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-2 ring-1 ring-amber-100">
            <span className="text-xs font-medium text-zinc-800 flex-1 min-w-0 truncate">{e.nome}</span>
            <div className="flex gap-1 shrink-0">
              {e.periodos.sort().map(p => (
                <span key={p} title={e.erro} className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help ${CHIP[p] ?? "bg-zinc-100 text-zinc-600"}`}>{p}d</span>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 truncate max-w-[160px] hidden sm:block" title={e.erro}>{e.erro}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => iniciarPipeline()}
        className="text-xs font-semibold text-amber-700 hover:underline"
      >
        Tentar novamente (rodar toda a coleta)
      </button>
    </div>
  );
}
