import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { getPainel, getGestores, getFarmacias } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { usePeriod } from "@/contexts/PeriodContext";
import { PeriodSelector } from "@/components/PeriodSelector";
import { PeriodBadge } from "@/components/PeriodBadge";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GrupoSymbol — Painel de Performance" },
      { name: "description", content: "Painel de performance para farmácias." },
    ],
  }),
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function alertColor(nivel: string) {
  if (nivel === "vermelho") return "bg-red-50 text-red-700 ring-red-600/10";
  if (nivel === "amarelo") return "bg-amber-50 text-amber-700 ring-amber-600/10";
  return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
}
function alertLabel(nivel: string) {
  if (nivel === "vermelho") return "Alerta";
  if (nivel === "amarelo") return "Atenção";
  return "Ativa";
}

function Index() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const [gestorId, setGestorId] = useState<number | undefined>();
  const { period, setPeriod } = usePeriod();

  const { data: painel, isLoading: loadingPainel, isFetching: fetchingPainel } = useQuery({
    queryKey: ["painel", gestorId, period],
    queryFn: () => getPainel(gestorId, period),
  });

  const { data: gestores = [] } = useQuery({
    queryKey: ["gestores"],
    queryFn: getGestores,
    enabled: admin,
  });

  const { data: farmacias = [], isLoading: loadingFarmacias } = useQuery({
    queryKey: ["farmacias", undefined, undefined, gestorId, period],
    queryFn: () => getFarmacias(gestorId ? { gestor_id: gestorId, dias: period } : { dias: period }),
    select: (data) =>
      [...data].sort((a, b) => b.score_criticidade - a.score_criticidade).slice(0, 8),
  });

  const kpis = painel
    ? [
        {
          label: "Receita Total",
          value: fmtBRL(painel.receita_total),
          icon: DollarSign,
          color: "text-brand",
        },
        {
          label: "Total de Atendimentos",
          value: painel.total_atendimentos.toLocaleString("pt-BR"),
          icon: Users,
          color: "text-accent-blue",
        },
        {
          label: "Vendas Realizadas",
          value: painel.vendas_realizadas.toLocaleString("pt-BR"),
          icon: ShoppingCart,
          color: "text-brand",
        },
        {
          label: "Taxa de Conversão",
          value: `${(painel.taxa_conversao_media ?? 0).toFixed(1)}%`,
          icon: TrendingUp,
          color: "text-brand",
        },
      ]
    : [];

  return (
    <AppShell title="Painel de Performance">
      {/* Gestor filter (admin only) */}
      {admin && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Filtrar por Gestor
          </label>
          <select
            value={gestorId ?? ""}
            onChange={(e) => setGestorId(e.target.value ? Number(e.target.value) : undefined)}
            className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Todos</option>
            {gestores.filter((g) => !g.is_admin).map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Seletor global de período ── */}
      <PeriodSelector
        value={period}
        onChange={setPeriod}
        loading={fetchingPainel && !loadingPainel}
      />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {loadingPainel
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl ring-1 ring-black/5 h-24 animate-pulse" />
            ))
          : kpis.map((k) => (
              <div
                key={k.label}
                className="bg-white p-6 rounded-xl ring-1 ring-black/5 shadow-sm space-y-2 transition-opacity duration-300"
                style={{ opacity: fetchingPainel ? 0.6 : 1 }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-medium">{k.label}</span>
                  <k.icon className={`size-4 ${k.color}`} />
                </div>
                <div className="text-2xl font-semibold tracking-tight">{k.value}</div>
                <div className="flex justify-end">
                  <PeriodBadge dias={period} />
                </div>
              </div>
            ))}
      </section>

      {/* Alert badges */}
      {painel && (
        <section className="grid grid-cols-3 gap-4">
          <AlertCard
            label="Farmácias em Alerta"
            value={painel.farmacias_alerta}
            total={painel.farmacias_ativas}
            color="red"
          />
          <AlertCard
            label="Farmácias em Atenção"
            value={painel.farmacias_atencao}
            total={painel.farmacias_ativas}
            color="amber"
          />
          <div className="bg-white p-5 rounded-xl ring-1 ring-black/5 shadow-sm flex flex-col justify-between">
            <span className="text-xs text-zinc-500 font-medium">Última Atualização</span>
            <div className="flex items-center gap-2 mt-2">
              <Clock className="size-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-900">
                {painel.ultima_atualizacao ? fmtDate(painel.ultima_atualizacao) : "—"}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              {painel.farmacias_ativas} farmácias ativas
            </div>
          </div>
        </section>
      )}

      {/* Top farmácias table */}
      <section className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-zinc-400" />
            Farmácias em Destaque (por criticidade)
            <PeriodBadge dias={period} />
          </h3>
          <button
            onClick={() => navigate({ to: "/farmacias" })}
            className="text-[10px] font-semibold text-brand hover:underline"
          >
            VER TODAS
          </button>
        </div>
        {loadingFarmacias ? (
          <div className="p-8 text-center text-sm text-zinc-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Farmácia</th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#4285F4] inline-block shrink-0" />
                      Google
                    </span>
                    <span className="text-[9px] font-normal text-zinc-400 normal-case tracking-normal">cliques · conv%</span>
                  </th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#1877F2] inline-block shrink-0" />
                      Meta / FB
                    </span>
                    <span className="text-[9px] font-normal text-zinc-400 normal-case tracking-normal">cliques · conv%</span>
                  </th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {farmacias.map((p) => {
                  const google = p.canais?.find((c) => c.nome.toLowerCase().includes("google"));
                  const meta   = p.canais?.find((c) => c.nome.toLowerCase().includes("meta") || c.nome.toLowerCase().includes("facebook"));
                  const gConv  = google?.vendas != null && (google.atendimentos ?? 0) > 0
                    ? ((google.vendas / google.atendimentos) * 100).toFixed(1)
                    : null;
                  const mConv  = meta?.vendas != null && (meta.atendimentos ?? 0) > 0
                    ? ((meta.vendas / meta.atendimentos) * 100).toFixed(1)
                    : null;

                  return (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-50/50 cursor-pointer"
                    onClick={() => navigate({ to: "/farmacias/$id", params: { id: String(p.id) } })}
                  >
                    <td className="px-6 py-3 text-xs text-zinc-400 font-mono">{p.posicao_ranking}</td>
                    <td className="px-6 py-3 text-sm font-medium text-zinc-900">{p.nome}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${alertColor(p.nivel_alerta)}`}>
                        {alertLabel(p.nivel_alerta)}
                      </span>
                    </td>
                    {/* Google */}
                    <td className="px-6 py-3">
                      {google ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-zinc-800">{(google.atendimentos ?? 0).toLocaleString("pt-BR")}</span>
                          <span className="text-[11px] font-semibold text-[#4285F4]">{gConv != null ? `${gConv}%` : "—"}</span>
                        </div>
                      ) : <span className="text-xs text-zinc-300">—</span>}
                    </td>
                    {/* Meta / Facebook */}
                    <td className="px-6 py-3">
                      {meta ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-zinc-800">{(meta.atendimentos ?? 0).toLocaleString("pt-BR")}</span>
                          <span className="text-[11px] font-semibold text-[#1877F2]">{mConv != null ? `${mConv}%` : "—"}</span>
                        </div>
                      ) : <span className="text-xs text-zinc-300">—</span>}
                    </td>
                    {/* Variação */}
                    <td className="px-6 py-3">
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${p.variacao_atendimentos >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {p.variacao_atendimentos >= 0
                          ? <TrendingUp className="size-3" />
                          : <TrendingDown className="size-3" />}
                        {Math.abs(p.variacao_atendimentos).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {farmacias.length === 0 && (
              <div className="p-8 text-center text-sm text-zinc-500">Nenhuma farmácia encontrada.</div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function AlertCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: "red" | "amber";
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const barColor = color === "red" ? "bg-red-500" : "bg-amber-400";
  const textColor = color === "red" ? "text-red-600" : "text-amber-600";
  const bgColor = color === "red" ? "bg-red-50" : "bg-amber-50";

  return (
    <div className={`p-5 rounded-xl ring-1 ring-black/5 shadow-sm ${bgColor}`}>
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <div className={`text-3xl font-bold mt-1 ${textColor}`}>{value}</div>
      <div className="mt-3 h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-zinc-500 mt-1.5">{pct}% do total</p>
    </div>
  );
}
