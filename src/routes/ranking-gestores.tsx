import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Target, CalendarDays, TrendingUp, Star } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import {
  getRankingGestores,
  getRankingHistorico,
  type RankingGestor,
  type RankingHistoricoEntry,
} from "@/lib/api";

export const Route = createFileRoute("/ranking-gestores")({
  component: RankingGestoresPage,
  head: () => ({ meta: [{ title: "Ranking de Gestores — PharmaFlow" }] }),
});

// ── Utilitários ────────────────────────────────────────────────────────────

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// Gera opções de mês: mês atual + 11 anteriores
function gerarOpcoesMes(): { label: string; value: string }[] {
  const opcoes: { label: string; value: string }[] = [
    { label: "Mês atual", value: "" },
  ];
  const agora = new Date();
  for (let i = 1; i <= 11; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opcoes.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value });
  }
  return opcoes;
}

// Pivota histórico: [{ mes, NomeGestor1: pontos, NomeGestor2: pontos }]
function pivotarHistorico(historico: RankingHistoricoEntry[]) {
  const gestores = [...new Map(historico.map((h) => [h.gestor_id, h.gestor_nome])).entries()].map(
    ([id, nome]) => ({ id, nome }),
  );
  const meses = [...new Set(historico.map((h) => h.mes))].sort();

  const data = meses.map((mes) => {
    const entry: Record<string, number | string> = {
      mes: mes.slice(0, 7), // "YYYY-MM"
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

const LINHA_CORES = [
  "#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899",
  "#8b5cf6", "#14b8a6", "#f97316",
];

// ── Componentes ────────────────────────────────────────────────────────────

function MedalCell({ posicao }: { posicao: number }) {
  if (posicao <= 3) return <span className="text-xl">{MEDAL[posicao]}</span>;
  return (
    <span className="size-7 rounded-full bg-zinc-100 text-zinc-500 text-xs font-bold grid place-items-center">
      {posicao}
    </span>
  );
}

function TaxaBar({ value, temMeta }: { value: number; temMeta: boolean }) {
  if (!temMeta) return <span className="text-xs text-zinc-400 italic">—</span>;
  const cor = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold text-zinc-700 tabular-nums">{value.toFixed(1)}%</span>
    </div>
  );
}

function PontosChip({ pontos, temMeta }: { pontos: number; temMeta: boolean }) {
  if (!temMeta) return <span className="text-xs text-zinc-400 italic">Sem meta</span>;
  const cor = pontos > 0
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-red-50 text-red-500 ring-red-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold ring-1 ${cor}`}>
      <Star className="size-3 fill-current" />
      {pontos}
    </span>
  );
}

function TabelaRanking({ ranking }: { ranking: RankingGestor[] }) {
  if (ranking.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Nenhum dado para o período selecionado.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/70">
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider w-12">#</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Gestor</th>
            <th className="px-5 py-3 text-center text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Pontos ★</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Metas batidas</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Taxa de acerto</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">% Médio meta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {ranking.map((g) => (
            <tr
              key={g.gestor_id}
              className={`transition-colors hover:bg-zinc-50 ${g.posicao === 1 ? "bg-amber-50/40" : ""}`}
            >
              <td className="px-5 py-4">
                <MedalCell posicao={g.posicao} />
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold shrink-0">
                    {g.gestor_nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{g.gestor_nome}</p>
                    <p className="text-[10px] text-zinc-400">{g.total_farmacias} farmácias</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-center">
                <PontosChip pontos={g.pontos} temMeta={g.tem_meta} />
              </td>
              <td className="px-5 py-4 text-zinc-700">
                <span className="font-semibold">{g.farmacias_meta_ok}</span>
                <span className="text-zinc-400"> / {g.farmacias_com_meta}</span>
              </td>
              <td className="px-5 py-4">
                <TaxaBar value={g.taxa_acerto} temMeta={g.tem_meta} />
              </td>
              <td className="px-5 py-4">
                <TaxaBar value={g.percentual_medio_meta} temMeta={g.tem_meta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GraficoEvolucao({ historico }: { historico: RankingHistoricoEntry[] }) {
  const { data, gestores } = useMemo(() => pivotarHistorico(historico), [historico]);

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Sem dados de histórico disponíveis.
      </div>
    );
  }

  const maxPontos = Math.max(
    ...historico.map((h) => h.pontos),
    1,
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#f4f4f5" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#a1a1aa" }}
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
          label={{ value: "Pontos", angle: -90, position: "insideLeft", offset: 8, fontSize: 10, fill: "#a1a1aa" }}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e4e4e7", boxShadow: "0 4px 12px rgb(0 0 0 / .08)" }}
          formatter={(v: number, name: string) => [`${v} ${v === 1 ? "ponto" : "pontos"}`, name]}
          labelFormatter={(l) => `Mês: ${l}`}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
          iconType="circle"
          iconSize={8}
        />
        {gestores.map(({ nome }, i) => (
          <Line
            key={nome}
            type="monotone"
            dataKey={nome}
            stroke={LINHA_CORES[i % LINHA_CORES.length]}
            strokeWidth={2.5}
            dot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: LINHA_CORES[i % LINHA_CORES.length] }}
            activeDot={{ r: 7 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

function RankingGestoresPage() {
  const opcoesMes = useMemo(gerarOpcoesMes, []);
  const [mesSelecionado, setMesSelecionado] = useState("");

  const { data: ranking = [], isLoading: loadingRanking } = useQuery({
    queryKey: ["ranking-gestores", mesSelecionado],
    queryFn: () => getRankingGestores(mesSelecionado || undefined),
  });

  const { data: historico = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ["ranking-historico"],
    queryFn: getRankingHistorico,
    staleTime: 5 * 60_000,
  });

  // Cards de resumo do mês selecionado
  const totalPontos = ranking.reduce((s, g) => s + g.pontos, 0);
  const lider = ranking[0];

  return (
    <AppShell title="Ranking de Gestores">
      {/* Banner critério */}
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-start gap-3">
        <Target className="size-5 text-brand shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-brand">1 ponto por farmácia que bate a meta</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Faturamento <strong>não</strong> conta. Apenas farmácias que atingiram a meta somam pontos ao gestor.
          </p>
        </div>
      </div>

      {/* Dropdown de mês */}
      <div className="flex items-center gap-3">
        <CalendarDays className="size-4 text-zinc-400" />
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Período:</label>
        <select
          value={mesSelecionado}
          onChange={(e) => setMesSelecionado(e.target.value)}
          className="text-sm font-medium text-zinc-900 bg-white border border-zinc-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        >
          {opcoesMes.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Cards de resumo */}
      {!loadingRanking && ranking.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Líder do período</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl">🥇</span>
              <div>
                <p className="font-bold text-zinc-900">{lider.gestor_nome}</p>
                <p className="text-xs text-zinc-400">{lider.pontos} {lider.pontos === 1 ? "ponto" : "pontos"}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total de pontos distribuídos</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{totalPontos}</p>
            <p className="text-xs text-zinc-400 mt-0.5">farmácias que bateram a meta</p>
          </div>
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Média de acerto</p>
            <p className="text-3xl font-extrabold text-brand mt-2">
              {ranking.length > 0
                ? (ranking.reduce((s, g) => s + g.taxa_acerto, 0) / ranking.length).toFixed(1)
                : "0"}%
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">entre todos os gestores</p>
          </div>
        </div>
      )}

      {/* Tabela de ranking */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
          <Trophy className="size-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Classificação</h2>
          {mesSelecionado && (
            <span className="ml-auto text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
              {opcoesMes.find((o) => o.value === mesSelecionado)?.label}
            </span>
          )}
        </div>
        {loadingRanking ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-zinc-50 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <TabelaRanking ranking={ranking} />
        )}
      </div>

      {/* Gráfico de evolução */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
          <TrendingUp className="size-4 text-brand" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Evolução por Gestor</h2>
            <p className="text-[10px] text-zinc-400">Pontos acumulados nos últimos meses</p>
          </div>
        </div>
        <div className="p-6">
          {loadingHistorico ? (
            <div className="h-64 bg-zinc-50 rounded animate-pulse" />
          ) : (
            <GraficoEvolucao historico={historico} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
