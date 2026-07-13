import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Megaphone, Plus, ChevronLeft, ChevronRight, Building2,
  RefreshCw, Pencil, XCircle, CheckCircle2, ChevronDown, Rocket,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getAcoes, getAcaoResumo, criarAcao, editarAcao, cancelarAcaoMarketing,
  type AcaoMarketing, type AcaoStatus,
} from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/acoes/")({
  component: AcoesPage,
  head: () => ({ meta: [{ title: "Ações de Marketing — GrupoSymbol" }] }),
});

// ── Helpers de mês ─────────────────────────────────────────────────────────

const MESES_FULL = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function mesAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_FULL[m - 1]} ${y}`;
}

// ── Status config ───────────────────────────────────────────────────────────

const STATUS_CFG: Record<AcaoStatus, { label: string; bg: string; text: string; ring: string; dot: string }> = {
  planejada:    { label: "Planejada",    bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200",   dot: "#F59E0B" },
  em_andamento: { label: "Em Andamento", bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-200",    dot: "#3B82F6" },
  concluida:    { label: "Concluída",    bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", dot: "#10B981" },
  cancelada:    { label: "Cancelada",    bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200",     dot: "#EF4444" },
};

// ── Tipos config ────────────────────────────────────────────────────────────

const TIPO_OPTS = [
  { value: "abre_mes",  label: "Abre Mês",  cor: "#3B82F6" },
  { value: "fecha_mes", label: "Fecha Mês", cor: "#8B5CF6" },
  { value: "campanha",  label: "Campanha",  cor: "#EC4899" },
  { value: "promocao",  label: "Promoção",  cor: "#F97316" },
  { value: "evento",    label: "Evento",    cor: "#14B8A6" },
  { value: "outro",     label: "Outro",     cor: "#6B7280" },
];

const COR_PALETTE = ["#3B82F6","#8B5CF6","#EC4899","#F97316","#14B8A6","#10B981","#F59E0B","#6B7280","#EF4444"];

function tipoLabel(tipo: string): string {
  return TIPO_OPTS.find((t) => t.value === tipo)?.label ?? tipo;
}

function tipoCor(tipo: string): string {
  return TIPO_OPTS.find((t) => t.value === tipo)?.cor ?? "#6B7280";
}

// ── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AcaoStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.cancelada;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${cfg.bg} ${cfg.ring} ${cfg.text}`}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── FiltroDropdown genérico ─────────────────────────────────────────────────

