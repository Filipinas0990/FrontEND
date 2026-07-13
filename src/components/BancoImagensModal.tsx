import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UploadCloud, Trash2, Loader2, ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";
import {
  listarCatalogoProdutos,
  cadastrarCatalogoProduto,
  deletarCatalogoProduto,
  catalogoImagemUrl,
} from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function nomeSemExtensao(nomeArquivo: string): string {
  return nomeArquivo.replace(/\.[^.]+$/, "").trim();
}

interface ArquivoPendente {
  id: string;
  file: File;
  nome: string;
  preview: string;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function BancoImagensModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendentes, setPendentes] = useState<ArquivoPendente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  // Lista de produtos já no banco
  const { data, isLoading } = useQuery({
    queryKey: ["catalogo-produtos"],
    queryFn: listarCatalogoProdutos,
  });
  const produtos = data?.produtos ?? [];

  // Excluir produto
  const excluir = useMutation({
    mutationFn: (id: number) => deletarCatalogoProduto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
      qc.invalidateQueries({ queryKey: ["catalogo-status"] });
      toast.success("Imagem removida do banco.");
    },
    onError: () => toast.error("Erro ao remover imagem."),
  });

  // ── Seleção de arquivos ─────────────────────────────────────────────────────

  async function adicionarArquivos(files: FileList | File[]) {
    const imagens = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imagens.length === 0) {
      toast.error("Selecione arquivos de imagem (PNG, JPG...).");
      return;
    }
    const novos = await Promise.all(
      imagens.map(async (file) => ({
        id: crypto.randomUUID(),
        file,
        nome: nomeSemExtensao(file.name),
        preview: await fileToDataUrl(file),
      })),
    );
    setPendentes((prev) => [...prev, ...novos]);
  }

  function onSelectFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) adicionarArquivos(e.target.files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files) adicionarArquivos(e.dataTransfer.files);
  }

  function removerPendente(id: string) {
    setPendentes((prev) => prev.filter((p) => p.id !== id));
  }

  function editarNome(id: string, nome: string) {
    setPendentes((prev) => prev.map((p) => (p.id === id ? { ...p, nome } : p)));
  }

  // ── Salvar no banco ──────────────────────────────────────────────────────────

  async function salvarTodos() {
    const semNome = pendentes.filter((p) => !p.nome.trim());
    if (semNome.length > 0) {
      toast.error("Todos os produtos precisam de um nome.");
      return;
    }
    setEnviando(true);
    let ok = 0;
    for (const p of pendentes) {
      try {
        await cadastrarCatalogoProduto({
          nome: p.nome.trim(),
          imagem_b64: p.preview, // data URI; o backend remove o prefixo
          mime: p.file.type || "image/png",
        });
        ok++;
      } catch {
        toast.error(`Falha ao salvar "${p.nome}".`);
      }
    }
    setEnviando(false);
    setPendentes([]);
    qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
    qc.invalidateQueries({ queryKey: ["catalogo-status"] });
    if (ok > 0) toast.success(`${ok} imagem(ns) salva(s) no banco!`);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Banco de Imagens</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Suba as fotos dos produtos para usar nos criativos.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Área de upload */}
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition ${
              arrastando ? "border-brand bg-brand/5" : "border-zinc-300 hover:border-brand hover:bg-brand/5"
            }`}
          >
            <UploadCloud className="size-8 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-600">Arraste as imagens aqui ou clique para selecionar</p>
            <p className="text-xs text-zinc-400">PNG, JPG ou WEBP • pode selecionar várias de uma vez</p>
            <p className="text-[11px] text-zinc-400 mt-1">
              O nome do arquivo vira o nome do produto (dá pra editar antes de salvar).
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onSelectFiles}
            />
          </div>

          {/* Pendentes para salvar */}
          {pendentes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                A enviar ({pendentes.length})
              </p>
              <div className="space-y-2">
                {pendentes.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-lg p-2">
                    <img src={p.preview} alt={p.nome} className="size-12 rounded-md object-cover border border-zinc-200 shrink-0" />
                    <input
                      value={p.nome}
                      onChange={(e) => editarNome(p.id, e.target.value)}
                      placeholder="Nome do produto"
                      className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    />
                    <button
                      onClick={() => removerPendente(p.id)}
                      className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-red-50 hover:text-red-500 transition shrink-0"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={salvarTodos}
                disabled={enviando}
                className="mt-3 w-full bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {enviando
                  ? <><Loader2 className="size-4 animate-spin" /> Salvando...</>
                  : <><Check className="size-4" /> Salvar {pendentes.length} no banco</>}
              </button>
            </div>
          )}

          {/* Imagens já no banco */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              No banco {produtos.length > 0 && `(${produtos.length})`}
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-zinc-400">
                <Loader2 className="size-5 animate-spin" /> Carregando...
              </div>
            ) : produtos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
                <ImageIcon className="size-8 text-zinc-300" />
                <p className="text-sm">Nenhuma imagem no banco ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {produtos.map((prod) => (
                  <div key={prod.id} className="group relative border border-zinc-200 rounded-xl overflow-hidden bg-white">
                    <div className="aspect-square bg-zinc-100 grid place-items-center">
                      <img
                        src={catalogoImagemUrl(prod.id)}
                        alt={prod.nome}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-zinc-700 truncate" title={prod.nome}>{prod.nome}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Remover "${prod.nome}" do banco?`)) excluir.mutate(prod.id);
                      }}
                      className="absolute top-1.5 right-1.5 size-7 rounded-lg bg-white/90 border border-zinc-200 grid place-items-center text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition"
                      title="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
