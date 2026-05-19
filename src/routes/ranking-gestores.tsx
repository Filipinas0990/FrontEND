import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Target, TrendingUp } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList, Legend,
  LineChart, ReferenceLine,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import {
  getRankingGestores, getRankingHistorico,
  type RankingGestor, type RankingHistoricoEntry,
} from "@/lib/api";

export const Route = createFileRoute("/ranking-gestores")({
  component: RankingGestoresPage,
  head: () => ({ meta: [{ title: "Ranking de Gestores — PharmaFlow" }] }),
});

// ── Cores ──────────────────────────────────────────────────────────────────

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309", "#10b981", "#6366f1", "#3b82f6", "#ec4899", "#14b8a6"];
const LINE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

function rankColor(posicao: number) {
  return RANK_COLORS[(posicao - 1) % RANK_COLORS.length];
}

// ── Utilitários ────────────────────────────────────────────────────────────

function gerarOpcoesMes() {
  const opcoes = [{ label: "Mês atual", value: "" }];
  const agora = new Date();
  for (let i = 1; i <= 11; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opcoes.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value });
  }
  return opcoes;
}

function pivotarHistorico(historico: RankingHistoricoEntry[]) {
  const gestoresMap = new Map<number, string>();
  historico.forEach((h) => gestoresMap.set(h.gestor_id, h.gestor_nome));
  const gestores = [...gestoresMap.entries()].map(([id, nome]) => ({ id, nome }));
  const meses = [...new Set(historico.map((h) => h.mes))].sort();

  const data = meses.map((mes) => {
    const entry: Record<string, number | string> = {
      mes,
      label: new Date(mes + "-02").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    };
    gestores.forEach(({ id, nome }) => {
      const found = historico.find((h) => h.mes === mes && h.gestor_id === id);
      entry[nome] = found?.pontos ?? 0;
    });
    return entry;
  });

  return { data, gestores };
}

// ── Tooltips ───────────────────────────────────────────────────────────────

