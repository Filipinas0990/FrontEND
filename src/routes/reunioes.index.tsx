import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  CalendarDays, Plus, X, Clock, CheckCircle2, XCircle,
  Building2, Search, Pencil, Trash2, AlertCircle, Trophy,
  ExternalLink, MapPin, Timer, RefreshCw, Calendar, BarChart2,
  ChevronDown, ChevronUp, Lock, AlertTriangle, ChevronLeft, ChevronRight,
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
  verificarConflitoAgenda,
  getDisponibilidade,
  getCalendario,
  criarBloqueio,
  listarBloqueios,
  removerBloqueio,
  ApiError,
  type ReuniaoAPI,
  type ReuniaoStatusAPI,
  type ResultadoConflito,
  type BloqueioAgenda,
  type CalendarioDia,
} from "@/lib/api";
import { getUser } from "@/lib/auth";
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
import { GerenciadorContent } from "./reunioes.gerenciador";

// ── Rota ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/reunioes/")({
  component: ReunioesPage,
  head: () => ({ meta: [{ title: "Reuniões — GrupoSymbol" }] }),
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

const DIAS_SEMANA      = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES_NOME       = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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

// ── useVerificarConflito hook ──────────────────────────────────────────────

function useVerificarConflito(
  data: string,
  hora: string,
  duracao: number,
  reuniaoId?: number,
) {
  const [conflito, setConflito] = useState<ResultadoConflito | null>(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    setConflito(null);
    if (!data || !hora) { setVerificando(false); return; }

    const dt = formToISO(data, hora);
    setVerificando(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await verificarConflitoAgenda(dt, duracao, reuniaoId);
        if (!cancelled) setConflito(res.conflito ? res : null);
      } catch {
        if (!cancelled) setConflito(null);
      } finally {
        if (!cancelled) setVerificando(false);
      }
    }, 500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [data, hora, duracao, reuniaoId]);

  return { conflito, verificando };
}

// ── 5a. AlertaConflito ─────────────────────────────────────────────────────

