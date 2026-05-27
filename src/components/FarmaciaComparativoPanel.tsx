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
import { DollarSign, ShoppingCart, Users, BarChart2, AlertCircle, Loader2 } from "lucide-react";
import { getFarmacias } from "@/lib/api";
import type { Farmacia } from "@/lib/api";
import { PERIOD_COLOR, type Period } from "@/contexts/PeriodContext";
import { KpiComparativoCard } from "./KpiComparativoCard";

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

export function FarmaciaComparativoPanel({ farmaciaId, farmaciaNome }: FarmaciaComparativoPanelProps) {
  // Busca os 3 períodos em paralelo
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

  const snap7  = r7.data;
  const snap15 = r15.data;
  const snap30 = r30.data;

  // ── Dados para gráfico de barras agrupadas ──
  const barData = [
    {
      metrica: "Receita",
      "7d":  snap7?.receita_total  ?? 0,
      "15d": snap15?.receita_total ?? 0,
      "30d": snap30?.receita_total ?? 0,
    },
    {
      metrica: "Vendas",
      "7d":  snap7?.vendas_realizadas  ?? 0,
      "15d": snap15?.vendas_realizadas ?? 0,
      "30d": snap30?.vendas_realizadas ?? 0,
    },
    {
      metrica: "Atend.",
      "7d":  snap7?.total_atendimentos  ?? 0,
      "15d": snap15?.total_atendimentos ?? 0,
      "30d": snap30?.total_atendimentos ?? 0,
    },
  ];

  // ── Mapa de valores para KpiComparativoCard ──
  const receitaValues: Partial<Record<Period, number>> = {};
  const vendasValues:  Partial<Record<Period, number>> = {};
  const atendValues:   Partial<Record<Period, number>> = {};
  const scoreValues:   Partial<Record<Period, number>> = {};

  if (snap7)  { receitaValues[7]  = snap7.receita_total;  vendasValues[7]  = snap7.vendas_realizadas;  atendValues[7]  = snap7.total_atendimentos;  scoreValues[7]  = snap7.score_criticidade;  }
  if (snap15) { receitaValues[15] = snap15.receita_total; vendasValues[15] = snap15.vendas_realizadas; atendValues[15] = snap15.total_atendimentos; scoreValues[15] = snap15.score_criticidade; }
  if (snap30) { receitaValues[30] = snap30.receita_total; vendasValues[30] = snap30.vendas_realizadas; atendValues[30] = snap30.total_atendimentos; scoreValues[30] = snap30.score_criticidade; }

  const activePeriod: Period = 30; // destaque sempre no período mais longo para tendência

  return (
    <section className="space-y-4">
      {/* Título */}
      <div className="flex items-center gap-2">
        <BarChart2 className="size-4 text-zinc-400" />
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Comparativo de Períodos — {farmaciaNome}
        </h3>
      </div>

      {/* ── Tabela comparativa 3 colunas ── */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Carregando comparativo...</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 divide-x divide-zinc-100">
            {PERIODS.map((dias, idx) => (
              <div key={dias}>
                {/* Header da coluna */}
                <div
                  className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between"
                  style={{ borderTop: `3px solid ${PERIOD_COLOR[dias]}` }}
                >
                  <span className="text-sm font-semibold" style={{ color: PERIOD_COLOR[dias] }}>
                    {PERIOD_LABEL[dias]}
                  </span>
                  {idx === 2 && (
                    <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-medium">
                      Mensal
                    </span>
                  )}
                </div>
                <PeriodColumn
                  dias={dias}
                  farmacia={[snap7, snap15, snap30][idx]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI Cards com tendência ── */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiComparativoCard
            label="Receita Total"
            icon={<DollarSign className="size-4 text-zinc-400" />}
            values={receitaValues}
            activePeriod={activePeriod}
            format={fmtBRL}
          />
          <KpiComparativoCard
            label="Vendas"
            icon={<ShoppingCart className="size-4 text-zinc-400" />}
            values={vendasValues}
            activePeriod={activePeriod}
          />
          <KpiComparativoCard
            label="Atendimentos"
            icon={<Users className="size-4 text-zinc-400" />}
            values={atendValues}
            activePeriod={activePeriod}
          />
          <KpiComparativoCard
            label="Score Criticidade"
            icon={<BarChart2 className="size-4 text-zinc-400" />}
            values={scoreValues}
            activePeriod={activePeriod}
          />
        </div>
      )}

      {/* ── Gráfico de barras agrupadas ── */}
      {!isLoading && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Evolução por Métrica — 7 / 15 / 30 dias
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={barData}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              barCategoryGap="30%"
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="metrica"
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }}
                formatter={(v: number, name: string) => [v.toLocaleString("pt-BR"), name]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => <span style={{ color: "#52525b" }}>{value}</span>}
              />
              <Bar dataKey="7d"  name="7 dias"  fill={PERIOD_COLOR[7]}  radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="15d" name="15 dias" fill={PERIOD_COLOR[15]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="30d" name="30 dias" fill={PERIOD_COLOR[30]} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
