import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { getRankingGestores, type RankingGestor } from "@/lib/api";

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  head: () => ({ meta: [{ title: "Ranking de Gestores — PharmaFlow" }] }),
});

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtK(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const resultado = payload.find((p: any) => p.dataKey === "receita_total");
  const meta = payload.find((p: any) => p.dataKey === "meta_receita_total");
  const entry: RankingGestor = payload[0]?.payload;
  const pct = entry?.percentual_medio_meta;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-lg p-4 text-xs min-w-[200px]">
      <p className="font-bold text-zinc-900 text-sm mb-2">{label}</p>
      {resultado && (
        <div className="flex justify-between gap-6">
          <span className="text-zinc-500">Resultado</span>
          <span className="font-semibold text-zinc-900">{fmtBRL(resultado.value)}</span>
        </div>
      )}
      {meta && meta.value != null && (
        <div className="flex justify-between gap-6 mt-1">
          <span className="text-zinc-500">Meta</span>
          <span className="font-semibold text-brand">{fmtBRL(meta.value)}</span>
        </div>
      )}
      {pct != null && (
        <div className={`mt-2 pt-2 border-t border-zinc-100 flex justify-between gap-6`}>
          <span className="text-zinc-500">% Atingido</span>
          <span className={`font-bold ${pct >= 100 ? "text-emerald-600" : "text-red-500"}`}>
            {pct.toFixed(1)}%
          </span>
        </div>
      )}
      <div className="mt-1 flex justify-between gap-6">
        <span className="text-zinc-500">Pontos</span>
        <span className="font-bold text-emerald-600">{entry?.pontos ?? 0} pts</span>
      </div>
    </div>
  );
}

function CustomLabel({ x, y, width, value }: any) {
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="#52525b"
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
    >
      {fmtK(value)}
    </text>
  );
}

function RankingPage() {
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["ranking-gestores"],
    queryFn: getRankingGestores,
  });

  const chartData = ranking.map((g) => ({
    ...g,
    label: `${MEDAL[g.posicao] ?? `#${g.posicao}`} ${g.gestor_nome}`,
  }));

  const temMeta = ranking.some((g) => g.meta_receita_total != null);

  return (
    <AppShell title="Ranking de Gestores">
      {/* Critério */}
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-start gap-3">
        <Target className="size-5 text-brand shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-brand">1 ponto por farmácia que bate a meta</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Cada farmácia tem sua própria meta. Quando bate, o gestor ganha 1 ponto.
            Faturamento <strong>não</strong> conta para o ranking — só metas batidas.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 h-80 animate-pulse" />
      )}

      {!isLoading && ranking.length === 0 && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 py-16 text-center">
          <Target className="size-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-400">Nenhuma meta cadastrada ainda.</p>
          <p className="text-xs text-zinc-300 mt-1">Defina metas para as farmácias para ativar o ranking.</p>
        </div>
      )}

      {!isLoading && ranking.length > 0 && (
        <>
          {/* Gráfico Meta x Resultado — Receita */}
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-base font-bold text-zinc-900">Meta × Resultado</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Receita realizada vs meta de receita por gestor</p>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart
                data={chartData}
                margin={{ top: 28, right: 20, left: 10, bottom: 8 }}
                barCategoryGap="35%"
              >
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#f4f4f5" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#52525b", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtK}
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                  formatter={(value) =>
                    value === "receita_total" ? "Resultado" : "Meta"
                  }
                />

                {/* Barras — Resultado */}
                <Bar dataKey="receita_total" name="receita_total" maxBarSize={52} radius={[6, 6, 0, 0]}>
                  {chartData.map((g) => {
                    const pct = g.percentual_medio_meta;
                    const fill = !g.tem_meta
                      ? "#d4d4d8"
                      : pct >= 100
                      ? "#10b981"
                      : pct >= 70
                      ? "#f59e0b"
                      : "#f87171";
                    return <Cell key={g.gestor_id} fill={fill} />;
                  })}
                  <LabelList content={<CustomLabel />} />
                </Bar>

                {/* Linha — Meta (só renderiza se houver meta_receita_total) */}
                {temMeta && (
                  <Line
                    dataKey="meta_receita_total"
                    name="meta_receita_total"
                    type="monotone"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 7 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legenda de cores das barras */}
            <div className="flex items-center gap-5 mt-4 flex-wrap">
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Cor das barras:</span>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-emerald-500 inline-block" />
                <span className="text-xs text-zinc-500">Meta batida (≥ 100%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-amber-400 inline-block" />
                <span className="text-xs text-zinc-500">Próximo (70–99%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-red-400 inline-block" />
                <span className="text-xs text-zinc-500">Abaixo da meta (&lt; 70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-zinc-300 inline-block" />
                <span className="text-xs text-zinc-500">Sem meta definida</span>
              </div>
            </div>
          </div>

          {/* Gráfico Pontos — ranking final */}
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-base font-bold text-zinc-900">Pontuação Final</h2>
              <p className="text-xs text-zinc-400 mt-0.5">1 ponto = 1 farmácia com meta batida no período</p>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart
                data={chartData}
                margin={{ top: 28, right: 20, left: 0, bottom: 8 }}
                barCategoryGap="35%"
              >
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#f4f4f5" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#52525b", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: "#f9fafb" }}
                  formatter={(v: number) => [`${v} ${v === 1 ? "ponto" : "pontos"}`, "Pontuação"]}
                  labelFormatter={(l) => l}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e4e4e7" }}
                />

                {/* Linha de metas possíveis */}
                <Line
                  dataKey="farmacias_com_meta"
                  name="farmacias_com_meta"
                  type="monotone"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                  legendType="none"
                />

                <Bar dataKey="pontos" name="pontos" maxBarSize={52} radius={[6, 6, 0, 0]}>
                  {chartData.map((g) => (
                    <Cell
                      key={g.gestor_id}
                      fill={g.pontos > 0 ? "#10b981" : "#fca5a5"}
                    />
                  ))}
                  <LabelList
                    dataKey="pontos"
                    position="top"
                    style={{ fontSize: 13, fontWeight: 700, fill: "#18181b" }}
                    formatter={(v: number) => `${v} pt${v !== 1 ? "s" : ""}`}
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-zinc-400 mt-2">
              Linha pontilhada = total de farmácias com meta cadastrada (potencial máximo de pontos)
            </p>
          </div>
        </>
      )}
    </AppShell>
  );
}
