import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search, Check, Loader2, ImageOff } from "lucide-react";
import { listarCatalogoProdutos, catalogoImagemUrl, type CatalogoProdutoItem } from "@/lib/api";
import { SEM_CATEGORIA, categoriasDe, normalizarCategoria, rotuloCategoria } from "@/lib/categorias";

/**
 * Escolha de produtos direto do catálogo, por foto.
 *
 * Existe porque o fluxo de criativos só aceitava planilha ou nome digitado: com
 * 200 produtos no banco, o gestor tinha de lembrar do nome exato de cada um. Aqui
 * ele vê, filtra e clica.
 *
 * Só lista produtos ATIVOS — item desligado não gera criativo, e mostrá-lo seria
 * oferecer uma escolha que o fluxo depois recusa.
 */

/** Mesma normalização de busca usada no Banco de Imagens. */
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function SeletorProdutosModal({
  jaEscolhidos = [],
  onConfirmar,
  onClose,
}: {
  /** Ids que já estão no fluxo — entram marcados, para o gestor complementar a lista. */
  jaEscolhidos?: number[];
  onConfirmar: (produtos: CatalogoProdutoItem[]) => void;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [selecao, setSelecao] = useState<Set<number>>(() => new Set(jaEscolhidos));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["catalogo-produtos"],
    queryFn: listarCatalogoProdutos,
    staleTime: 60_000,
  });

  const produtos = useMemo(
    () => (data?.produtos ?? []).filter((p) => p.ativo),
    [data],
  );

  // Chips vêm do que existe nos produtos, não de uma lista fixa: chip que não
  // filtra nada é armadilha.
  const chips = useMemo(() => {
    const { nomes, temSemCategoria } = categoriasDe(produtos);
    const base = [{ valor: "todas", rotulo: "Todas" }, ...nomes.map((n) => ({ valor: n, rotulo: n }))];
    return temSemCategoria ? [...base, { valor: SEM_CATEGORIA, rotulo: "Sem categoria" }] : base;
  }, [produtos]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca);
    return produtos.filter((p) => {
      if (termo && !semAcento(p.nome).includes(termo)) return false;
      if (filtroCat === "todas") return true;
      if (filtroCat === SEM_CATEGORIA) return !p.categoria?.trim();
      return normalizarCategoria(p.categoria ?? "") === normalizarCategoria(filtroCat);
    });
  }, [produtos, busca, filtroCat]);

  function alternar(id: number) {
    setSelecao((prev) => {
      const proxima = new Set(prev);
      if (proxima.has(id)) proxima.delete(id); else proxima.add(id);
      return proxima;
    });
  }

  /** Marca/desmarca tudo o que está na tela — respeita busca e filtro. */
  function alternarVisiveis() {
    const todosMarcados = visiveis.length > 0 && visiveis.every((p) => selecao.has(p.id));
    setSelecao((prev) => {
      const proxima = new Set(prev);
      visiveis.forEach((p) => (todosMarcados ? proxima.delete(p.id) : proxima.add(p.id)));
      return proxima;
    });
  }

  function confirmar() {
    // Ordem da tela, não a de clique: é assim que o gestor espera rever a lista.
    onConfirmar(produtos.filter((p) => selecao.has(p.id)));
  }

  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((p) => selecao.has(p.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + filtros */}
        <div className="px-6 py-4 border-b border-zinc-100 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Escolher do catálogo</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Clique nos produtos que vão virar criativo. Os preços você ajusta depois.
              </p>
            </div>
            <button onClick={onClose} className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
              <X className="size-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoFocus
                placeholder="Buscar produto pelo nome..."
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            {visiveis.length > 0 && (
              <button
                onClick={alternarVisiveis}
                className="shrink-0 text-xs font-semibold text-brand hover:underline whitespace-nowrap"
              >
                {todosVisiveisMarcados ? "Desmarcar todos" : `Selecionar os ${visiveis.length}`}
              </button>
            )}
          </div>

          {chips.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.valor}
                  onClick={() => setFiltroCat(c.valor)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    filtroCat === c.valor
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {rotuloCategoria(c.rotulo)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grade */}
        <div className="flex-1 overflow-y-auto p-5 bg-zinc-50/60">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Carregando o catálogo...</span>
            </div>
          ) : isError ? (
            <p className="text-sm text-center text-zinc-500 py-12">Não foi possível carregar o catálogo.</p>
          ) : visiveis.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <ImageOff className="size-8 mx-auto mb-2" />
              <p className="text-sm">
                {produtos.length === 0 ? "Nenhum produto ativo no catálogo." : "Nenhum produto com esses filtros."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {visiveis.map((p) => {
                const marcado = selecao.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => alternar(p.id)}
                    title={p.nome}
                    className={`group text-left rounded-xl border-2 bg-white overflow-hidden transition ${
                      marcado ? "border-brand ring-2 ring-brand/20" : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="relative aspect-square bg-zinc-100">
                      <img
                        src={catalogoImagemUrl(p.id)}
                        alt={p.nome}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                      {marcado && (
                        <span className="absolute top-1.5 right-1.5 size-6 rounded-full bg-brand text-white grid place-items-center shadow">
                          <Check className="size-4" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    {/* Altura de duas linhas sempre: nome curto e nome longo
                        deixam os cards da fileira do mesmo tamanho. */}
                    <p className="px-2 py-1.5 min-h-[2.9em] text-[11px] leading-snug text-zinc-700 line-clamp-2">
                      {p.nome}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <p className="text-sm text-zinc-500">
            {selecao.size === 0
              ? "Nenhum produto escolhido"
              : `${selecao.size} produto(s) escolhido(s)`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition">
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={selecao.size === 0}
              className="bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
            >
              <Check className="size-4" /> Usar {selecao.size > 0 ? selecao.size : ""} produto{selecao.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
