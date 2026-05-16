import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Plus, TrendingUp, TrendingDown, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getFarmacias,
  getGestores,
  createFarmacia,
  updateFarmacia,
  deleteFarmacia,
  setFarmaciaMeta,
  type Farmacia,
  type Gestor,
} from "@/lib/api";
import { isAdmin } from "@/lib/auth";
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
  nome: string;
  url_base: string;
  email: string;
  senha: string;
  gestor_id: string;
  meta_vendas: string;
  meta_receita: string;
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
  const [form, setForm] = useState<FarmaciaForm>({
    nome: editing?.nome ?? "",
    url_base: "",
    email: "",
    senha: "",
    gestor_id: editing?.gestor_id ? String(editing.gestor_id) : "",
    meta_vendas: editing?.meta_vendas != null ? String(editing.meta_vendas) : "",
    meta_receita: editing?.meta_receita != null ? String(editing.meta_receita) : "",
  });

  // Reset when target changes
  useState(() => {
    setForm({
      nome: editing?.nome ?? "",
      url_base: "",
      email: "",
      senha: "",
      gestor_id: editing?.gestor_id ? String(editing.gestor_id) : "",
      meta_vendas: editing?.meta_vendas != null ? String(editing.meta_vendas) : "",
      meta_receita: editing?.meta_receita != null ? String(editing.meta_receita) : "",
    });
  });

  const set = (f: keyof FarmaciaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Farmácia" : "Nova Farmácia"}</DialogTitle>
        </DialogHeader>
        <form
          id="farmacia-form"
          onSubmit={(e) => { e.preventDefault(); onSave(form); }}
          className="space-y-3 py-2"
        >
          <FormField label="Nome">
            <input required value={form.nome} onChange={set("nome")} className="form-input" placeholder="Farmácia Central" />
          </FormField>
          {!editing && (
            <>
              <FormField label="URL Base (PharmaChatBot)">
                <input required value={form.url_base} onChange={set("url_base")} className="form-input" placeholder="https://app13.pharmachatbot.com.br/..." />
              </FormField>
              <FormField label="E-mail (PharmaChatBot)">
                <input required type="email" value={form.email} onChange={set("email")} className="form-input" placeholder="login@farmacia.com" />
              </FormField>
              <FormField label="Senha (PharmaChatBot)">
                <input required type="password" value={form.senha} onChange={set("senha")} className="form-input" placeholder="••••••••" />
              </FormField>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Meta de Vendas (opcional)">
              <input
                type="number"
                min="0"
                step="1"
                value={form.meta_vendas}
                onChange={set("meta_vendas")}
                className="form-input"
                placeholder="Ex: 600"
              />
            </FormField>
            <FormField label="Meta de Receita R$ (opcional)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.meta_receita}
                onChange={set("meta_receita")}
                className="form-input"
                placeholder="Ex: 45000"
              />
            </FormField>
          </div>
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
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
          <button type="submit" form="farmacia-form" disabled={saving} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar"}
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

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todas" | "Ativa" | "Atencao" | "Alerta">("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Farmacia | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmacia | null>(null);

  const { data: farmacias = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["farmacias", filter, query],
    queryFn: () =>
      getFarmacias({
        status: filter !== "todas" ? filter : undefined,
        busca: query || undefined,
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
    const hasMeta = form.meta_vendas !== "" || form.meta_receita !== "";
    try {
      let targetId: number;
      if (editTarget) {
        const patch: Parameters<typeof updateFarmacia>[1] = { nome: form.nome };
        if (form.gestor_id !== undefined) patch.gestor_id = gestorId ?? null;
        await updateMut.mutateAsync({ id: editTarget.id, data: patch });
        targetId = editTarget.id;
      } else {
        const result = await createMut.mutateAsync({
          nome: form.nome,
          url_base: form.url_base,
          email: form.email,
          senha: form.senha,
          gestor_id: gestorId,
        });
        targetId = result.id;
      }
      if (hasMeta) {
        await setFarmaciaMeta(targetId, {
          meta_vendas: form.meta_vendas ? Number(form.meta_vendas) : null,
          meta_receita: form.meta_receita ? Number(form.meta_receita) : null,
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
      {/* Filters */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4 flex items-center gap-3">
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
          {farmacias.map((p) => {
            const semDados = p.posicao_ranking >= 9999 || (p.receita_total === 0 && p.total_atendimentos === 0 && p.vendas_realizadas === 0);
            const naoAtingiuMeta = !semDados && p.atingiu_meta === false;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer ${
                  naoAtingiuMeta
                    ? "ring-2 ring-red-500"
                    : "ring-1 ring-black/5"
                }`}
                onClick={() => navigate({ to: "/farmacias/$id", params: { id: String(p.id) } })}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-sm font-semibold truncate">{p.nome}</h3>
                    {semDados
                      ? <p className="text-[10px] text-zinc-400 mt-0.5 italic">Aguardando dados</p>
                      : <p className="text-[10px] text-zinc-500 mt-0.5">#{p.posicao_ranking} no ranking</p>
                    }
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 shrink-0 ${alertColor(p.nivel_alerta)}`}>
                    {alertLabel(p.nivel_alerta)}
                  </span>
                </div>

                {semDados ? (
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

                {!semDados && p.meta_receita != null && p.percentual_meta_receita != null && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1" onClick={(e) => e.stopPropagation()}>
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
                  </div>
                )}

                {admin && (
                  <div
                    className="flex gap-2 mt-3 pt-3 border-t border-zinc-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setEditTarget(p); setDialogOpen(true); }}
                      className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900"
                    >
                      <Pencil className="size-3" /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="size-3" /> Desativar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && farmacias.length === 0 && (
        <div className="text-center py-16 text-zinc-500 text-sm">
          Nenhuma farmácia encontrada.
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
