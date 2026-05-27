import { Calendar } from "lucide-react";
import { type Period, PERIOD_BADGE_CLASS, PERIOD_LABEL } from "@/contexts/PeriodContext";

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
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${PERIOD_BADGE_CLASS[dias]}`}
    >
      <Calendar className="size-2.5" />
      {PERIOD_LABEL[dias]}
    </span>
  );
}
