import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CalendarDays, Plus, X, Clock, CheckCircle2, XCircle,
  Building2, Search, Pencil, Trash2, AlertCircle, Trophy,
  ExternalLink, Link2, MapPin, Timer, RefreshCw, Calendar,
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

          {/* Link Meet */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Link da Reunião</label>
            <input
              value={form.link_meet}
              onChange={set("link_meet")}
              placeholder="https://meet.google.com/..."
              className="mt-1 form-input w-full"
            />
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
                      <Link2 className="size-4 text-zinc-400" />
                      <a
                        href={r.link_meet}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline truncate"
                      >
                        Entrar na reunião
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

// ── 10. ReunioesPage ───────────────────────────────────────────────────────

function ReunioesPage() {
  const qc = useQueryClient();

  // Filtros
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

  // Dados
  const { data: reunioes = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reunioes", filtroStatus],
    queryFn: () => getReunioes(
      filtroStatus !== "todas" ? { status: filtroStatus as ReuniaoStatusAPI } : undefined,
    ),
    staleTime: 30_000,
  });

  const { data: googleStatus } = useQuery({
    queryKey: ["google-status"],
    queryFn: getGoogleStatus,
    staleTime: 60_000,
  });

  // Farmácias únicas com reuniões ou todas as farmácias cadastradas
  const { data: farmacias = [] } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias(),
    staleTime: 60_000,
  });

  // Agrupar reuniões por farmácia
  const farmaciasFiltradas = farmacias.filter((f) =>
    f.nome.toLowerCase().includes(filtroBusca.toLowerCase()),
  );

  function reunioesDa(farmaciaId: number): ReuniaoAPI[] {
    return reunioes.filter((r) => r.farmacia_id === farmaciaId);
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

  // Abrir drawer e fechar modal de edição ao mesmo tempo
  function handleEditar(r: ReuniaoAPI) {
    setDrawerReuniao(null);
    setTimeout(() => {
      setEditando(r);
      setModalAgendar({ aberto: true });
    }, 150);
  }

  return (
    <AppShell title="Reuniões com Clientes">
      {/* Stats */}
      <ReunioeStats loading={isFetching} />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Busca */}
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
        {/* Botão atualizar */}
        <button
          onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["reunioes-stats"] }); }}
          disabled={isFetching}
          title="Atualizar"
          className="p-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm text-zinc-400 hover:text-zinc-700 disabled:opacity-40"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Abas de status */}
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
              reunioes={reunioesDa(f.id)}
              onAgendar={(id, nome) => {
                setEditando(null);
                setModalAgendar({ aberto: true, farmaciaId: id, farmaciaNome: nome });
              }}
              onDetalhes={setDrawerReuniao}
            />
          ))}
        </div>
      )}

      {/* Banner Google Calendar (se não conectado e Google configurado) */}
      {googleStatus?.google_configurado && !googleStatus?.conectado && (
        <BannerGoogleCalendar onConectar={handleConectarGoogle} loading={googleLoading} />
      )}

      {/* Modal agendar / editar */}
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

      {/* Drawer detalhe */}
      <DrawerDetalhesReuniao
        reuniao={drawerReuniao}
        onClose={() => setDrawerReuniao(null)}
        onEditar={handleEditar}
        onRefresh={() => {
          refetch();
          qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
        }}
      />
    </AppShell>
  );
}
