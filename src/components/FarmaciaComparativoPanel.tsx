import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart2, AlertCircle, Loader2 } from "lucide-react";
import { getFarmacias } from "@/lib/api";
import type { Farmacia } from "@/lib/api";
import { PERIOD_COLOR, type Period } from "@/contexts/PeriodContext";

// ── Props ──────────────────────────────────────────────────────────────────

interface FarmaciaComparativoPanelProps {
  farmaciaId: number;
  farmaciaNome: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const PERIODS: Period[] = [7, 15, 30];

const PERIOD_LABEL: Record<Period, string> = {
  7:  "7 dias",
  15: "15 dias",
  30: "30 dias",
};

function semDados(f: Farmacia | undefined) {
  if (!f) return true;
  return f.receita_total === 0 && f.total_atendimentos === 0;
}

function alertColor(nivel: string) {
  if (nivel === "vermelho") return "text-red-600 bg-red-50";
  if (nivel === "amarelo")  return "text-amber-600 bg-amber-50";
  return "text-emerald-600 bg-emerald-50";
}

function alertLabel(nivel: string) {
  if (nivel === "vermelho") return "Alerta";
  if (nivel === "amarelo")  return "Atenção";
  return "Verde";
}

// ── Coluna individual de período ───────────────────────────────────────────

function PeriodColumn({ dias, farmacia }: { dias: Period; farmacia: Farmacia | undefined }) {
  const color = PERIOD_COLOR[dias];

  if (!farmacia || semDados(farmacia)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
        <AlertCircle className="size-6 text-zinc-300" />
        <p className="text-xs text-zinc-400">Sem dados para {dias} dias</p>
        <p className="text-[10px] text-zinc-300">Execute a automação para popular este período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Receita */}
      <div>
        <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Receita</p>
        <p className="text-lg font-bold" style={{ color }}>{fmtBRL(farmacia.receita_total)}</p>
      </div>
      {/* Vendas */}
      <div>
        <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Vendas</p>
        <p className="text-base font-semibold text-zinc-800">{farmacia.vendas_realizadas.toLocaleString("pt-BR")}</p>
      </div>
      {/* Atendimentos */}
      <div>
        <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Atendimentos</p>
        <p className="text-base font-semibold text-zinc-800">{farmacia.total_atendimentos.toLocaleString("pt-BR")}</p>
      </div>
      {/* Score */}
      <div>
        <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Score</p>
        <p className="text-base font-semibold text-zinc-800">{farmacia.score_criticidade}</p>
      </div>
      {/* Status */}
      <div>
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${alertColor(farmacia.nivel_alerta)}`}>
          {alertLabel(farmacia.nivel_alerta)}
        </span>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export function FarmaciaComparativoPanel({ farmaciaId, farmaciaNome }: FarmaciaComparativoPanelProps) {
  const [activePeriods, setActivePeriods] = useState<Period[]>([7, 15, 30]);

  function togglePeriod(p: Period) {
    setActivePeriods((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev; // mínimo 1 selecionado
        return prev.filter((x) => x !== p);
      }
      return [...prev, p].sort((a, b) => a - b) as Period[];
    });
  }

  const allSelected = activePeriods.length === 3;

  // Busca os 3 períodos em paralelo (sempre, para não perder cache)
  const results = useQueries({
    queries: PERIODS.map((dias) => ({
      queryKey: ["farmacias", "periodo", dias, farmaciaId],
      queryFn: () => getFarmacias({ dias }),
      staleTime: 5 * 60 * 1000,
      select: (data: Farmacia[]) => data.find((f) => f.id === farmaciaId),
    })),
  });

  const [r7, r15, r30] = results;
  const isLoading = results.some((r) => r.isLoading);

  const snapMap: Record<Period, Farmacia | undefined> = {
    7:  r7.data,
    15: r15.data,
    30: r30.data,
  };

  const visiblePeriods = PERIODS.filter((p) => activePeriods.includes(p));

  // Dados para o gráfico (só quando todos os 3 estão ativos)
  const barData = [
    { metrica: "Receita",  "7d": snapMap[7]?.receita_total ?? 0,  "15d": snapMap[15]?.receita_total ?? 0,  "30d": snapMap[30]?.receita_total ?? 0  },
    { metrica: "Vendas",   "7d": snapMap[7]?.vendas_realizadas ?? 0, "15d": snapMap[15]?.vendas_realizadas ?? 0, "30d": snapMap[30]?.vendas_realizadas ?? 0 },
    { metrica: "Atend.",   "7d": snapMap[7]?.total_atendimentos ?? 0, "15d": snapMap[15]?.total_atendimentos ?? 0, "30d": snapMap[30]?.total_atendimentos ?? 0 },
  ];

  return (
    <section className="space-y-4">
      {/* ── Cabeçalho + toggles ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-4 text-zinc-400" />
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Comparativo de Períodos — {farmaciaNome}
          </h3>
        </div>

        {/* Toggles de período */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
          {PERIODS.map((p) => {
            const active = activePeriods.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePeriod(p)}
                className={[
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  active
                    ? "bg-white shadow-sm ring-1 ring-black/5 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-800",
                ].join(" ")}
                style={active ? { color: PERIOD_COLOR[p] } : undefined}
              >
                {PERIOD_LABEL[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Colunas filtradas ── */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : (
          <div className={`grid ${GRID_COLS[visiblePeriods.length] ?? "grid-cols-3"} divide-x divide-zinc-100`}>
            {visiblePeriods.map((dias, idx) => (
              <div key={dias}>
                <div
                  className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between"
                  style={{ borderTop: `3px solid ${PERIOD_COLOR[dias]}` }}
                >
                  <span className="text-sm font-semibold" style={{ color: PERIOD_COLOR[dias] }}>
                    {PERIOD_LABEL[dias]}
                  </span>
                  {dias === 30 && idx === visiblePeriods.length - 1 && (
                    <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-medium">
                      Mensal
                    </span>
                  )}
                </div>
                <PeriodColumn dias={dias} farmacia={snapMap[dias]} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Gráfico — só aparece com os 3 períodos selecionados ── */}
      {!isLoading && allSelected && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Evolução por Métrica — 7 / 15 / 30 dias
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="metrica" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={50}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }}
                formatter={(v: number, name: string) => [v.toLocaleString("pt-BR"), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => <span style={{ color: "#52525b" }}>{value}</span>} />
              <Bar dataKey="7d"  name="7 dias"  fill={PERIOD_COLOR[7]}  radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="15d" name="15 dias" fill={PERIOD_COLOR[15]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="30d" name="30 dias" fill={PERIOD_COLOR[30]} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dica quando o gráfico está oculto */}
      {!isLoading && !allSelected && (
        <p className="text-[11px] text-zinc-400 text-center">
          Selecione os 3 períodos para ver o gráfico comparativo.
        </p>
      )}
    </section>
  );
}
