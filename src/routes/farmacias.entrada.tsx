import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Search, Plus, Pencil, Trash2, RefreshCw, Phone, MapPin,
  User, Rocket, Clock, UserCheck, Bot, BotOff, type LucideIcon,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FarmaciasTabs } from "@/components/FarmaciasTabs";
import { FarmaciasCabecalho, IndicadorTopo, CLASSE_ACAO_TOPO } from "@/components/FarmaciasCabecalho";
import {
  getFarmacias, getGestores, createFarmacia, updateFarmacia,
  deleteFarmacia, ativarFarmacia, nomeVisivel, type Farmacia, type Gestor,
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
  const [form, setForm] = useState({ gestor_id: "" });

  useEffect(() => {
    if (farmacia) setForm({ gestor_id: farmacia.gestor_id ? String(farmacia.gestor_id) : "" });
  }, [farmacia]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      ativarFarmacia(farmacia!.id, {
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
            disabled={mut.isPending}
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
      qc.invalidateQueries({ queryKey: ["farmacias"] });
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
  const [form, setForm] = useState({ nome: "", nome_fachada: "", responsavel: "", telefone: "", cidade: "", gestor_id: "", tem_chatbot: true });
  const [showSenha] = useState(false);

  useEffect(() => {
    if (open) setForm({ nome: "", nome_fachada: "", responsavel: "", telefone: "", cidade: "", gestor_id: "", tem_chatbot: true });
  }, [open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => createFarmacia({
      nome: form.nome,
      nome_fachada: form.nome_fachada,
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
      qc.invalidateQueries({ queryKey: ["farmacias"] });
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
            Cliente ainda em implantação. Ative quando começar a ser acompanhado no painel.
          </p>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Razão social *</label>
            <input required value={form.nome} onChange={set("nome")} className="mt-1 form-input w-full" placeholder="BARROS E SILVA COMERCIO DE MEDICAMENTOS LTDA" />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Nome de fachada *</label>
            <input required value={form.nome_fachada} onChange={set("nome_fachada")} className="mt-1 form-input w-full" placeholder="Drogaria Bem Estar" />
            <p className="text-[11px] text-zinc-400 mt-1">É este que vai no criativo do grupo de ofertas.</p>
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
            disabled={mut.isPending || !form.nome.trim() || !form.nome_fachada.trim()}
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
  const [selId, setSelId] = useState<number | null>(null);
  const [ativarTarget, setAtivarTarget] = useState<Farmacia | null>(null);
  const [editTarget, setEditTarget] = useState<Farmacia | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmacia | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: farmacias = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["farmacias-entrada"],
    queryFn: () => getFarmacias({ fase: "entrada" }),
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
      qc.invalidateQueries({ queryKey: ["farmacias"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const gestorNome = (id: number | null) => (id ? gestores.find((g) => g.id === id)?.nome ?? null : null);

  const termo = query.trim().toLowerCase();
  const filtradas = farmacias.filter((p) =>
    !termo || [p.nome, p.nome_fachada, p.responsavel, p.cidade, gestorNome(p.gestor_id)]
      .filter(Boolean).join(" ").toLowerCase().includes(termo),
  );
  const atual = filtradas.find((p) => p.id === selId) ?? filtradas[0] ?? null;

  const comGestor = farmacias.filter((p) => p.gestor_id).length;
  const comContato = farmacias.filter((p) => p.responsavel || p.telefone).length;
  const semChatbot = farmacias.filter((p) => !p.tem_chatbot).length;

  return (
    <AppShell title="Farmácias" hideHeader larguraTotal>
      <FarmaciasCabecalho
        subtitulo={`${farmacias.length} clientes em implantação · ainda fora do painel`}
        atualizando={isFetching}
        onAtualizar={() => refetch()}
        acao={
          <button onClick={() => setNovoOpen(true)} className={CLASSE_ACAO_TOPO}>
            <Plus className="size-4" /> Novo cliente
          </button>
        }
      >
        <IndicadorTopo icone={Clock} rotulo="Em entrada" carregando={isLoading} valor={String(farmacias.length)} />
        <IndicadorTopo icone={UserCheck} rotulo="Com gestor" carregando={isLoading} valor={`${comGestor}/${farmacias.length}`} />
        <IndicadorTopo icone={Phone} rotulo="Com contato" carregando={isLoading} valor={`${comContato}/${farmacias.length}`} />
        <IndicadorTopo icone={BotOff} rotulo="Sem ChatBot" carregando={isLoading} valor={String(semChatbot)} />
      </FarmaciasCabecalho>

      <div className={`grid items-start gap-6 ${atual ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        {/* Lista */}
        <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-4">
            <FarmaciasTabs />
            <label className="flex h-10 flex-1 min-w-56 items-center gap-2 rounded-xl px-3 ring-1 ring-zinc-200 focus-within:ring-zinc-400">
              <Search className="size-4 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, responsável, cidade ou gestor…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          {isLoading && (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 px-4 py-3"><div className="h-full rounded-lg bg-zinc-100 animate-pulse" /></div>
              ))}
            </div>
          )}

          {!isLoading && filtradas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-y border-zinc-100">
                <span className="size-2 rounded-full bg-amber-500" />
                Aguardando ativação
                <span className="font-medium normal-case tracking-normal text-zinc-400">· {filtradas.length} clientes</span>
              </div>
              {filtradas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelId(p.id)}
                  className={`flex w-full items-center gap-4 border-l-4 px-4 py-3 text-left transition-colors hover:bg-zinc-50 ${
                    atual?.id === p.id ? "border-l-brand bg-red-50/40" : "border-l-transparent"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-900">{nomeVisivel(p)}</p>
                      {!p.nome_fachada && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 ring-1 ring-red-200">
                          SEM FACHADA
                        </span>
                      )}
                      {!p.tem_chatbot && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-sky-50 text-sky-600 ring-1 ring-sky-200">
                          Sem ChatBot
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      {[gestorNome(p.gestor_id) ?? "Sem gestor", p.responsavel, p.cidade].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-600/15">
                    Em entrada
                  </span>
                </button>
              ))}
            </div>
          )}

          {!isLoading && farmacias.length === 0 && (
            <div className="p-12 text-center">
              <Clock className="size-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Nenhum cliente em entrada no momento.</p>
              <button
                onClick={() => setNovoOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand text-white rounded-xl hover:opacity-90"
              >
                <Plus className="size-4" /> Adicionar primeiro cliente
              </button>
            </div>
          )}

          {!isLoading && farmacias.length > 0 && filtradas.length === 0 && (
            <p className="p-12 text-center text-sm text-zinc-500">Nenhum cliente encontrado.</p>
          )}
        </section>

        {/* Detalhe */}
        {atual && (
          <aside className="sticky top-6 space-y-4 rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight text-zinc-900">{nomeVisivel(atual)}</p>
                <p className="truncate text-xs text-zinc-500">{atual.nome_fachada ? atual.nome : " "}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-600/15">
                Em entrada
              </span>
            </div>

            <div className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-100">
              <Dado icone={UserCheck} rotulo="Gestor" valor={gestorNome(atual.gestor_id)} vazio="Sem gestor atribuído" />
              <Dado icone={User} rotulo="Responsável" valor={atual.responsavel} />
              <Dado icone={Phone} rotulo="Telefone" valor={atual.telefone} />
              <Dado icone={MapPin} rotulo="Cidade" valor={atual.cidade} />
              <Dado icone={Bot} rotulo="PharmaChatBot" valor={atual.tem_chatbot ? "Sim" : "Não"} />
            </div>

            <div className="rounded-xl border-l-4 border-l-amber-500 bg-amber-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Próximo passo</p>
              <p className="mt-1 font-bold text-zinc-900">Ativar o cliente</p>
              <p className="mt-1 text-sm text-zinc-600">
                Ainda não é acompanhado no painel. Ative assim que tiver as informações de acesso.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAtivarTarget(atual)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                <Rocket className="size-3.5" /> Ativar cliente
              </button>
              <button
                onClick={() => setEditTarget(atual)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg ring-1 ring-zinc-200 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                <Pencil className="size-3.5" /> Editar
              </button>
              <button onClick={() => setDeleteTarget(atual)} title="Remover" className="flex items-center justify-center rounded-lg px-3 py-2 text-red-500 hover:bg-red-50">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </aside>
        )}
      </div>

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

function Dado({ icone: Icone, rotulo, valor, vazio = "—" }: { icone: LucideIcon; rotulo: string; valor: string | null; vazio?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Icone className="size-4 shrink-0 text-zinc-400" />
      <span className="text-xs text-zinc-500">{rotulo}</span>
      <span className={`ml-auto truncate text-sm ${valor ? "font-medium text-zinc-800" : "text-zinc-400 italic"}`}>{valor || vazio}</span>
    </div>
  );
}
