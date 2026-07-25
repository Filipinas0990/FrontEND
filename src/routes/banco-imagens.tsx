import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Search, Plus, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BancoImagensModal } from "@/components/BancoImagensModal";
import { Switch } from "@/components/ui/switch";
import {
  listarCatalogoProdutos,
  setCatalogoProdutoAtivo,
  deletarCatalogoProduto,
  catalogoImagemUrl,
  type CatalogoProdutoItem,
} from "@/lib/api";
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

function BancoImagensPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [excluir, setExcluir] = useState<CatalogoProdutoItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["catalogo-produtos"],
    queryFn: listarCatalogoProdutos,
  });
  const produtos = data?.produtos ?? [];

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

  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? produtos.filter((p) => p.nome.toLowerCase().includes(termo)) : produtos;

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

      {/* Toolbar: busca + adicionar */}
      <div className="flex items-center gap-3 max-w-5xl mx-auto w-full">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquise pelo produto"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand/90 transition"
        >
          <Plus className="size-4" /> Adicionar Imagem
        </button>
      </div>

      {/* Lista */}
      <div className="max-w-5xl mx-auto w-full">
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
          <p className="text-center text-sm text-zinc-400 py-16">Nenhum produto encontrado para "{busca}".</p>
        ) : (
          <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
            {/* Cabeçalho da tabela */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Produto</span>
              <span className="w-28 text-center">Adicionado</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-10" />
            </div>

            {visiveis.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60 transition"
              >
                {/* Produto: miniatura + nome */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={catalogoImagemUrl(p.id)}
                    alt={p.nome}
                    loading="lazy"
                    className={`size-11 rounded-lg object-cover border border-zinc-200 shrink-0 ${p.ativo ? "" : "grayscale opacity-60"}`}
                  />
                  <span className={`text-sm font-medium truncate ${p.ativo ? "text-zinc-800" : "text-zinc-400"}`} title={p.nome}>
                    {p.nome}
                  </span>
                </div>

                {/* Data */}
                <span className="hidden sm:block w-28 text-center text-xs text-zinc-500">{fmtData(p.criadoEm)}</span>

                {/* Status toggle */}
                <div className="hidden sm:flex w-20 justify-center">
                  <Switch
                    checked={p.ativo}
                    onCheckedChange={(v) => toggleMut.mutate({ id: p.id, ativo: v })}
                    aria-label={p.ativo ? `Desligar ${p.nome}` : `Ativar ${p.nome}`}
                    className="data-[state=checked]:bg-brand"
                  />
                </div>

                {/* Ações (+ toggle no mobile) */}
                <div className="flex items-center justify-end gap-2 w-auto sm:w-10">
                  <div className="sm:hidden">
                    <Switch
                      checked={p.ativo}
                      onCheckedChange={(v) => toggleMut.mutate({ id: p.id, ativo: v })}
                      aria-label={p.ativo ? `Desligar ${p.nome}` : `Ativar ${p.nome}`}
                      className="data-[state=checked]:bg-brand"
                    />
                  </div>
                  <button
                    onClick={() => setExcluir(p)}
                    className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-red-50 hover:text-red-500 transition"
                    title="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