function FiltroDropdown<T extends string>({
  label, value, onChange, opcoes,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  opcoes: { value: T; label: string; cor?: string }[];
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

  const current = opcoes.find((o) => o.value === value) ?? opcoes[0];

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
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/8 py-1.5 min-w-[168px]">
          {opcoes.map((o) => {
            const isActive = value === o.value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={[
                  "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                  isActive ? "bg-brand/5 text-brand font-semibold" : "text-zinc-700 hover:bg-zinc-50",
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

// ── Modal de Criar / Editar Ação ────────────────────────────────────────────

interface AcaoForm {
  nome: string;
  tipo: string;
  tipoCustom: string;
  mes_referencia: string;
  status: AcaoStatus;
  cor: string;
  descricao: string;
}

function ModalAcao({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AcaoMarketing | null;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AcaoForm>({
    nome: "",
    tipo: "abre_mes",
    tipoCustom: "",
    mes_referencia: mesAtual(),
    status: "planejada",
    cor: "#3B82F6",
    descricao: "",
  });
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const tipoKnown = TIPO_OPTS.some((t) => t.value === editing.tipo);
      setForm({
        nome: editing.nome,
        tipo: tipoKnown ? editing.tipo : "outro",
        tipoCustom: tipoKnown ? "" : editing.tipo,
        mes_referencia: editing.mes_referencia,
        status: editing.status,
        cor: editing.cor ?? tipoCor(editing.tipo),
        descricao: editing.descricao ?? "",
      });
    } else {
      setForm({
        nome: "",
        tipo: "abre_mes",
        tipoCustom: "",
        mes_referencia: mesAtual(),
        status: "planejada",
        cor: "#3B82F6",
        descricao: "",
      });
    }
    setCancelConfirm(false);
  }, [open, editing]);

  const criarMut = useMutation({
    mutationFn: criarAcao,
    onSuccess: () => {
      toast.success("Ação criada!");
      qc.invalidateQueries({ queryKey: ["acoes"] });
      qc.invalidateQueries({ queryKey: ["acoes-resumo"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editarMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof editarAcao>[1] }) =>
      editarAcao(id, data),
    onSuccess: () => {
      toast.success("Ação atualizada!");
      qc.invalidateQueries({ queryKey: ["acoes"] });
      qc.invalidateQueries({ queryKey: ["acoes-resumo"] });
      qc.invalidateQueries({ queryKey: ["acao", editing?.id] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelarMut = useMutation({
    mutationFn: () => cancelarAcaoMarketing(editing!.id),
    onSuccess: () => {
      toast.success("Ação cancelada.");
      qc.invalidateQueries({ queryKey: ["acoes"] });
      qc.invalidateQueries({ queryKey: ["acoes-resumo"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSave() {
    const tipoFinal = form.tipo === "outro" ? (form.tipoCustom.trim() || "outro") : form.tipo;
    if (!form.nome.trim() || !tipoFinal || !form.mes_referencia) {
      toast.error("Preencha nome, tipo e mês de referência.");
      return;
    }
    const payload = {
      nome: form.nome.trim(),
      tipo: tipoFinal,
      mes_referencia: form.mes_referencia,
      status: form.status,
      cor: form.cor || undefined,
      descricao: form.descricao.trim() || undefined,
    };
    if (editing) {
      editarMut.mutate({ id: editing.id, data: payload });
    } else {
      criarMut.mutate(payload);
    }
  }

  const saving = criarMut.isPending || editarMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-brand" />
              {editing ? "Editar Ação" : "Nova Ação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Ação Abre Mês — Julho"
                className="mt-1 form-input w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((p) => ({ ...p, tipo: v, cor: v !== "outro" ? tipoCor(v) : p.cor }));
                  }}
                  className="mt-1 form-input w-full"
                >
                  {TIPO_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Mês *</label>
                <input
                  type="month"
                  value={form.mes_referencia}
                  onChange={(e) => setForm((p) => ({ ...p, mes_referencia: e.target.value }))}
                  className="mt-1 form-input w-full"
                />
              </div>
            </div>

            {form.tipo === "outro" && (
              <div>
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Tipo personalizado</label>
                <input
                  value={form.tipoCustom}
                  onChange={(e) => setForm((p) => ({ ...p, tipoCustom: e.target.value }))}
                  placeholder="Ex: Parceria Laboratório"
                  className="mt-1 form-input w-full"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as AcaoStatus }))}
                className="mt-1 form-input w-full"
              >
                <option value="planejada">Planejada</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Cor</label>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {COR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, cor: c }))}
                    className={`size-7 rounded-full transition-all ${form.cor === c ? "ring-2 ring-offset-2 ring-zinc-500 scale-110" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Descrição</label>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                rows={3}
                placeholder="Detalhes sobre esta ação..."
                className="mt-1 form-input w-full resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2">
            {editing && editing.status !== "cancelada" && (
              <button
                type="button"
                onClick={() => setCancelConfirm(true)}
                className="mr-auto text-xs text-red-500 hover:text-red-700 font-medium"
              >
                <XCircle className="size-3.5 inline mr-1" />
                Cancelar ação
              </button>
            )}
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
            >
              {saving && <RefreshCw className="size-3.5 animate-spin" />}
              {editing ? "Salvar" : "Criar Ação"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta ação?</AlertDialogTitle>
            <AlertDialogDescription>
              A ação será marcada como cancelada. Ela pode ser reativada depois via edição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelarMut.mutate()}
              disabled={cancelarMut.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelarMut.isPending ? "Cancelando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── AcoesPage ───────────────────────────────────────────────────────────────

function AcoesPage() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const [mes, setMes] = useState(mesAtual);
  const [filtroStatus, setFiltroStatus] = useState<"" | AcaoStatus>("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AcaoMarketing | null>(null);

  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: ["acoes-resumo", mes],
    queryFn: () => getAcaoResumo(mes),
    staleTime: 30_000,
  });

  const { data: acoes = [], isLoading: loadingAcoes, isFetching } = useQuery({
    queryKey: ["acoes", mes],
    queryFn: () => getAcoes({ mes }),
    staleTime: 30_000,
  });

  const loading = loadingResumo || loadingAcoes;

  const filtradas = acoes.filter((a) => {
    const matchS = !filtroStatus || a.status === filtroStatus;
    const matchT = !filtroTipo || a.tipo === filtroTipo;
    return matchS && matchT;
  });

  const statusOpts: { value: "" | AcaoStatus; label: string; cor?: string }[] = [
    { value: "", label: "Todos os status" },
    { value: "planejada",    label: "Planejadas",    cor: "#F59E0B" },
    { value: "em_andamento", label: "Em Andamento",  cor: "#3B82F6" },
    { value: "concluida",    label: "Concluídas",    cor: "#10B981" },
    { value: "cancelada",    label: "Canceladas",    cor: "#EF4444" },
  ];

  const tipoOpts: { value: string; label: string; cor?: string }[] = [
    { value: "", label: "Todos os tipos" },
    ...TIPO_OPTS,
  ];

  const kpis = [
    {
      label: "Ações no mês",
      value: resumo?.total_acoes ?? 0,
      bg: "bg-brand/5",
      icon: <Megaphone className="size-5 text-brand" />,
    },
    {
      label: "Farmácias com ação",
      value: resumo?.farmacias_com_acao ?? 0,
      bg: "bg-blue-50",
      icon: <Building2 className="size-5 text-blue-500" />,
    },
    {
      label: "Em andamento",
      value: resumo?.por_status.em_andamento ?? 0,
      bg: "bg-indigo-50",
      icon: <RefreshCw className="size-5 text-indigo-500" />,
    },
    {
      label: "Concluídas",
      value: resumo?.por_status.concluidas ?? 0,
      bg: "bg-emerald-50",
      icon: <CheckCircle2 className="size-5 text-emerald-500" />,
    },
  ];

  function openEdit(a: AcaoMarketing, e: React.MouseEvent) {
    e.stopPropagation();
    setEditTarget(a);
    setModalOpen(true);
  }

  return (
    <AppShell
      title="Ações de Marketing"
      headerRight={
        admin ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: "/campanhas/nova" })}
              className="flex items-center gap-2 py-2 px-3 text-sm font-medium border border-brand text-brand rounded-md hover:bg-brand/5"
            >
              <Rocket className="size-3.5" /> Nova Campanha
            </button>
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
            >
              <Plus className="size-3.5" /> Nova Ação
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Navegação de mês */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMes((m) => addMes(m, -1))}
          className="size-8 rounded-lg bg-white ring-1 ring-black/5 shadow-sm grid place-items-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-zinc-800 min-w-[140px] text-center">
          {fmtMesLabel(mes)}
        </span>
        <button
          onClick={() => setMes((m) => addMes(m, 1))}
          className="size-8 rounded-lg bg-white ring-1 ring-black/5 shadow-sm grid place-items-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
        {isFetching && !loading && <RefreshCw className="size-3.5 animate-spin text-zinc-400" />}
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl ring-1 ring-black/5 shadow-sm p-5 flex items-center gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="size-10 rounded-xl bg-white/70 grid place-items-center shadow-sm shrink-0">
              {k.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{loading ? "—" : k.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-tight">{k.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <FiltroDropdown
          label="Status"
          value={filtroStatus}
          onChange={setFiltroStatus}
          opcoes={statusOpts}
        />
        <FiltroDropdown
          label="Tipo"
          value={filtroTipo}
          onChange={setFiltroTipo}
          opcoes={tipoOpts}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl ring-1 ring-black/5 animate-pulse" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm py-20 text-center">
          <Megaphone className="size-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">
            {acoes.length === 0 ? "Nenhuma ação cadastrada para este mês." : "Nenhuma ação para este filtro."}
          </p>
          {admin && acoes.length === 0 && (
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
            >
              <Plus className="size-3.5" /> Criar primeira ação
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm divide-y divide-zinc-50">
          {filtradas.map((a) => {
            const cor = a.cor ?? tipoCor(a.tipo);
            const isCancelada = a.status === "cancelada";
            return (
              <div
                key={a.id}
                onClick={() => navigate({ to: "/acoes/$id", params: { id: String(a.id) } })}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50/60 transition-colors cursor-pointer group first:rounded-t-xl last:rounded-b-xl"
              >
                {/* Barra colorida */}
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: isCancelada ? "#D1D5DB" : cor }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isCancelada ? "#D1D5DB" : cor }}
                    />
                    <p className={`text-sm font-semibold truncate ${isCancelada ? "line-through text-zinc-400" : "text-zinc-900"}`}>
                      {a.nome}
                    </p>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 pl-4">
                    {tipoLabel(a.tipo)} · {fmtMesLabel(a.mes_referencia)}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                    <Building2 className="size-3.5 text-zinc-400" />
                    {a.total_farmacias}
                  </span>
                  <StatusBadge status={a.status} />
                  {admin && !isCancelada && (
                    <button
                      onClick={(e) => openEdit(a, e)}
                      className="text-zinc-300 hover:text-zinc-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Editar"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {admin && (
        <ModalAcao
          open={modalOpen}
          onOpenChange={(v) => { setModalOpen(v); if (!v) setEditTarget(null); }}
          editing={editTarget}
          onSaved={() => setEditTarget(null)}
        />
      )}
    </AppShell>
  );
}