function AlertaConflito({
  resultado,
  onVerGrade,
}: {
  resultado: ResultadoConflito;
  onVerGrade?: () => void;
}) {
  if (resultado.tipo === "bloqueio") {
    return (
      <div className="flex gap-2.5 p-3 bg-red-50 rounded-lg ring-1 ring-red-200">
        <Lock className="size-4 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-700">Agenda fechada neste dia</p>
          {resultado.detalhe && (
            <p className="text-[11px] text-red-600 mt-0.5">
              {resultado.detalhe.replace(/^Agenda fechada:\s*/i, "")}
            </p>
          )}
          <p className="text-[11px] text-red-500 mt-0.5">Escolha outra data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 p-3 bg-amber-50 rounded-lg ring-1 ring-amber-200">
      <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-700">Horário indisponível</p>
        {resultado.detalhe && (
          <p className="text-[11px] text-amber-600 mt-0.5">{resultado.detalhe}</p>
        )}
        {onVerGrade && (
          <button
            type="button"
            onClick={onVerGrade}
            className="mt-1 text-[11px] font-semibold text-amber-700 underline underline-offset-2 hover:opacity-75"
          >
            Ver grade de horários livres →
          </button>
        )}
      </div>
    </div>
  );
}

// ── 5b. GradeHorarios ─────────────────────────────────────────────────────

function GradeHorarios({
  data,
  open,
  onClose,
  onSelectHora,
}: {
  data: string;
  open: boolean;
  onClose: () => void;
  onSelectHora: (hora: string) => void;
}) {
  const { data: disponibilidade, isLoading } = useQuery({
    queryKey: ["disponibilidade", data],
    queryFn: () => getDisponibilidade(data),
    enabled: open && !!data,
    staleTime: 30_000,
  });

  const d = data ? new Date(`${data}T12:00:00`) : null;
  const titulo = d
    ? `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_NOME[d.getMonth()]} ${d.getFullYear()}`
    : "Grade de horários";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xs overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-zinc-100">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-brand" />
            {titulo}
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-1.5">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 bg-zinc-100 rounded-lg animate-pulse" />
            ))
          ) : disponibilidade?.dia_bloqueado ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Lock className="size-8 text-red-400" />
              <p className="font-semibold text-zinc-700 text-sm">Agenda fechada neste dia</p>
              {disponibilidade.bloqueios[0]?.motivo && (
                <p className="text-xs text-zinc-500">{disponibilidade.bloqueios[0].motivo}</p>
              )}
            </div>
          ) : (disponibilidade?.slots ?? []).length === 0 ? (
            <p className="text-center text-zinc-400 text-sm py-10">
              Sem informações de disponibilidade.
            </p>
          ) : (
            (disponibilidade?.slots ?? []).map((slot) => {
              const reuniaoOcupada = !slot.disponivel
                ? (disponibilidade?.reunioes_dia ?? []).find((r) =>
                    fmtHora(r.data_reuniao) === slot.hora,
                  )
                : null;

              return (
                <button
                  key={slot.hora}
                  onClick={() => {
                    if (slot.disponivel) { onSelectHora(slot.hora); onClose(); }
                  }}
                  disabled={!slot.disponivel}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                    slot.disponivel
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100 cursor-pointer"
                      : "bg-red-50 text-red-500 ring-1 ring-red-100 cursor-not-allowed opacity-75",
                  ].join(" ")}
                >
                  <span className="w-12 font-mono text-xs">{slot.hora}</span>
                  {slot.disponivel ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs">Livre — clique para usar</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3.5 text-red-400 shrink-0" />
                      <span className="text-xs truncate">
                        {reuniaoOcupada?.titulo ?? "Ocupado"}
                      </span>
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
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
  const [gradeAberta, setGradeAberta] = useState(false);
  const [erroConflito409, setErroConflito409] = useState<ResultadoConflito | null>(null);

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
    setErroConflito409(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, open, farmaciaIdPreset]);

  // Limpa o erro 409 quando o usuário altera data, hora ou duração
  useEffect(() => { setErroConflito409(null); }, [form.data, form.hora, form.duracao_minutos]);

  const { conflito, verificando } = useVerificarConflito(
    form.data,
    form.hora,
    Number(form.duracao_minutos),
    editing?.id,
  );

  const set = <K extends keyof AgendarForm>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const criarMut = useMutation({
    mutationFn: criarReuniaoAPI,
    onSuccess: (res) => {
      toast.success("Reunião agendada!");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      onSaved(res.google_event_sincronizado ? undefined : res.google_link);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      if ("status" in apiErr && apiErr.status === 409) {
        setErroConflito409({ conflito: true, tipo: "sobreposicao", detalhe: apiErr.message });
      } else {
        toast.error(err.message);
      }
    },
  });

  const editarMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof atualizarReuniaoAPI>[1] }) =>
      atualizarReuniaoAPI(id, data),
    onSuccess: () => {
      toast.success("Reunião atualizada!");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      if ("status" in apiErr && apiErr.status === 409) {
        setErroConflito409({ conflito: true, tipo: "sobreposicao", detalhe: apiErr.message });
      } else {
        toast.error(err.message);
      }
    },
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
  // Bloqueia submit apenas em conflito definitivo: dia fechado pelo admin OU rejeição 409 do servidor.
  // O pré-check de sobreposição é só um aviso — o backend é o árbitro final.
  const hayConflicto = conflito?.tipo === "bloqueio" || erroConflito409?.conflito === true;
  const conflitoAtivo = erroConflito409 ?? conflito;

  return (
    <>
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
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
                  Horário *
                  {verificando && <RefreshCw className="size-3 animate-spin text-zinc-400" />}
                </label>
                <input type="time" value={form.hora} onChange={set("hora")} className="mt-1 form-input w-full" />
              </div>
            </div>

            {/* Alerta de conflito */}
            {conflitoAtivo && (
              <AlertaConflito
                resultado={conflitoAtivo}
                onVerGrade={conflitoAtivo.tipo !== "bloqueio" ? () => setGradeAberta(true) : undefined}
              />
            )}

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
              disabled={saving || hayConflicto}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
            >
              {saving && <RefreshCw className="size-3.5 animate-spin" />}
              {editing ? "Salvar alterações" : "Agendar Reunião"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade de horários livres */}
      <GradeHorarios
        data={form.data}
        open={gradeAberta}
        onClose={() => setGradeAberta(false)}
        onSelectHora={(hora) => setForm((p) => ({ ...p, hora }))}
      />
    </>
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

// ── 10a. StatusFiltroDropdown ──────────────────────────────────────────────

const STATUS_FILTRO_OPTS: { value: FiltroStatus; label: string; cor: string | null }[] = [
  { value: "todas",      label: "Todos os status", cor: null       },
  { value: "agendada",   label: "Agendadas",        cor: "#F59E0B" },
  { value: "confirmada", label: "Confirmadas",      cor: "#10B981" },
  { value: "realizada",  label: "Realizadas",       cor: "#3B82F6" },
  { value: "cancelada",  label: "Canceladas",       cor: "#EF4444" },
];

function StatusFiltroDropdown({
  value,
  onChange,
}: {
  value: FiltroStatus;
  onChange: (v: FiltroStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = STATUS_FILTRO_OPTS.find((o) => o.value === value)!;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white rounded-xl ring-1 shadow-sm transition-all whitespace-nowrap select-none",
          open ? "ring-brand/60 text-zinc-900" : "ring-black/5 text-zinc-600 hover:ring-zinc-300 hover:text-zinc-900",
        ].join(" ")}
      >
        {current.cor ? (
          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: current.cor }} />
        ) : (
          <span className="size-2 rounded-full bg-zinc-300 shrink-0" />
        )}
        <span>{current.label}</span>
        <ChevronDown className={`size-3.5 text-zinc-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/8 py-1.5 min-w-[168px] animate-in fade-in slide-in-from-top-1 duration-100">
          {STATUS_FILTRO_OPTS.map((o) => {
            const isActive = value === o.value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={[
                  "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-brand/5 text-brand font-semibold"
                    : "text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                {o.cor ? (
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: o.cor }} />
                ) : (
                  <span className="size-2 rounded-full bg-zinc-300 shrink-0" />
                )}
                <span className="flex-1 text-left">{o.label}</span>
                {isActive && <CheckCircle2 className="size-3.5 text-brand shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 10b. StatusDropdownBadge — badge clicável que abre dropdown de status ──

type StatusOption = { value: ReuniaoStatusAPI; label: string };
function statusTransitions(current: ReuniaoStatusAPI): StatusOption[] {
  if (current === "agendada")   return [
    { value: "agendada",   label: "Agendada"   },
    { value: "confirmada", label: "Confirmada" },
    { value: "realizada",  label: "Realizada"  },
    { value: "cancelada",  label: "Cancelada"  },
  ];
  if (current === "confirmada") return [
    { value: "confirmada", label: "Confirmada" },
    { value: "realizada",  label: "Realizada"  },
    { value: "cancelada",  label: "Cancelada"  },
  ];
  return [{ value: current, label: STATUS_CFG[current].label }];
}

function StatusDropdownBadge({
  reuniao,
  onSelect,
}: {
  reuniao: ReuniaoAPI;
  onSelect: (r: ReuniaoAPI, novo: ReuniaoStatusAPI) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const cfg = STATUS_CFG[reuniao.status];
  const Icon = cfg.icon;
  const opts = statusTransitions(reuniao.status);
  const isFinal = reuniao.status === "realizada" || reuniao.status === "cancelada";

  if (isFinal) return <StatusBadge status={reuniao.status} size="xs" />;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-opacity hover:opacity-80 select-none ${cfg.bg} ${cfg.ring} ${cfg.text}`}
      >
        <Icon className="size-3" />
        {cfg.label}
        <ChevronDown className={`size-2.5 ml-0.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/8 py-1.5 min-w-[152px]">
          {opts.map((o) => {
            const oCfg = STATUS_CFG[o.value];
            const OIcon = oCfg.icon;
            const isActive = reuniao.status === o.value;
            return (
              <button
                key={o.value}
                onClick={(e) => { e.stopPropagation(); onSelect(reuniao, o.value); setOpen(false); }}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                  isActive ? `${oCfg.bg} ${oCfg.text} font-semibold` : "text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                <OIcon className="size-3 shrink-0" style={{ color: oCfg.cor }} />
                <span className="flex-1 text-left">{o.label}</span>
                {isActive && <CheckCircle2 className="size-3 shrink-0" style={{ color: oCfg.cor }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 10c. FarmaciaFiltroDropdown ───────────────────────────────────────────

function FarmaciaFiltroDropdown({
  value,
  onChange,
  opcoes,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white rounded-xl ring-1 shadow-sm transition-all whitespace-nowrap select-none max-w-[200px]",
          open ? "ring-brand/60 text-zinc-900" : "ring-black/5 text-zinc-600 hover:ring-zinc-300 hover:text-zinc-900",
        ].join(" ")}
      >
        <Building2 className="size-3.5 text-zinc-400 shrink-0" />
        <span className="truncate">{value || "Todas as farmácias"}</span>
        <ChevronDown className={`size-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/8 py-1.5 min-w-[210px] max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className={[
              "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
              !value ? "bg-brand/5 text-brand font-semibold" : "text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            <span className="size-2 rounded-full bg-zinc-300 shrink-0" />
            <span className="flex-1 text-left">Todas as farmácias</span>
            {!value && <CheckCircle2 className="size-3.5 text-brand shrink-0" />}
          </button>
          {opcoes.map((nome) => (
            <button
              key={nome}
              onClick={() => { onChange(nome); setOpen(false); }}
              className={[
                "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                value === nome ? "bg-brand/5 text-brand font-semibold" : "text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              <span className="size-2 rounded-full bg-brand/40 shrink-0" />
              <span className="flex-1 text-left truncate">{nome}</span>
              {value === nome && <CheckCircle2 className="size-3.5 text-brand shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 10d. ReuniaoListaRow ──────────────────────────────────────────────────

function ReuniaoListaRow({
  r,
  semana = false,
  onDetalhes,
  onStatusChange,
  onCancelar,
}: {
  r: ReuniaoAPI;
  semana?: boolean;
  onDetalhes: (r: ReuniaoAPI) => void;
  onStatusChange: (r: ReuniaoAPI, novo: ReuniaoStatusAPI) => void;
  onCancelar: (r: ReuniaoAPI) => void;
}) {
  const d = new Date(r.data_reuniao);
  const dia = String(d.getDate()).padStart(2, "0");
  const mesAbrev = MESES_NOME[d.getMonth()].toUpperCase();
  const mesFull = MESES_NOME[d.getMonth()].toLowerCase();
  const diaSemana = DIAS_SEMANA_FULL[d.getDay()];
  const cfg = STATUS_CFG[r.status];
  const canEdit = r.status !== "realizada" && r.status !== "cancelada";

  return (
    <div
      className={[
        "flex items-center gap-4 px-5 py-4 hover:bg-zinc-50/60 transition-colors group",
        "first:rounded-t-xl last:rounded-b-xl",
        semana ? "bg-brand/[0.018]" : "",
      ].join(" ")}
    >
      {/* Badge de data */}
      <div className="flex flex-col items-center w-8 shrink-0 text-center">
        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{mesAbrev}</span>
        <span className="text-[22px] font-bold text-zinc-800 leading-tight">{dia}</span>
      </div>

      {/* Separador colorido por status */}
      <div
        className="w-[3px] self-stretch rounded-full shrink-0"
        style={{ backgroundColor: cfg.cor + "80" }}
      />

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onDetalhes(r)}>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">{r.titulo}</p>
          {semana && isFutura(r.data_reuniao) && (
            <span className="text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Em breve
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
          {r.farmacia_nome}
          {" · "}
          {diaSemana}, {dia} {mesFull}
          {" · "}
          {fmtHora(r.data_reuniao)}
          {r.duracao_minutos > 0 && ` · ${r.duracao_minutos}min`}
          {r.local && ` · ${r.local}`}
          {r.gestor_nome && ` · ${r.gestor_nome}`}
        </p>
      </div>

      {/* Controles direitos */}
      <div className="flex items-center gap-2 shrink-0">
        <StatusDropdownBadge reuniao={r} onSelect={onStatusChange} />
        {canEdit ? (
          <button
            onClick={(e) => { e.stopPropagation(); onCancelar(r); }}
            title="Cancelar reunião"
            className="text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <span className="size-3.5 inline-block" />
        )}
      </div>
    </div>
  );
}

// ── 10. ListaReunioes ─────────────────────────────────────────────────────

function ListaReunioes({
  reunioes,
  loading,
  onDetalhes,
}: {
  reunioes: ReuniaoAPI[];
  loading: boolean;
  onDetalhes: (r: ReuniaoAPI) => void;
}) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroFarmacia, setFiltroFarmacia] = useState<string>("");
  const [realizarTarget, setRealizarTarget] = useState<ReuniaoAPI | null>(null);
  const [confirmCancelar, setConfirmCancelar] = useState<ReuniaoAPI | null>(null);

  const lista = reunioes
    .filter((r) => {
      const q = busca.toLowerCase();
      const matchQ = !q || r.titulo.toLowerCase().includes(q) || r.farmacia_nome.toLowerCase().includes(q);
      const matchS = filtroStatus === "todas" || r.status === filtroStatus;
      const matchF = !filtroFarmacia || r.farmacia_nome === filtroFarmacia;
      return matchQ && matchS && matchF;
    })
    .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao));

  // "Esta semana" — Segunda a Domingo
  const agora = new Date();
  const diaHoje = agora.getDay();
  const segunda = new Date(agora);
  segunda.setDate(agora.getDate() - (diaHoje === 0 ? 6 : diaHoje - 1));
  segunda.setHours(0, 0, 0, 0);
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  const semanaAtual = lista.filter((r) => {
    const d = new Date(r.data_reuniao);
    return d >= segunda && d <= domingo
      && r.status !== "realizada"
      && r.status !== "cancelada";
  });
  const restante = lista.filter((r) => {
    const d = new Date(r.data_reuniao);
    const naSemana = d >= segunda && d <= domingo;
    return !naSemana || r.status === "realizada" || r.status === "cancelada";
  });

  // Agrupar restante por mês
  type MesGrupo = { key: string; label: string; items: ReuniaoAPI[] };
  const gruposMes: MesGrupo[] = [];
  for (const r of restante) {
    const d = new Date(r.data_reuniao);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES_FULL[d.getMonth()]} ${d.getFullYear()}`;
    let grupo = gruposMes.find((g) => g.key === key);
    if (!grupo) { grupo = { key, label, items: [] }; gruposMes.push(grupo); }
    grupo.items.push(r);
  }

  // Farmácias únicas para filtro
  const farmaciasUnicas = Array.from(new Set(reunioes.map((r) => r.farmacia_nome))).sort();

  const confirmarMut = useMutation({
    mutationFn: (id: number) => confirmarReuniao(id),
    onSuccess: () => {
      toast.success("Reunião confirmada!");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelarMut = useMutation({
    mutationFn: (id: number) => cancelarReuniao(id),
    onSuccess: () => {
      toast.success("Reunião cancelada.");
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
      setConfirmCancelar(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleStatusChange(r: ReuniaoAPI, novo: ReuniaoStatusAPI) {
    if (novo === r.status) return;
    if (novo === "confirmada") confirmarMut.mutate(r.id);
    else if (novo === "realizada") setRealizarTarget(r);
    else if (novo === "cancelada") setConfirmCancelar(r);
  }

  const semFiltro = !busca && filtroStatus === "todas" && !filtroFarmacia;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {/* Barra busca + filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm flex-1 min-w-[180px]">
          <Search className="size-4 text-zinc-400 shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título ou cliente..."
            className="bg-transparent outline-none text-sm flex-1 min-w-0"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700 shrink-0">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <FarmaciaFiltroDropdown value={filtroFarmacia} onChange={setFiltroFarmacia} opcoes={farmaciasUnicas} />
        <StatusFiltroDropdown value={filtroStatus} onChange={setFiltroStatus} />
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm py-16 text-center text-zinc-400 text-sm">
          {semFiltro ? "Nenhuma reunião cadastrada ainda." : "Nenhuma reunião encontrada para este filtro."}
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Esta Semana ── */}
          {semanaAtual.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-[10px] font-bold text-brand uppercase tracking-widest">⚡ Esta semana</span>
                <span className="text-[11px] text-zinc-400">
                  {semanaAtual.length} {semanaAtual.length === 1 ? "reunião" : "reuniões"}
                </span>
              </div>
              <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm divide-y divide-zinc-50">
                {semanaAtual.map((r) => (
                  <ReuniaoListaRow
                    key={r.id}
                    r={r}
                    semana
                    onDetalhes={onDetalhes}
                    onStatusChange={handleStatusChange}
                    onCancelar={setConfirmCancelar}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Grupos por mês ── */}
          {gruposMes.map((grupo) => {
            const ativas = grupo.items.filter((r) => r.status !== "cancelada").length;
            return (
              <div key={grupo.key}>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="h-px flex-1 bg-zinc-200" />
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                    {grupo.label}
                  </span>
                  <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                    · {ativas} {ativas === 1 ? "reunião" : "reuniões"}
                  </span>
                  <div className="h-px flex-1 bg-zinc-200" />
                </div>
                <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm divide-y divide-zinc-50">
                  {grupo.items.map((r) => (
                    <ReuniaoListaRow
                      key={r.id}
                      r={r}
                      onDetalhes={onDetalhes}
                      onStatusChange={handleStatusChange}
                      onCancelar={setConfirmCancelar}
                    />
                  ))}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* Modal marcar realizada */}
      <ModalMarcarRealizada
        reuniao={realizarTarget}
        onClose={() => setRealizarTarget(null)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["reunioes"] });
          qc.invalidateQueries({ queryKey: ["reunioes-stats"] });
        }}
      />

      {/* Confirmar cancelamento */}
      <AlertDialog open={!!confirmCancelar} onOpenChange={(v) => !v && setConfirmCancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCancelar?.google_event_id
                ? "O evento também será removido do Google Calendar."
                : "A reunião será marcada como cancelada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmCancelar && cancelarMut.mutate(confirmCancelar.id)}
              disabled={cancelarMut.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelarMut.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [historicoFarmacia, setHistoricoFarmacia] = useState<{ id: number; nome: string } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  // Histórico da farmácia selecionada
  const historicoLista = historicoFarmacia
    ? reunioes
        .filter((r) => r.farmacia_id === historicoFarmacia.id)
        .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao))
    : [];

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
        <div className="px-5 py-3.5 border-b border-zinc-100 grid grid-cols-[1fr_auto_auto_auto] items-center gap-6">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Farmácia</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center w-20">Realizadas</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center w-20">Agendadas</p>
          <div />
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
                onClick={() => { setHistoricoFarmacia({ id: row.id, nome: row.nome }); setExpandedId(null); }}
                className="px-5 py-4 grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 hover:bg-zinc-50/60 transition-colors cursor-pointer"
              >
                {/* Nome + próxima */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-full bg-brand/10 grid place-items-center text-brand text-[11px] font-bold shrink-0">
                    {row.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{row.nome}</p>
                    {row.proxima ? (
                      <p className="text-[11px] text-brand mt-0.5">
                        Próxima: {fmtDataCurta(row.proxima.data_reuniao)} às {fmtHora(row.proxima.data_reuniao)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-400 mt-0.5 italic">Sem próximas reuniões</p>
                    )}
                  </div>
                </div>

                {/* Realizadas */}
                <div className="text-center w-20">
                  <p className="text-sm font-bold text-emerald-600">{row.realizadas}</p>
                </div>

                {/* Agendadas */}
                <div className="text-center w-20">
                  <p className="text-sm font-bold text-amber-500">{row.futuras}</p>
                </div>

                {/* Agendar */}
                <button
                  onClick={(e) => { e.stopPropagation(); onAgendar(row.id, row.nome); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand/5 text-brand ring-1 ring-brand/20 rounded-lg hover:bg-brand/10 shrink-0"
                >
                  <Plus className="size-3.5" /> Agendar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sheet — Histórico de reuniões */}
      <Sheet open={!!historicoFarmacia} onOpenChange={(v) => !v && setHistoricoFarmacia(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {historicoFarmacia && (
            <>
              <SheetHeader className="pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-brand/10 grid place-items-center text-brand text-xs font-bold shrink-0">
                    {historicoFarmacia.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="text-sm font-semibold text-zinc-900">
                      {historicoFarmacia.nome}
                    </SheetTitle>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {historicoLista.length} {historicoLista.length === 1 ? "reunião" : "reuniões"} no histórico
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="py-3 border-b border-zinc-100">
                <button
                  onClick={() => { onAgendar(historicoFarmacia.id, historicoFarmacia.nome); setHistoricoFarmacia(null); }}
                  className="flex items-center gap-1.5 w-full justify-center text-sm font-medium text-brand hover:opacity-80 px-4 py-2 rounded-lg bg-brand/5 ring-1 ring-brand/10"
                >
                  <Plus className="size-3.5" /> Nova Reunião
                </button>
              </div>

              <div className="py-4 space-y-2">
                {historicoLista.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">
                    Nenhuma reunião registrada para este cliente.
                  </div>
                ) : (
                  historicoLista.map((r) => {
                    const d         = new Date(r.data_reuniao);
                    const dia       = String(d.getDate()).padStart(2, "0");
                    const mesAbrev  = MESES_NOME[d.getMonth()].toUpperCase();
                    const isExpanded = expandedId === r.id;
                    const cfg        = STATUS_CFG[r.status];

                    return (
                      <div key={r.id} className="bg-white rounded-xl ring-1 ring-black/5 overflow-hidden transition-all">
                        {/* Linha principal */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50/60 transition-colors"
                        >
                          {/* Badge data */}
                          <div className="flex flex-col items-center w-8 shrink-0 text-center">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{mesAbrev}</span>
                            <span className="text-[18px] font-bold text-zinc-800 leading-tight">{dia}</span>
                          </div>

                          {/* Separador */}
                          <div className="w-px self-stretch bg-zinc-100 shrink-0" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-800 truncate">{r.titulo}</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {fmtHora(r.data_reuniao)}
                              {r.duracao_minutos > 0 && ` · ${r.duracao_minutos}min`}
                              {r.local && ` · ${r.local}`}
                            </p>
                          </div>

                          {/* Status + chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={r.status} size="xs" />
                            <ChevronDown
                              className={`size-3.5 transition-transform duration-200 ${cfg.text} ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </button>

                        {/* Observações expandidas */}
                        {isExpanded && (
                          <div className={`px-4 pb-4 pt-1 border-t ${cfg.ring} ${cfg.bg}`}>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 ${cfg.text}" style={{ color: cfg.cor }}>
                              Observações
                            </p>
                            {r.observacoes ? (
                              <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                                {r.observacoes}
                              </p>
                            ) : (
                              <p className="text-sm text-zinc-400 italic">
                                Sem observações registradas.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── 10. ReunioesPage ───────────────────────────────────────────────────────

// ── 13. CalendarioMensal ───────────────────────────────────────────────────

const MESES_FULL = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const CABECALHO_SEMANA = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

function CalendarioMensal({
  ano,
  mes,
  onAnoMesChange,
  onDiaClick,
}: {
  ano: number;
  mes: number; // 1-12
  onAnoMesChange: (ano: number, mes: number) => void;
  onDiaClick: (data: string) => void;
}) {
  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;

  const { data: calendario, isLoading } = useQuery({
    queryKey: ["calendario", mesStr],
    queryFn: () => getCalendario(mesStr),
    staleTime: 60_000,
  });

  const diaMap = new Map<string, CalendarioDia>();
  for (const d of calendario?.dias ?? []) diaMap.set(d.data, d);

  // Grade Monday-first
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia   = new Date(ano, mes, 0);
  const offset      = (primeiroDia.getDay() + 6) % 7; // Mon=0 … Sun=6

  const celulas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: ultimoDia.getDate() }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));

  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,"0")}-${String(agora.getDate()).padStart(2,"0")}`;

  function prevMes() {
    if (mes === 1) onAnoMesChange(ano - 1, 12);
    else onAnoMesChange(ano, mes - 1);
  }
  function nextMes() {
    if (mes === 12) onAnoMesChange(ano + 1, 1);
    else onAnoMesChange(ano, mes + 1);
  }

  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <button onClick={prevMes} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
          <ChevronLeft className="size-4" />
        </button>
        <h3 className="text-sm font-semibold text-zinc-800">{MESES_FULL[mes-1]} {ano}</h3>
        <button onClick={nextMes} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="p-4">
        {/* Cabeçalho */}
        <div className="grid grid-cols-7 mb-1">
          {CABECALHO_SEMANA.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Dias */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-zinc-50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {semanas.map((semana, si) => (
              <div key={si} className="grid grid-cols-7 gap-0.5">
                {semana.map((dia, di) => {
                  if (!dia) return <div key={di} className="h-14" />;

                  const dataStr = `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                  const info    = diaMap.get(dataStr);
                  const isHoje  = dataStr === hoje;
                  const bloqueado  = info?.bloqueado ?? false;
                  const total      = info?.reunioes.total ?? 0;
                  const confirmadas = info?.reunioes.confirmadas ?? 0;

                  return (
                    <button
                      key={di}
                      onClick={() => onDiaClick(dataStr)}
                      className={[
                        "relative flex flex-col items-center justify-start pt-1.5 rounded-lg h-14 text-sm font-medium transition-all hover:ring-1 ring-inset",
                        isHoje
                          ? "ring-2 ring-brand bg-brand/5 text-brand"
                          : bloqueado
                          ? "bg-red-50 text-red-400 hover:ring-red-200"
                          : total > 0 && confirmadas > 0
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 hover:ring-emerald-300"
                          : total > 0
                          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100 hover:ring-amber-300"
                          : "text-zinc-600 hover:bg-zinc-50 hover:ring-zinc-100",
                      ].join(" ")}
                    >
                      <span className="text-sm font-semibold">{dia}</span>
                      {bloqueado ? (
                        <Lock className="size-3 text-red-400 mt-0.5" />
                      ) : total > 0 ? (
                        <span className={[
                          "mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                          confirmadas > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                        ].join(" ")}>
                          {total}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="px-5 py-3 border-t border-zinc-50 flex items-center gap-5 flex-wrap">
        {[
          { cor: "bg-brand", label: "Hoje" },
          { cor: "bg-amber-400", label: "Com reuniões" },
          { cor: "bg-emerald-400", label: "Confirmadas" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className={`size-2 rounded-full ${l.cor} inline-block`} />
            {l.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Lock className="size-3 text-red-400" />
          Bloqueado
        </div>
      </div>
    </div>
  );
}

// ── 14. ModalBloqueio ──────────────────────────────────────────────────────

function ModalBloqueio({
  open,
  onOpenChange,
  dataPreset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dataPreset?: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"dia" | "horario">("dia");
  const [data, setData] = useState(dataPreset ?? hojeISO());
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open) {
      setData(dataPreset ?? hojeISO());
      setTipo("dia");
      setMotivo("");
    }
  }, [open, dataPreset]);

  const mut = useMutation({
    mutationFn: criarBloqueio,
    onSuccess: () => {
      toast.success("Agenda bloqueada!");
      qc.invalidateQueries({ queryKey: ["calendario"] });
      qc.invalidateQueries({ queryKey: ["bloqueios"] });
      qc.invalidateQueries({ queryKey: ["disponibilidade"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSave() {
    if (!data) { toast.error("Selecione uma data."); return; }
    if (tipo === "horario" && (!horaInicio || !horaFim)) {
      toast.error("Informe o horário de início e fim.");
      return;
    }
    mut.mutate({
      data,
      dia_inteiro: tipo === "dia",
      hora_inicio: tipo === "horario" ? horaInicio : undefined,
      hora_fim:    tipo === "horario" ? horaFim    : undefined,
      motivo:      motivo || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4 text-red-500" />
            Fechar Agenda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "dia"     as const, label: "🔒 Dia inteiro"         },
              { v: "horario" as const, label: "⏰ Horário específico"  },
            ].map((t) => (
              <button
                key={t.v}
                onClick={() => setTipo(t.v)}
                className={[
                  "px-3 py-2.5 text-xs font-semibold rounded-lg ring-1 transition-all",
                  tipo === t.v
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-zinc-50 text-zinc-600 ring-zinc-200 hover:bg-zinc-100",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Data *</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 form-input w-full"
            />
          </div>

          {/* Horário parcial */}
          {tipo === "horario" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Das</label>
                <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="mt-1 form-input w-full" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Até</label>
                <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className="mt-1 form-input w-full" />
              </div>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Motivo (opcional)</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Viagem para São Paulo"
              className="mt-1 form-input w-full"
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
            disabled={mut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
            🔒 Fechar Agenda
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 15. ListaBloqueios ─────────────────────────────────────────────────────

function ListaBloqueios({
  mes,
  onAdicionarBloqueio,
}: {
  mes: string;
  onAdicionarBloqueio: () => void;
}) {
  const qc = useQueryClient();

  const { data: bloqueios = [], isLoading } = useQuery({
    queryKey: ["bloqueios", mes],
    queryFn: () => listarBloqueios(mes),
    staleTime: 30_000,
  });

  const removerMut = useMutation({
    mutationFn: removerBloqueio,
    onSuccess: () => {
      toast.success("Bloqueio removido.");
      qc.invalidateQueries({ queryKey: ["bloqueios"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      qc.invalidateQueries({ queryKey: ["disponibilidade"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Bloqueios de Agenda</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Dias ou horários fechados para agendamento</p>
        </div>
        <button
          onClick={onAdicionarBloqueio}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Plus className="size-3.5" /> Adicionar Bloqueio
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 bg-zinc-50 rounded-lg animate-pulse" />)}
        </div>
      ) : bloqueios.length === 0 ? (
        <div className="py-10 text-center text-zinc-400 text-sm">
          Nenhum bloqueio ativo neste período.
        </div>
      ) : (
        <div className="divide-y divide-zinc-50">
          {bloqueios.map((b: BloqueioAgenda) => {
            const d = new Date(`${b.data}T12:00:00`);
            const dataFmt = `${String(d.getDate()).padStart(2,"0")}/${MESES_NOME[d.getMonth()]}`;
            const range   = b.dia_inteiro ? "Dia inteiro" : `${b.hora_inicio} às ${b.hora_fim}`;

            return (
              <div key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="size-8 rounded-full bg-red-50 grid place-items-center shrink-0">
                  <Lock className="size-3.5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">{dataFmt} — {range}</p>
                  {b.motivo && <p className="text-xs text-zinc-500 truncate">{b.motivo}</p>}
                </div>
                <button
                  onClick={() => removerMut.mutate(b.id)}
                  disabled={removerMut.isPending}
                  title="Remover bloqueio"
                  className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 16. AgendaView ─────────────────────────────────────────────────────────

function AgendaView({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [diaDetalhe, setDiaDetalhe] = useState<string | null>(null);
  const [modalBloqueio, setModalBloqueio] = useState(false);
  const [dataBloquear, setDataBloquear] = useState<string | undefined>(undefined);

  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;

  const { data: disponibilidadeDia, isLoading: loadingDia } = useQuery({
    queryKey: ["disponibilidade", diaDetalhe],
    queryFn: () => getDisponibilidade(diaDetalhe!),
    enabled: !!diaDetalhe,
    staleTime: 30_000,
  });

  function handleAbrirBloqueio(data?: string) {
    setDataBloquear(data);
    setModalBloqueio(true);
  }

  function onBloqueioSaved() {
    setDiaDetalhe(null);
    qc.invalidateQueries({ queryKey: ["calendario"] });
    qc.invalidateQueries({ queryKey: ["bloqueios"] });
  }

  return (
    <div className="space-y-4">
      <CalendarioMensal
        ano={ano}
        mes={mes}
        onAnoMesChange={(a, m) => { setAno(a); setMes(m); }}
        onDiaClick={setDiaDetalhe}
      />

      {isAdmin && (
        <ListaBloqueios
          mes={mesStr}
          onAdicionarBloqueio={() => handleAbrirBloqueio(undefined)}
        />
      )}

      {/* Detalhe do dia */}
      <Sheet open={!!diaDetalhe} onOpenChange={(v) => !v && setDiaDetalhe(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {diaDetalhe && (() => {
            const d = new Date(`${diaDetalhe}T12:00:00`);
            const titulo = `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_FULL[d.getMonth()]} ${d.getFullYear()}`;
            return (
              <>
                <SheetHeader className="pb-4 border-b border-zinc-100">
                  <SheetTitle className="text-sm font-semibold text-zinc-900">{titulo}</SheetTitle>
                </SheetHeader>

                <div className="py-5 space-y-4">
                  {loadingDia ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 bg-zinc-50 rounded-lg animate-pulse" />
                    ))
                  ) : (
                    <>
                      {/* Bloqueio ativo */}
                      {disponibilidadeDia?.dia_bloqueado && (
                        <div className="flex gap-3 p-4 bg-red-50 rounded-xl ring-1 ring-red-100">
                          <Lock className="size-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-red-700">Agenda fechada</p>
                            {disponibilidadeDia.bloqueios[0]?.motivo && (
                              <p className="text-xs text-red-600 mt-0.5">{disponibilidadeDia.bloqueios[0].motivo}</p>
                            )}
                            {!disponibilidadeDia.bloqueios[0]?.dia_inteiro && (
                              <p className="text-xs text-red-500 mt-0.5">
                                {disponibilidadeDia.bloqueios[0]?.hora_inicio} — {disponibilidadeDia.bloqueios[0]?.hora_fim}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reuniões do dia */}
                      {(disponibilidadeDia?.reunioes_dia?.length ?? 0) > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            Reuniões ({disponibilidadeDia!.reunioes_dia.length})
                          </p>
                          <div className="space-y-2">
                            {disponibilidadeDia!.reunioes_dia.map((r) => (
                              <div key={r.id} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg ring-1 ring-zinc-100">
                                <CalendarDays className="size-4 text-brand mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-zinc-800 truncate">{r.titulo}</p>
                                  <p className="text-[11px] text-zinc-500 mt-0.5">
                                    {fmtHora(r.data_reuniao)}
                                    {r.duracao_minutos > 0 && ` · ${r.duracao_minutos}min`}
                                    {" · "}{r.farmacia_nome}
                                  </p>
                                </div>
                                <StatusBadge status={r.status} size="xs" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : !disponibilidadeDia?.dia_bloqueado ? (
                        <div className="text-center py-8 text-zinc-400 text-sm">
                          Dia livre — nenhuma reunião agendada.
                        </div>
                      ) : null}

                      {/* Admin: bloquear */}
                      {isAdmin && !disponibilidadeDia?.dia_bloqueado && (
                        <div className="pt-2 border-t border-zinc-100">
                          <button
                            onClick={() => { handleAbrirBloqueio(diaDetalhe); setDiaDetalhe(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 transition-colors"
                          >
                            <Lock className="size-4" />
                            Bloquear este dia
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {isAdmin && (
        <ModalBloqueio
          open={modalBloqueio}
          onOpenChange={setModalBloqueio}
          dataPreset={dataBloquear}
          onSaved={onBloqueioSaved}
        />
      )}
    </div>
  );
}

// ── ViewTab ────────────────────────────────────────────────────────────────

type ViewTab = "dashboard" | "reunioes" | "clientes" | "agenda" | "gerenciador";

const VIEW_TABS: { value: ViewTab; label: string; icon?: React.ReactNode }[] = [
  { value: "dashboard",   label: "Dashboard"    },
  { value: "reunioes",    label: "Reuniões"     },
  { value: "clientes",    label: "Clientes"     },
  { value: "agenda",      label: "Agenda",      icon: <CalendarDays className="size-3.5" /> },
  { value: "gerenciador", label: "Gerenciador", icon: <BarChart2    className="size-3.5" /> },
];

function ReunioesPage() {
  const qc = useQueryClient();
  const isAdmin = getUser()?.is_admin === true;

  // View tab
  const [viewTab, setViewTab] = useState<ViewTab>("dashboard");
  const [gerenciadorMes, setGerenciadorMes] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

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
      toast.success("Google Agenda conectado com sucesso!");
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
          label: "Adicionar ao Google Agenda",
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
        viewTab === "clientes" ? (
          <button
            onClick={() => { setEditando(null); setModalAgendar({ aberto: true }); }}
            className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
          >
            <Plus className="size-3.5" /> Nova Reunião
          </button>
        ) : null
      }
    >
      {/* Tabs de navegação */}
      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl self-start">
        {VIEW_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setViewTab(t.value)}
            className={[
              "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
              viewTab === t.value
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                : "text-zinc-500 hover:text-zinc-800",
            ].join(" ")}
          >
            {t.icon}{t.label}
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
          <ListaReunioes
            reunioes={todasReunioes}
            loading={isFetching}
            onDetalhes={setDrawerReuniao}
          />

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

      {/* ── Tab: Agenda ── */}
      {viewTab === "agenda" && (
        <AgendaView isAdmin={isAdmin} />
      )}

      {/* ── Tab: Gerenciador ── */}
      {viewTab === "gerenciador" && (
        <GerenciadorContent mes={gerenciadorMes} onMesChange={setGerenciadorMes} />
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
