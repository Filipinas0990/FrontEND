import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { baixarCatalogoImagem, catalogoImagemUrl, type CatalogoProdutoItem } from "@/lib/api";
import { rotuloCategoria } from "@/lib/categorias";

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** 1080x1350 → "4:5". O gestor precisa disso: o Meta corta o que não encaixa. */
function proporcao(w: number, h: number): string {
  const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
  const d = mdc(w, h) || 1;
  return `${w / d}:${h / d}`;
}

interface Props {
  produto: CatalogoProdutoItem;
  /** Setas do rodapé — percorre a mesma lista filtrada que está na grade. */
  onAnterior?: () => void;
  onProximo?: () => void;
  onToggleAtivo: (ativo: boolean) => void;
  onExcluir: () => void;
  onClose: () => void;
}

export function ImagemPreviewModal({
  produto,
  onAnterior,
  onProximo,
  onToggleAtivo,
  onExcluir,
  onClose,
}: Props) {
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [baixando, setBaixando] = useState(false);

  // Dimensão é por imagem: trocando de produto com as setas, zera antes de ler
  // a nova — senão o painel mostra o tamanho da foto anterior por um instante.
  useEffect(() => setDim(null), [produto.id]);

  // Esc fecha, setas navegam: com dezenas de fotos, revisar no teclado é o que
  // torna a conferência rápida.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onAnterior?.();
      else if (e.key === "ArrowRight") onProximo?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onAnterior, onProximo]);

  async function baixar() {
    setBaixando(true);
    try {
      await baixarCatalogoImagem(produto.id, produto.nome);
    } catch {
      toast.error("Não foi possível baixar a imagem.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Imagem de ${produto.nome}`}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Foto ampliada — fundo escuro para a embalagem não sumir no branco */}
        <div className="relative flex-1 bg-zinc-900 grid place-items-center min-h-[240px] md:min-h-[420px]">
          <img
            src={catalogoImagemUrl(produto.id)}
            alt={produto.nome}
            onLoad={(e) =>
              setDim({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
            className="max-h-[45vh] md:max-h-[92vh] max-w-full object-contain"
          />

          {onAnterior && (
            <button
              onClick={onAnterior}
              className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full grid place-items-center bg-black/50 text-white hover:bg-black/70 transition"
              title="Anterior (←)"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          {onProximo && (
            <button
              onClick={onProximo}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full grid place-items-center bg-black/50 text-white hover:bg-black/70 transition"
              title="Próxima (→)"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>

        {/* Detalhes */}
        <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-zinc-100 overflow-y-auto">
          <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-zinc-100">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-zinc-900 break-words">{produto.nome}</h2>
              <p
                className={`text-xs mt-0.5 ${
                  produto.categoria ? "text-zinc-500" : "text-amber-600 font-medium"
                }`}
              >
                {rotuloCategoria(produto.categoria)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>
          </div>

          <dl className="px-5 py-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Status</dt>
              <dd className="flex items-center gap-2">
                <span className={produto.ativo ? "text-emerald-600 font-medium" : "text-zinc-400"}>
                  {produto.ativo ? "Ativo nos criativos" : "Desligado"}
                </span>
                <Switch
                  checked={produto.ativo}
                  onCheckedChange={onToggleAtivo}
                  aria-label={produto.ativo ? "Desligar imagem" : "Ativar imagem"}
                  className="data-[state=checked]:bg-brand scale-90"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Adicionada em</dt>
              <dd className="text-zinc-800 font-medium">{fmtDataHora(produto.criadoEm)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Dimensões</dt>
              <dd className="text-zinc-800 font-medium">
                {dim ? `${dim.w} × ${dim.h} px` : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Proporção</dt>
              <dd className="text-zinc-800 font-medium">
                {dim ? proporcao(dim.w, dim.h) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">ID</dt>
              <dd className="text-zinc-400 font-mono">#{produto.id}</dd>
            </div>
          </dl>

          <div className="mt-auto px-5 py-4 border-t border-zinc-100 flex items-center gap-2">
            <button
              onClick={baixar}
              disabled={baixando}
              className="flex-1 h-9 rounded-lg bg-zinc-900 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-60 transition"
            >
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Baixar imagem
            </button>
            <button
              onClick={onExcluir}
              className="size-9 rounded-lg grid place-items-center text-zinc-400 hover:bg-red-50 hover:text-red-500 transition"
              title="Remover"
              aria-label={`Remover ${produto.nome}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
