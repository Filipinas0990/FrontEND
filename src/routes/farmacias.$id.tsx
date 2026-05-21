import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Users, Search, BarChart2, MessageCircle,
  ShoppingCart, DollarSign, TrendingUp, X, Maximize2, Settings,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getFarmacias, setFarmaciaMeta, type CanalData } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/farmacias/$id")({
  component: FarmaciaDetailPage,
  head: () => ({ meta: [{ title: "Farmácia — PharmaFlow" }] }),
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── Cores e estilos por canal ──────────────────────────────────────────────

const CANAL_COLORS: Record<string, string> = {
  google: "#3b82f6",
  meta: "#6366f1",
  grupos: "#10b981",
  "base de contatos": "#f59e0b",
  site: "#8b5cf6",
  "site novo": "#ec4899",
};

function canalHexColor(nome: string, idx: number): string {
  const key = nome.toLowerCase();
  for (const [k, v] of Object.entries(CANAL_COLORS)) {
    if (key.includes(k)) return v;
  }
  const fallbacks = ["#64748b", "#0ea5e9", "#f97316", "#14b8a6", "#a855f7"];
  return fallbacks[idx % fallbacks.length];
}

const CANAL_STYLE: Record<string, { icon: React.ElementType; color: string; bar: string; bg: string; ring: string }> = {
  google:             { icon: Search,        color: "text-blue-600",    bar: "bg-blue-500",    bg: "bg-blue-50",    ring: "ring-blue-200"    },
  meta:               { icon: BarChart2,     color: "text-indigo-600",  bar: "bg-indigo-500",  bg: "bg-indigo-50",  ring: "ring-indigo-200"  },
  grupos:             { icon: MessageCircle, color: "text-emerald-600", bar: "bg-emerald-500", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  site:               { icon: BarChart2,     color: "text-violet-600",  bar: "bg-violet-500",  bg: "bg-violet-50",  ring: "ring-violet-200"  },
  "base de contatos": { icon: BarChart2,     color: "text-zinc-600",    bar: "bg-zinc-400",    bg: "bg-zinc-100",   ring: "ring-zinc-300"    },
};

function canalStyle(nome: string) {
  const key = nome.toLowerCase();
  for (const [k, v] of Object.entries(CANAL_STYLE)) {
    if (key.includes(k)) return v;
  }
  return { icon: BarChart2, color: "text-zinc-500", bar: "bg-zinc-400", bg: "bg-zinc-50", ring: "ring-zinc-200" };
}

// ── Modal de detalhe do canal ──────────────────────────────────────────────

function CanalModal({
  canal,
  totalAtendimentos,
  todos,
  onClose,
}: {
  canal: CanalData;
  totalAtendimentos: number;
  todos: CanalData[];
  onClose: () => void;
}) {
  const s = canalStyle(canal.nome);
  const Icon = s.icon;
  const color = canalHexColor(canal.nome, todos.indexOf(canal));

  const pctAtend = totalAtendimentos > 0 ? (canal.atendimentos / totalAtendimentos) * 100 : 0;
  const taxaConv = canal.vendas != null && canal.atendimentos > 0
    ? (canal.vendas / canal.atendimentos) * 100
    : null;

  // Dado para o gráfico radial de participação
  const radialData = [
    { name: canal.nome, value: Math.round(pctAtend), fill: color },
  ];

  // Dado para o gráfico de barras comparativo (esse canal vs restante)
  const barData = [
    { nome: "Atendimentos", valor: canal.atendimentos, outros: totalAtendimentos - canal.atendimentos },
    ...(canal.vendas != null
      ? [{
          nome: "Vendas",
          valor: canal.vendas,
          outros: todos.reduce((s, c) => s + (c.vendas ?? 0), 0) - canal.vendas,
        }]
      : []),
  ];

  // Comparativo de conversão entre canais
  const convData = todos
    .filter((c) => c.vendas != null && c.atendimentos > 0)
    .map((c) => ({
      nome: c.nome.length > 10 ? c.nome.slice(0, 10) + "…" : c.nome,
      taxa: parseFloat(((c.vendas! / c.atendimentos) * 100).toFixed(1)),
      destaque: c.nome === canal.nome,
    }))
    .sort((a, b) => b.taxa - a.taxa);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${s.bg} rounded-t-2xl p-6 flex items-start justify-between`}>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/70 grid place-items-center shadow-sm">
              <Icon className={`size-5 ${s.color}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">{canal.nome}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Detalhes do canal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-white/60 hover:bg-white grid place-items-center transition-colors"
          >
            <X className="size-4 text-zinc-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiBox label="Atendimentos" value={canal.atendimentos.toLocaleString("pt-BR")} color={s.color} />
            <KpiBox label="Participação" value={`${pctAtend.toFixed(1)}%`} color={s.color} />
            {canal.vendas != null && (
              <KpiBox label="Vendas" value={canal.vendas.toLocaleString("pt-BR")} color={s.color} />
            )}
            {taxaConv != null && (
              <KpiBox label="Conversão" value={`${taxaConv.toFixed(1)}%`} color={s.color} highlight />
            )}
          </div>

          {canal.receita_vendas != null && (
            <div className={`${s.bg} rounded-xl p-4 flex items-center justify-between`}>
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <DollarSign className="size-4" /> Receita gerada por este canal
              </div>
              <span className="text-xl font-bold text-zinc-900">{fmtBRL(canal.receita_vendas)}</span>
            </div>
          )}

          {/* Gráfico radial — participação */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Participação no total</p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={110} height={110}>
                  <RadialBarChart
                    innerRadius={30}
                    outerRadius={52}
                    data={radialData}
                    startAngle={90}
                    endAngle={90 - 360 * (pctAtend / 100)}
                  >
                    <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#e4e4e7" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div>
                  <p className="text-3xl font-extrabold" style={{ color }}>{pctAtend.toFixed(0)}%</p>
                  <p className="text-xs text-zinc-400 mt-0.5">dos atendimentos</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {canal.atendimentos.toLocaleString("pt-BR")} de {totalAtendimentos.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>

            {/* Barra de progresso visual */}
            <div className="bg-zinc-50 rounded-xl p-4 flex flex-col justify-center gap-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">vs outros canais</p>
              {barData.map((d) => {
                const total = d.valor + d.outros;
                const pct = total > 0 ? (d.valor / total) * 100 : 0;
                return (
                  <div key={d.nome}>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>{d.nome}</span>
                      <span className="font-semibold" style={{ color }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráfico de conversão comparativo entre canais */}
          {convData.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider">Taxa de conversão — todos os canais</p>
              <ResponsiveContainer width="100%" height={convData.length * 38 + 16}>
                <BarChart
                  data={convData}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis type="number" hide domain={[0, "auto"]} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={100}
                    tick={{ fontSize: 12, fill: "#52525b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Conversão"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
                    cursor={{ fill: "#f4f4f5" }}
                  />
                  <Bar dataKey="taxa" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {convData.map((d, i) => (
                      <Cell key={i} fill={d.destaque ? color : "#d4d4d8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiBox({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 text-center ${highlight ? "bg-brand/5 ring-1 ring-brand/20" : "bg-zinc-50"}`}>
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-extrabold ${highlight ? "text-brand" : color}`}>{value}</p>
    </div>
  );
}

// ── Meta de Leads ──────────────────────────────────────────────────────────

function leadsDetailStatus(pct: number) {
  if (pct >= 100) return { emoji: "✅", text: "Meta atingida! +1 ponto", color: "text-emerald-600", bar: "bg-emerald-500" };
  if (pct >= 70)  return { emoji: "🟡", text: "Quase lá!",               color: "text-amber-500",   bar: "bg-amber-500"   };
  if (pct >= 40)  return { emoji: "🟠", text: "Em progresso",            color: "text-orange-500",  bar: "bg-orange-500"  };
  return               { emoji: "🔴", text: "Abaixo da meta",           color: "text-red-500",     bar: "bg-red-500"     };
}

function LeadsMetaRow({ canal, atual, meta }: { canal: string; atual: number; meta: number }) {
  const pct = meta > 0 ? (atual / meta) * 100 : 0;
  const s = leadsDetailStatus(pct);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-700">{canal}</span>
        <span className={`text-xs font-medium ${s.color}`}>{s.emoji} {s.text}</span>
      </div>
      <p className="text-[11px] text-zinc-500">{atual} leads de {meta} necessários</p>
      <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-[10px] text-zinc-400">{pct.toFixed(0)}%</p>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

function FarmaciaDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const farmaciaId = Number(id);
  const admin = isAdmin();
  const qc = useQueryClient();

  const [canalAberto, setCanalAberto] = useState<CanalData | null>(null);
  const [editLeadsOpen, setEditLeadsOpen] = useState(false);
  const [leadsGoogle, setLeadsGoogle] = useState("");
  const [leadsMeta, setLeadsMeta] = useState("");

  const { data: farmacias = [] } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias(),
    staleTime: 60_000,
  });
  const farmacia = farmacias.find((f) => f.id === farmaciaId);

  const saveLeadsMutation = useMutation({
    mutationFn: () =>
      setFarmaciaMeta(farmaciaId, {
        meta_leads_google: leadsGoogle ? Number(leadsGoogle) : null,
        meta_leads_meta: leadsMeta ? Number(leadsMeta) : null,
      }),
    onSuccess: () => {
      toast.success("Metas de leads atualizadas!");
      qc.invalidateQueries({ queryKey: ["farmacias"] });
      setEditLeadsOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openEditLeads() {
    setLeadsGoogle(farmacia?.meta_leads_google != null ? String(farmacia.meta_leads_google) : "");
    setLeadsMeta(farmacia?.meta_leads_meta != null ? String(farmacia.meta_leads_meta) : "");
    setEditLeadsOpen(true);
  }

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
      {/* Receita total */}
      {farmacia && (
        <section className="grid grid-cols-1 gap-4 max-w-xs">
          <MetricCard
            label="Receita Total"
            value={fmtBRL(farmacia.receita_total)}
            delta={farmacia.variacao_receita != null ? `${farmacia.variacao_receita >= 0 ? "+" : ""}${farmacia.variacao_receita.toFixed(1)}% vs semana anterior` : undefined}
            positive={farmacia.variacao_receita != null ? farmacia.variacao_receita >= 0 : undefined}
          />
        </section>
      )}

      {/* Meta de desempenho */}
      {farmacia && farmacia.meta_receita != null && (
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Meta de Desempenho</h3>
          <div className="max-w-sm">
            {farmacia.percentual_meta_receita != null && (
              <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-zinc-500">Meta Receita</span>
                  <span className={`text-xs font-semibold ${farmacia.atingiu_meta ? "text-emerald-600" : "text-red-500"}`}>
                    {farmacia.percentual_meta_receita.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${farmacia.atingiu_meta ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(farmacia.percentual_meta_receita, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400">
                  {fmtBRL(farmacia.receita_total)} / {fmtBRL(farmacia.meta_receita)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Meta de Leads */}
      {farmacia && (farmacia.meta_leads_google !== null || farmacia.meta_leads_meta !== null) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Meta de Leads — Semana Atual</h3>
            {admin && (
              <button
                onClick={openEditLeads}
                className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900"
              >
                <Settings className="size-3" /> Configurar metas de leads
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 space-y-4 max-w-sm">
            {farmacia.meta_leads_google !== null && (
              <LeadsMetaRow
                canal="Google"
                atual={farmacia.canais?.find((c) => c.nome.toLowerCase().includes("google"))?.atendimentos ?? 0}
                meta={farmacia.meta_leads_google}
              />
            )}
            {farmacia.meta_leads_meta !== null && (
              <LeadsMetaRow
                canal="Meta/Facebook"
                atual={farmacia.canais?.find((c) => c.nome.toLowerCase().includes("meta"))?.atendimentos ?? 0}
                meta={farmacia.meta_leads_meta}
              />
            )}
            <p className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100">
              ⚠️ Os dados são da última coleta da semana. A meta é avaliada ao rodar a automação.
            </p>
          </div>
        </section>
      )}

      {/* Botão configurar leads (admin, sem meta configurada) */}
      {farmacia && admin && farmacia.meta_leads_google === null && farmacia.meta_leads_meta === null && (
        <section>
          <button
            onClick={openEditLeads}
            className="flex items-center gap-2 py-2 px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-md hover:bg-zinc-50"
          >
            <Settings className="size-3.5" /> Configurar metas de leads
          </button>
        </section>
      )}

      {/* Canais — cards clicáveis */}
      {farmacia?.canais && farmacia.canais.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Atendimentos por Canal — <span className="normal-case font-normal text-zinc-400">clique em um canal para ver detalhes</span>
          </h3>
          <CanaisCards
            canais={farmacia.canais}
            total={farmacia.total_atendimentos}
            onSelect={setCanalAberto}
          />
          <ChartCard
            title="Distribuição por Canal"
            icon={<Users className="size-4 text-zinc-400" />}
          >
            <CanaisPieChart canais={farmacia.canais} />
          </ChartCard>
        </section>
      )}

      {/* Modal do canal selecionado */}
      {canalAberto && farmacia?.canais && (
        <CanalModal
          canal={canalAberto}
          totalAtendimentos={farmacia.total_atendimentos}
          todos={farmacia.canais}
          onClose={() => setCanalAberto(null)}
        />
      )}

      {/* Dialog — editar metas de leads */}
      {admin && (
        <Dialog open={editLeadsOpen} onOpenChange={setEditLeadsOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Metas de Leads por Canal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Meta Leads Google (semanal)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={leadsGoogle}
                    onChange={(e) => setLeadsGoogle(e.target.value)}
                    className="form-input flex-1"
                    placeholder="Ex: 300"
                  />
                  <span className="text-xs text-zinc-400 shrink-0">leads/sem.</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">Deixe em branco para não monitorar este canal.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Meta Leads Meta/Facebook (semanal)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={leadsMeta}
                    onChange={(e) => setLeadsMeta(e.target.value)}
                    className="form-input flex-1"
                    placeholder="Ex: 200"
                  />
                  <span className="text-xs text-zinc-400 shrink-0">leads/sem.</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">Deixe em branco para não monitorar este canal.</p>
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setEditLeadsOpen(false)}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => saveLeadsMutation.mutate()}
                disabled={saveLeadsMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
              >
                {saveLeadsMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}

// ── Cards de canais ────────────────────────────────────────────────────────

function CanaisCards({
  canais,
  total,
  onSelect,
}: {
  canais: CanalData[];
  total: number;
  onSelect: (c: CanalData) => void;
}) {
  const sorted = [...canais].sort((a, b) => b.atendimentos - a.atendimentos);
  const cols = Math.min(sorted.length, 4);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {sorted.map((c) => {
        const s        = canalStyle(c.nome);
        const Icon     = s.icon;
        const pctAtend = total > 0 ? Math.round((c.atendimentos / total) * 100) : 0;
        const taxaConv = c.vendas != null && c.atendimentos > 0
          ? ((c.vendas / c.atendimentos) * 100).toFixed(1)
          : null;

        return (
          <div
            key={c.nome}
            onClick={() => onSelect(c)}
            className={`rounded-xl p-5 ring-1 ring-black/5 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99] transition-all ${s.bg}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-600">{c.nome}</span>
              <div className="flex items-center gap-1.5">
                <Maximize2 className="size-3 text-zinc-400 opacity-60" />
                <Icon className={`size-4 ${s.color}`} />
              </div>
            </div>

            <div className={`text-2xl font-semibold tracking-tight ${s.color}`}>
              {c.atendimentos.toLocaleString("pt-BR")}
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">atendimentos</p>

            <div className="mt-3 h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pctAtend}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">{pctAtend}% do total</p>

            {(c.vendas != null || c.receita_vendas != null) && (
              <div className="mt-4 pt-3 border-t border-white/50 space-y-1.5">
                {c.vendas != null && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <ShoppingCart className="size-3" /> Vendas
                    </span>
                    <span className="text-xs font-semibold text-zinc-800">{c.vendas.toLocaleString("pt-BR")}</span>
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
                    <span className={`text-xs font-semibold ${s.color}`}>{taxaConv}%</span>
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

// ── Pie chart geral ────────────────────────────────────────────────────────

function CanaisPieChart({ canais }: { canais: { nome: string; atendimentos: number }[] }) {
  const data  = [...canais].sort((a, b) => b.atendimentos - a.atendimentos);
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
              <Cell key={c.nome} fill={canalHexColor(c.nome, i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }}
            formatter={(v: number, name: string) => [
              `${v.toLocaleString("pt-BR")} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-2 flex-1">
        {data.map((c, i) => {
          const pct   = total > 0 ? Math.round((c.atendimentos / total) * 100) : 0;
          const color = canalHexColor(c.nome, i);
          return (
            <div key={c.nome} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-xs text-zinc-600 flex-1">{c.nome}</span>
              <span className="text-xs font-semibold text-zinc-900">{c.atendimentos.toLocaleString("pt-BR")}</span>
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

// ── Componentes auxiliares ─────────────────────────────────────────────────

function MetricCard({ label, value, delta, positive }: {
  label: string; value: string; delta?: string; positive?: boolean;
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

function ChartCard({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
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
