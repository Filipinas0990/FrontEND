import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Building2, Pencil, Trash2, Plus, Search, X,
  RefreshCw, CheckCircle2, Megaphone, MapPin, User, Phone,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getAcao, editarAcao, cancelarAcaoMarketing, adicionarFarmaciasAcao,
  removerFarmaciaAcao, atualizarObservacoesAcao, getFarmacias,
  type AcaoDetalhe, type AcaoStatus, type ParticipacaoFarmacia, type AcaoMarketing,
} from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/acoes/$id")({
  component: AcaoDetailPage,
  head: () => ({ meta: [{ title: "Ação — GrupoSymbol" }] }),
});

// ── Shared helpers ──────────────────────────────────────────────────────────

const MESES_FULL = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function fmtMesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_FULL[m - 1]} ${y}`;
}

const TIPO_OPTS = [
  { value: "abre_mes",  label: "Abre Mês",  cor: "#3B82F6" },
  { value: "fecha_mes", label: "Fecha Mês", cor: "#8B5CF6" },
  { value: "campanha",  label: "Campanha",  cor: "#EC4899" },
  { value: "promocao",  label: "Promoção",  cor: "#F97316" },
  { value: "evento",    label: "Evento",    cor: "#14B8A6" },
  { value: "outro",     label: "Outro",     cor: "#6B7280" },
];

const COR_PALETTE = ["#3B82F6","#8B5CF6","#EC4899","#F97316","#14B8A6","#10B981","#F59E0B","#6B7280","#EF4444"];

function tipoCor(tipo: string): string {
  return TIPO_OPTS.find((t) => t.value === tipo)?.cor ?? "#6B7280";
}

function tipoLabel(tipo: string): string {
  return TIPO_OPTS.find((t) => t.value === tipo)?.label ?? tipo;
}

const STATUS_CFG: Record<AcaoStatus, { label: string; bg: string; text: string; ring: string; dot: string }> = {
  planejada:    { label: "Planejada",    bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200",   dot: "#F59E0B" },
  em_andamento: { label: "Em Andamento", bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-200",    dot: "#3B82F6" },
  concluida:    { label: "Concluída",    bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", dot: "#10B981" },
  cancelada:    { label: "Cancelada",    bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200",     dot: "#EF4444" },
};

function StatusBadge({ status }: { status: AcaoStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.cancelada;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${cfg.bg} ${cfg.ring} ${cfg.text}`}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function alertDot(nivel: string): string {
  if (nivel === "vermelho") return "bg-red-500";
  if (nivel === "amarelo") return "bg-amber-400";
  return "bg-emerald-500";
}

// ── Modal Edit Ação ─────────────────────────────────────────────────────────

interface AcaoForm {
  nome: string;
  tipo: string;
  tipoCustom: string;
  mes_referencia: string;
  status: AcaoStatus;
  cor: string;
  descricao: string;
}

