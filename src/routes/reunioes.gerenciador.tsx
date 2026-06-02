import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Building2, Search, X, Phone,
  CalendarDays, CheckCircle2, XCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, Plus, User, MapPin, BarChart2, Trophy,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import {
  getGerenciadorMensal, getCoberturaMensal, criarReuniaoAPI,
  getFarmacias,
  type GerenciadorFarmaciaCom, type GerenciadorFarmaciaSem,
  type ReuniaoStatusAPI,
} from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/reunioes/gerenciador")({
  validateSearch: (s: Record<string, unknown>) => ({
    mes: typeof s.mes === "string" ? s.mes : undefined,
  }),
  component: GerenciadorPage,
  head: () => ({ meta: [{ title: "Gerenciador de Reuniões — GrupoSymbol" }] }),
});

// ── Helpers de mês ──────────────────────────────────────────────────────────

const MESES_FULL = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function mesAtual(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function addMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_FULL[m - 1]} / ${y}`;
}

function fmtMesAbrev(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_ABREV[m - 1]}/${String(y).slice(2)}`;
}

function fmtData(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0") === "00" ? "" : String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Status config ───────────────────────────────────────────────────────────

const STATUS_CFG: Record<ReuniaoStatusAPI, { label: string; icon: React.ElementType; color: string }> = {
  agendada:   { label: "Agendada",   icon: Clock,        color: "#F59E0B" },
  confirmada: { label: "Confirmada", icon: CheckCircle2, color: "#10B981" },
  realizada:  { label: "Realizada",  icon: Trophy,       color: "#3B82F6" },
  cancelada:  { label: "Cancelada",  icon: XCircle,      color: "#EF4444" },
};

function alertDot(nivel: string): string {
  if (nivel === "vermelho") return "bg-red-500";
  if (nivel === "amarelo")  return "bg-amber-400";
  return "bg-emerald-500";
}

function alertOrder(nivel: string): number {
  if (nivel === "vermelho") return 0;
  if (nivel === "amarelo")  return 1;
  return 2;
}

// ── MonthPicker ──────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const isAtual = value >= mesAtual();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(addMes(value, -1))}
        className="size-8 rounded-lg bg-white/10 hover:bg-white/20 grid place-items-center text-white transition-colors"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-sm font-semibold text-white min-w-[140px] text-center">
        {fmtMesLabel(value)}
      </span>
      <button
        onClick={() => { if (!isAtual) onChange(addMes(value, 1)); }}
        disabled={isAtual}
        className="size-8 rounded-lg bg-white/10 hover:bg-white/20 grid place-items-center text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

// ── Modal Agendar Reunião ────────────────────────────────────────────────────

interface AgendarForm {
  farmacia_id: string;
  titulo: string;
  data: string;
  hora: string;
  duracao_minutos: string;
  local: string;
}

const DURACAO_OPTS = [
  { v: "30",  l: "30 min"  },
  { v: "45",  l: "45 min"  },
  { v: "60",  l: "1 hora"  },
  { v: "90",  l: "1h30"    },
  { v: "120", l: "2 horas" },
];

function hojeISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function horaAtual(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function ModalAgendar({
  open,
  onOpenChange,
  farmaciaIdPreset,
  farmaciaNomePreset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  farmaciaIdPreset?: number;
  farmaciaNomePreset?: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AgendarForm>({
    farmacia_id: farmaciaIdPreset ? String(farmaciaIdPreset) : "",
    titulo: "", data: hojeISO(), hora: horaAtual(),
    duracao_minutos: "60", local: "Online",
  });

  useEffect(() => {
    if (open) setForm({
      farmacia_id: farmaciaIdPreset ? String(farmaciaIdPreset) : "",
      titulo: "", data: hojeISO(), hora: horaAtual(),
      duracao_minutos: "60", local: "Online",
    });
  }, [open, farmaciaIdPreset]);

  const set = <K extends keyof AgendarForm>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => criarReuniaoAPI({
      farmacia_id: Number(form.farmacia_id),
      titulo: form.titulo,
      data_reuniao: new Date(`${form.data}T${form.hora}`).toISOString(),
      duracao_minutos: Number(form.duracao_minutos),
      local: form.local || undefined,
    }),
    onSuccess: () => {
      toast.success("Reunião agendada!");
      qc.invalidateQueries({ queryKey: ["gerenciador"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSave() {
    if (!form.farmacia_id || !form.titulo || !form.data || !form.hora) {
      toast.error("Preencha farmácia, título, data e horário.");
      return;
    }
    mut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brand" />
            Agendar Reunião
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {farmaciaNomePreset ? (
            <div className="p-3 bg-zinc-50 rounded-lg ring-1 ring-zinc-100 text-sm font-medium text-zinc-700">
              <Building2 className="size-3.5 inline mr-1.5 text-zinc-400" />
              {farmaciaNomePreset}
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Farmácia *</label>
              <input value={form.farmacia_id} onChange={set("farmacia_id")} className="mt-1 form-input w-full" placeholder="ID da farmácia" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Título *</label>
            <input value={form.titulo} onChange={set("titulo")} placeholder="Ex: Reunião Mensal Julho" className="mt-1 form-input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Data *</label>
              <input type="date" value={form.data} onChange={set("data")} className="mt-1 form-input w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Horário *</label>
              <input type="time" value={form.hora} onChange={set("hora")} className="mt-1 form-input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Duração</label>
              <select value={form.duracao_minutos} onChange={set("duracao_minutos")} className="mt-1 form-input w-full">
                {DURACAO_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Local</label>
              <input value={form.local} onChange={set("local")} className="mt-1 form-input w-full" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={mut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60">
            {mut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
            Agendar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba Evolução ─────────────────────────────────────────────────────────────

function AbaEvolucao({ mes, onMesChange }: { mes: string; onMesChange: (m: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cobertura-mensal"],
    queryFn: () => getCoberturaMensal(6),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 bg-zinc-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  const historico = data?.historico ?? [];

  const chartData = historico.map((h) => ({
    mes: fmtMesAbrev(h.mes),
    mesKey: h.mes,
    com: h.farmacias_com_reuniao,
    sem: h.farmacias_sem_reuniao,
    taxa: h.taxa_cobertura,
  }));

  return (
    <div className="space-y-6">
      {/* Gráfico */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
          Cobertura — últimos {historico.length} meses
        </p>
        {historico.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">Sem dados históricos.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={28} onClick={(e) => { if (e?.activePayload?.[0]) onMesChange((e.activePayload[0].payload as { mesKey: string }).mesKey); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number, name: string) => [value, name === "com" ? "Com reunião" : "Sem reunião"]}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7", fontSize: 12 }}
              />
              <Legend formatter={(v) => v === "com" ? "Com reunião" : "Sem reunião"} iconType="square" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="com" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} name="com">
                {chartData.map((entry) => (
                  <Cell key={entry.mes} fill={entry.mesKey === mes ? "#1D4ED8" : "#3B82F6"} cursor="pointer" />
                ))}
              </Bar>
              <Bar dataKey="sem" stackId="a" fill="#E4E4E7" radius={[4, 4, 0, 0]} name="sem">
                {chartData.map((entry) => (
                  <Cell key={entry.mes} fill={entry.mesKey === mes ? "#D1D5DB" : "#E4E4E7"} cursor="pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabela resumo */}
      {historico.length > 0 && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["Mês", "Total", "Com Reunião", "Sem Reunião", "Cobertura", "Realizadas"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {[...historico].reverse().map((h) => {
                const isSelected = h.mes === mes;
                return (
                  <tr
                    key={h.mes}
                    onClick={() => onMesChange(h.mes)}
                    className={`cursor-pointer transition-colors hover:bg-zinc-50 ${isSelected ? "bg-brand/5 font-semibold" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-zinc-800">{fmtMesAbrev(h.mes)}</td>
                    <td className="px-4 py-3 text-zinc-600">{h.total_farmacias}</td>
                    <td className="px-4 py-3 text-blue-600 font-semibold">{h.farmacias_com_reuniao}</td>
                    <td className="px-4 py-3 text-zinc-400">{h.farmacias_sem_reuniao}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${h.taxa_cobertura >= 80 ? "text-emerald-600" : h.taxa_cobertura >= 50 ? "text-amber-600" : "text-red-500"}`}>
                        {h.taxa_cobertura.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{h.realizadas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Aba Com Reunião ──────────────────────────────────────────────────────────

function CardComReuniao({
  f,
  onAgendar,
}: {
  f: GerenciadorFarmaciaCom;
  onAgendar: (id: number, nome: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`size-2.5 rounded-full shrink-0 mt-1.5 ${alertDot(f.nivel_alerta)}`} />
            <div className="flex-1 min-w-0">
              <Link
                to="/farmacias/$id"
                params={{ id: String(f.farmacia_id) }}
                className="text-sm font-semibold text-zinc-900 hover:text-brand transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {f.farmacia_nome}
              </Link>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-400 flex-wrap">
                {f.cidade && <span className="flex items-center gap-1"><MapPin className="size-3" />{f.cidade}</span>}
                {f.gestor_nome && <span className="flex items-center gap-1"><User className="size-3" />{f.gestor_nome}</span>}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  {f.total_reunioes} {f.total_reunioes === 1 ? "reunião" : "reuniões"}
                </span>
                {f.realizadas > 0 && (
                  <span className="text-[10px] text-emerald-600 font-medium">✅ {f.realizadas} realizada{f.realizadas > 1 ? "s" : ""}</span>
                )}
                {f.confirmadas > 0 && (
                  <span className="text-[10px] text-blue-600 font-medium">📅 {f.confirmadas} confirmada{f.confirmadas > 1 ? "s" : ""}</span>
                )}
                {f.agendadas > 0 && (
                  <span className="text-[10px] text-amber-600 font-medium">🕐 {f.agendadas} agendada{f.agendadas > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onAgendar(f.farmacia_id, f.farmacia_nome)}
              className="flex items-center gap-1 text-xs font-medium text-brand hover:opacity-80 px-2.5 py-1.5 rounded-lg bg-brand/5 ring-1 ring-brand/10"
            >
              <Plus className="size-3" /> Reunião
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="size-7 rounded-lg bg-zinc-50 ring-1 ring-zinc-100 grid place-items-center text-zinc-400 hover:text-zinc-700"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-zinc-50 space-y-2">
            {f.reunioes.map((r) => {
              const cfg = STATUS_CFG[r.status];
              const Icon = cfg.icon;
              return (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-50 ring-1 ring-zinc-100">
                  <Icon className="size-3.5 shrink-0" style={{ color: cfg.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 truncate">{r.titulo}</p>
                    <p className="text-[10px] text-zinc-400">
                      {fmtData(r.data_reuniao)} às {fmtHora(r.data_reuniao)}
                      {r.duracao_minutos > 0 && ` · ${r.duracao_minutos}min`}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AbaComReuniao({
  farmacias,
  onAgendar,
}: {
  farmacias: GerenciadorFarmaciaCom[];
  onAgendar: (id: number, nome: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"" | "realizadas" | "confirmadas" | "agendadas">("");

  const filtradas = farmacias.filter((f) => {
    const q = busca.toLowerCase();
    const matchQ = !q || f.farmacia_nome.toLowerCase().includes(q) ||
      (f.cidade ?? "").toLowerCase().includes(q) ||
      (f.gestor_nome ?? "").toLowerCase().includes(q);
    const matchS = !filtroStatus
      || (filtroStatus === "realizadas" && f.realizadas > 0)
      || (filtroStatus === "confirmadas" && f.confirmadas > 0)
      || (filtroStatus === "agendadas" && f.agendadas > 0);
    return matchQ && matchS;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm flex-1 min-w-[200px]">
          <Search className="size-4 text-zinc-400 shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cidade ou gestor..."
            className="bg-transparent outline-none text-sm flex-1"
          />
          {busca && <button onClick={() => setBusca("")}><X className="size-3.5 text-zinc-400 hover:text-zinc-700" /></button>}
        </div>
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
          {([
            { v: "",           l: "Todas" },
            { v: "realizadas", l: "Realizadas" },
            { v: "confirmadas",l: "Confirmadas" },
            { v: "agendadas",  l: "Agendadas" },
          ] as const).map((o) => (
            <button
              key={o.v}
              onClick={() => setFiltroStatus(o.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filtroStatus === o.v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl ring-1 ring-black/5 py-12 text-center text-sm text-zinc-400">
          {farmacias.length === 0 ? "Nenhuma farmácia teve reunião neste mês." : "Nenhuma farmácia para este filtro."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((f) => (
            <CardComReuniao key={f.farmacia_id} f={f} onAgendar={onAgendar} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Aba Sem Reunião ──────────────────────────────────────────────────────────

function AbaSemReuniao({
  farmacias,
  onAgendar,
}: {
  farmacias: GerenciadorFarmaciaSem[];
  onAgendar: (id: number, nome: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtroAlerta, setFiltroAlerta] = useState<"" | "vermelho" | "amarelo" | "verde">("");

  const filtradas = farmacias
    .filter((f) => {
      const q = busca.toLowerCase();
      const matchQ = !q || f.farmacia_nome.toLowerCase().includes(q) ||
        (f.cidade ?? "").toLowerCase().includes(q) ||
        (f.gestor_nome ?? "").toLowerCase().includes(q);
      const matchA = !filtroAlerta || f.nivel_alerta === filtroAlerta;
      return matchQ && matchA;
    })
    .sort((a, b) => alertOrder(a.nivel_alerta) - alertOrder(b.nivel_alerta));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm flex-1 min-w-[200px]">
          <Search className="size-4 text-zinc-400 shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cidade ou gestor..."
            className="bg-transparent outline-none text-sm flex-1"
          />
          {busca && <button onClick={() => setBusca("")}><X className="size-3.5 text-zinc-400 hover:text-zinc-700" /></button>}
        </div>
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
          {([
            { v: "",          l: "Todos",    dot: null },
            { v: "vermelho",  l: "Alerta",   dot: "bg-red-500" },
            { v: "amarelo",   l: "Atenção",  dot: "bg-amber-400" },
            { v: "verde",     l: "Ativos",   dot: "bg-emerald-500" },
          ] as const).map((o) => (
            <button
              key={o.v}
              onClick={() => setFiltroAlerta(o.v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filtroAlerta === o.v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              {o.dot && <span className={`size-1.5 rounded-full ${o.dot}`} />}
              {o.l}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400 font-medium">{filtradas.length} farmácia{filtradas.length !== 1 ? "s" : ""}</span>
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl ring-1 ring-black/5 py-12 text-center">
          <CheckCircle2 className="size-10 text-emerald-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600">
            {farmacias.length === 0 ? "🎉 Todas as farmácias tiveram reunião!" : "Nenhuma farmácia para este filtro."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm divide-y divide-zinc-50">
          {filtradas.map((f) => (
            <div key={f.farmacia_id} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50/50 transition-colors group">
              <div className={`size-2.5 rounded-full shrink-0 ${alertDot(f.nivel_alerta)}`} />

              <div className="flex-1 min-w-0">
                <Link
                  to="/farmacias/$id"
                  params={{ id: String(f.farmacia_id) }}
                  className="text-sm font-semibold text-zinc-900 hover:text-brand transition-colors"
                >
                  {f.farmacia_nome}
                </Link>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-400 flex-wrap">
                  {f.cidade && <span className="flex items-center gap-1"><MapPin className="size-3" />{f.cidade}</span>}
                  {f.gestor_nome && <span className="flex items-center gap-1"><User className="size-3" />{f.gestor_nome}</span>}
                  {f.responsavel && <span className="flex items-center gap-1"><User className="size-3" />{f.responsavel}</span>}
                  {f.telefone && <span className="flex items-center gap-1"><Phone className="size-3" />{f.telefone}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {f.telefone && (
                  <a
                    href={`tel:${f.telefone.replace(/\D/g, "")}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 px-2.5 py-1.5 rounded-lg bg-zinc-50 ring-1 ring-zinc-100"
                  >
                    <Phone className="size-3" /> Ligar
                  </a>
                )}
                <button
                  onClick={() => onAgendar(f.farmacia_id, f.farmacia_nome)}
                  className="flex items-center gap-1 text-xs font-medium text-brand hover:opacity-80 px-2.5 py-1.5 rounded-lg bg-brand/5 ring-1 ring-brand/10"
                >
                  <CalendarDays className="size-3" /> Agendar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GerenciadorContent (componente reutilizável, sem AppShell) ───────────────

type Aba = "evolucao" | "com" | "sem";

export function GerenciadorContent({ mes, onMesChange }: { mes: string; onMesChange: (m: string) => void }) {
  const [aba, setAba] = useState<Aba>("evolucao");
  const [agendarTarget, setAgendarTarget] = useState<{ id: number; nome: string } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["gerenciador", mes],
    queryFn: () => getGerenciadorMensal(mes),
    staleTime: 30_000,
  });

  if (isError) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-sm text-zinc-500">Erro ao carregar dados.</p>
      <button onClick={() => refetch()} className="text-sm font-medium text-brand hover:underline">
        Tentar novamente
      </button>
    </div>
  );

  const kpis = [
    { label: "Farmácias Ativas", value: data?.total_farmacias_ativas ?? 0,    bg: "bg-zinc-50",    icon: <Building2    className="size-5 text-zinc-500"   /> },
    { label: "Com Reunião",      value: data?.farmacias_com_reuniao ?? 0,      bg: "bg-emerald-50", icon: <CheckCircle2 className="size-5 text-emerald-500" /> },
    { label: "Sem Reunião",      value: data?.farmacias_sem_reuniao ?? 0,      bg: "bg-amber-50",   icon: <Clock        className="size-5 text-amber-500"   /> },
    {
      label: "Cobertura",
      value: data ? `${data.taxa_cobertura.toFixed(1)}%` : "—",
      bg: data && data.taxa_cobertura === 100 ? "bg-emerald-50" : "bg-blue-50",
      icon: <BarChart2 className="size-5 text-blue-500" />,
    },
  ];

  const coberturaTotal = data?.taxa_cobertura === 100;

  return (
    <>
      {/* Navegação de mês */}
      <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-black/5 shadow-sm px-4 py-3 self-start">
        <button
          onClick={() => onMesChange(addMes(mes, -1))}
          className="size-8 rounded-lg bg-zinc-50 hover:bg-zinc-100 ring-1 ring-zinc-200 grid place-items-center text-zinc-600 transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-zinc-900 min-w-[140px] text-center">
          {fmtMesLabel(mes)}
        </span>
        <button
          onClick={() => { if (mes < mesAtual()) onMesChange(addMes(mes, 1)); }}
          disabled={mes >= mesAtual()}
          className="size-8 rounded-lg bg-zinc-50 hover:bg-zinc-100 ring-1 ring-zinc-200 grid place-items-center text-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Celebração 100% */}
      {coberturaTotal && !isLoading && (
        <div className="bg-emerald-50 rounded-xl ring-1 ring-emerald-200 px-5 py-3 flex items-center gap-3">
          <span className="text-xl">🎉</span>
          <p className="text-sm font-semibold text-emerald-800">
            Todas as farmácias tiveram reunião em {fmtMesLabel(mes)}!
          </p>
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl ring-1 ring-black/5 shadow-sm p-5 flex items-center gap-4 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            <div className="size-10 rounded-xl bg-white/70 grid place-items-center shadow-sm shrink-0">
              {k.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">
                {isLoading ? <span className="inline-block h-6 w-10 bg-zinc-200 rounded animate-pulse" /> : k.value}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-tight">{k.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Abas internas */}
      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto">
        {([
          { v: "evolucao", l: "📊 Evolução" },
          { v: "com",      l: `✅ Com Reunião${data ? ` (${data.farmacias_com_reuniao})` : ""}` },
          { v: "sem",      l: `⚠️ Sem Reunião${data ? ` (${data.farmacias_sem_reuniao})` : ""}` },
        ] as const).map((a) => (
          <button
            key={a.v}
            onClick={() => setAba(a.v)}
            className={[
              "px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all",
              aba === a.v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
            ].join(" ")}
          >
            {a.l}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl ring-1 ring-black/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {aba === "evolucao" && (
            <AbaEvolucao mes={mes} onMesChange={(m) => { onMesChange(m); setAba("com"); }} />
          )}
          {aba === "com" && data && (
            <AbaComReuniao farmacias={data.com_reuniao} onAgendar={(id, nome) => setAgendarTarget({ id, nome })} />
          )}
          {aba === "sem" && data && (
            <AbaSemReuniao farmacias={data.sem_reuniao} onAgendar={(id, nome) => setAgendarTarget({ id, nome })} />
          )}
        </>
      )}

      <ModalAgendar
        open={!!agendarTarget}
        onOpenChange={(v) => { if (!v) setAgendarTarget(null); }}
        farmaciaIdPreset={agendarTarget?.id}
        farmaciaNomePreset={agendarTarget?.nome}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["gerenciador", mes] });
          setAgendarTarget(null);
        }}
      />
    </>
  );
}

// ── GerenciadorPage (rota direta /reunioes/gerenciador) ──────────────────────

function GerenciadorPage() {
  const navigate = useNavigate();
  const { mes: mesParam } = Route.useSearch();
  const [mes, setMes] = useState(mesParam ?? mesAtual());

  useEffect(() => {
    navigate({ to: "/reunioes/gerenciador", search: { mes }, replace: true });
  }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell title="Gerenciador de Reuniões">
      <GerenciadorContent mes={mes} onMesChange={setMes} />
    </AppShell>
  );
}
