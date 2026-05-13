import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Activity, ShoppingCart, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { getFarmaciaEvolucao, getFarmacias } from "@/lib/api";

export const Route = createFileRoute("/farmacias/$id")({
  component: FarmaciaDetailPage,
  head: () => ({ meta: [{ title: "Farmácia — PharmaFlow" }] }),
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function alertColor(nivel: string) {
  if (nivel === "vermelho") return "text-red-600 bg-red-50 ring-red-600/10";
  if (nivel === "amarelo") return "text-amber-600 bg-amber-50 ring-amber-600/10";
  return "text-emerald-600 bg-emerald-50 ring-emerald-600/10";
}

function alertLabel(nivel: string) {
  if (nivel === "vermelho") return "Alerta";
  if (nivel === "amarelo") return "Atenção";
  return "Ativa";
}

const chartTooltipStyle = {
  contentStyle: {
    fontSize: "11px",
    borderRadius: "8px",
    border: "1px solid rgb(228 228 231)",
    boxShadow: "0 1px 4px rgb(0 0 0 / .08)",
  },
};

function FarmaciaDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const farmaciaId = Number(id);

  const { data: evolucao = [], isLoading: loadingEvo } = useQuery({
    queryKey: ["farmacia", farmaciaId, "evolucao"],
    queryFn: () => getFarmaciaEvolucao(farmaciaId),
  });

  // Get current metrics from the list endpoint (single item)
  const { data: farmacias = [] } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias(),
    staleTime: 60_000,
  });
  const farmacia = farmacias.find((f) => f.id === farmaciaId);

  const chartData = evolucao.map((s) => ({
    semana: `Sem ${s.semana_numero}`,
    receita: s.receita_total,
    vendas: s.vendas_realizadas,
    atendimentos: s.total_atendimentos,
    score_criticidade: s.score_criticidade,
  }));

  const latest = evolucao[evolucao.length - 1];

  return (
    <AppShell
      title={farmacia?.nome ?? `Farmácia #${id}`}
      headerRight={
        <button
          onClick={() => navigate({ to: "/farmacias" })}
          className="flex items-center gap-2 py-2 px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-md hover:bg-zinc-50"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </button>
      }
    >
      {/* Current metrics cards */}
      {farmacia && (
        <section className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Receita Total"
            value={fmtBRL(farmacia.receita_total)}
            delta={`${farmacia.variacao_receita >= 0 ? "+" : ""}${farmacia.variacao_receita.toFixed(1)}% vs semana anterior`}
            positive={farmacia.variacao_receita >= 0}
          />
          <MetricCard
            label="Vendas Realizadas"
            value={String(farmacia.vendas_realizadas)}
            delta={`${farmacia.variacao_vendas >= 0 ? "+" : ""}${farmacia.variacao_vendas.toFixed(1)}% vs semana anterior`}
            positive={farmacia.variacao_vendas >= 0}
          />
          <MetricCard
            label="Taxa de Conversão"
            value={`${farmacia.taxa_conversao.toFixed(1)}%`}
            delta={`${farmacia.atendimentos_finalizados} atendimentos finalizados`}
          />
          <div className="bg-white p-5 rounded-xl ring-1 ring-black/5 shadow-sm flex flex-col justify-between">
            <span className="text-xs text-zinc-500 font-medium">Status</span>
            <div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold ring-1 ${alertColor(farmacia.nivel_alerta)}`}>
                {alertLabel(farmacia.nivel_alerta)}
              </span>
              <p className="text-[10px] text-zinc-400 mt-1.5">Score: {farmacia.score_criticidade.toFixed(1)}</p>
            </div>
          </div>
        </section>
      )}

      {loadingEvo && (
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl ring-1 ring-black/5 h-56 animate-pulse" />
          ))}
        </div>
      )}

      {!loadingEvo && chartData.length > 0 && (
        <>
          {/* Line charts */}
          <section className="grid grid-cols-2 gap-6">
            <ChartCard title="Receita Total por Semana" icon={<Activity className="size-4 text-zinc-400" />}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(244 244 245)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={48} />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(v: number) => [fmtBRL(v), "Receita"]}
                  />
                  <Line type="monotone" dataKey="receita" stroke="var(--brand)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Vendas Realizadas por Semana" icon={<ShoppingCart className="size-4 text-zinc-400" />}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(244 244 245)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip {...chartTooltipStyle} formatter={(v: number) => [v, "Vendas"]} />
                  <Line type="monotone" dataKey="vendas" stroke="var(--accent-blue)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          {/* Bar chart */}
          <section className="grid grid-cols-2 gap-6">
            <ChartCard title="Total de Atendimentos por Semana" icon={<Users className="size-4 text-zinc-400" />}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(244 244 245)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip {...chartTooltipStyle} formatter={(v: number) => [v, "Atendimentos"]} />
                  <Bar dataKey="atendimentos" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Score card */}
            {latest && (
              <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6 flex flex-col justify-center">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Score de Criticidade</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-5xl font-bold text-zinc-900">{latest.score_criticidade.toFixed(0)}</span>
                  <span className="text-lg text-zinc-400 mb-1">/100</span>
                </div>
                <div className="mt-4 h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${latest.score_criticidade}%`,
                      background: latest.score_criticidade >= 70 ? "var(--brand)" : latest.score_criticidade >= 40 ? "oklch(0.7 0.18 60)" : "oklch(0.6 0.22 25)",
                    }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-2">Última semana registrada</p>
              </div>
            )}
          </section>
        </>
      )}

      {!loadingEvo && chartData.length === 0 && (
        <div className="text-center py-20 text-zinc-500 text-sm">
          Ainda não há dados de evolução para esta farmácia.
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  delta,
  positive,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-white p-5 rounded-xl ring-1 ring-black/5 shadow-sm space-y-1">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {delta && (
        <div className={`text-[10px] font-medium ${positive === undefined ? "text-zinc-400" : positive ? "text-brand" : "text-red-500"}`}>
          {delta}
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm">
      <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
