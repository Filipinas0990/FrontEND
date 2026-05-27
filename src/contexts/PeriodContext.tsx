import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

// ── Tipos ──────────────────────────────────────────────────────────────────

export type Period = 7 | 15 | 30;

interface PeriodContextType {
  period: Period;
  setPeriod: (p: Period) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const PeriodContext = createContext<PeriodContextType>({} as PeriodContextType);

// ── Provider ───────────────────────────────────────────────────────────────

function readStoredPeriod(): Period {
  try {
    const stored = localStorage.getItem("pharma_period");
    const n = Number(stored);
    if (n === 7 || n === 15 || n === 30) return n;
  } catch {
    // localStorage pode não estar disponível em SSR
  }
  return 7;
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<Period>(readStoredPeriod);

  function setPeriod(p: Period) {
    try {
      localStorage.setItem("pharma_period", String(p));
    } catch {
      // ignora
    }
    setPeriodState(p);
  }

  return (
    <PeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </PeriodContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePeriod() {
  return useContext(PeriodContext);
}

// ── Helpers de estilo por período ──────────────────────────────────────────

export const PERIOD_COLOR: Record<Period, string> = {
  7:  "#3B82F6", // azul
  15: "#8B5CF6", // roxo
  30: "#10B981", // verde
};

export const PERIOD_LABEL: Record<Period, string> = {
  7:  "7 dias",
  15: "15 dias",
  30: "30 dias",
};

/** Classes Tailwind para fundo leve + borda do botão ativo */
export const PERIOD_ACTIVE_CLASS: Record<Period, string> = {
  7:  "border-blue-500 bg-blue-500/10 text-blue-600 font-semibold",
  15: "border-violet-500 bg-violet-500/10 text-violet-600 font-semibold",
  30: "border-emerald-500 bg-emerald-500/10 text-emerald-600 font-semibold",
};

/** Classes para o badge de período */
export const PERIOD_BADGE_CLASS: Record<Period, string> = {
  7:  "bg-blue-50 text-blue-600 ring-blue-200",
  15: "bg-violet-50 text-violet-600 ring-violet-200",
  30: "bg-emerald-50 text-emerald-600 ring-emerald-200",
};
