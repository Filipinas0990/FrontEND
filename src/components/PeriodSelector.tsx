import { Calendar } from "lucide-react";
import {
  type Period,
  PERIOD_ACTIVE_CLASS,
  PERIOD_LABEL,
} from "@/contexts/PeriodContext";

// ── Props ──────────────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  value: Period;
  onChange: (dias: Period) => void;
  /** Exibe um spinner quando true (período sendo carregado) */
  loading?: boolean;
}

// ── Componente ─────────────────────────────────────────────────────────────

const PERIODS: Period[] = [7, 15, 30];

export function PeriodSelector({ value, onChange, loading = false }: PeriodSelectorProps) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm px-5 py-4 flex items-center gap-5 flex-wrap">
      {/* Ícone + label */}
      <div className="flex items-center gap-2 text-zinc-500">
        <Calendar className="size-4 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
          Período de análise
        </span>
        {loading && (
          <span className="ml-1 size-3 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin inline-block" />
        )}
      </div>

      {/* Botões */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => {
          const isActive = value === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={[
                "relative px-4 py-1.5 rounded-lg text-sm border-2 transition-all duration-150",
                isActive
                  ? PERIOD_ACTIVE_CLASS[p]
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 bg-transparent",
              ].join(" ")}
            >
              {PERIOD_LABEL[p]}
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight">
                  ativo
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="ml-auto text-[10px] text-zinc-400 hidden sm:block">
        Todos os dados abaixo refletem os últimos <strong>{value} dias</strong>
      </p>
    </div>
  );
}
