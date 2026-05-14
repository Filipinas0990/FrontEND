import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Users, Search, BarChart2, MessageCircle, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import type React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { getFarmacias } from "@/lib/api";

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

  const { data: farmacias = [] } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias(),
    staleTime: 60_000,
  });
  const farmacia = farmacias.find((f) => f.id === farmaciaId);

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

      {/* Canais — cards + gráfico de pizza */}
      {farmacia?.canais && farmacia.canais.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Atendimentos por Canal
          </h3>

          {/* Cards individuais por canal */}
          <CanaisCards canais={farmacia.canais} total={farmacia.total_atendimentos} />

          {/* Gráfico de pizza abaixo dos cards */}
          <ChartCard
            title="Distribuição por Canal"
            icon={<Users className="size-4 text-zinc-400" />}
          >
            <CanaisPieChart canais={farmacia.canais} />
          </ChartCard>
        </section>
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

const CANAL_STYLE: Record<string, { icon: React.ElementType; color: string; bar: string; bg: string }> = {
  google:           { icon: Search,        color: "text-blue-600",    bar: "bg-blue-500",    bg: "bg-blue-50"    },
  meta:             { icon: BarChart2,     color: "text-indigo-600",  bar: "bg-indigo-500",  bg: "bg-indigo-50"  },
  grupos:           { icon: MessageCircle, color: "text-emerald-600", bar: "bg-emerald-500", bg: "bg-emerald-50" },
  site:             { icon: BarChart2,     color: "text-violet-600",  bar: "bg-violet-500",  bg: "bg-violet-50"  },
  "base de contatos": { icon: BarChart2,   color: "text-zinc-600",    bar: "bg-zinc-400",    bg: "bg-zinc-100"   },
};

function canalStyle(nome: string) {
  const key = nome.toLowerCase();
  for (const [k, v] of Object.entries(CANAL_STYLE)) {
    if (key.includes(k)) return v;
  }
  return { icon: BarChart2, color: "text-zinc-500", bar: "bg-zinc-400", bg: "bg-zinc-50" };
}

function CanaisCards({ canais, total }: { canais: import("@/lib/api").CanalData[]; total: number }) {
  const sorted = [...canais].sort((a, b) => b.atendimentos - a.atendimentos);
  const cols = Math.min(sorted.length, 4);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {sorted.map((c) => {
        const s          = canalStyle(c.nome);
        const Icon       = s.icon;
        const pctAtend   = total > 0 ? Math.round((c.atendimentos / total) * 100) : 0;
        const taxaConv   = c.vendas != null && c.atendimentos > 0
          ? ((c.vendas / c.atendimentos) * 100).toFixed(1)
          : null;

        return (
          <div key={c.nome} className={`rounded-xl p-5 ring-1 ring-black/5 shadow-sm ${s.bg}`}>
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-600">{c.nome}</span>
              <Icon className={`size-4 ${s.color}`} />
            </div>

            {/* Atendimentos — métrica principal */}
            <div className={`text-2xl font-semibold tracking-tight ${s.color}`}>
              {c.atendimentos.toLocaleString("pt-BR")}
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">atendimentos</p>

            {/* Barra de participação */}
            <div className="mt-3 h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pctAtend}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">{pctAtend}% do total</p>

            {/* Novos campos: vendas + receita + conversão */}
            {(c.vendas != null || c.receita_vendas != null) && (
              <div className="mt-4 pt-3 border-t border-white/50 space-y-1.5">
                {c.vendas != null && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <ShoppingCart className="size-3" /> Vendas
                    </span>
                    <span className="text-xs font-semibold text-zinc-800">
                      {c.vendas.toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}
                {c.receita_vendas != null && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <DollarSign className="size-3" /> Receita
                    </span>
                    <span className="text-xs font-semibold text-zinc-800">
                      {c.receita_vendas.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {taxaConv != null && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <TrendingUp className="size-3" /> Conversão
                    </span>
                    <span className={`text-xs font-semibold ${s.color}`}>
                      {taxaConv}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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
