import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CampoCategoria } from "@/components/CampoCategoria";
import { useSenhaBanco } from "@/components/SenhaBancoDialog";
import { Switch } from "@/components/ui/switch";
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
import {
  catalogoImagemUrl,
  deletarCatalogoProduto,
  editarCatalogoProduto,
  getCategoriasCatalogo,
  listarCatalogoProdutos,
  trocarImagemCatalogoProduto,
} from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { mesclarCategorias } from "@/lib/categorias";
import {
  EDICAO_INICIAL,
  desenharOrientada,
  dimensoesGiradas,
  edicaoAlterada,
  exportar,
  filtroCss,
  limitarRecorte,
  recorteCentral,
  type Edicao,
  type Recorte,
  type Rotacao,
} from "@/lib/editorImagem";

export const Route = createFileRoute("/banco-imagens/editar/$id")({
  component: EditorImagemPage,
  head: () => ({ meta: [{ title: "Editar Imagem — GrupoSymbol" }] }),
});

/** Lado maior da prévia na tela. A exportação usa a imagem inteira, não isto. */
const LADO_PREVIA = 1000;

type Proporcao = "livre" | "1:1" | "4:5";
const VALOR_PROPORCAO: Record<Exclude<Proporcao, "livre">, number> = { "1:1": 1, "4:5": 4 / 5 };

function msgErro(err: unknown, padrao: string): string {
  return err instanceof Error && err.message && err.message !== "Erro no servidor" ? err.message : padrao;
}

