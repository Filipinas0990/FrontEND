import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Search, Plus, Pencil, Trash2, RefreshCw, Phone, MapPin,
  User, Rocket, Eye, EyeOff, Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FarmaciasTabs } from "@/components/FarmaciasTabs";
import {
  getFarmacias, getGestores, createFarmacia, updateFarmacia,
  deleteFarmacia, ativarFarmacia, type Farmacia, type Gestor,
} from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/farmacias/entrada")({
  component: EntradaPage,
  head: () => ({ meta: [{ title: "Clientes em Entrada — GrupoSymbol" }] }),
});

// ── Modal Ativar ─────────────────────────────────────────────────────────────

function ModalAtivar({
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
      qc.invalidateQueries({ queryKey: ["farmacias-entrada"] });
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
            <Rocket className="size-4 text-amber-500" />
            Ativar Cliente — {farmacia?.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="p-3 bg-amber-50 rounded-lg ring-1 ring-amber-200 text-xs text-amber-800">
            Após a ativação, o cliente entra no próximo ciclo de coleta automaticamente.
          </div>

          {farmacia?.tem_chatbot ? (
            <>
              <div>
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">URL da Plataforma *</label>
                <input required value={form.url_base} onChange={set("url_base")} className="mt-1 form-input w-full" placeholder="https://app13.pharmachatbot.com.br/..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">E-mail *</label>
                <input required type="email" value={form.email} onChange={set("email")} className="mt-1 form-input w-full" placeholder="login@farmacia.com" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Senha *</label>
                <div className="relative mt-1">
                  <input
                    required
                    type={showSenha ? "text" : "password"}
                    value={form.senha}
                    onChange={set("senha")}
                    className="form-input w-full pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                    {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-3 bg-zinc-50 rounded-lg ring-1 ring-zinc-200 text-xs text-zinc-600">
              Este cliente não usa PharmaChatBot. Nenhuma credencial necessária.
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Atribuir Gestor</label>
            <select value={form.gestor_id} onChange={set("gestor_id")} className="mt-1 form-input w-full">
              <option value="">Sem gestor</option>
              {gestores.filter((g) => !g.is_admin).map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (farmacia?.tem_chatbot === true && (!form.url_base || !form.email || !form.senha))}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending ? <RefreshCw className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
            Ativar Cliente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal Editar ─────────────────────────────────────────────────────────────

function ModalEditar({
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
  const [form, setForm] = useState({ nome: "", responsavel: "", telefone: "", cidade: "", gestor_id: "" });

  useEffect(() => {
    if (farmacia) setForm({
      nome: farmacia.nome,
      responsavel: farmacia.responsavel ?? "",
      telefone: farmacia.telefone ?? "",
      cidade: farmacia.cidade ?? "",
      gestor_id: farmacia.gestor_id ? String(farmacia.gestor_id) : "",
    });
  }, [farmacia]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => updateFarmacia(farmacia!.id, {
      nome: form.nome,
      responsavel: form.responsavel || null,
      telefone: form.telefone || null,
      cidade: form.cidade || null,
      gestor_id: form.gestor_id ? Number(form.gestor_id) : null,
    }),
    onSuccess: () => {
      toast.success("Cliente atualizado!");
      qc.invalidateQueries({ queryKey: ["farmacias-entrada"] });
      onSaved();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!farmacia} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Nome *</label>
            <input required value={form.nome} onChange={set("nome")} className="mt-1 form-input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Responsável</label>
              <input value={form.responsavel} onChange={set("responsavel")} className="mt-1 form-input w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Telefone</label>
              <input value={form.telefone} onChange={set("telefone")} className="mt-1 form-input w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Cidade</label>
            <input value={form.cidade} onChange={set("cidade")} className="mt-1 form-input w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Gestor</label>
            <select value={form.gestor_id} onChange={set("gestor_id")} className="mt-1 form-input w-full">
              <option value="">Sem gestor</option>
              {gestores.filter((g) => !g.is_admin).map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.nome.trim()}
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

// ── Modal Novo Cliente de Entrada ─────────────────────────────────────────────

function ModalNovo({
  open,
  onOpenChange,
  gestores,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gestores: Gestor[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", responsavel: "", telefone: "", cidade: "", gestor_id: "", tem_chatbot: true });
  const [showSenha] = useState(false);

  useEffect(() => {
    if (open) setForm({ nome: "", responsavel: "", telefone: "", cidade: "", gestor_id: "", tem_chatbot: true });
  }, [open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => createFarmacia({
      nome: form.nome,
      fase: "entrada",
      responsavel: form.responsavel || undefined,
      telefone: form.telefone || undefined,
      cidade: form.cidade || undefined,
      tem_chatbot: form.tem_chatbot,
      gestor_id: form.gestor_id ? Number(form.gestor_id) : undefined,
    }),
    onSuccess: () => {
      toast.success("Cliente adicionado!");
      qc.invalidateQueries({ queryKey: ["farmacias-entrada"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4 text-amber-500" />
            Novo Cliente de Entrada
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-amber-200">
            Cliente ainda sem credenciais. Será ativado depois com URL + login.
          </p>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Nome *</label>
            <input required value={form.nome} onChange={set("nome")} className="mt-1 form-input w-full" placeholder="Farmácia Central" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Responsável</label>
              <input value={form.responsavel} onChange={set("responsavel")} className="mt-1 form-input w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Telefone</label>
              <input value={form.telefone} onChange={set("telefone")} className="mt-1 form-input w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Cidade</label>
            <input value={form.cidade} onChange={set("cidade")} className="mt-1 form-input w-full" />
          </div>
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl ring-1 ring-zinc-100">
            <input
              type="checkbox"
              id="tem_chatbot_novo"
              checked={form.tem_chatbot}
              onChange={(e) => setForm((p) => ({ ...p, tem_chatbot: e.target.checked }))}
              className="size-4 accent-brand"
            />
            <label htmlFor="tem_chatbot_novo" className="text-sm font-medium text-zinc-700 cursor-pointer">
              Tem PharmaChatBot
            </label>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Gestor</label>
            <select value={form.gestor_id} onChange={set("gestor_id")} className="mt-1 form-input w-full">
              <option value="">Sem gestor</option>
              {gestores.filter((g) => !g.is_admin).map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.nome.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
            Adicionar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

function EntradaPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [ativarTarget, setAtivarTarget] = useState<Farmacia | null>(null);
  const [editTarget, setEditTarget] = useState<Farmacia | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmacia | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: farmacias = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["farmacias-entrada", query],
    queryFn: () => getFarmacias({ fase: "entrada", busca: query || undefined }),
    refetchOnMount: "always",
    staleTime: 0,
  });

  const { data: gestores = [] } = useQuery({
    queryKey: ["gestores"],
    queryFn: getGestores,
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: deleteFarmacia,
    onSuccess: () => {
      toast.success("Cliente removido.");
      qc.invalidateQueries({ queryKey: ["farmacias-entrada"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppShell
      title="Farmácias"
      headerRight={
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <RefreshCw className="size-3 animate-spin" /> Atualizando...
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setNovoOpen(true)}
            className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-amber-500 text-white rounded-md hover:opacity-90"
          >
            <Plus className="size-3.5" /> Novo Cliente
          </button>
        </div>
      }
    >
      <FarmaciasTabs />

      {/* Barra de aviso */}
      <div className="bg-amber-50 rounded-xl ring-1 ring-amber-200 px-4 py-3 flex items-center gap-3">
        <Clock className="size-4 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-800">
          Clientes cadastrados mas ainda sem credenciais da plataforma.
          Ative-os assim que tiver as informações de acesso.
        </p>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-md border border-zinc-100">
          <Search className="size-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome..."
            className="bg-transparent outline-none text-sm flex-1"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl ring-1 ring-amber-100 h-44 animate-pulse" />
          ))}
        </div>
      )}

      {/* Cards */}
      {!isLoading && farmacias.length === 0 && (
        <div className="text-center py-20">
          <Clock className="size-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Nenhum cliente em entrada no momento.</p>
          <button
            onClick={() => setNovoOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-md hover:opacity-90"
          >
            <Plus className="size-3.5" /> Adicionar primeiro cliente
          </button>
        </div>
      )}

      {!isLoading && farmacias.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {farmacias.map((p) => {
            const gestorNome = gestores.find((g) => g.id === p.gestor_id)?.nome;
            return (
              <div key={p.id} className="bg-white rounded-xl ring-1 ring-amber-200 shadow-sm p-5 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-200 shrink-0">
                        ENTRADA
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-900 truncate">{p.nome}</h3>
                    <p className="text-[10px] text-amber-600 italic mt-0.5">Aguardando ativação</p>
                  </div>
                  {!p.tem_chatbot && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-50 text-sky-600 ring-1 ring-sky-200 shrink-0">
                      Sem ChatBot
                    </span>
                  )}
                </div>

                {/* Contato */}
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
                  {!p.responsavel && !p.telefone && !p.cidade && (
                    <p className="text-xs text-zinc-400 italic">Sem dados de contato</p>
                  )}
                  <p className="text-[10px] text-zinc-400">
                    {gestorNome ?? "Sem gestor atribuído"}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 mt-auto">
                  <button
                    onClick={() => setEditTarget(p)}
                    className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900"
                  >
                    <Pencil className="size-3" /> Editar
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="size-3" /> Remover
                  </button>
                  <button
                    onClick={() => setAtivarTarget(p)}
                    className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold bg-amber-500 text-white px-2.5 py-1 rounded-md hover:opacity-90"
                  >
                    <Rocket className="size-3" /> Ativar Cliente
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ModalNovo open={novoOpen} onOpenChange={setNovoOpen} gestores={gestores} />
      <ModalAtivar farmacia={ativarTarget} gestores={gestores} onClose={() => setAtivarTarget(null)} onSaved={() => {}} />
      <ModalEditar farmacia={editTarget} gestores={gestores} onClose={() => setEditTarget(null)} onSaved={() => {}} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.nome}" será removido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
