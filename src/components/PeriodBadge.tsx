import { Calendar } from "lucide-react";
import { type Period, PERIOD_BADGE_CLASS, PERIOD_LABEL, usePeriod } from "@/contexts/PeriodContext";

interface PeriodBadgeProps {
  dias: Period;
}

/**
 * Chip compacto exibido nos cards de farmácia indicando qual período está sendo
 * visualizado.
 *
 * Exemplo de uso:
 *   <PeriodBadge dias={period} />
 */
export function PeriodBadge({ dias }: PeriodBadgeProps) {
  // Mês fechado ou de/até: mostra o período escolhido no lugar da janela
  const { intervalo, rotulo } = usePeriod();
  if (intervalo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 bg-zinc-100 text-zinc-700 ring-zinc-300 capitalize">
        <Calendar className="size-2.5" />
        {rotulo}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${PERIOD_BADGE_CLASS[dias]}`}
    >
      <Calendar className="size-2.5" />
      {PERIOD_LABEL[dias]}
    </span>
  );
}