function TooltipPontos({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const g: RankingGestor = payload[0].payload;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-lg p-4 text-xs min-w-[180px]">
      <p className="font-bold text-zinc-900 text-sm mb-2">{g.gestor_nome}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-zinc-500">Pontos</span>
          <span className="font-bold text-emerald-600">{g.pontos}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-zinc-500">Metas batidas</span>
          <span className="font-semibold">{g.farmacias_meta_ok}/{g.farmacias_com_meta}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-zinc-500">Taxa acerto</span>
          <span className="font-semibold">{(g.taxa_acerto ?? 0).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-zinc-500">% médio meta</span>
          <span className="font-semibold">{(g.percentual_medio_meta ?? 0).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function TooltipAcerto({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const g: RankingGestor = payload[0].payload;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-zinc-900 mb-1">{g.gestor_nome}</p>
      <div className="flex justify-between gap-4">
        <span className="text-zinc-500">Taxa acerto</span>
        <span className="font-bold text-brand">{(g.taxa_acerto ?? 0).toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-4 mt-0.5">
        <span className="text-zinc-500">% médio meta</span>
        <span className="font-semibold">{(g.percentual_medio_meta ?? 0).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function TooltipEvolucao({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-zinc-500 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-6">
          <span style={{ color: p.stroke }} className="font-medium">{p.dataKey}</span>
          <span className="font-bold text-zinc-900">{p.value} {p.value === 1 ? "pt" : "pts"}</span>
        </div>
      ))}
    </div>
  );
}

// ── Gráficos ───────────────────────────────────────────────────────────────

function GraficoPontos({ ranking }: { ranking: RankingGestor[] }) {
  const data = [...ranking].sort((a, b) => a.posicao - b.posicao);
  const maxPontos = Math.max(...data.map((g) => g.pontos), 1);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 28, right: 20, left: 0, bottom: 4 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#f4f4f5" />
        <XAxis
          dataKey="gestor_nome"
          tick={{ fontSize: 13, fill: "#3f3f46", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          domain={[0, maxPontos + 1]}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<TooltipPontos />} cursor={{ fill: "#f9fafb" }} />
        <Bar dataKey="pontos" radius={[8, 8, 0, 0]} maxBarSize={64}>
          {data.map((g) => (
            <Cell key={g.gestor_id} fill={rankColor(g.posicao)} />
          ))}
          <LabelList
            dataKey="pontos"
            position="top"
            style={{ fontSize: 14, fontWeight: 800, fill: "#18181b" }}
            formatter={(v: number) => `${v} ${v === 1 ? "pt" : "pts"}`}
          />
        </Bar>
        {/* Linha de potencial máximo */}
        <Line
          dataKey="farmacias_com_meta"
          type="monotone"
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
          name="Potencial máximo"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function GraficoAcerto({ ranking }: { ranking: RankingGestor[] }) {
  const data = [...ranking]
    .filter((g) => g.tem_meta)
    .sort((a, b) => b.taxa_acerto - a.taxa_acerto);

  if (data.length === 0) return (
    <div className="py-10 text-center text-sm text-zinc-400">Sem metas cadastradas.</div>
  );

  return (
    <ResponsiveContainer width="100%" height={data.length * 56 + 24}>
      <ComposedChart data={data} layout="vertical" margin={{ top: 4, right: 80, left: 0, bottom: 4 }} barCategoryGap="25%">
        <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="#f4f4f5" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="gestor_nome" width={80} tick={{ fontSize: 13, fill: "#3f3f46", fontWeight: 500 }} axisLine={false} tickLine={false} />
        <Tooltip content={<TooltipAcerto />} cursor={{ fill: "#f9fafb" }} />
        <ReferenceLine x={100} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "100%", position: "right", fontSize: 10, fill: "#10b981" }} />
        {/* Barra taxa acerto */}
        <Bar dataKey="taxa_acerto" name="Taxa de acerto" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((g) => (
            <Cell key={g.gestor_id} fill={(g.taxa_acerto ?? 0) >= 80 ? "#10b981" : (g.taxa_acerto ?? 0) >= 50 ? "#f59e0b" : "#f87171"} />
          ))}
          <LabelList
            dataKey="taxa_acerto"
            position="right"
            style={{ fontSize: 12, fontWeight: 700, fill: "#3f3f46" }}
            formatter={(v: number) => `${(v ?? 0).toFixed(1)}%`}
          />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function GraficoEvolucao({ historico }: { historico: RankingHistoricoEntry[] }) {
  const { data, gestores } = useMemo(() => pivotarHistorico(historico), [historico]);

  if (data.length === 0) return (
    <div className="py-10 text-center text-sm text-zinc-400">Sem histórico disponível.</div>
  );

  const maxPontos = Math.max(...historico.map((h) => h.pontos), 1);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#f4f4f5" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <YAxis
          allowDecimals={false}
          domain={[0, maxPontos + 1]}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          width={24}
        />
        <Tooltip content={<TooltipEvolucao />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} iconType="circle" iconSize={8} />
        {gestores.map(({ nome }, i) => (
          <Line
            key={nome}
            type="monotone"
            dataKey={nome}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: LINE_COLORS[i % LINE_COLORS.length] }}
            activeDot={{ r: 7 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-zinc-900" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-extrabold mt-2 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartPanel({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-start gap-2">
        {icon}
        <div>
          <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
          {subtitle && <p className="text-[10px] text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

import type React from "react";

function RankingGestoresPage() {
  const opcoesMes = useMemo(gerarOpcoesMes, []);
  const [mes, setMes] = useState("");

  const { data: ranking = [], isLoading: loadRanking } = useQuery({
    queryKey: ["ranking-gestores", mes],
    queryFn: () => getRankingGestores(mes || undefined),
  });

  const { data: historico = [], isLoading: loadHistorico } = useQuery({
    queryKey: ["ranking-historico"],
    queryFn: getRankingHistorico,
    staleTime: 5 * 60_000,
  });

  const lider = ranking[0];
  const totalPontos = ranking.reduce((s, g) => s + g.pontos, 0);
  const mediaAcerto = ranking.length
    ? ranking.reduce((s, g) => s + (g.taxa_acerto ?? 0), 0) / ranking.length
    : 0;

  return (
    <AppShell title="Ranking de Gestores">
      {/* Critério */}
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-center gap-3">
        <Target className="size-5 text-brand shrink-0" />
        <p className="text-sm text-zinc-700">
          <span className="font-bold text-brand">1 ponto</span> por farmácia que bate a meta — faturamento <strong>não</strong> conta.
        </p>
        {/* Seletor de mês */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <CalendarDays className="size-4 text-zinc-400" />
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-sm font-medium text-zinc-900 bg-white border border-zinc-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          >
            {opcoesMes.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      {!loadRanking && ranking.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="🥇 Líder do período"
            value={lider.gestor_nome}
            sub={`${lider.pontos} ${lider.pontos === 1 ? "ponto" : "pontos"}`}
            color="text-amber-500"
          />
          <StatCard
            label="Total de pontos"
            value={String(totalPontos)}
            sub="farmácias que bateram a meta"
            color="text-emerald-600"
          />
          <StatCard
            label="Média de acerto"
            value={`${(mediaAcerto ?? 0).toFixed(1)}%`}
            sub="entre todos os gestores"
            color="text-brand"
          />
        </div>
      )}

      {loadRanking && (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 bg-white rounded-xl ring-1 ring-black/5 animate-pulse" />)}
        </div>
      )}

      {/* Gráfico 1 — Pontos por gestor (barras + linha potencial) */}
      <ChartPanel
        title="Pontuação por Gestor"
        subtitle="Barras = pontos conquistados · Linha = potencial máximo (farmácias com meta)"
        icon={<span className="text-lg">🏆</span>}
      >
        {loadRanking
          ? <div className="h-72 bg-zinc-50 rounded-lg animate-pulse" />
          : ranking.length === 0
          ? <EmptyState />
          : <GraficoPontos ranking={ranking} />
        }
      </ChartPanel>

      {/* Gráfico 2 — Taxa de acerto horizontal */}
      <ChartPanel
        title="Taxa de Acerto por Gestor"
        subtitle="% das farmácias com meta que conseguiram bater — linha verde = 100%"
        icon={<Target className="size-4 text-brand mt-0.5" />}
      >
        {loadRanking
          ? <div className="h-48 bg-zinc-50 rounded-lg animate-pulse" />
          : ranking.length === 0
          ? <EmptyState />
          : <GraficoAcerto ranking={ranking} />
        }
      </ChartPanel>

      {/* Gráfico 3 — Evolução mensal */}
      <ChartPanel
        title="Evolução de Pontos — Últimos Meses"
        subtitle="Uma linha por gestor · Passe o mouse para ver detalhes"
        icon={<TrendingUp className="size-4 text-brand mt-0.5" />}
      >
        {loadHistorico
          ? <div className="h-72 bg-zinc-50 rounded-lg animate-pulse" />
          : <GraficoEvolucao historico={historico} />
        }
      </ChartPanel>

      {/* Legenda de cores das posições */}
      <div className="flex items-center gap-4 px-1 flex-wrap">
        <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Posições:</span>
        {["🥇 1º", "🥈 2º", "🥉 3º"].map((m, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm inline-block" style={{ background: RANK_COLORS[i] }} />
            <span className="text-xs text-zinc-500">{m}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-indigo-400 inline-block opacity-60" style={{ background: "#6366f1" }} />
          <span className="text-xs text-zinc-500">Linha pontilhada = potencial máximo</span>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <Target className="size-8 text-zinc-200 mx-auto mb-2" />
      <p className="text-sm text-zinc-400">Nenhuma meta cadastrada para este período.</p>
    </div>
  );
}
