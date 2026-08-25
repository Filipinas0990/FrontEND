import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Tags, Tag, Plus, Pencil, Trash2, Loader2, Search, Check, X, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getCategoriasCatalogo, criarCategoria, renomearCategoria, excluirCategoria,
  type CategoriaCadastrada,
} from "@/lib/api";
import { normalizarCategoria } from "@/lib/categorias";
import { getUser } from "@/lib/auth";
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

export const Route = createFileRoute("/categorias")({
  component: CategoriasPage,
  head: () => ({ meta: [{ title: "Categorias — GrupoSymbol" }] }),
});

const MAX_NOME = 60;

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/**
 * Cadastro de categorias do banco de imagens.
 *
 * O que a categoria organiza são as IMAGENS do acervo — é por ela que o dono
 * da farmácia filtra no celular, no link público de ofertas. Por isso a
 * contagem de imagens fica visível em cada linha: categoria com zero imagem
 * não aparece como filtro em lugar nenhum, e é bom que isso não seja surpresa.
 *
 * Renomear reescreve a categoria das imagens que estavam nela; excluir deixa
 * essas imagens sem categoria, sem apagar nada. O backend é quem faz as duas
 * coisas — aqui só avisamos o tamanho do estrago antes.
 */
function CategoriasPage() {
  const qc = useQueryClient();
  const podeEditar = getUser()?.is_admin === true;

  const [nova, setNova] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<{ id: number; nome: string } | null>(null);
  const [excluindo, setExcluindo] = useState<CategoriaCadastrada | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["catalogo-categorias"],
    queryFn: getCategoriasCatalogo,
  });
  const categorias = useMemo(() => data?.categorias ?? [], [data]);

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["catalogo-categorias"] });
    // A grade de imagens mostra a categoria em cada card: renomear ou excluir
    // aqui deixa aquela tela com o texto velho até o próximo fetch.
    qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
  }

  const criar = useMutation({
    mutationFn: () => criarCategoria(nova.trim()),
    onSuccess: (r) => {
      setNova("");
      recarregar();
      toast.success(`Categoria "${r.categoria.nome}" criada.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar."),
  });

  const renomear = useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) => renomearCategoria(id, nome),
    onSuccess: (r) => {
      setEditando(null);
      recarregar();
      toast.success(
        r.produtos > 0
          ? `Renomeada para "${r.categoria.nome}" — ${r.produtos} ${r.produtos === 1 ? "imagem atualizada" : "imagens atualizadas"}.`
          : `Renomeada para "${r.categoria.nome}".`,
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível renomear."),
  });

  const excluir = useMutation({
    mutationFn: (id: number) => excluirCategoria(id),
    onSuccess: (r) => {
      setExcluindo(null);
      recarregar();
      toast.success(
        r.produtos > 0
          ? `Categoria excluída — ${r.produtos} ${r.produtos === 1 ? "imagem ficou" : "imagens ficaram"} sem categoria.`
          : "Categoria excluída.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });

  // Avisa ANTES de mandar: o backend recusa com 409, mas descobrir que a
  // categoria já existe só depois de clicar é atrito à toa.
  const novaJaExiste =
    nova.trim().length > 0 &&
    categorias.some((c) => normalizarCategoria(c.nome) === normalizarCategoria(nova));

  const visiveis = useMemo(() => {
    const termo = normalizarCategoria(busca);
    if (!termo) return categorias;
    return categorias.filter((c) => normalizarCategoria(c.nome).includes(termo));
  }, [categorias, busca]);

  const classificadas = categorias.reduce((s, c) => s + c.total, 0);

  return (
    <AppShell title="Categorias">
      <div className="max-w-3xl mx-auto space-y-5">
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition"
        >
          <ChevronLeft className="size-4" /> Configurações
        </Link>

        {/* Cabeçalho + criação */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <div className="flex items-start gap-3">
            <Tags className="size-5 text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Categorias do banco de imagens
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                São elas que organizam o acervo: viram os filtros do banco de imagens, do passo
                de criativos e do link público que o dono da farmácia abre no celular. Renomear
                aqui atualiza todas as imagens da categoria; excluir não apaga imagem nenhuma —
                elas só ficam sem categoria.
              </p>
            </div>
          </div>

          {podeEditar ? (
            <>
              <div className="flex flex-wrap items-end gap-3 mt-5">
                <div className="flex flex-col gap-1.5 flex-1 min-w-[14rem]">
                  <label htmlFor="nova-categoria" className="text-xs font-medium text-zinc-600">
                    Nova categoria
                  </label>
                  <input
                    id="nova-categoria"
                    value={nova}
                    onChange={(e) => setNova(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && nova.trim() && !novaJaExiste && !criar.isPending) {
                        criar.mutate();
                      }
                    }}
                    maxLength={MAX_NOME}
                    placeholder="Ex.: Verão 2026"
                    className="px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <button
                  onClick={() => criar.mutate()}
                  disabled={criar.isPending || !nova.trim() || novaJaExiste}
                  className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
                >
                  {criar.isPending
                    ? <Loader2 className="size-4 animate-spin" />
                    : <Plus className="size-4" />}
                  Criar categoria
                </button>
              </div>
              {novaJaExiste && (
                <p className="text-[11px] text-amber-600 mt-2">
                  “{nova.trim()}” já está cadastrada.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-zinc-400 mt-4">
              Só o administrador cria, renomeia ou exclui categorias.
            </p>
          )}
        </div>

        {/* Busca — só aparece quando a lista já não cabe de relance */}
        {categorias.length > 8 && (
          <div className="relative">
            <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar categoria..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        )}

        {/* Lista */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-400 text-sm">
              <Loader2 className="size-4 animate-spin" /> Carregando...
            </div>
          ) : categorias.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">
              Nenhuma categoria cadastrada
              {podeEditar ? ". Crie a primeira acima." : " ainda."}
            </div>
          ) : visiveis.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">
              Nenhuma categoria com “{busca}”.
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {visiveis.map((c) =>
                editando?.id === c.id ? (
                  <LinhaEdicao
                    key={c.id}
                    nome={editando.nome}
                    salvando={renomear.isPending}
                    onChange={(nome) => setEditando({ id: c.id, nome })}
                    onCancelar={() => setEditando(null)}
                    onSalvar={() => renomear.mutate({ id: c.id, nome: editando.nome.trim() })}
                    duplicada={categorias.some(
                      (o) => o.id !== c.id &&
                        normalizarCategoria(o.nome) === normalizarCategoria(editando.nome),
                    )}
                  />
                ) : (
                  <div key={c.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
                      <Tag className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{c.nome}</p>
                      <p className="text-[11px] text-zinc-500">Criada em {fmtData(c.criadoEm)}</p>
                    </div>

                    <span
                      title="Imagens do banco classificadas nesta categoria"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 shrink-0 ${
                        c.total > 0
                          ? "bg-zinc-100 text-zinc-600 ring-zinc-200"
                          : "bg-amber-50 text-amber-600 ring-amber-200"
                      }`}
                    >
                      <ImageIcon className="size-3" />
                      {c.total === 0 ? "sem imagens" : `${c.total} ${c.total === 1 ? "imagem" : "imagens"}`}
                    </span>

                    {podeEditar && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditando({ id: c.id, nome: c.nome })}
                          title="Renomear"
                          className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => setExcluindo(c)}
                          title="Excluir"
                          className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {categorias.length > 0 && (
          <p className="text-[11px] text-zinc-400 text-center">
            {categorias.length} {categorias.length === 1 ? "categoria" : "categorias"} · {classificadas}{" "}
            {classificadas === 1 ? "imagem classificada" : "imagens classificadas"}.
            {" "}Para classificar imagens, use o{" "}
            <Link to="/banco-imagens" className="text-brand hover:underline">banco de imagens</Link>.
          </p>
        )}
      </div>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{excluindo?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo && excluindo.total > 0 ? (
                <>
                  {excluindo.total} {excluindo.total === 1 ? "imagem ficará" : "imagens ficarão"} sem
                  categoria. Nenhuma imagem é apagada — elas continuam no banco e podem ser
                  classificadas de novo a qualquer momento.
                </>
              ) : (
                <>Esta categoria não tem imagem nenhuma. Excluir não afeta o acervo.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
              disabled={excluir.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {excluir.isPending ? "Excluindo..." : "Excluir categoria"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

/**
 * Renomear acontece na própria linha, não num diálogo: é um campo só, e trocar
 * a tela inteira de contexto para editar uma palavra faz perder de vista quais
 * são as outras categorias — que é justamente o que se está conferindo ao
 * padronizar nomes.
 */
function LinhaEdicao({
  nome, salvando, duplicada, onChange, onSalvar, onCancelar,
}: {
  nome: string;
  salvando: boolean;
  duplicada: boolean;
  onChange: (v: string) => void;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const invalido = !nome.trim() || duplicada;

  return (
    <div className="px-5 py-3 bg-zinc-50/60">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
          <Tag className="size-4" />
        </div>
        <input
          autoFocus
          value={nome}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !invalido && !salvando) onSalvar();
            if (e.key === "Escape") onCancelar();
          }}
          maxLength={MAX_NOME}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          onClick={onSalvar}
          disabled={invalido || salvando}
          title="Salvar"
          className="size-8 rounded-lg grid place-items-center bg-brand text-white disabled:opacity-40 hover:bg-brand/90 transition shrink-0"
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button
          onClick={onCancelar}
          title="Cancelar"
          className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>
      {duplicada && (
        <p className="text-[11px] text-amber-600 mt-1.5 pl-11">
          Já existe uma categoria com esse nome.
        </p>
      )}
    </div>
  );
}
