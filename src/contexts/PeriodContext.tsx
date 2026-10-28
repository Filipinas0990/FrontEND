import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

// ── Tipos ──────────────────────────────────────────────────────────────────

export type Period = 7 | 15 | 30;

/** Período livre: mês fechado ou de/até, datas "AAAA-MM-DD". */
export interface Intervalo {
  inicio: string;
  fim: string;
}

/** O que vai na query de /api/farmacias: a janela OU o período livre. */
export type FiltroPeriodo = { dias: Period } | { inicio: string; fim: string };

interface PeriodContextType {
  period: Period;
  /** Escolher 7/15/30 desliga o período livre. */
  setPeriod: (p: Period) => void;
  /** null = usando a janela de 7/15/30 dias. */
  intervalo: Intervalo | null;
  setIntervalo: (i: Intervalo | null) => void;
  filtro: FiltroPeriodo;
  /** Para a queryKey do React Query. */
  chave: string;
  /** "últimos 7 dias", "setembro de 2026", "10/10 a 19/10/2026". */
  rotulo: string;
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
  const [intervalo, setIntervalo] = useState<Intervalo | null>(null);

  function setPeriod(p: Period) {
    try {
      localStorage.setItem("pharma_period", String(p));
    } catch {
      // ignora
    }
    setPeriodState(p);
    setIntervalo(null);
  }

  const filtro: FiltroPeriodo = intervalo ? { ...intervalo } : { dias: period };
  const chave = intervalo ? `${intervalo.inicio}_${intervalo.fim}` : String(period);
  const rotulo = intervalo ? rotuloIntervalo(intervalo) : `últimos ${period} dias`;

  return (
    <PeriodContext.Provider value={{ period, setPeriod, intervalo, setIntervalo, filtro, chave, rotulo }}>
      {children}
    </PeriodContext.Provider>
  );
}

// ── Período livre ──────────────────────────────────────────────────────────

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ultimoDiaDoMes = (ano: number, mes: number) =>
  new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

/** Mês "AAAA-MM" como intervalo do dia 1 ao último dia. */
export function intervaloDoMes(mes: string): Intervalo {
  const [ano, m] = mes.split("-").map(Number);
  return { inicio: `${mes}-01`, fim: ultimoDiaDoMes(ano, m) };
}

export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${ano}`;
}

/** "AAAA-MM" quando o intervalo é um mês inteiro; senão null. */
export function mesDoIntervalo({ inicio, fim }: Intervalo): string | null {
  const mes = inicio.slice(0, 7);
  return inicio.endsWith("-01") && fim === intervaloDoMes(mes).fim ? mes : null;
}

const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function rotuloIntervalo(i: Intervalo): string {
  const mes = mesDoIntervalo(i);
  return mes ? nomeDoMes(mes) : `${dataBR(i.inicio)} a ${dataBR(i.fim)}`;
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
