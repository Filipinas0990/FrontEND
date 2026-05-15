import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

function barColor(pontos: number, temMeta: boolean) {
  if (!temMeta) return "#e4e4e7";
  if (pontos === 0) return "#fca5a5";
  if (pontos >= 3) return "#10b981";
  return "#34d399";
}

function CustomTooltipPontos({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const g: RankingGestor = payload[0].payload;
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-md p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-zinc-900 text-sm">
        {MEDAL[g.posicao] ?? `#${g.posicao}`} {g.gestor_nome}
      </p>
      <div className="border-t border-zinc-100 pt-1 space-y-0.5">
        <p className="text-zinc-700"><span className="font-semibold text-emerald-600">{g.pontos}</span> {g.pontos === 1 ? "ponto" : "pontos"}</p>
        <p className="text-zinc-500">{g.farmacias_meta_ok} / {g.farmacias_com_meta} farmácias bateram a meta</p>
        <p className="text-zinc-500">Taxa de acerto: <span className="font-medium">{g.taxa_acerto.toFixed(1)}%</span></p>
        <p className="text-zinc-500">% médio da meta: <span className="font-medium">{g.percentual_medio_meta.toFixed(1)}%</span></p>
      </div>
    </div>
  );
}

function CustomTooltipAcerto({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const g: RankingGestor = payload[0].payload;
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-md p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-zinc-900 text-sm">
        {MEDAL[g.posicao] ?? `#${g.posicao}`} {g.gestor_nome}
      </p>
      <div className="border-t border-zinc-100 pt-1 space-y-0.5">
        <p className="text-zinc-700">% médio: <span className="font-semibold text-brand">{g.percentual_medio_meta.toFixed(1)}%</span></p>
        <p className="text-zinc-500">Taxa de acerto: {g.taxa_acerto.toFixed(1)}%</p>
      </div>
    </div>
  );
}

function RankingPage() {
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["ranking-gestores"],
    queryFn: getRankingGestores,
  });

  const chartHeight = Math.max(ranking.length * 60, 200);

  const labelNome = (entry: RankingGestor) =>
    `${MEDAL[entry.posicao] ?? `#${entry.posicao}`} ${entry.gestor_nome}`;

  return (
    <AppShell title="Ranking de Gestores">
      {/* Critério */}
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-start gap-3">
        <Target className="size-5 text-brand shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-brand">1 ponto por farmácia que bate a meta</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Cada farmácia tem sua própria meta. Quando bate, o gestor ganha 1 ponto.
            Faturamento <strong>não</strong> conta — só metas batidas.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 h-72 animate-pulse" />
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
          {/* Gráfico principal — Pontos */}
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">Pontuação por Gestor</h2>
              <p className="text-xs text-zinc-400 mt-0.5">1 ponto = 1 farmácia com meta batida</p>
            </div>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={ranking}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
                barCategoryGap="30%"
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Pontos", position: "insideBottomRight", offset: -4, fontSize: 10, fill: "#a1a1aa" }}
                />
                <YAxis
                  type="category"
                  dataKey={(entry: RankingGestor) => labelNome(entry)}
                  width={130}
                  tick={{ fontSize: 13, fill: "#18181b", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltipPontos />} cursor={{ fill: "#f4f4f5" }} />
                <Bar dataKey="pontos" radius={[0, 6, 6, 0]} maxBarSize={36}>
                  {ranking.map((g) => (
                    <Cell key={g.gestor_id} fill={barColor(g.pontos, g.tem_meta)} />
                  ))}
                  <LabelList
                    dataKey="pontos"
                    position="right"
                    style={{ fontSize: 13, fontWeight: 700, fill: "#18181b" }}
                    formatter={(v: number) => v === 0 ? "0 pts" : `${v} ${v === 1 ? "pt" : "pts"}`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico secundário — % Médio da meta */}
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">% Médio Atingido da Meta</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Média de quanto cada gestor chegou na meta de suas farmácias</p>
            </div>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={ranking}
                layout="vertical"
                margin={{ top: 4, right: 70, left: 0, bottom: 4 }}
                barCategoryGap="30%"
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey={(entry: RankingGestor) => labelNome(entry)}
                  width={130}
                  tick={{ fontSize: 13, fill: "#18181b", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltipAcerto />} cursor={{ fill: "#f4f4f5" }} />
                <Bar dataKey="percentual_medio_meta" radius={[0, 6, 6, 0]} maxBarSize={36} fill="#6366f1">
                  {ranking.map((g) => (
                    <Cell
                      key={g.gestor_id}
                      fill={
                        !g.tem_meta ? "#e4e4e7"
                        : g.percentual_medio_meta >= 100 ? "#10b981"
                        : g.percentual_medio_meta >= 70 ? "#6366f1"
                        : "#f59e0b"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="percentual_medio_meta"
                    position="right"
                    style={{ fontSize: 12, fontWeight: 600, fill: "#52525b" }}
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda de cores */}
          <div className="flex items-center gap-5 px-1 flex-wrap">
            <span className="text-xs text-zinc-400 font-medium">Legenda:</span>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-emerald-500 inline-block" />
              <span className="text-xs text-zinc-500">Meta batida (≥ 3 pts)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-emerald-300 inline-block" />
              <span className="text-xs text-zinc-500">Parcial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-red-300 inline-block" />
              <span className="text-xs text-zinc-500">Nenhuma meta batida</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-zinc-200 inline-block" />
              <span className="text-xs text-zinc-500">Sem meta cadastrada</span>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
