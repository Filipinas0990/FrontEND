import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Search, Plus, Trash2, ImageIcon, Loader2, X, Tag } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BancoImagensModal } from "@/components/BancoImagensModal";
import { Switch } from "@/components/ui/switch";
import {
  listarCatalogoProdutos,
  setCatalogoProdutoAtivo,
  setCatalogoProdutosCategoria,
  getCategoriasCatalogo,
  deletarCatalogoProduto,
  catalogoImagemUrl,
  type CatalogoProdutoItem,
} from "@/lib/api";
import {
  SEM_CATEGORIA,
  rotuloCategoria,
  categoriasDe,
  normalizarCategoria,
  mesclarCategorias,
} from "@/lib/categorias";
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

export const Route = createFileRoute("/banco-imagens")({
  component: BancoImagensPage,
  head: () => ({ meta: [{ title: "Banco de Imagens — GrupoSymbol" }] }),
});

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** Busca sem acento: "dermocosmetico" tem de achar "Dermocosmético". */
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type FiltroStatus = "todos" | "ativos" | "desligados";

function BancoImagensPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [excluir, setExcluir] = useState<CatalogoProdutoItem | null>(null);
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [selecao, setSelecao] = useState<Set<number>>(new Set());
  // Texto do campo de classificação em lote (a barra escura)
  const [catLote, setCatLote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["catalogo-produtos"],
    queryFn: listarCatalogoProdutos,
  });
  const produtos = useMemo(() => data?.produtos ?? [], [data]);

  // Liga/desliga com atualização otimista
  const toggleMut = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => setCatalogoProdutoAtivo(id, ativo),
    onMutate: async ({ id, ativo }) => {
      await qc.cancelQueries({ queryKey: ["catalogo-produtos"] });
      const anterior = qc.getQueryData<{ produtos: CatalogoProdutoItem[] }>(["catalogo-produtos"]);
      qc.setQueryData<{ produtos: CatalogoProdutoItem[] }>(["catalogo-produtos"], (old) =>
        old ? { produtos: old.produtos.map((p) => (p.id === id ? { ...p, ativo } : p)) } : old,
      );
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(["catalogo-produtos"], ctx.anterior);
      toast.error("Não foi possível atualizar o status.");
    },
  });

  const deletarMut = useMutation({
    mutationFn: (id: number) => deletarCatalogoProduto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
      qc.invalidateQueries({ queryKey: ["catalogo-status"] });
      toast.success("Imagem removida do banco.");
    },
    onError: () => toast.error("Erro ao remover imagem."),
  });

  const classificarMut = useMutation({
    mutationFn: ({ ids, categoria }: { ids: number[]; categoria: string | null }) =>
      setCatalogoProdutosCategoria(ids, categoria),
    onSuccess: (res, { categoria }) => {
      qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
      qc.invalidateQueries({ queryKey: ["catalogo-categorias"] });
      setSelecao(new Set());
      setCatLote("");
      toast.success(
        categoria
          ? `${res.total} produto(s) em ${rotuloCategoria(categoria)}.`
          : `${res.total} produto(s) sem categoria.`,
      );
    },
    onError: () => toast.error("Não foi possível classificar os produtos."),
  });

  // ── Chips: as categorias que EXISTEM nos produtos, não uma lista fixa ───────
  // Com texto livre não há catálogo de categorias para percorrer; a barra é um
  // reflexo do que está aplicado. Categoria que ficou sem produto some sozinha.
  const contagem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of produtos) {
      const chave = p.categoria?.trim() ? normalizarCategoria(p.categoria) : SEM_CATEGORIA;
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
    return mapa;
  }, [produtos]);

  const chips = useMemo(() => {
    const { nomes, temSemCategoria } = categoriasDe(produtos);
    const lista: { valor: string; rotulo: string; total: number }[] = [
      { valor: "todas", rotulo: "Todas", total: produtos.length },
    ];
    for (const nome of nomes) {
      lista.push({ valor: nome, rotulo: nome, total: contagem.get(normalizarCategoria(nome)) ?? 0 });
    }
    if (temSemCategoria) {
      lista.push({
        valor: SEM_CATEGORIA,
        rotulo: "Sem categoria",
        total: contagem.get(SEM_CATEGORIA) ?? 0,
      });
    }
    return lista;
  }, [produtos, contagem]);

  /**
   * Opções do campo de lote: as em uso MAIS as padrão do negócio — a mesma
   * lista do modal de upload. Os CHIPS acima continuam saindo só do acervo:
   * chip de categoria sem produto nenhum seria um filtro que não filtra.
   */
  const { data: cats } = useQuery({
    queryKey: ["catalogo-categorias"],
    queryFn: getCategoriasCatalogo,
    staleTime: 60_000,
  });
  const sugestoes = useMemo(
    () => mesclarCategorias(
      (cats?.categorias ?? []).map((c) => c.nome),
      cats?.sugestoes ?? [],
    ),
    [cats],
  );

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return produtos.filter((p) => {
      if (termo && !semAcento(p.nome).includes(termo)) return false;
      if (filtroStatus === "ativos" && !p.ativo) return false;
      if (filtroStatus === "desligados" && p.ativo) return false;
      if (filtroCat === "todas") return true;
      if (filtroCat === SEM_CATEGORIA) return !p.categoria?.trim();
      // Compara normalizado: grafias diferentes da mesma categoria caem no
      // mesmo chip, mesmo que alguma tenha escapado da canonização do backend.
      return normalizarCategoria(p.categoria ?? "") === normalizarCategoria(filtroCat);
    });
  }, [produtos, busca, filtroCat, filtroStatus]);

  // A seleção vale sobre o que está na tela. Se um filtro esconde um produto
  // marcado, ele sai da seleção — classificar em lote algo que sumiu da grade
  // seria uma alteração invisível.
  useEffect(() => {
    setSelecao((atual) => {
      if (atual.size === 0) return atual;
      const naTela = new Set(visiveis.map((p) => p.id));
      const podado = new Set([...atual].filter((id) => naTela.has(id)));
      return podado.size === atual.size ? atual : podado;
    });
  }, [visiveis]);

  function alternarSelecao(id: number) {
    setSelecao((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const todosMarcados = visiveis.length > 0 && selecao.size === visiveis.length;

  return (
    <AppShell title="Banco de Imagens">
      {/* Cabeçalho: voltar + título + intro */}
      <div className="relative">
        <Link
          to="/configuracoes"
          className="absolute left-0 top-0 size-9 rounded-lg ring-1 ring-zinc-200 bg-white grid place-items-center text-zinc-600 hover:bg-zinc-50 transition"
          title="Voltar"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center max-w-3xl mx-auto px-12">
          <h2 className="text-2xl font-bold text-zinc-900">Banco de Imagens</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            As fotos dos produtos usadas para gerar os criativos automaticamente.
            Desligue um produto para que ele não seja usado nos criativos, sem
            precisar apagar a imagem.
          </p>
        </div>
      </div>

      {/* Toolbar: busca + status + adicionar */}
      <div className="flex flex-wrap items-center gap-3 max-w-6xl mx-auto w-full">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquise pelo produto"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>

        {/* Status: ver o acervo todo, só o que entra em criativo, ou só o pausado */}
        <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
          {([
            ["todos", "Todos"],
            ["ativos", "Ativos"],
            ["desligados", "Desligados"],
          ] as const).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltroStatus(valor)}
              className={`px-3 py-1.5 rounded-md transition ${
                filtroStatus === valor ? "bg-brand text-white" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand/90 transition"
        >
          <Plus className="size-4" /> Adicionar Imagem
        </button>
      </div>

      {/* Chips de categoria */}
      {produtos.length > 0 && (
        <div className="max-w-6xl mx-auto w-full -mt-1">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => (
              <button
                key={c.valor}
                type="button"
                onClick={() => setFiltroCat(c.valor)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  filtroCat === c.valor
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {c.rotulo}
                <span className={filtroCat === c.valor ? "text-white/70 ml-1.5" : "text-zinc-400 ml-1.5"}>
                  {c.total}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de ação em lote — o que viabiliza organizar o acervo antigo */}
      {selecao.size > 0 && (
        <div className="max-w-6xl mx-auto w-full sticky top-2 z-20">
          <div className="flex flex-wrap items-center gap-3 bg-zinc-900 text-white rounded-xl px-4 py-3 shadow-lg">
            <Tag className="size-4 shrink-0" />
            <span className="text-sm font-medium">
              {selecao.size} selecionado{selecao.size > 1 ? "s" : ""}
            </span>
            {/* Digita a categoria (nova ou existente) e aplica na seleção */}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const texto = catLote.trim();
                if (!texto) return;
                classificarMut.mutate({ ids: [...selecao], categoria: texto });
              }}
            >
              <input
                list="categorias-em-uso"
                value={catLote}
                onChange={(e) => setCatLote(e.target.value)}
                maxLength={60}
                placeholder="Mover para a categoria..."
                className="px-3 py-1.5 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <datalist id="categorias-em-uso">
                {sugestoes.map((c) => <option key={c} value={c} />)}
              </datalist>
              <button
                type="submit"
                disabled={!catLote.trim() || classificarMut.isPending}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white text-zinc-900 disabled:opacity-40 transition"
              >
                Aplicar
              </button>
              <button
                type="button"
                disabled={classificarMut.isPending}
                onClick={() => classificarMut.mutate({ ids: [...selecao], categoria: null })}
                className="px-2 py-1.5 text-xs text-white/70 hover:text-white transition"
                title="Deixar os selecionados sem categoria"
              >
                limpar categoria
              </button>
            </form>
            {classificarMut.isPending && <Loader2 className="size-4 animate-spin" />}
            <button
              type="button"
              onClick={() => setSelecao(new Set())}
              className="ml-auto flex items-center gap-1 text-xs text-white/70 hover:text-white transition"
            >
              <X className="size-3.5" /> Limpar seleção
            </button>
          </div>
        </div>
      )}

      {/* Grade */}
      <div className="max-w-6xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-16">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        ) : produtos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-zinc-400">
            <ImageIcon className="size-10 text-zinc-300" />
            <p className="text-sm">Nenhuma imagem no banco ainda.</p>
            <button onClick={() => setShowUpload(true)} className="mt-1 text-sm font-medium text-brand hover:underline">
              Adicionar a primeira imagem
            </button>
          </div>
        ) : visiveis.length === 0 ? (
          <p className="text-center text-sm text-zinc-400 py-16">
            Nenhum produto {busca ? `para "${busca}"` : "neste filtro"}.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 text-xs text-zinc-500">
              <span>
                {visiveis.length} de {produtos.length} imagem(ns)
              </span>
              <button
                type="button"
                onClick={() => setSelecao(todosMarcados ? new Set() : new Set(visiveis.map((p) => p.id)))}
                className="font-medium text-brand hover:underline"
              >
                {todosMarcados ? "Desmarcar todos" : "Selecionar todos os visíveis"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visiveis.map((p) => {
                const marcado = selecao.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`group relative bg-white rounded-xl border p-2 transition ${
                      marcado ? "border-brand ring-2 ring-brand/20" : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {/* A imagem inteira é o alvo da seleção — mira grande, o
                        gestor vai marcar dezenas seguidas. */}
                    <button
                      type="button"
                      onClick={() => alternarSelecao(p.id)}
                      className="block w-full text-left"
                      aria-pressed={marcado}
                      aria-label={`Selecionar ${p.nome}`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-zinc-50">
                        <img
                          src={catalogoImagemUrl(p.id)}
                          alt={p.nome}
                          loading="lazy"
                          className={`size-full object-cover transition ${p.ativo ? "" : "grayscale opacity-50"}`}
                        />
                        <span
                          className={`absolute top-2 left-2 size-5 rounded-md border grid place-items-center text-[11px] font-bold transition ${
                            marcado
                              ? "bg-brand border-brand text-white"
                              : "bg-white/90 border-zinc-300 text-transparent group-hover:border-zinc-400"
                          }`}
                        >
                          ✓
                        </span>
                        {!p.ativo && (
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-zinc-900/75 text-white text-[10px] font-semibold">
                            DESLIGADO
                          </span>
                        )}
                      </div>

                      <p
                        className={`mt-2 text-xs font-medium truncate ${p.ativo ? "text-zinc-800" : "text-zinc-400"}`}
                        title={p.nome}
                      >
                        {p.nome}
                      </p>
                      <p
                        className={`mt-0.5 text-[11px] truncate ${
                          p.categoria ? "text-zinc-500" : "text-amber-600 font-medium"
                        }`}
                      >
                        {rotuloCategoria(p.categoria)}
                      </p>
                    </button>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
                      <span className="text-[10px] text-zinc-400">{fmtData(p.criadoEm)}</span>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={p.ativo}
                          onCheckedChange={(v) => toggleMut.mutate({ id: p.id, ativo: v })}
                          aria-label={p.ativo ? `Desligar ${p.nome}` : `Ativar ${p.nome}`}
                          className="data-[state=checked]:bg-brand scale-90"
                        />
                        <button
                          onClick={() => setExcluir(p)}
                          className="size-7 rounded-lg grid place-items-center text-zinc-400 hover:bg-red-50 hover:text-red-500 transition"
                          title="Remover"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showUpload && <BancoImagensModal onClose={() => setShowUpload(false)} />}

      <AlertDialog open={!!excluir} onOpenChange={(open) => !open && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{excluir?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem será apagada do banco. Se quiser só pausar o uso nos criativos, use o toggle de status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluir) deletarMut.mutate(excluir.id);
                setExcluir(null);
              }}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
