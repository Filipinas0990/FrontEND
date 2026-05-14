import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Activity, ShoppingCart, Users } from "lucide-react";
import type React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
        <section className="grid grid-cols-1 gap-4 max-w-xs">
          <MetricCard
            label="Receita Total"
            value={fmtBRL(farmacia.receita_total)}
            delta={`${farmacia.variacao_receita >= 0 ? "+" : ""}${farmacia.variacao_receita.toFixed(1)}% vs semana anterior`}
            positive={farmacia.variacao_receita >= 0}
          />
        </section>
      )}

      {/* Gráfico de pizza — canais do objeto farmácia (GET /api/farmacias) */}
      {farmacia?.canais && farmacia.canais.length > 0 && (
        <ChartCard
          title="Atendimentos por Canal"
          icon={<Users className="size-4 text-zinc-400" />}
        >
          <CanaisPieChart canais={farmacia.canais} />
        </ChartCard>
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

const CANAL_COLORS: Record<string, string> = {
  google:         "#3b82f6",
  meta:           "#6366f1",
  grupos:         "#10b981",
  "base de contatos": "#f59e0b",
  site:           "#8b5cf6",
  "site novo":    "#ec4899",
};

function canalColor(nome: string, idx: number): string {
  const key = nome.toLowerCase();
  for (const [k, v] of Object.entries(CANAL_COLORS)) {
    if (key.includes(k)) return v;
  }
  const fallbacks = ["#64748b", "#0ea5e9", "#f97316", "#14b8a6", "#a855f7"];
  return fallbacks[idx % fallbacks.length];
}

function CanaisPieChart({ canais }: { canais: { nome: string; atendimentos: number }[] }) {
  const data = [...canais].sort((a, b) => b.atendimentos - a.atendimentos);
  const total = data.reduce((s, c) => s + c.atendimentos, 0);

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={220} height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="atendimentos"
            nameKey="nome"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((c, i) => (
              <Cell key={c.nome} fill={canalColor(c.nome, i)} />
            ))}
          </Pie>
          <Tooltip
            {...chartTooltipStyle}
            formatter={(v: number, name: string) => [
              `${v.toLocaleString("pt-BR")} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda manual */}
      <div className="flex flex-col gap-2 flex-1">
        {data.map((c, i) => {
          const pct = total > 0 ? Math.round((c.atendimentos / total) * 100) : 0;
          const color = canalColor(c.nome, i);
          return (
            <div key={c.nome} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-xs text-zinc-600 flex-1">{c.nome}</span>
              <span className="text-xs font-semibold text-zinc-900">
                {c.atendimentos.toLocaleString("pt-BR")}
              </span>
              <span className="text-[10px] text-zinc-400 w-8 text-right">{pct}%</span>
            </div>
          );
        })}
        <div className="mt-1 pt-2 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">Total</span>
          <span className="text-xs font-bold text-zinc-900">{total.toLocaleString("pt-BR")}</span>
        </div>
      </div>
    </div>
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
