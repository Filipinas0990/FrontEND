import { useRef, useState } from "react";
import { X, UploadCloud, Loader2, Trash2, ArrowRight, ImageIcon } from "lucide-react";
import { normalizarParaAnuncio, TETO_POR_ARTE_ANUNCIO } from "@/lib/exportarCriativo";
import { formatarMoeda } from "@/lib/moeda";
import { toast } from "sonner";

/**
 * Atalho para quem já tem a arte pronta.
 *
 * O fluxo de Anúncios sempre exigiu passar pelas quatro etapas — escolher
 * produto, identificar no catálogo, montar o criativo a partir de um modelo —
 * mesmo quando o gestor já tinha as peças prontas do designer. Aqui ele sobe as
 * imagens e cai direto na escolha da conta de anúncio.
 *
 * Nome e preço não são decoração: a copy do anúncio troca {produto} e {preco}
 * por eles no wizard. O nome vem do arquivo e pode ser corrigido; o preço é
 * opcional (a arte pronta normalmente já mostra o valor).
 */

export interface CriativoProntoItem {
  id: string;
  nome: string;
  preco: string;
  /** Arte em data URI, já dentro do orçamento de envio. */
  arquivoUrl: string;
}

/** Nome do arquivo virando nome de produto: "oferta_dipirona-500mg.jpg" → "oferta dipirona 500mg". */
function nomeDoArquivo(arquivo: string): string {
  return arquivo.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Criativo";
}

function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("falha ao ler o arquivo"));
    fr.readAsDataURL(file);
  });
}

/**
 * Prepara a arte para o Meta: reenquadra em 1080×1350 e deixa dentro do teto.
 *
 * Antes a arte subia com a dimensão que o designer mandou — quadrada, paisagem,
 * 2000px — e quem reenquadrava era o Meta, cortando preço e marca no feed.
 * `normalizarParaAnuncio` encaixa a arte inteira no retrato 4:5 (sem corte) e
 * já entrega JPEG, que é o que a API de imagens aceita sem discussão. Arte que
 * já chega em 1080×1350 e dentro do teto passa intacta.
 */
async function prepararArte(file: File): Promise<CriativoProntoItem> {
  const original = await lerComoDataUrl(file);
  const { dataUrl } = await normalizarParaAnuncio(original, TETO_POR_ARTE_ANUNCIO);
  return { id: crypto.randomUUID(), nome: nomeDoArquivo(file.name), preco: "", arquivoUrl: dataUrl };
}

export function CriativosProntosModal({
  onConcluir,
  onClose,
}: {
  /** Recebe as artes prontas para seguir para o wizard de campanha. */
  onConcluir: (itens: CriativoProntoItem[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<CriativoProntoItem[]>([]);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function adicionar(lista: FileList | File[] | null) {
    const arquivos = Array.from(lista ?? []).filter((f) => f.type.startsWith("image/"));
    if (arquivos.length === 0) {
      toast.error("Envie imagens (JPG, PNG ou WEBP).");
      return;
    }
    setLendo(true);
    try {
      const novos = await Promise.all(arquivos.map(prepararArte));
      setItens((prev) => [...prev, ...novos]);
    } catch (err) {
      console.error(err);
      toast.error("Não consegui ler alguma das imagens.");
    } finally {
      setLendo(false);
    }
  }

  function alterar(id: string, campo: "nome" | "preco", valor: string) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }

  function remover(id: string) {
    setItens((prev) => prev.filter((i) => i.id !== id));
  }

  async function seguir() {
    if (itens.length === 0 || enviando) return;
    setEnviando(true);
    try {
      // Nome vazio viraria uma copy começando com ": R$ ..." — cai no padrão.
      await onConcluir(itens.map((i) => ({ ...i, nome: i.nome.trim() || "Criativo", preco: i.preco.trim() })));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Subir criativos prontos</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Envie as artes finalizadas e siga direto para a escolha da conta de anúncio.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Dropzone */}
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); void adicionar(e.dataTransfer.files); }}
            className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-1.5 transition ${
              arrastando ? "border-brand bg-brand/5" : "border-zinc-300 hover:border-brand hover:bg-brand/5"
            }`}
          >
            {lendo ? (
              <>
                <Loader2 className="size-8 text-brand animate-spin" />
                <span className="text-sm font-medium text-zinc-600 mt-1">Preparando as artes...</span>
              </>
            ) : (
              <>
                <UploadCloud className="size-8 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-600 mt-1">Arraste as artes aqui</span>
                <span className="text-xs text-zinc-400">ou clique para escolher os arquivos</span>
                <span className="text-[11px] text-zinc-400 mt-2">JPG, PNG ou WEBP · pode subir várias de uma vez</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }}
          />

          {/* Artes enviadas */}
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-zinc-400">
              <ImageIcon className="size-8 text-zinc-300" />
              <p className="text-sm">As artes enviadas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                {itens.length} arte(s) — confira o nome e o preço de cada uma
              </p>
              {itens.map((i) => (
                <div key={i.id} className="flex items-center gap-3 border border-zinc-200 rounded-xl p-3">
                  {/* 4:5: a miniatura mostra a arte já reenquadrada, igual ao que sobe. */}
                  <div className="h-20 aspect-[4/5] rounded-lg bg-zinc-100 overflow-hidden shrink-0">
                    <img src={i.arquivoUrl} alt={i.nome} className="size-full object-cover" />
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                    <label className="block">
                      <span className="block text-[11px] text-zinc-400 mb-1">Produto</span>
                      <input
                        value={i.nome}
                        onChange={(e) => alterar(i.id, "nome", e.target.value)}
                        placeholder="Nome do produto"
                        className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] text-zinc-400 mb-1">Preço (opcional)</span>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand">
                        <span className="text-[11px] font-semibold text-zinc-400">R$</span>
                        <input
                          value={i.preco}
                          onChange={(e) => alterar(i.id, "preco", formatarMoeda(e.target.value))}
                          inputMode="numeric"
                          placeholder="0,00"
                          className="w-full bg-transparent text-sm focus:outline-none"
                        />
                      </div>
                    </label>
                  </div>
                  <button
                    onClick={() => remover(i.id)}
                    title="Remover esta arte"
                    aria-label={`Remover ${i.nome}`}
                    className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-red-50 hover:text-red-600 transition shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            A copy do anúncio usa o produto e o preço informados — dá para ajustar tudo no wizard.
          </p>
          <button
            onClick={seguir}
            disabled={itens.length === 0 || lendo || enviando}
            className="bg-brand hover:bg-brand/90 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm text-sm shrink-0"
          >
            {enviando
              ? <><Loader2 className="size-4 animate-spin" /> Abrindo campanha...</>
              : <>Ir para a campanha{itens.length > 0 ? ` (${itens.length})` : ""} <ArrowRight className="size-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