function ModalEditarAcao({
  open,
  onOpenChange,
  acao,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  acao: AcaoDetalhe;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AcaoForm>({
    nome: "", tipo: "abre_mes", tipoCustom: "",
    mes_referencia: "", status: "planejada", cor: "#3B82F6", descricao: "",
  });
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    const tipoKnown = TIPO_OPTS.some((t) => t.value === acao.tipo);
    setForm({
      nome: acao.nome,
      tipo: tipoKnown ? acao.tipo : "outro",
      tipoCustom: tipoKnown ? "" : acao.tipo,
      mes_referencia: acao.mes_referencia,
      status: acao.status,
      cor: acao.cor ?? tipoCor(acao.tipo),
      descricao: acao.descricao ?? "",
    });
    setCancelConfirm(false);
  }, [open, acao]);

  const editarMut = useMutation({
    mutationFn: (data: Parameters<typeof editarAcao>[1]) => editarAcao(acao.id, data),
    onSuccess: () => {
      toast.success("Ação atualizada!");
      qc.invalidateQueries({ queryKey: ["acao", acao.id] });
      qc.invalidateQueries({ queryKey: ["acoes"] });
      qc.invalidateQueries({ queryKey: ["acoes-resumo"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelarMut = useMutation({
    mutationFn: () => cancelarAcaoMarketing(acao.id),
    onSuccess: () => {
      toast.success("Ação cancelada.");
      qc.invalidateQueries({ queryKey: ["acao", acao.id] });
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
    editarMut.mutate({
      nome: form.nome.trim(),
      tipo: tipoFinal,
      mes_referencia: form.mes_referencia,
      status: form.status,
      cor: form.cor || null,
      descricao: form.descricao.trim() || null,
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-brand" />
              Editar Ação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
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
                className="mt-1 form-input w-full resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2">
            {acao.status !== "cancelada" && (
              <button
                type="button"
                onClick={() => setCancelConfirm(true)}
                className="mr-auto text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
              >
                <X className="size-3.5" /> Cancelar ação
              </button>
            )}
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={editarMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
            >
              {editarMut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta ação?</AlertDialogTitle>
            <AlertDialogDescription>
              A ação será marcada como cancelada. Pode ser reativada depois via edição.
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

// ── Modal Adicionar Farmácias ────────────────────────────────────────────────

function ModalAdicionarFarmacias({
  open,
  onOpenChange,
  acaoId,
  farmaciaIdsJaAdicionadas,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  acaoId: number;
  farmaciaIdsJaAdicionadas: number[];
  onAdded: () => void;
}) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<number[]>([]);

  const { data: farmacias = [], isLoading } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias({ fase: "ativo" }),
    staleTime: 60_000,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setBusca("");
      setSelecionadas([]);
    }
  }, [open]);

  const adicionarMut = useMutation({
    mutationFn: () => adicionarFarmaciasAcao(acaoId, { farmacia_ids: selecionadas }),
    onSuccess: (res) => {
      toast.success(res.mensagem);
      qc.invalidateQueries({ queryKey: ["acao", acaoId] });
      qc.invalidateQueries({ queryKey: ["acoes"] });
      onAdded();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtradas = farmacias.filter((f) => {
    const q = busca.toLowerCase();
    return !q || f.nome.toLowerCase().includes(q) || (f.cidade ?? "").toLowerCase().includes(q);
  });

  function toggle(id: number) {
    if (farmaciaIdsJaAdicionadas.includes(id)) return;
    setSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-brand" />
            Adicionar Farmácias à Ação
          </DialogTitle>
        </DialogHeader>

        <div className="py-1 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-100">
            <Search className="size-4 text-zinc-400 shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou cidade..."
              className="bg-transparent outline-none text-sm flex-1"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
              ))
            ) : filtradas.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">Nenhuma farmácia encontrada.</p>
            ) : (
              filtradas.map((f) => {
                const jaAdicionada = farmaciaIdsJaAdicionadas.includes(f.id);
                const checked = jaAdicionada || selecionadas.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                      jaAdicionada ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={jaAdicionada}
                      onChange={() => toggle(f.id)}
                      className="size-4 accent-brand shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{f.nome}</p>
                      {(f.cidade || jaAdicionada) && (
                        <p className="text-[11px] text-zinc-400">
                          {f.cidade && <span>{f.cidade}</span>}
                          {jaAdicionada && <span className="text-emerald-600 font-medium"> · já adicionada</span>}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => adicionarMut.mutate()}
            disabled={selecionadas.length === 0 || adicionarMut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {adicionarMut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
            Adicionar {selecionadas.length > 0 ? `${selecionadas.length} selecionada${selecionadas.length > 1 ? "s" : ""}` : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal Editar Observações ────────────────────────────────────────────────

function ModalEditarObs({
  target,
  acaoId,
  onClose,
}: {
  target: { participacao_id: number; farmacia_id: number; farmacia_nome: string; observacoes: string | null } | null;
  acaoId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (target) setObs(target.observacoes ?? "");
  }, [target]);

  const mut = useMutation({
    mutationFn: () => atualizarObservacoesAcao(acaoId, target!.farmacia_id, obs.trim() || null),
    onSuccess: () => {
      toast.success("Observações atualizadas.");
      qc.invalidateQueries({ queryKey: ["acao", acaoId] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Observações — {target?.farmacia_nome}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={4}
            placeholder="Observações sobre a participação desta farmácia..."
            className="form-input w-full resize-none"
          />
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AcaoDetailPage ──────────────────────────────────────────────────────────

function AcaoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const admin = isAdmin();
  const acaoId = Number(id);
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [addFarmsOpen, setAddFarmsOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ParticipacaoFarmacia | null>(null);
  const [editObsTarget, setEditObsTarget] = useState<{
    participacao_id: number;
    farmacia_id: number;
    farmacia_nome: string;
    observacoes: string | null;
  } | null>(null);
  const [busca, setBusca] = useState("");

  const { data: acao, isLoading, isError } = useQuery({
    queryKey: ["acao", acaoId],
    queryFn: () => getAcao(acaoId),
    staleTime: 30_000,
  });

  const removerMut = useMutation({
    mutationFn: () => removerFarmaciaAcao(acaoId, removeTarget!.farmacia_id),
    onSuccess: () => {
      toast.success("Farmácia removida da ação.");
      qc.invalidateQueries({ queryKey: ["acao", acaoId] });
      qc.invalidateQueries({ queryKey: ["acoes"] });
      setRemoveTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isError) {
    toast.error("Ação não encontrada.");
    navigate({ to: "/acoes" });
    return null;
  }

  const cor = acao ? (acao.cor ?? tipoCor(acao.tipo)) : "#6B7280";
  const isCancelada = acao?.status === "cancelada";

  const farmaciasFiltradas = (acao?.farmacias ?? []).filter((f) => {
    const q = busca.toLowerCase();
    return !q || f.farmacia_nome.toLowerCase().includes(q) || (f.cidade ?? "").toLowerCase().includes(q);
  });

  return (
    <AppShell
      title={acao?.nome ?? "Carregando..."}
      headerRight={
        <button
          onClick={() => navigate({ to: "/acoes" })}
          className="flex items-center gap-2 py-2 px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-md hover:bg-zinc-50"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </button>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 bg-white rounded-xl ring-1 ring-black/5 animate-pulse" />
          <div className="h-64 bg-white rounded-xl ring-1 ring-black/5 animate-pulse" />
        </div>
      ) : acao ? (
        <>
          {/* Header da ação */}
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="size-10 rounded-xl shrink-0 mt-0.5"
                  style={{ backgroundColor: isCancelada ? "#E5E7EB" : cor + "25" }}
                >
                  <div className="size-full rounded-xl grid place-items-center">
                    <span className="size-4 rounded-full" style={{ backgroundColor: isCancelada ? "#9CA3AF" : cor }} />
                  </div>
                </div>
                <div className="min-w-0">
                  <h2 className={`text-lg font-bold leading-tight ${isCancelada ? "line-through text-zinc-400" : "text-zinc-900"}`}>
                    {acao.nome}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusBadge status={acao.status} />
                    <span className="text-[11px] text-zinc-500 font-medium bg-zinc-100 px-2 py-0.5 rounded-full">
                      {tipoLabel(acao.tipo)}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {fmtMesLabel(acao.mes_referencia)}
                    </span>
                  </div>
                  {acao.descricao && (
                    <p className="text-sm text-zinc-500 mt-2">{acao.descricao}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 rounded-lg ring-1 ring-zinc-100 text-sm font-semibold text-zinc-700">
                  <Building2 className="size-4 text-zinc-400" />
                  {acao.total_farmacias} farmácia{acao.total_farmacias !== 1 ? "s" : ""}
                </div>
                {admin && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50"
                  >
                    <Pencil className="size-3.5" /> Editar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Farmácias participantes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-700">Farmácias Participantes</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg ring-1 ring-black/5 shadow-sm">
                  <Search className="size-3.5 text-zinc-400 shrink-0" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar farmácia..."
                    className="bg-transparent outline-none text-sm min-w-0 w-40"
                  />
                  {busca && (
                    <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                {admin && !isCancelada && (
                  <button
                    onClick={() => setAddFarmsOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:opacity-90"
                  >
                    <Plus className="size-3.5" /> Adicionar Farmácias
                  </button>
                )}
              </div>
            </div>

            {farmaciasFiltradas.length === 0 ? (
              <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm py-16 text-center">
                <Building2 className="size-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">
                  {acao.farmacias.length === 0
                    ? "Nenhuma farmácia adicionada ainda."
                    : "Nenhuma farmácia para esta busca."}
                </p>
                {admin && !isCancelada && acao.farmacias.length === 0 && (
                  <button
                    onClick={() => setAddFarmsOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
                  >
                    <Plus className="size-3.5" /> Adicionar Farmácias
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm divide-y divide-zinc-50">
                {farmaciasFiltradas.map((f) => (
                  <div key={f.farmacia_id} className="flex items-start gap-4 px-5 py-4 group hover:bg-zinc-50/50 transition-colors">
                    {/* Indicador de alerta */}
                    <div className={`size-2.5 rounded-full shrink-0 mt-1.5 ${alertDot(f.nivel_alerta)}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{f.farmacia_nome}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-400 flex-wrap">
                        {f.cidade && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />{f.cidade}
                          </span>
                        )}
                        {f.gestor_nome && (
                          <span className="flex items-center gap-1">
                            <User className="size-3" />{f.gestor_nome}
                          </span>
                        )}
                        {f.responsavel && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" />{f.responsavel}
                          </span>
                        )}
                      </div>
                      {f.observacoes && (
                        <p className="text-xs text-zinc-500 mt-1 bg-zinc-50 px-2 py-1 rounded italic">
                          {f.observacoes}
                        </p>
                      )}
                    </div>

                    {/* Ações */}
                    {admin && (
                      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditObsTarget({
                            participacao_id: f.participacao_id,
                            farmacia_id: f.farmacia_id,
                            farmacia_nome: f.farmacia_nome,
                            observacoes: f.observacoes,
                          })}
                          title="Editar observações"
                          className="text-zinc-400 hover:text-zinc-700 transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setRemoveTarget(f)}
                          title="Remover da ação"
                          className="text-zinc-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modals */}
          {admin && (
            <ModalEditarAcao
              open={editOpen}
              onOpenChange={setEditOpen}
              acao={acao}
              onSaved={() => {}}
            />
          )}

          {admin && (
            <ModalAdicionarFarmacias
              open={addFarmsOpen}
              onOpenChange={setAddFarmsOpen}
              acaoId={acaoId}
              farmaciaIdsJaAdicionadas={acao.farmacias.map((f) => f.farmacia_id)}
              onAdded={() => {}}
            />
          )}

          {admin && (
            <ModalEditarObs
              target={editObsTarget}
              acaoId={acaoId}
              onClose={() => setEditObsTarget(null)}
            />
          )}

          <AlertDialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover farmácia da ação?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{removeTarget?.farmacia_nome}" será removida de "{acao.nome}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => removerMut.mutate()}
                  disabled={removerMut.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {removerMut.isPending ? "Removendo..." : "Remover"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </AppShell>
  );
}
