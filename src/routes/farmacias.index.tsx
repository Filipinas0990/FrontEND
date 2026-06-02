import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, Plus, TrendingUp, TrendingDown, Pencil, Trash2, RefreshCw, Settings, Phone, MapPin, User, Rocket, Eye, EyeOff, CheckCircle2, Megaphone } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { usePeriod } from "@/contexts/PeriodContext";
import { PeriodSelector } from "@/components/PeriodSelector";
import { PeriodBadge } from "@/components/PeriodBadge";
import {
  getFarmacias,
  getGestores,
  createFarmacia,
  updateFarmacia,
  deleteFarmacia,
  setFarmaciaMeta,
  ativarFarmacia,
  type Farmacia,
  type Gestor,
} from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { usePipelineContext } from "@/contexts/PipelineContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/farmacias/")({
  component: FarmaciasPage,
  head: () => ({ meta: [{ title: "Farmácias — PharmaFlow" }] }),
});

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

function Variacao({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0) return <span className="text-zinc-400 text-[10px]">—</span>;
  const pos = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${pos ? "text-emerald-600" : "text-red-600"}`}>
      {pos ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── Form dialog ────────────────────────────────────────────────────────────

interface FarmaciaForm {
  fase: "entrada" | "ativo";
  nome: string;
  telefone: string;
  responsavel: string;
  cidade: string;
  tem_chatbot: boolean;
  url_base: string;
  email: string;
  senha: string;
  gestor_id: string;
  meta_receita: string;
  meta_leads_google: string;
  meta_leads_meta: string;
}

function FarmaciaDialog({
  open,
  onOpenChange,
  editing,
  gestores,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Farmacia | null;
  gestores: Gestor[];
  onSave: (data: FarmaciaForm) => Promise<void>;
  saving: boolean;
}) {
  const emptyForm = (): FarmaciaForm => ({
    fase: editing?.fase ?? "ativo",
    nome: editing?.nome ?? "",
    telefone: editing?.telefone ?? "",
    responsavel: editing?.responsavel ?? "",
    cidade: editing?.cidade ?? "",
    tem_chatbot: editing?.tem_chatbot ?? true,
    url_base: "",
    email: "",
    senha: "",
    gestor_id: editing?.gestor_id ? String(editing.gestor_id) : "",
    meta_receita: editing?.meta_receita != null ? String(editing.meta_receita) : "",
    meta_leads_google: editing?.meta_leads_google != null ? String(editing.meta_leads_google) : "",
    meta_leads_meta: editing?.meta_leads_meta != null ? String(editing.meta_leads_meta) : "",
  });
  const [form, setForm] = useState<FarmaciaForm>(emptyForm);
  const [confirmPending, setConfirmPending] = useState<FarmaciaForm | null>(null);
  const [showSenha, setShowSenha] = useState(false);

  useEffect(() => { setForm(emptyForm()); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (f: keyof FarmaciaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const metaNum = form.meta_receita ? Number(form.meta_receita) : null;
  const metaFormatada = metaNum != null && !isNaN(metaNum)
    ? metaNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

  const gestorNome = form.gestor_id
    ? gestores.find((g) => String(g.id) === form.gestor_id)?.nome ?? "—"
    : "Sem gestor";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmPending(form);
  };

  const handleConfirm = async () => {
    if (!confirmPending) return;
    await onSave(confirmPending);
    setConfirmPending(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Farmácia" : "Nova Farmácia"}</DialogTitle>
          </DialogHeader>
          <form id="farmacia-form" onSubmit={handleSubmit} className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Toggle Entrada / Ativo */}
            {!editing && (
              <div className="flex gap-2 p-1 bg-zinc-100 rounded-xl">
                {(["entrada", "ativo"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, fase: f }))}
                    className={[
                      "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                      form.fase === f
                        ? f === "entrada"
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-brand text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800",
                    ].join(" ")}
                  >
                    {f === "entrada" ? "📋 Cliente de Entrada" : "✅ Cliente Ativo"}
                  </button>
                ))}
              </div>
            )}
            {form.fase === "entrada" && !editing && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-amber-200">
                Cliente ainda sem credenciais da plataforma. Será ativado depois com URL + login.
              </p>
            )}

            {/* Dados básicos */}
            <FormField label="Nome *">
              <input required value={form.nome} onChange={set("nome")} className="form-input" placeholder="Farmácia Central" />
            </FormField>
            {form.fase === "entrada" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Responsável">
                    <input value={form.responsavel} onChange={set("responsavel")} className="form-input" placeholder="João Silva" />
                  </FormField>
                  <FormField label="Telefone">
                    <input value={form.telefone} onChange={set("telefone")} className="form-input" placeholder="(11) 99999-1234" />
                  </FormField>
                </div>
                <FormField label="Cidade">
                  <input value={form.cidade} onChange={set("cidade")} className="form-input" placeholder="São Paulo" />
                </FormField>
              </>
            )}

            {/* Tem chatbot — sempre visível */}
            <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl ring-1 ring-zinc-100">
              <input
                type="checkbox"
                id="tem_chatbot"
                checked={form.tem_chatbot}
                onChange={(e) => setForm((p) => ({ ...p, tem_chatbot: e.target.checked }))}
                className="size-4 accent-brand"
              />
              <label htmlFor="tem_chatbot" className="text-sm font-medium text-zinc-700 cursor-pointer">
                Tem PharmaChatBot
              </label>
            </div>

            {/* Credenciais — só quando ativo E tem_chatbot */}
            {form.fase === "ativo" && !editing && form.tem_chatbot && (
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Credenciais da Plataforma</p>
                <FormField label="URL Base *">
                  <input required value={form.url_base} onChange={set("url_base")} className="form-input" placeholder="https://app13.pharmachatbot.com.br/..." />
                </FormField>
                <FormField label="E-mail *">
                  <input required type="email" value={form.email} onChange={set("email")} className="form-input" placeholder="login@farmacia.com" />
                </FormField>
                <FormField label="Senha *">
                  <div className="relative">
                    <input
                      required
                      type={showSenha ? "text" : "password"}
                      value={form.senha}
                      onChange={set("senha")}
                      className="form-input pr-10"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                      {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </FormField>
              </div>
            )}

            {/* Metas — só para clientes ativos */}
            {form.fase === "ativo" && (
              <>
                <FormField label="Meta de Receita R$ (opcional)">
                  <input type="number" min="0" step="0.01" value={form.meta_receita} onChange={set("meta_receita")} className="form-input" placeholder="Ex: 45000" />
                  {metaFormatada && <p className="mt-1 text-xs font-semibold text-emerald-600">{metaFormatada}</p>}
                </FormField>
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Metas de Leads por Canal</p>
                  <div className="space-y-3">
                    <FormField label="Meta Leads Google (semanal)">
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" step="1" value={form.meta_leads_google} onChange={set("meta_leads_google")} className="form-input flex-1" placeholder="Ex: 300" />
                        <span className="text-xs text-zinc-400 shrink-0">leads/sem.</span>
                      </div>
                    </FormField>
                    <FormField label="Meta Leads Meta/Facebook (semanal)">
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" step="1" value={form.meta_leads_meta} onChange={set("meta_leads_meta")} className="form-input flex-1" placeholder="Ex: 200" />
                        <span className="text-xs text-zinc-400 shrink-0">leads/sem.</span>
                      </div>
                    </FormField>
                  </div>
                </div>
              </>
            )}

            <FormField label="Gestor (opcional)">
              <select value={form.gestor_id} onChange={set("gestor_id")} className="form-input">
                <option value="">Sem gestor</option>
                {gestores.filter((g) => !g.is_admin).map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            </FormField>
          </form>
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
              Cancelar
            </button>
            <button type="submit" form="farmacia-form" disabled={saving} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60">
              {saving ? "Salvando..." : "Revisar e Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação */}
      <AlertDialog open={!!confirmPending} onOpenChange={(o) => { if (!o) setConfirmPending(null); }}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Revise os dados abaixo antes de salvar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 divide-y divide-zinc-200 text-sm overflow-hidden my-1">
            <Row label="Farmácia" value={confirmPending?.nome ?? "—"} />
            <Row label="Gestor" value={gestorNome} />
            <Row
              label="Meta de Receita"
              value={
                confirmPending?.meta_receita
                  ? Number(confirmPending.meta_receita).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "Sem meta"
              }
              highlight={!!confirmPending?.meta_receita}
            />
            <Row
              label="Meta Leads Google"
              value={confirmPending?.meta_leads_google ? `${Number(confirmPending.meta_leads_google)} leads/semana` : "Sem meta"}
              highlight={!!confirmPending?.meta_leads_google}
            />
            <Row
              label="Meta Leads Meta"
              value={confirmPending?.meta_leads_meta ? `${Number(confirmPending.meta_leads_meta)} leads/semana` : "Sem meta"}
              highlight={!!confirmPending?.meta_leads_meta}
            />
            {!editing && (
              <>
                <Row label="URL" value={confirmPending?.url_base ?? "—"} mono />
                <Row label="E-mail" value={confirmPending?.email ?? "—"} mono />
              </>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Voltar e editar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={saving}
              className="bg-brand hover:opacity-90"
            >
              {saving ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Row({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span className={`text-xs text-right break-all ${mono ? "font-mono" : "font-medium"} ${highlight ? "text-emerald-600 font-semibold" : "text-zinc-800"}`}>
        {value}
      </span>
    </div>
  );
}

// ── Leads helpers ──────────────────────────────────────────────────────────

function leadsStatus(pct: number): "verde" | "amarelo" | "vermelho" {
  if (pct >= 100) return "verde";
  if (pct >= 70) return "amarelo";
  return "vermelho";
}

const LEADS_STATUS_STYLE = {
  verde:    { emoji: "🟢", bar: "bg-emerald-500", text: "text-emerald-600" },
  amarelo:  { emoji: "🟡", bar: "bg-amber-500",   text: "text-amber-600"   },
  vermelho: { emoji: "🔴", bar: "bg-red-500",      text: "text-red-600"    },
};

function LeadsChannelRow({ canalNome, atual, meta }: { canalNome: string; atual: number; meta: number }) {
  const pct = meta > 0 ? (atual / meta) * 100 : 0;
  const s = LEADS_STATUS_STYLE[leadsStatus(pct)];
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium text-zinc-600">{s.emoji} {canalNome}</span>
        <span className={`font-semibold ${s.text}`}>{Math.round(Math.min(pct, 100))}%</span>
      </div>
      <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="text-[10px] text-zinc-400">{atual} / {meta} leads</div>
    </div>
  );
}

// ── Modal Ativar Farmácia ──────────────────────────────────────────────────

function ModalAtivarFarmacia({
  farmacia,
  gestores,
  onClose,
  onSaved,
}: {
  farmacia: Farmacia | null;
  gestores: Gestor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ url_base: "", email: "", senha: "", gestor_id: "" });
  const [showSenha, setShowSenha] = useState(false);

  useEffect(() => {
    if (farmacia) setForm({ url_base: "", email: "", senha: "", gestor_id: farmacia.gestor_id ? String(farmacia.gestor_id) : "" });
  }, [farmacia]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      ativarFarmacia(farmacia!.id, {
        url_base: form.url_base || undefined,
        email: form.email || undefined,
        senha: form.senha || undefined,
        gestor_id: form.gestor_id ? Number(form.gestor_id) : undefined,
      }),
    onSuccess: () => {
      toast.success(`${farmacia!.nome} ativada com sucesso!`);
      qc.invalidateQueries({ queryKey: ["farmacias"] });
      onSaved();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!farmacia} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-brand" />
            Ativar Cliente — {farmacia?.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="p-3 bg-amber-50 rounded-lg ring-1 ring-amber-200 text-xs text-amber-800">
            Após a ativação, o cliente entra no próximo ciclo de coleta automaticamente.
          </div>
          {farmacia?.tem_chatbot ? (
            <>
              <FormField label="URL da Plataforma *">
                <input required value={form.url_base} onChange={set("url_base")} className="form-input" placeholder="https://app13.pharmachatbot.com.br/..." />
              </FormField>
              <FormField label="E-mail da Plataforma *">
                <input required type="email" value={form.email} onChange={set("email")} className="form-input" placeholder="login@farmacia.com" />
              </FormField>
              <FormField label="Senha da Plataforma *">
                <div className="relative">
                  <input
                    required
                    type={showSenha ? "text" : "password"}
                    value={form.senha}
                    onChange={set("senha")}
                    className="form-input pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                    {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </FormField>
            </>
          ) : (
            <div className="p-3 bg-zinc-50 rounded-lg ring-1 ring-zinc-200 text-xs text-zinc-600">
              Este cliente não usa PharmaChatBot. Nenhuma credencial necessária.
            </div>
          )}
          <FormField label="Atribuir Gestor">
            <select value={form.gestor_id} onChange={set("gestor_id")} className="form-input">
              <option value="">Sem gestor</option>
              {gestores.filter((g) => !g.is_admin).map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </FormField>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (farmacia?.tem_chatbot === true && (!form.url_base || !form.email || !form.senha))}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending ? <RefreshCw className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
            Ativar Cliente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

function FarmaciasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = isAdmin();
  const { period, setPeriod } = usePeriod();
  const { ultimoResultado } = usePipelineContext();
  const pipelineErros = ultimoResultado?.farmaciasComErro ?? [];

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todas" | "Ativa" | "Atencao" | "Alerta">("todas");
  const [acaoFilter, setAcaoFilter] = useState<"todos" | "com_acao" | "sem_acao" | "abre_mes" | "fecha_mes">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Farmacia | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmacia | null>(null);
  const [ativarTarget, setAtivarTarget] = useState<Farmacia | null>(null);

  const { data: farmacias = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["farmacias", filter, query, period],
    queryFn: () =>
      getFarmacias({
        status: filter !== "todas" ? filter : undefined,
        busca: query || undefined,
        dias: period,
        fase: "ativo",
      }),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: gestores = [] } = useQuery({
    queryKey: ["gestores"],
    queryFn: getGestores,
    enabled: admin,
  });

  const createMut = useMutation({
    mutationFn: createFarmacia,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateFarmacia>[1] }) =>
      updateFarmacia(id, data),
  });

  const deleteMut = useMutation({
    mutationFn: deleteFarmacia,
    onSuccess: () => {
      toast.success("Farmácia desativada.");
      qc.invalidateQueries({ queryKey: ["farmacias"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = async (form: FarmaciaForm) => {
    const gestorId = form.gestor_id ? Number(form.gestor_id) : undefined;
    const hasMeta = form.meta_receita !== "" || form.meta_leads_google !== "" || form.meta_leads_meta !== "";
    try {
      let targetId: number;
      if (editTarget) {
        const patch: Parameters<typeof updateFarmacia>[1] = {
          nome: form.nome,
          telefone: form.telefone || null,
          responsavel: form.responsavel || null,
          cidade: form.cidade || null,
        };
        if (form.gestor_id !== undefined) patch.gestor_id = gestorId ?? null;
        await updateMut.mutateAsync({ id: editTarget.id, data: patch });
        targetId = editTarget.id;
      } else {
        const result = await createMut.mutateAsync({
          nome: form.nome,
          fase: form.fase,
          telefone: form.telefone || undefined,
          responsavel: form.responsavel || undefined,
          cidade: form.cidade || undefined,
          tem_chatbot: form.tem_chatbot,
          url_base: form.fase === "ativo" && form.tem_chatbot ? form.url_base : undefined,
          email: form.fase === "ativo" && form.tem_chatbot ? form.email : undefined,
          senha: form.fase === "ativo" && form.tem_chatbot ? form.senha : undefined,
          gestor_id: gestorId,
        });
        targetId = result.id;
      }
      const fase = editTarget ? editTarget.fase : form.fase;
      if (fase !== "entrada" && (editTarget || hasMeta)) {
        await setFarmaciaMeta(targetId, {
          meta_vendas: null,
          meta_receita: form.meta_receita ? Number(form.meta_receita) : null,
          meta_leads_google: form.meta_leads_google ? Number(form.meta_leads_google) : null,
          meta_leads_meta: form.meta_leads_meta ? Number(form.meta_leads_meta) : null,
        });
      }
      toast.success(editTarget ? "Farmácia atualizada!" : "Farmácia criada com sucesso!");
      qc.invalidateQueries({ queryKey: ["farmacias"] });
      setDialogOpen(false);
      setEditTarget(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  const farmaciasFiltradas = farmacias.filter((p) => {
    if (acaoFilter === "com_acao")  return (p.acoes_ativas?.length ?? 0) > 0;
    if (acaoFilter === "sem_acao")  return (p.acoes_ativas?.length ?? 0) === 0;
    if (acaoFilter === "abre_mes")  return p.acoes_ativas?.some((a) => a.tipo === "abre_mes") ?? false;
    if (acaoFilter === "fecha_mes") return p.acoes_ativas?.some((a) => a.tipo === "fecha_mes") ?? false;
    return true;
  });

  return (
    <AppShell
      title="Farmácias"
      headerRight={
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <RefreshCw className="size-3 animate-spin" />
              Atualizando...
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Atualizar dados"
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          {admin && (
            <button
              onClick={() => { setEditTarget(null); setDialogOpen(true); }}
              className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
            >
              <Plus className="size-3.5" /> Nova Farmácia
            </button>
          )}
        </div>
      }
    >
      {/* Seletor de período */}
      <PeriodSelector
        value={period}
        onChange={setPeriod}
        loading={isFetching && !isLoading}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-md border border-zinc-100">
          <Search className="size-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome..."
            className="bg-transparent outline-none text-sm flex-1"
          />
        </div>
        <div className="flex gap-1 bg-zinc-50 p-1 rounded-md">
          {(["todas", "Ativa", "Atencao", "Alerta"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                filter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {f === "Atencao" ? "Atenção" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por ação */}
      <div className="flex items-center gap-2">
          <Megaphone className="size-3 text-zinc-300 shrink-0" />
          {(
            [
              { value: "todos",     label: "Todos" },
              { value: "com_acao",  label: "Com Ação" },
              { value: "sem_acao",  label: "Sem Ação" },
              { value: "abre_mes",  label: "Abre Mês" },
              { value: "fecha_mes", label: "Fecha Mês" },
            ] as const
          ).map((f, i) => (
            <span key={f.value} className="flex items-center gap-2">
              {i > 0 && <span className="text-zinc-200 select-none">·</span>}
              <button
                onClick={() => setAcaoFilter(f.value)}
                className={`text-xs transition-colors ${
                  acaoFilter === f.value
                    ? "text-zinc-800 font-semibold"
                    : "text-zinc-400 hover:text-zinc-600 font-medium"
                }`}
              >
                {f.label}
              </button>
            </span>
          ))}
        </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl ring-1 ring-black/5 h-36 animate-pulse" />
          ))}
        </div>
      )}

      {/* Cards */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {farmaciasFiltradas.map((p) => {
            const isEntrada = p.fase === "entrada";
            const semDados = !isEntrada && (p.posicao_ranking >= 9999 || (p.receita_total === 0 && p.total_atendimentos === 0 && p.vendas_realizadas === 0));
            const naoAtingiuMeta = !isEntrada && !semDados && p.atingiu_meta === false;
            const errosPipeline = pipelineErros.filter((e) => e.nome === p.nome);
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer ${
                  isEntrada ? "ring-1 ring-amber-200"
                  : naoAtingiuMeta ? "ring-2 ring-red-500"
                  : !p.tem_chatbot ? "ring-1 ring-sky-200"
                  : "ring-1 ring-black/5"
                }`}
                onClick={() => navigate({ to: "/farmacias/$id", params: { id: String(p.id) } })}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isEntrada && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-200 shrink-0">
                          ENTRADA
                        </span>
                      )}
                      <h3 className="text-sm font-semibold truncate">{p.nome}</h3>
                    </div>
                    {isEntrada
                      ? <p className="text-[10px] text-amber-600 mt-0.5 italic">Aguardando ativação</p>
                      : semDados
                        ? <p className="text-[10px] text-zinc-400 mt-0.5 italic">Aguardando dados</p>
                        : <p className="text-[10px] text-zinc-500 mt-0.5">#{p.posicao_ranking} no ranking</p>
                    }
                    {/* Badge de erro do pipeline */}
                    {!isEntrada && errosPipeline.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {errosPipeline.map((e) => (
                          <span
                            key={e.periodo}
                            title={e.erro}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 cursor-help"
                          >
                            ⚠ Sem dados {e.periodo}d
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!isEntrada && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${alertColor(p.nivel_alerta)}`}>
                        {alertLabel(p.nivel_alerta)}
                      </span>
                      {!p.tem_chatbot && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-50 text-sky-600 ring-1 ring-sky-200">
                          Sem ChatBot
                        </span>
                      )}
                      <PeriodBadge dias={period} />
                    </div>
                  )}
                </div>

                {isEntrada ? (
                  <div className="pt-3 border-t border-zinc-100 space-y-1.5">
                    {(p.responsavel || p.telefone || p.cidade) ? (
                      <div className="space-y-1">
                        {p.responsavel && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                            <User className="size-3 text-zinc-400 shrink-0" />{p.responsavel}
                          </div>
                        )}
                        {p.telefone && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                            <Phone className="size-3 text-zinc-400 shrink-0" />{p.telefone}
                          </div>
                        )}
                        {p.cidade && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                            <MapPin className="size-3 text-zinc-400 shrink-0" />{p.cidade}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic">Sem dados de contato</p>
                    )}
                    <div className="text-[10px] text-zinc-400">
                      {p.gestor_id
                        ? gestores.find((g) => g.id === p.gestor_id)?.nome ?? "Gestor atribuído"
                        : "Sem gestor atribuído"}
                    </div>
                  </div>
                ) : semDados ? (
                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-center py-4">
                    <span className="text-xs text-zinc-400 italic">Nenhum dado coletado neste período.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-100">
                    <div>
                      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Receita</div>
                      <div className="text-sm font-semibold text-zinc-900">{fmtBRL(p.receita_total)}</div>
                      <Variacao value={p.variacao_receita} />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Vendas</div>
                      <div className="text-sm font-semibold text-zinc-900">{p.vendas_realizadas}</div>
                      <Variacao value={p.variacao_vendas} />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Conversão</div>
                      <div className={`text-sm font-semibold ${(p.taxa_conversao ?? 0) >= 60 ? "text-brand" : "text-zinc-900"}`}>
                        {(p.taxa_conversao ?? 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                {!semDados && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1" onClick={(e) => e.stopPropagation()}>
                    {p.meta_receita != null && p.percentual_meta_receita != null ? (
                      <>
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>Meta receita</span>
                          <span className={`font-semibold ${p.atingiu_meta ? "text-emerald-600" : "text-red-500"}`}>
                            {(p.percentual_meta_receita ?? 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${p.atingiu_meta ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(p.percentual_meta_receita, 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {fmtBRL(p.receita_total)} / {fmtBRL(p.meta_receita)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Meta receita</span><span>Sem meta</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full" />
                        <div className="text-[10px] text-zinc-300">—</div>
                      </>
                    )}
                  </div>
                )}

                {!semDados && (p.meta_leads_google !== null || p.meta_leads_meta !== null) && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Leads da semana</div>
                    {p.meta_leads_google !== null && (
                      <LeadsChannelRow canalNome="Google" atual={p.canais?.find((c) => c.nome.toLowerCase().includes("google"))?.atendimentos ?? 0} meta={p.meta_leads_google} />
                    )}
                    {p.meta_leads_meta !== null && (
                      <LeadsChannelRow canalNome="Meta" atual={p.canais?.find((c) => c.nome.toLowerCase().includes("meta"))?.atendimentos ?? 0} meta={p.meta_leads_meta} />
                    )}
                  </div>
                )}

                {/* Badges de ações ativas */}
                {!isEntrada && p.acoes_ativas && p.acoes_ativas.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                    {p.acoes_ativas.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => navigate({ to: "/acoes/$id", params: { id: String(a.id) } })}
                        title={`${a.tipo} · ${a.status}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white truncate max-w-[140px] hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: a.cor ?? "#6B7280" }}
                      >
                        <Megaphone className="size-2.5 shrink-0" />
                        <span className="truncate">{a.nome}</span>
                      </button>
                    ))}
                  </div>
                )}

                {admin && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditTarget(p); setDialogOpen(true); }} className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900">
                      <Pencil className="size-3" /> Editar
                    </button>
                    {!isEntrada && (
                      <button onClick={() => { setEditTarget(p); setDialogOpen(true); }} className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900">
                        <Settings className="size-3" /> Metas de leads
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget(p)} className="flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-600">
                      <Trash2 className="size-3" /> Desativar
                    </button>
                    {isEntrada && (
                      <button
                        onClick={() => setAtivarTarget(p)}
                        className="flex items-center gap-1.5 ml-auto text-[10px] font-semibold bg-amber-500 text-white px-2.5 py-1 rounded-md hover:opacity-90"
                      >
                        <Rocket className="size-3" /> Ativar Cliente
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && farmaciasFiltradas.length === 0 && (
        <div className="text-center py-16 text-zinc-500 text-sm">
          {acaoFilter !== "todos" ? "Nenhuma farmácia com este filtro de ação." : "Nenhuma farmácia encontrada."}
        </div>
      )}

      {/* Create / Edit dialog */}
      {admin && (
        <FarmaciaDialog
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditTarget(null); }}
          editing={editTarget}
          gestores={gestores}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar farmácia?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.nome}" será removida das listagens. Os dados históricos são preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppShell>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