function EditorImagemPage() {
  const { id: idParam } = Route.useParams();
  const id = parseInt(idParam, 10);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = isAdmin();
  const { pedirSenha, dialogoSenha } = useSenhaBanco();

  useEffect(() => {
    if (!admin) {
      toast.error("Acesso restrito ao administrador");
      navigate({ to: "/" });
    }
  }, [admin, navigate]);

  // Mesma query da grade: vindo de lá, o produto já está em cache.
  const { data, isLoading } = useQuery({
    queryKey: ["catalogo-produtos"],
    queryFn: listarCatalogoProdutos,
    enabled: admin,
  });
  const produto = data?.produtos.find((p) => p.id === id) ?? null;

  const { data: cats } = useQuery({
    queryKey: ["catalogo-categorias"],
    queryFn: getCategoriasCatalogo,
    staleTime: 60_000,
    enabled: admin,
  });
  const sugestoes = useMemo(
    () => mesclarCategorias((cats?.categorias ?? []).map((c) => c.nome), cats?.sugestoes ?? []),
    [cats],
  );

  // ── Dados do produto ────────────────────────────────────────────────────────
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ativo, setAtivo] = useState(true);
  const carregouDados = useRef(false);
  useEffect(() => {
    if (!produto || carregouDados.current) return;
    carregouDados.current = true;
    setNome(produto.nome);
    setCategoria(produto.categoria ?? "");
    setAtivo(produto.ativo);
  }, [produto]);

  // ── Imagem ──────────────────────────────────────────────────────────────────
  // Carregada como blob (não direto no <img>): dá o formato original, que o
  // editor tenta manter ao salvar, e o canvas não fica "sujo" para exportar.
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [mimeOriginal, setMimeOriginal] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState(false);
  const versao = produto?.atualizadoEm;
  useEffect(() => {
    if (!produto) return;
    let url: string | null = null;
    let cancelado = false;
    setErroImagem(false);
    fetch(catalogoImagemUrl(produto.id, versao))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        if (cancelado) return;
        url = URL.createObjectURL(blob);
        const el = new Image();
        el.onload = () => {
          if (!cancelado) {
            setImg(el);
            setMimeOriginal(blob.type || null);
          }
        };
        el.onerror = () => !cancelado && setErroImagem(true);
        el.src = url;
      })
      .catch(() => !cancelado && setErroImagem(true));
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto?.id, versao]);

  const [edicao, setEdicao] = useState<Edicao>(EDICAO_INICIAL);
  const [proporcao, setProporcao] = useState<Proporcao>("livre");
  const [recortando, setRecortando] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const { w, h } = dimensoesGiradas(img, edicao.rotacao);
    desenharOrientada(canvasRef.current, img, edicao, Math.min(1, LADO_PREVIA / Math.max(w, h)));
  }, [img, edicao.rotacao, edicao.espelharH, edicao.espelharV]); // eslint-disable-line react-hooks/exhaustive-deps

  const dimGirada = img ? dimensoesGiradas(img, edicao.rotacao) : null;

  function girar(delta: 90 | -90) {
    // O recorte é medido na imagem já girada: girar invalida o que estava marcado.
    setEdicao((e) => ({ ...e, rotacao: (((e.rotacao + delta) % 360) + 360) % 360 as Rotacao, recorte: null }));
  }

  function espelhar(eixo: "espelharH" | "espelharV") {
    setEdicao((e) => ({ ...e, [eixo]: !e[eixo], recorte: null }));
  }

  function escolherProporcao(p: Proporcao) {
    setProporcao(p);
    setRecortando(true);
    if (p !== "livre" && dimGirada) {
      setEdicao((e) => ({ ...e, recorte: recorteCentral(VALOR_PROPORCAO[p], dimGirada.w, dimGirada.h) }));
    }
  }

  // ── Arrastar o recorte ──────────────────────────────────────────────────────
  const arraste = useRef<
    | { modo: "desenhar"; ax: number; ay: number }
    | { modo: "mover"; dx: number; dy: number; base: Recorte }
    | null
  >(null);

  function pontoNormalizado(ev: React.PointerEvent): { x: number; y: number } {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
    };
  }

  function onPointerDown(ev: React.PointerEvent) {
    if (!recortando || !dimGirada) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const p = pontoNormalizado(ev);
    const r = edicao.recorte;
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      arraste.current = { modo: "mover", dx: p.x - r.x, dy: p.y - r.y, base: r };
    } else {
      arraste.current = { modo: "desenhar", ax: p.x, ay: p.y };
    }
  }

  function onPointerMove(ev: React.PointerEvent) {
    const a = arraste.current;
    if (!a || !dimGirada) return;
    const p = pontoNormalizado(ev);

    if (a.modo === "mover") {
      const r = limitarRecorte({ ...a.base, x: p.x - a.dx, y: p.y - a.dy });
      setEdicao((e) => ({ ...e, recorte: r }));
      return;
    }

    const sx = p.x >= a.ax ? 1 : -1;
    const sy = p.y >= a.ay ? 1 : -1;
    let w = Math.abs(p.x - a.ax);
    let h = Math.abs(p.y - a.ay);
    if (w < 0.01 && h < 0.01) return; // clique sem arrastar não apaga o recorte

    if (proporcao !== "livre") {
      // Proporção é em PIXELS: converte a fração da largura para a da altura.
      const prop = VALOR_PROPORCAO[proporcao];
      const fator = dimGirada.w / (prop * dimGirada.h); // h = w * fator
      h = w * fator;
      // Não deixa passar da borda no sentido do arraste, mantendo a proporção.
      const maxW = sx > 0 ? 1 - a.ax : a.ax;
      const maxH = sy > 0 ? 1 - a.ay : a.ay;
      if (w > maxW) { w = maxW; h = w * fator; }
      if (h > maxH) { h = maxH; w = h / fator; }
    }

    const r = {
      x: sx > 0 ? a.ax : a.ax - w,
      y: sy > 0 ? a.ay : a.ay - h,
      w,
      h,
    };
    setEdicao((e) => ({ ...e, recorte: proporcao === "livre" ? limitarRecorte(r) : r }));
  }

  function onPointerUp() {
    arraste.current = null;
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const nomeLimpo = nome.trim();
  const catLimpa = categoria.trim();
  const dadosAlterados =
    !!produto &&
    (nomeLimpo !== produto.nome || catLimpa !== (produto.categoria ?? "") || ativo !== produto.ativo);
  const imagemAlterada = edicaoAlterada(edicao);
  const algoAlterado = dadosAlterados || imagemAlterada;

  async function salvar() {
    if (!produto) return;
    if (!nomeLimpo) {
      toast.error("O produto precisa de um nome.");
      return;
    }

    // Gera a imagem ANTES de pedir a senha e de gravar qualquer coisa: se não
    // couber no envio, nada é salvo pela metade.
    let saida: ReturnType<typeof exportar> | null = null;
    if (imagemAlterada) {
      if (!img) return;
      try {
        saida = exportar(img, edicao, mimeOriginal);
      } catch (err) {
        toast.error(msgErro(err, "Não foi possível gerar a imagem editada."));
        return;
      }
    }

    const senha = await pedirSenha(`Salvar alterações em "${produto.nome}"`);
    if (!senha) return;

    setSalvando(true);
    try {
      if (dadosAlterados) {
        const campos: { nome?: string; categoria?: string | null; ativo?: boolean } = {};
        if (nomeLimpo !== produto.nome) campos.nome = nomeLimpo;
        if (catLimpa !== (produto.categoria ?? "")) campos.categoria = catLimpa || null;
        if (ativo !== produto.ativo) campos.ativo = ativo;
        await editarCatalogoProduto(produto.id, campos, senha);
      }
      if (saida) await trocarImagemCatalogoProduto(produto.id, saida.dataUrl, saida.mime, senha);

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["catalogo-produtos"] }),
        qc.invalidateQueries({ queryKey: ["catalogo-categorias"] }),
      ]);
      toast.success("Alterações salvas.");
      navigate({ to: "/banco-imagens" });
    } catch (err) {
      // Os dados podem ter sido gravados e a imagem não: recarrega para a tela
      // mostrar o que de fato está no banco.
      qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
      toast.error(msgErro(err, "Não foi possível salvar as alterações."));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!produto) return;
    const senha = await pedirSenha(`Excluir "${produto.nome}"`);
    if (!senha) return;
    setSalvando(true);
    try {
      await deletarCatalogoProduto(produto.id, senha);
      qc.invalidateQueries({ queryKey: ["catalogo-produtos"] });
      qc.invalidateQueries({ queryKey: ["catalogo-status"] });
      toast.success("Imagem removida do banco.");
      navigate({ to: "/banco-imagens" });
    } catch (err) {
      toast.error(msgErro(err, "Erro ao remover imagem."));
      setSalvando(false);
    }
  }

  if (!admin) return null;

  const r = edicao.recorte;
  const tamanhoFinal =
    dimGirada && (r ? { w: Math.round(r.w * dimGirada.w), h: Math.round(r.h * dimGirada.h) } : dimGirada);

  return (
    <AppShell title="Editar Imagem">
      <div className="relative">
        <Link
          to="/banco-imagens"
          className="absolute left-0 top-0 size-9 rounded-lg ring-1 ring-zinc-200 bg-white grid place-items-center text-zinc-600 hover:bg-zinc-50 transition"
          title="Voltar ao Banco de Imagens"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center max-w-3xl mx-auto px-12">
          <h2 className="text-2xl font-bold text-zinc-900">Editar Imagem</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            Gire, espelhe, recorte e ajuste a cor da foto, e corrija o nome e a
            categoria do produto. Nada é gravado até você salvar com a senha do banco.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-16">
          <Loader2 className="size-4 animate-spin" /> Carregando...
        </div>
      ) : !produto ? (
        <div className="text-center py-16">
          <p className="text-sm text-zinc-500">Produto não encontrado — pode ter sido removido.</p>
          <Link to="/banco-imagens" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
            Voltar ao Banco de Imagens
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto w-full grid gap-4 lg:grid-cols-[1fr_20rem]">
          {/* ── Imagem ── */}
          <div className="bg-white rounded-xl border border-zinc-200 p-3 flex flex-col gap-3 min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <Ferramenta titulo="Girar para a esquerda" onClick={() => girar(-90)} disabled={!img}>
                <RotateCcw className="size-4" />
              </Ferramenta>
              <Ferramenta titulo="Girar para a direita" onClick={() => girar(90)} disabled={!img}>
                <RotateCw className="size-4" />
              </Ferramenta>
              <Ferramenta
                titulo="Espelhar na horizontal"
                onClick={() => espelhar("espelharH")}
                ativo={edicao.espelharH}
                disabled={!img}
              >
                <FlipHorizontal2 className="size-4" />
              </Ferramenta>
              <Ferramenta
                titulo="Espelhar na vertical"
                onClick={() => espelhar("espelharV")}
                ativo={edicao.espelharV}
                disabled={!img}
              >
                <FlipVertical2 className="size-4" />
              </Ferramenta>

              <span className="w-px h-6 bg-zinc-200 mx-1" />

              <Ferramenta
                titulo="Recortar"
                onClick={() => setRecortando((v) => !v)}
                ativo={recortando}
                disabled={!img}
              >
                <Crop className="size-4" />
              </Ferramenta>
              {recortando && (
                <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
                  {(["livre", "1:1", "4:5"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => escolherProporcao(p)}
                      className={`px-2.5 py-1 rounded-md transition ${
                        proporcao === p ? "bg-brand text-white" : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      {p === "livre" ? "Livre" : p}
                    </button>
                  ))}
                </div>
              )}
              {r && (
                <button
                  type="button"
                  onClick={() => setEdicao((e) => ({ ...e, recorte: null }))}
                  className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800 transition"
                >
                  tirar recorte
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEdicao(EDICAO_INICIAL);
                  setRecortando(false);
                  setProporcao("livre");
                }}
                disabled={!imagemAlterada}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition"
              >
                <Undo2 className="size-3.5" /> Desfazer edição da foto
              </button>
            </div>

            <div className="bg-zinc-900 rounded-lg grid place-items-center p-3 min-h-[320px]">
              {erroImagem ? (
                <p className="text-sm text-zinc-400">Não foi possível carregar a imagem.</p>
              ) : !img ? (
                <Loader2 className="size-6 animate-spin text-zinc-500" />
              ) : (
                <div
                  className={`relative inline-block max-w-full overflow-hidden select-none touch-none ${
                    recortando ? "cursor-crosshair" : ""
                  }`}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <canvas
                    ref={canvasRef}
                    className="block max-w-full max-h-[60vh] w-auto h-auto"
                    style={{ filter: filtroCss(edicao) }}
                  />
                  {r && (
                    <div
                      className={`absolute border-2 border-white pointer-events-none ${
                        recortando ? "" : "border-dashed"
                      }`}
                      style={{
                        left: `${r.x * 100}%`,
                        top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`,
                        height: `${r.h * 100}%`,
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                      }}
                    >
                      {/* Terços: ajuda a centralizar a embalagem */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="border border-white/25" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {recortando && (
              <p className="text-[11px] text-zinc-500 -mt-1">
                Arraste sobre a foto para marcar a área. Arraste dentro da área para movê-la.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Ajuste
                rotulo="Brilho"
                valor={edicao.brilho}
                min={50}
                max={150}
                onChange={(v) => setEdicao((e) => ({ ...e, brilho: v }))}
              />
              <Ajuste
                rotulo="Contraste"
                valor={edicao.contraste}
                min={50}
                max={150}
                onChange={(v) => setEdicao((e) => ({ ...e, contraste: v }))}
              />
              <Ajuste
                rotulo="Saturação"
                valor={edicao.saturacao}
                min={0}
                max={200}
                onChange={(v) => setEdicao((e) => ({ ...e, saturacao: v }))}
              />
            </div>

            {tamanhoFinal && (
              <p className="text-[11px] text-zinc-400">
                Tamanho final: {tamanhoFinal.w} × {tamanhoFinal.h} px
                {Math.max(tamanhoFinal.w, tamanhoFinal.h) > 2048 && " (será reduzida para 2048 px no lado maior)"}
              </p>
            )}
          </div>

          {/* ── Dados ── */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-4 h-fit">
            <div>
              <label htmlFor="nome-produto" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Nome do produto
              </label>
              <input
                id="nome-produto"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={200}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                É por este nome que a planilha encontra o produto.
              </p>
            </div>

            <div>
              <label htmlFor="categoria-produto" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Categoria
              </label>
              <CampoCategoria
                id="categoria-produto"
                valor={categoria}
                onChange={setCategoria}
                opcoes={sugestoes.map((c) => ({ valor: c, rotulo: c }))}
                permitirNova
                rotuloVazio="Sem categoria"
                placeholder="Clique para ver as categorias ou digite uma nova"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-zinc-700">Usar nos criativos</p>
                <p className="text-[11px] text-zinc-400">
                  {ativo ? "Ativo" : "Desligado — não entra nos criativos"}
                </p>
              </div>
              <Switch
                checked={ativo}
                onCheckedChange={setAtivo}
                aria-label={ativo ? "Desligar produto" : "Ativar produto"}
                className="data-[state=checked]:bg-brand"
              />
            </div>

            <div className="pt-3 border-t border-zinc-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={salvar}
                disabled={!algoAlterado || salvando || (imagemAlterada && !img)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-40 transition"
              >
                {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar alterações
              </button>
              <Link
                to="/banco-imagens"
                className="w-full text-center py-2.5 text-sm font-medium text-zinc-600 rounded-lg ring-1 ring-zinc-200 hover:bg-zinc-50 transition"
              >
                Cancelar
              </Link>
              <button
                type="button"
                onClick={() => setConfirmarExclusao(true)}
                disabled={salvando}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-40 transition"
              >
                <Trash2 className="size-3.5" /> Excluir do banco
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{produto?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem será apagada do banco. Se quiser só pausar o uso nos criativos, desligue o produto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarExclusao(false);
                excluir();
              }}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dialogoSenha}
    </AppShell>
  );
}

function Ferramenta({
  titulo,
  onClick,
  ativo = false,
  disabled = false,
  children,
}: {
  titulo: string;
  onClick: () => void;
  ativo?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      className={`size-9 rounded-lg grid place-items-center transition disabled:opacity-40 ${
        ativo ? "bg-brand text-white" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function Ajuste({
  rotulo,
  valor,
  min,
  max,
  onChange,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <span className="flex items-center justify-between text-xs text-zinc-600">
        <span className="font-medium">{rotulo}</span>
        <button
          type="button"
          onClick={() => onChange(100)}
          className={`tabular-nums ${valor === 100 ? "text-zinc-400" : "text-brand hover:underline"}`}
          title="Voltar para 100%"
        >
          {valor}%
        </button>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={rotulo}
        className="w-full mt-1 accent-brand"
      />
    </div>
  );
}
