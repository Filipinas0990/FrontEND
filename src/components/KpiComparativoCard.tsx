import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PERIOD_COLOR, type Period } from "@/contexts/PeriodContext";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface KpiComparativoCardProps {
  label: string;
  icon: React.ReactNode;
  values: Partial<Record<Period, number>>;
  /** Período principal exibido em destaque */
  activePeriod: Period;
  format?: (v: number) => string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function defaultFmt(v: number) {
  return v.toLocaleString("pt-BR");
}

function calcTendencia(atual: number, base: number): number | null {
  if (!base || base === 0) return null;
  return ((atual - base) / base) * 100;
}

// ── Componente ─────────────────────────────────────────────────────────────

export function KpiComparativoCard({
  label,
  icon,
  values,
  activePeriod,
  format = defaultFmt,
}: KpiComparativoCardProps) {
  const currentVal = values[activePeriod];

  // comparações: 30d vs 7d e 30d vs 15d (apenas quando activePeriod === 30)
  // ou genérico: activePeriod vs demais períodos disponíveis
  const PERIODS: Period[] = [7, 15, 30];
  const otherPeriods = PERIODS.filter((p) => p !== activePeriod && values[p] !== undefined);

  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 space-y-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 text-zinc-500">
        <span className="size-4 shrink-0">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>

      {/* Valor principal */}
      <div
        className="text-2xl font-bold tracking-tight"
        style={{ color: PERIOD_COLOR[activePeriod] }}
      >
        {currentVal != null ? format(currentVal) : "—"}
      </div>

      {/* Comparações */}
      {currentVal != null && otherPeriods.length > 0 && (
        <div className="space-y-1.5 border-t border-zinc-100 pt-3">
          {otherPeriods.map((p) => {
            const base = values[p]!;
            const diff = calcTendencia(currentVal, base);
            if (diff === null) return null;

            const pos = diff >= 0;
            const isZero = diff === 0;
            return (
              <div key={p} className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">vs {p} dias</span>
                <span
                  className={`flex items-center gap-0.5 font-semibold ${
                    isZero
                      ? "text-zinc-400"
                      : pos
                        ? "text-emerald-600"
                        : "text-red-500"
                  }`}
                >
                  {isZero ? (
                    <Minus className="size-3" />
                  ) : pos ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {isZero ? "—" : `${pos ? "+" : ""}${diff.toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
