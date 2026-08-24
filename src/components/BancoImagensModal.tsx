import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UploadCloud, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cadastrarCatalogoProduto } from "@/lib/api";
import { CATEGORIAS, ROTULOS, type Categoria } from "@/lib/categorias";

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

// ── Modal (somente upload — a listagem fica na tela /banco-imagens) ─────────────

export function BancoImagensModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendentes, setPendentes] = useState<ArquivoPendente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  // Categoria vale para o LOTE inteiro, não por imagem. É o que torna a
  // classificação viável: sobe-se a pasta "Higiene" de uma vez e classifica com
  // um clique, em vez de escolher a categoria 40 vezes seguidas.
  const [categoria, setCategoria] = useState<Categoria | "">("");

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
          // Sem escolha, o campo nem vai no corpo: reenviar a foto de um produto
          // já classificado não pode apagar a categoria dele.
          ...(categoria ? { categoria } : {}),
        });
        ok++;
      } catch {
        toast.error(`Falha ao salvar "${p.nome}".`);
      }
    }
    setEnviando(false);
    setPendentes([]);
    setCategoria("");
    qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
    qc.invalidateQueries({ queryKey: ["catalogo-status"] });
    if (ok > 0) {
      toast.success(`${ok} imagem(ns) salva(s) no banco!`);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Adicionar Imagens</h2>
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
              {/* Categoria do lote — antes da lista, porque vale para todas */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 mb-4">
                <label htmlFor="categoria-lote" className="block text-xs font-semibold text-zinc-700">
                  Categoria destas {pendentes.length} imagem(ns)
                </label>
                <p className="text-[11px] text-zinc-500 mt-0.5 mb-2">
                  Vale para o lote inteiro. Suba uma pasta por categoria e classifique
                  tudo de uma vez — dá para trocar depois no Banco de Imagens.
                </p>
                <select
                  id="categoria-lote"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as Categoria | "")}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                >
                  <option value="">Sem categoria (classificar depois)</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>{ROTULOS[c]}</option>
                  ))}
                </select>
              </div>

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
        </div>
      </div>
    </div>
  );
}
