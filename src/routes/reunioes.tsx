import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CalendarDays, Plus, X, Clock, CheckCircle2, XCircle,
  Building2, Search, Pencil, Trash2, AlertCircle, Trophy,
  ExternalLink, MapPin, Timer, RefreshCw, Calendar,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getFarmacias,
  getReuniaoStats,
  getReunioes,
  criarReuniaoAPI,
  atualizarReuniaoAPI,
  confirmarReuniao,
  realizarReuniao,
  cancelarReuniao,
  getGoogleStatus,
  iniciarOAuthGoogle,
  desconectarGoogleCalendar,
  type ReuniaoAPI,
  type ReuniaoStatusAPI,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── Rota ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/reunioes")({
  component: ReunioesPage,
  head: () => ({ meta: [{ title: "Reuniões — PharmaFlow" }] }),
});

// ── Status config ──────────────────────────────────────────────────────────

type StatusCfg = {
  label: string;
  icon: React.ElementType;
  bg: string;
  ring: string;
  text: string;
  cor: string;
};

const STATUS_CFG: Record<ReuniaoStatusAPI, StatusCfg> = {
  agendada:   { label: "Agendada",   icon: Clock,        bg: "bg-amber-50",   ring: "ring-amber-200",   text: "text-amber-700",   cor: "#F59E0B" },
  confirmada: { label: "Confirmada", icon: CheckCircle2, bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-700", cor: "#10B981" },
  realizada:  { label: "Realizada",  icon: Trophy,       bg: "bg-blue-50",    ring: "ring-blue-200",    text: "text-blue-700",    cor: "#3B82F6" },
  cancelada:  { label: "Cancelada",  icon: XCircle,      bg: "bg-red-50",     ring: "ring-red-200",     text: "text-red-700",     cor: "#EF4444" },
};

// ── Helpers de data ────────────────────────────────────────────────────────

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_NOME  = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtDataCompleta(iso: string): string {
  const d = new Date(iso);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} ${MESES_NOME[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtHoraFim(iso: string, min: number): string {
  const d = new Date(new Date(iso).getTime() + min * 60000);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtDataCurta(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function formToISO(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}
function hojeISO(): string {
  return isoToDateInput(new Date().toISOString());
}
function horaAtual(): string {
  return isoToTimeInput(new Date().toISOString());
}

function isFutura(iso: string): boolean {
  return new Date(iso) > new Date();
}

// ── 1. StatusBadge ─────────────────────────────────────────────────────────

function StatusBadge({ status, size = "sm" }: { status: ReuniaoStatusAPI; size?: "xs" | "sm" }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  const cls = size === "xs"
    ? "px-1.5 py-0.5 text-[10px]"
    : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${cls} ${cfg.bg} ${cfg.ring} ${cfg.text}`}>
      <Icon className={size === "xs" ? "size-2.5" : "size-3"} />
      {cfg.label}
    </span>
  );
}

// ── 2. ReunioeStats ────────────────────────────────────────────────────────

function ReunioeStats({ loading }: { loading: boolean }) {
  const { data: stats } = useQuery({
    queryKey: ["reunioes-stats"],
    queryFn: getReuniaoStats,
    staleTime: 30_000,
  });

  const cards = [
    { label: "Reuniões este mês",      value: stats?.reunioes_mes        ?? 0, icon: <CalendarDays className="size-5 text-brand" />,        bg: "bg-brand/5"     },
    { label: "Total realizadas",        value: stats?.total_realizadas    ?? 0, icon: <CheckCircle2  className="size-5 text-blue-500" />,     bg: "bg-blue-50"     },
    { label: "Agendadas (futuras)",     value: stats?.agendadas_futuras   ?? 0, icon: <Clock         className="size-5 text-amber-500" />,    bg: "bg-amber-50"    },
    { label: "Confirmadas (futuras)",   value: stats?.confirmadas_futuras ?? 0, icon: <Trophy        className="size-5 text-emerald-500" />,  bg: "bg-emerald-50"  },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`${c.bg} rounded-xl ring-1 ring-black/5 shadow-sm p-5 flex items-center gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="size-10 rounded-xl bg-white/70 grid place-items-center shadow-sm shrink-0">
            {c.icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-900">{c.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-tight">{c.label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

// ── 3. FiltroAbas ──────────────────────────────────────────────────────────

type FiltroStatus = "todas" | ReuniaoStatusAPI;
const FILTROS: { value: FiltroStatus; label: string }[] = [
  { value: "todas",      label: "Todas"      },
  { value: "agendada",   label: "Agendadas"  },
  { value: "confirmada", label: "Confirmadas"},
  { value: "realizada",  label: "Realizadas" },
  { value: "cancelada",  label: "Canceladas" },
];

function FiltroAbas({ value, onChange }: { value: FiltroStatus; onChange: (v: FiltroStatus) => void }) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto">
      {FILTROS.map((f) => {
        const cfg = f.value !== "todas" ? STATUS_CFG[f.value as ReuniaoStatusAPI] : null;
        const isActive = value === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={[
              "px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all",
              isActive
                ? cfg
                  ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring} shadow-sm`
                  : "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                : "text-zinc-500 hover:text-zinc-800",
            ].join(" ")}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 4. ReuniaoCard (mini-card dentro do card da farmácia) ──────────────────

function ReuniaoCard({ r, onClick }: { r: ReuniaoAPI; onClick: () => void }) {
  const future = isFutura(r.data_reuniao);
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left rounded-lg p-3 ring-1 transition-all hover:shadow-md",
        future ? "bg-white ring-black/8 hover:ring-brand/30" : "bg-zinc-50 ring-zinc-100",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-900 truncate">{r.titulo}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {fmtDataCurta(r.data_reuniao)} às {fmtHora(r.data_reuniao)}
            {r.duracao_minutos > 0 && ` • ${r.duracao_minutos} min`}
            {r.local && ` • ${r.local}`}
          </p>
        </div>
        <StatusBadge status={r.status} size="xs" />
      </div>
    </button>
  );
}

// ── 5. FarmaciaReuniaoCard ─────────────────────────────────────────────────

function FarmaciaReuniaoCard({
  farmaciaId,
  farmaciaNome,
  reunioes,
  onAgendar,
  onDetalhes,
}: {
  farmaciaId: number;
  farmaciaNome: string;
  reunioes: ReuniaoAPI[];
  onAgendar: (id: number, nome: string) => void;
  onDetalhes: (r: ReuniaoAPI) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const totalMes = reunioes.filter(
    (r) => r.data_reuniao.startsWith(mesAtual) && r.status !== "cancelada",
  ).length;
  const totalGeral = reunioes.filter((r) => r.status !== "cancelada").length;
  const proximas = reunioes
    .filter((r) => r.status !== "cancelada" && isFutura(r.data_reuniao))
    .sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao))
    .slice(0, 2);
  const historico = reunioes.filter((r) => !isFutura(r.data_reuniao) || r.status === "cancelada");

  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Building2 className="size-4 text-zinc-400 shrink-0" />
              <h3 className="text-sm font-semibold text-zinc-900 truncate">{farmaciaNome}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand/10 text-brand ring-1 ring-brand/20">
                <Calendar className="size-3" />
                {totalMes} {totalMes === 1 ? "reunião" : "reuniões"} este mês
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200">
                {totalGeral} no total
              </span>
            </div>
          </div>
          <button
            onClick={() => onAgendar(farmaciaId, farmaciaNome)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90 shrink-0"
          >
            <Plus className="size-3.5" /> Agendar
          </button>
        </div>

        {/* Próximas reuniões */}
        {proximas.length > 0 ? (
          <div className="space-y-2">
            {proximas.map((r) => (
              <ReuniaoCard key={r.id} r={r} onClick={() => onDetalhes(r)} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-100">
            <AlertCircle className="size-3.5 text-zinc-300 shrink-0" />
            <p className="text-[11px] text-zinc-400 italic">
              {reunioes.length === 0 ? "Nenhuma reunião agendada ainda." : "Sem próximas reuniões."}
            </p>
          </div>
        )}
      </div>

      {/* Expandir histórico */}
      {historico.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-5 py-2.5 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <span className="font-medium">
              {expanded ? "Ocultar histórico" : `Ver histórico (${historico.length})`}
            </span>
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {expanded && (
            <div className="px-5 pb-4 space-y-2 border-t border-zinc-50">
              {historico
                .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao))
                .map((r) => (
                  <ReuniaoCard key={r.id} r={r} onClick={() => onDetalhes(r)} />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 6. ModalAgendarReuniao ─────────────────────────────────────────────────

interface AgendarForm {
  farmacia_id: string;
  titulo: string;
  descricao: string;
  data: string;
  hora: string;
  duracao_minutos: string;
  local: string;
  link_meet: string;
}

const DURACAO_OPTS = [
  { v: "15",  l: "15 min"  },
  { v: "30",  l: "30 min"  },
  { v: "45",  l: "45 min"  },
  { v: "60",  l: "1 hora"  },
  { v: "90",  l: "1h30"    },
  { v: "120", l: "2 horas" },
];

function ModalAgendarReuniao({
  open,
  onOpenChange,
  farmaciaIdPreset,
  farmaciaNomePreset,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  farmaciaIdPreset?: number;
  farmaciaNomePreset?: string;
  editing: ReuniaoAPI | null;
  onSaved: (googleLink?: string) => void;
}) {
  const qc = useQueryClient();
  const { data: farmacias = [] } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias(),
    staleTime: 60_000,
  });

  const emptyForm = (): AgendarForm => ({
    farmacia_id: String(farmaciaIdPreset ?? ""),
    titulo: "",
    descricao: "",
    data: hojeISO(),
    hora: horaAtual(),
    duracao_minutos: "60",
    local: "Online",
    link_meet: "",
  });

  const [form, setForm] = useState<AgendarForm>(emptyForm);

  useEffect(() => {
    if (editing) {
      setForm({
        farmacia_id: String(editing.farmacia_id),
        titulo: editing.titulo,
        descricao: editing.descricao ?? "",
        data: isoToDateInput(editing.data_reuniao),
        hora: isoToTimeInput(editing.data_reuniao),
        duracao_minutos: String(editing.duracao_minutos),
        local: editing.local,
        link_meet: editing.link_meet ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, open, farmaciaIdPreset]);

  const set = <K extends keyof AgendarForm>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const criarMut = useMutation({
    mutationFn: criarReuniaoAPI,
    onSuccess: (res) => {
      toast.success("Reunião agendada!");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
      onSaved(res.google_event_sincronizado ? undefined : res.google_link);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editarMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof atualizarReuniaoAPI>[1] }) =>
      atualizarReuniaoAPI(id, data),
    onSuccess: () => {
      toast.success("Reunião atualizada!");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
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
    const data_reuniao = formToISO(form.data, form.hora);
    if (editing) {
      editarMut.mutate({
        id: editing.id,
        data: {
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          data_reuniao,
          duracao_minutos: Number(form.duracao_minutos),
          local: form.local,
          link_meet: form.link_meet || undefined,
        },
      });
    } else {
      criarMut.mutate({
        farmacia_id: Number(form.farmacia_id),
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        data_reuniao,
        duracao_minutos: Number(form.duracao_minutos),
        local: form.local || undefined,
        link_meet: form.link_meet || undefined,
      });
    }
  }

  const saving = criarMut.isPending || editarMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brand" />
            {editing ? "Editar Reunião" : "Agendar Reunião"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
          {/* Farmácia */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Farmácia *</label>
            <select
              value={form.farmacia_id}
              onChange={set("farmacia_id")}
              disabled={!!farmaciaIdPreset || !!editing}
              className="mt-1 form-input w-full disabled:opacity-60"
            >
              <option value="">Selecionar farmácia...</option>
              {farmacias.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Título *</label>
            <input
              value={form.titulo}
              onChange={set("titulo")}
              placeholder="Ex: Revisão de metas de maio"
              className="mt-1 form-input w-full"
            />
          </div>

          {/* Data + Hora */}
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

          {/* Duração + Local */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Duração</label>
              <select value={form.duracao_minutos} onChange={set("duracao_minutos")} className="mt-1 form-input w-full">
                {DURACAO_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Local</label>
              <input
                value={form.local}
                onChange={set("local")}
                list="locais-list"
                placeholder="Online"
                className="mt-1 form-input w-full"
              />
              <datalist id="locais-list">
                <option value="Online" />
                <option value="Presencial" />
                <option value="Híbrido" />
              </datalist>
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-base leading-none">💬</span> WhatsApp
            </label>
            <input
              value={form.link_meet}
              onChange={(e) => {
                const raw = e.target.value;
                // Se o usuário digitou só números, converte para wa.me
                const apenasNums = raw.replace(/\D/g, "");
                if (apenasNums.length >= 8 && apenasNums === raw.replace(/[\s()\-+]/g, "")) {
                  const com55 = apenasNums.startsWith("55") ? apenasNums : "55" + apenasNums;
                  setForm((p) => ({ ...p, link_meet: `https://wa.me/${com55}` }));
                } else {
                  setForm((p) => ({ ...p, link_meet: raw }));
                }
              }}
              placeholder="https://wa.me/5511999999999"
              className="mt-1 form-input w-full"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Cole o link ou digite só o número — ex: (11) 99999-9999
            </p>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Descrição / Pauta</label>
            <textarea
              value={form.descricao}
              onChange={set("descricao")}
              rows={3}
              placeholder="Pauta da reunião, pontos a discutir..."
              className="mt-1 form-input w-full resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {saving && <RefreshCw className="size-3.5 animate-spin" />}
            {editing ? "Salvar alterações" : "Agendar Reunião"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 7. ModalMarcarRealizada ────────────────────────────────────────────────

function ModalMarcarRealizada({
  reuniao,
  onClose,
  onDone,
}: {
  reuniao: ReuniaoAPI | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [obs, setObs] = useState("");

  useEffect(() => { if (reuniao) setObs(""); }, [reuniao]);

  const mut = useMutation({
    mutationFn: () => realizarReuniao(reuniao!.id, obs || undefined),
    onSuccess: () => {
      toast.success("Reunião marcada como realizada!");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
      onDone();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!reuniao} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            Marcar como Realizada
          </DialogTitle>
        </DialogHeader>
        {reuniao && (
          <div className="space-y-4 py-1">
            <div className="p-3 bg-zinc-50 rounded-lg ring-1 ring-zinc-100">
              <p className="text-sm font-medium text-zinc-800">{reuniao.titulo}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {fmtDataCurta(reuniao.data_reuniao)} às {fmtHora(reuniao.data_reuniao)} • {reuniao.farmacia_nome}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Observações (opcional)</label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                placeholder="Como foi a reunião? O que foi acordado?"
                className="mt-1 form-input w-full resize-none"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
            Confirmar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 8. DrawerDetalhesReuniao ───────────────────────────────────────────────

function DrawerDetalhesReuniao({
  reuniao,
  onClose,
  onEditar,
  onRefresh,
}: {
  reuniao: ReuniaoAPI | null;
  onClose: () => void;
  onEditar: (r: ReuniaoAPI) => void;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [modalRealizar, setModalRealizar] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);

  const confirmarMut = useMutation({
    mutationFn: () => confirmarReuniao(reuniao!.id),
    onSuccess: () => {
      toast.success("Reunião confirmada!");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
      onRefresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelarMut = useMutation({
    mutationFn: () => cancelarReuniao(reuniao!.id),
    onSuccess: () => {
      toast.success("Reunião cancelada.");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
      setConfirmCancelar(false);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const r = reuniao;

  return (
    <>
      <Sheet open={!!r} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {r && (
            <>
              <SheetHeader className="pb-4 border-b border-zinc-100">
                <SheetTitle className="text-base font-semibold text-zinc-900 pr-8">{r.titulo}</SheetTitle>
              </SheetHeader>

              <div className="py-5 space-y-5">
                {/* Farmácia + Gestor */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <Building2 className="size-4 text-zinc-400" />
                    <span className="font-medium">{r.farmacia_nome}</span>
                  </div>
                  {r.gestor_nome && (
                    <p className="text-xs text-zinc-500 pl-6">Gestor: {r.gestor_nome}</p>
                  )}
                </div>

                {/* Status */}
                <StatusBadge status={r.status} />

                {/* Data + Hora */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <CalendarDays className="size-4 text-zinc-400" />
                    <span>{fmtDataCompleta(r.data_reuniao)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <Clock className="size-4 text-zinc-400" />
                    <span>
                      {fmtHora(r.data_reuniao)}
                      {r.duracao_minutos > 0 && ` — ${fmtHoraFim(r.data_reuniao, r.duracao_minutos)} (${r.duracao_minutos} min)`}
                    </span>
                  </div>
                  {r.local && (
                    <div className="flex items-center gap-2 text-sm text-zinc-700">
                      <MapPin className="size-4 text-zinc-400" />
                      <span>{r.local}</span>
                    </div>
                  )}
                  {r.link_meet && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-base leading-none">💬</span>
                      <a
                        href={r.link_meet}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 hover:underline truncate font-medium"
                      >
                        Abrir WhatsApp
                      </a>
                    </div>
                  )}
                </div>

                {/* Descrição */}
                {r.descricao && (
                  <div className="p-3 bg-zinc-50 rounded-lg ring-1 ring-zinc-100">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Pauta</p>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap">{r.descricao}</p>
                  </div>
                )}

                {/* Observações (se realizada) */}
                {r.status === "realizada" && r.observacoes && (
                  <div className="p-3 bg-blue-50 rounded-lg ring-1 ring-blue-100">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Observações</p>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{r.observacoes}</p>
                  </div>
                )}

                {/* Ações */}
                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Ações</p>

                  {/* Google Calendar */}
                  {r.google_link && (
                    <button
                      onClick={() => window.open(r.google_link, "_blank")}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-50 ring-1 ring-zinc-200 hover:bg-zinc-100 transition-colors"
                    >
                      <CalendarDays className="size-4 text-[#4285F4]" />
                      Abrir no Google Agenda
                      <ExternalLink className="size-3 ml-auto text-zinc-400" />
                    </button>
                  )}

                  {/* Confirmar (se agendada) */}
                  {r.status === "agendada" && (
                    <button
                      onClick={() => confirmarMut.mutate()}
                      disabled={confirmarMut.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-60"
                    >
                      {confirmarMut.isPending
                        ? <RefreshCw className="size-4 animate-spin" />
                        : <CheckCircle2 className="size-4" />}
                      Confirmar Reunião
                    </button>
                  )}

                  {/* Marcar como Realizada */}
                  {(r.status === "agendada" || r.status === "confirmada") && (
                    <button
                      onClick={() => setModalRealizar(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 ring-1 ring-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <Trophy className="size-4" />
                      Marcar como Realizada
                    </button>
                  )}

                  {/* Editar */}
                  {r.status !== "realizada" && r.status !== "cancelada" && (
                    <button
                      onClick={() => onEditar(r)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-50 ring-1 ring-zinc-200 hover:bg-zinc-100 transition-colors"
                    >
                      <Pencil className="size-4" />
                      Editar
                    </button>
                  )}

                  {/* Cancelar */}
                  {r.status !== "cancelada" && r.status !== "realizada" && (
                    <button
                      onClick={() => setConfirmCancelar(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 transition-colors"
                    >
                      <XCircle className="size-4" />
                      Cancelar Reunião
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal "Marcar como Realizada" */}
      <ModalMarcarRealizada
        reuniao={modalRealizar ? r : null}
        onClose={() => setModalRealizar(false)}
        onDone={onRefresh}
      />

      {/* Confirmar cancelamento */}
      <AlertDialog open={confirmCancelar} onOpenChange={setConfirmCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              {r?.google_event_id
                ? "O evento também será removido do Google Calendar."
                : "A reunião será marcada como cancelada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelarMut.mutate()}
              disabled={cancelarMut.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelarMut.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── 9. BannerGoogleCalendar ────────────────────────────────────────────────

function BannerGoogleCalendar({ onConectar, loading }: { onConectar: () => void; loading: boolean }) {
  return (
    <div className="bg-gradient-to-r from-[#4285F4]/10 to-brand/5 rounded-xl ring-1 ring-[#4285F4]/20 p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-white shadow-sm grid place-items-center">
          <CalendarDays className="size-4 text-[#4285F4]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800">Conecte seu Google Agenda</p>
          <p className="text-xs text-zinc-500">Sincronize reuniões automaticamente com seu calendário.</p>
        </div>
      </div>
      <button
        onClick={onConectar}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#4285F4] rounded-lg hover:opacity-90 disabled:opacity-60 shrink-0"
      >
        {loading ? <RefreshCw className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
        Conectar Google Agenda
      </button>
    </div>
  );
}

// ── Dashboard helpers ──────────────────────────────────────────────────────

type WeekEntry = {
  label: string;
  Realizada: number;
  Cancelada: number;
  Agendada: number;
  Confirmada: number;
};

function computeWeeklyData(reunioes: ReuniaoAPI[]): WeekEntry[] {
  const map = new Map<string, WeekEntry>();

  for (const r of reunioes) {
    const d = new Date(r.data_reuniao);
    const day = d.getDay(); // 0=Dom … 6=Sáb
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = monday.toISOString().slice(0, 10);
    const label = `${String(monday.getDate()).padStart(2, "0")}/${String(monday.getMonth() + 1).padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, { label, Realizada: 0, Cancelada: 0, Agendada: 0, Confirmada: 0 });
    }
    const entry = map.get(key)!;
    if (r.status === "realizada")       entry.Realizada++;
    else if (r.status === "cancelada")  entry.Cancelada++;
    else if (r.status === "agendada")   entry.Agendada++;
    else if (r.status === "confirmada") entry.Confirmada++;
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([, v]) => v);
}

// ── 11. DashboardView ──────────────────────────────────────────────────────

function DashboardView({ reunioes, loading }: { reunioes: ReuniaoAPI[]; loading: boolean }) {
  const agora = new Date();
  const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const total     = reunioes.length;
  const realizadas = reunioes.filter((r) => r.status === "realizada").length;
  const canceladas = reunioes.filter((r) => r.status === "cancelada").length;
  const proximas7 = reunioes.filter((r) => {
    const d = new Date(r.data_reuniao);
    return d > agora && d <= em7dias && r.status !== "cancelada";
  }).length;

  const base = realizadas + canceladas;
  const comparecimento = base > 0 ? Math.round((realizadas / base) * 100) : 0;
  const desistencia    = base > 0 ? Math.round((canceladas / base) * 100) : 0;

  const weeklyData = computeWeeklyData(reunioes);

  const statusData = [
    { name: "Agendada",   value: reunioes.filter((r) => r.status === "agendada").length,   fill: "#8B5CF6" },
    { name: "Confirmada", value: reunioes.filter((r) => r.status === "confirmada").length,  fill: "#F59E0B" },
    { name: "Realizada",  value: realizadas, fill: "#84CC16" },
    { name: "Cancelada",  value: canceladas, fill: "#EF4444" },
  ].filter((d) => d.value > 0);

  const kpiCards = [
    {
      label: "Reuniões Totais",
      value: total,
      sub: "todas as reuniões",
      icon: <CalendarDays className="size-5 text-brand" />,
      bg: "bg-brand/5",
      ring: "ring-brand/10",
    },
    {
      label: "Realizadas",
      value: realizadas,
      sub: `${comparecimento}% comparecimento`,
      icon: <CheckCircle2 className="size-5 text-emerald-600" />,
      bg: "bg-emerald-50",
      ring: "ring-emerald-100",
    },
    {
      label: "Taxa de Desistência",
      value: `${desistencia}%`,
      sub: `${canceladas} desistência${canceladas !== 1 ? "s" : ""}`,
      icon: <XCircle className="size-5 text-red-500" />,
      bg: "bg-red-50",
      ring: "ring-red-100",
    },
    {
      label: "Próximas 7 dias",
      value: proximas7,
      sub: "reuniões marcadas",
      icon: <Timer className="size-5 text-amber-500" />,
      bg: "bg-amber-50",
      ring: "ring-amber-100",
    },
  ] as const;

  return (
    <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl ring-1 ${c.ring} shadow-sm p-5`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider leading-tight">{c.label}</p>
              <div className="size-9 rounded-xl bg-white/70 grid place-items-center shadow-sm shrink-0">
                {c.icon}
              </div>
            </div>
            <p className="text-3xl font-bold text-zinc-900">{c.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Stacked Bar */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 lg:col-span-3">
          <h3 className="text-sm font-semibold text-zinc-800 mb-4">Agendamentos por Semana</h3>
          {weeklyData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-zinc-400 text-sm">
              Sem dados para exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} barSize={30} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7", fontSize: "12px" }}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                />
                <Bar dataKey="Realizada"  stackId="a" fill="#84CC16" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Confirmada" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Agendada"   stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Cancelada"  stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-800 mb-4">Status das Reuniões</h3>
          {statusData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-zinc-400 text-sm">
              Sem dados
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full shrink-0 inline-block" style={{ backgroundColor: d.fill }} />
                      <span className="text-zinc-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-zinc-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 12. ClientesView ───────────────────────────────────────────────────────

function ClientesView({
  farmacias,
  reunioes,
  onAgendar,
}: {
  farmacias: { id: number; nome: string }[];
  reunioes: ReuniaoAPI[];
  onAgendar: (id: number, nome: string) => void;
}) {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [busca, setBusca] = useState("");

  const rows = farmacias
    .filter((f) => f.nome.toLowerCase().includes(busca.toLowerCase()))
    .map((f) => {
      const mine = reunioes.filter((r) => r.farmacia_id === f.id);
      const totalMes  = mine.filter((r) => r.data_reuniao.startsWith(mesAtual) && r.status !== "cancelada").length;
      const realizadas = mine.filter((r) => r.status === "realizada").length;
      const futuras    = mine.filter((r) => (r.status === "agendada" || r.status === "confirmada") && isFutura(r.data_reuniao)).length;
      const canceladas = mine.filter((r) => r.status === "cancelada").length;
      const proxima    = mine
        .filter((r) => (r.status === "agendada" || r.status === "confirmada") && isFutura(r.data_reuniao))
        .sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao))[0] ?? null;
      return { ...f, totalMes, realizadas, futuras, canceladas, proxima, total: mine.length };
    })
    .sort((a, b) => b.totalMes - a.totalMes || b.total - a.total);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm max-w-xs">
        <Search className="size-4 text-zinc-400 shrink-0" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar cliente..."
          className="bg-transparent outline-none text-sm flex-1"
        />
        {busca && (
          <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Farmácia</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center hidden sm:block">Este mês</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center hidden sm:block">Realizadas</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center hidden sm:block">Agendadas</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center hidden sm:block">Canceladas</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center hidden sm:block">Ação</p>
        </div>
        <div className="divide-y divide-zinc-50">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">
              {busca ? `Nenhuma farmácia encontrada para "${busca}".` : "Nenhuma farmácia cadastrada."}
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="px-5 py-4 grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 hover:bg-zinc-50/50 transition-colors"
              >
                {/* Nome + próxima */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-full bg-brand/10 grid place-items-center text-brand text-[11px] font-bold shrink-0">
                    {row.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{row.nome}</p>
                    {row.proxima ? (
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Próxima: {fmtDataCurta(row.proxima.data_reuniao)} às {fmtHora(row.proxima.data_reuniao)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-400 mt-0.5 italic">Sem próximas reuniões</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-center hidden sm:block">
                  <p className="text-sm font-bold text-zinc-900">{row.totalMes}</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-sm font-bold text-emerald-600">{row.realizadas}</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-sm font-bold text-amber-600">{row.futuras}</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-sm font-bold text-red-500">{row.canceladas}</p>
                </div>

                {/* Ação */}
                <button
                  onClick={() => onAgendar(row.id, row.nome)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand/5 text-brand ring-1 ring-brand/20 rounded-lg hover:bg-brand/10 shrink-0"
                >
                  <Plus className="size-3.5" /> Agendar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── 10. ReunioesPage ───────────────────────────────────────────────────────

type ViewTab = "dashboard" | "reunioes" | "clientes";

const VIEW_TABS: { value: ViewTab; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "reunioes",  label: "Reuniões"  },
  { value: "clientes",  label: "Clientes"  },
];

function ReunioesPage() {
  const qc = useQueryClient();

  // View tab
  const [viewTab, setViewTab] = useState<ViewTab>("dashboard");

  // Filtros (aba Reuniões)
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroBusca, setFiltroBusca] = useState("");

  // Modais / drawer
  const [modalAgendar, setModalAgendar] = useState<{ aberto: boolean; farmaciaId?: number; farmaciaNome?: string }>({ aberto: false });
  const [drawerReuniao, setDrawerReuniao] = useState<ReuniaoAPI | null>(null);
  const [editando, setEditando] = useState<ReuniaoAPI | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Ler ?google= param ao montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "connected") {
      toast.success("✅ Google Agenda conectado com sucesso!");
      qc.invalidateQueries({ queryKey: ["google-status"] });
      window.history.replaceState({}, "", "/reunioes");
    } else if (google === "error") {
      toast.error("Erro ao conectar o Google Agenda. Tente novamente.");
      window.history.replaceState({}, "", "/reunioes");
    } else if (google === "already_connected") {
      toast.info("Google Agenda já estava conectado.");
      window.history.replaceState({}, "", "/reunioes");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dados — sempre busca todas as reuniões; filtragem é client-side
  const { data: todasReunioes = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reunioes"],
    queryFn: () => getReunioes(),
    staleTime: 30_000,
  });

  const { data: googleStatus } = useQuery({
    queryKey: ["google-status"],
    queryFn: getGoogleStatus,
    staleTime: 60_000,
  });

  const { data: farmacias = [] } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias(),
    staleTime: 60_000,
  });

  // Farmácias filtradas por busca (aba Reuniões)
  const farmaciasFiltradas = farmacias.filter((f) =>
    f.nome.toLowerCase().includes(filtroBusca.toLowerCase()),
  );

  function reunioesDa(farmaciaId: number): ReuniaoAPI[] {
    return todasReunioes.filter((r) => r.farmacia_id === farmaciaId);
  }

  // Google OAuth
  async function handleConectarGoogle() {
    setGoogleLoading(true);
    try {
      await iniciarOAuthGoogle();
    } catch (err) {
      toast.error((err as Error).message ?? "Erro ao conectar Google Agenda.");
    } finally {
      setGoogleLoading(false);
    }
  }

  // Toast pós-criação com botão Google
  function handleSaved(googleLink?: string) {
    if (googleLink) {
      toast.success("Reunião agendada!", {
        action: {
          label: "📅 Adicionar ao Google Agenda",
          onClick: () => window.open(googleLink, "_blank"),
        },
        duration: 8000,
      });
    }
  }

  function handleEditar(r: ReuniaoAPI) {
    setDrawerReuniao(null);
    setTimeout(() => {
      setEditando(r);
      setModalAgendar({ aberto: true });
    }, 150);
  }

  function handleRefresh() {
    refetch();
    qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
  }

  return (
    <AppShell
      title="Reuniões com Clientes"
      headerRight={
        <button
          onClick={() => { setEditando(null); setModalAgendar({ aberto: true }); }}
          className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
        >
          <Plus className="size-3.5" /> Nova Reunião
        </button>
      }
    >
      {/* Tabs de navegação */}
      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl self-start">
        {VIEW_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setViewTab(t.value)}
            className={[
              "px-4 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
              viewTab === t.value
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                : "text-zinc-500 hover:text-zinc-800",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Dashboard ── */}
      {viewTab === "dashboard" && (
        <DashboardView reunioes={todasReunioes} loading={isFetching} />
      )}

      {/* ── Tab: Reuniões ── */}
      {viewTab === "reunioes" && (
        <>
          {/* Stats */}
          <ReunioeStats loading={isFetching} />

          {/* Barra de filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm flex-1">
              <Search className="size-4 text-zinc-400 shrink-0" />
              <input
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                placeholder="Buscar farmácia..."
                className="bg-transparent outline-none text-sm flex-1"
              />
              {filtroBusca && (
                <button onClick={() => setFiltroBusca("")} className="text-zinc-400 hover:text-zinc-700">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              title="Atualizar"
              className="p-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm text-zinc-400 hover:text-zinc-700 disabled:opacity-40"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Filtros de status */}
          <FiltroAbas value={filtroStatus} onChange={setFiltroStatus} />

          {/* Grid de farmácias */}
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl ring-1 ring-black/5 h-44 animate-pulse" />
              ))}
            </div>
          ) : farmaciasFiltradas.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 text-sm">
              {filtroBusca ? `Nenhuma farmácia encontrada para "${filtroBusca}".` : "Nenhuma farmácia cadastrada."}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {farmaciasFiltradas.map((f) => (
                <FarmaciaReuniaoCard
                  key={f.id}
                  farmaciaId={f.id}
                  farmaciaNome={f.nome}
                  reunioes={reunioesDa(f.id).filter((r) =>
                    filtroStatus === "todas" ? true : r.status === filtroStatus,
                  )}
                  onAgendar={(id, nome) => {
                    setEditando(null);
                    setModalAgendar({ aberto: true, farmaciaId: id, farmaciaNome: nome });
                  }}
                  onDetalhes={setDrawerReuniao}
                />
              ))}
            </div>
          )}

          {/* Banner Google Calendar */}
          {googleStatus?.google_configurado && !googleStatus?.conectado && (
            <BannerGoogleCalendar onConectar={handleConectarGoogle} loading={googleLoading} />
          )}
        </>
      )}

      {/* ── Tab: Clientes ── */}
      {viewTab === "clientes" && (
        <ClientesView
          farmacias={farmacias}
          reunioes={todasReunioes}
          onAgendar={(id, nome) => {
            setEditando(null);
            setModalAgendar({ aberto: true, farmaciaId: id, farmaciaNome: nome });
          }}
        />
      )}

      {/* ── Modais / Drawer (sempre montados) ── */}
      <ModalAgendarReuniao
        open={modalAgendar.aberto}
        onOpenChange={(v) => {
          setModalAgendar((s) => ({ ...s, aberto: v }));
          if (!v) setEditando(null);
        }}
        farmaciaIdPreset={modalAgendar.farmaciaId}
        farmaciaNomePreset={modalAgendar.farmaciaNome}
        editing={editando}
        onSaved={handleSaved}
      />

      <DrawerDetalhesReuniao
        reuniao={drawerReuniao}
        onClose={() => setDrawerReuniao(null)}
        onEditar={handleEditar}
        onRefresh={handleRefresh}
      />
    </AppShell>
  );
}
