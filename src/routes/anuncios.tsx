import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Plus, FileSpreadsheet, Pencil, UploadCloud, Info, CheckCircle2,
  LayoutTemplate, Tags, ImageIcon, PlusCircle, Send, Loader2, Download, ZoomIn, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CriativosModal, type CriativosConfig } from "@/components/CriativosModal";
import { CriativoCard } from "@/components/CriativoCard";
import { exportarCriativoPng, baixarPng } from "@/lib/exportarCriativo";
import { identificarCatalogo, type ProdutoIdentificado } from "@/lib/api";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/anuncios")({
  component: CriativosCampanhasPage,
  head: () => ({ meta: [{ title: "Criativos e Campanhas — GrupoSymbol" }] }),
});

// Item na tabela da etapa 2 (usa o tipo da API + um id local para render)
type ItemProduto = ProdutoIdentificado & { id: string };

const EXEMPLO_TEXTO = `Paracetamol 750mg 20 comprimidos - R$ 9,90
Dipirona 500mg 10 comprimidos - R$ 4,90
Ibuprofeno 600mg 20 comprimidos - R$ 12,90
Loratadina 10mg 12 comprimidos - R$ 14,90`;

// ── Wrapper de etapa (número + título à esquerda, conteúdo à direita) ──────────

function EtapaRow({
  numero, titulo, descricao, left, right,
}: {
  numero: number; titulo: string; descricao: string;
  left: React.ReactNode; right: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 md:p-8 mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-6 lg:gap-10">
        {/* Coluna esquerda: número + título + controles */}
        <div>
          <div className="flex items-start gap-4">
            <div className="shrink-0 size-9 rounded-full bg-brand/10 text-brand grid place-items-center font-bold">
              {numero}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">{titulo}</h2>
              <p className="text-sm text-zinc-500 mt-1">{descricao}</p>
            </div>
          </div>
          <div className="mt-5 pl-0 lg:pl-13">{left}</div>
        </div>

        {/* Coluna direita: painel */}
        <div className="rounded-xl bg-zinc-50/70 border border-zinc-200 p-5">{right}</div>
      </div>
    </section>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

// ── Persistência do fluxo (sobrevive a F5 / sair e voltar) ────────────────────

const CHAVE_ESTADO = "anuncios_estado_v2";

interface EstadoSalvo {
  textoProdutos: string;
  produtos: ItemProduto[];
  confirmado: boolean;
  criativosConfig: CriativosConfig | null;
}

function carregarEstado(): Partial<EstadoSalvo> {
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO);
    return raw ? (JSON.parse(raw) as EstadoSalvo) : {};
  } catch {
    return {};
  }
}

function CriativosCampanhasPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado inicial vindo do localStorage (não perde no F5)
  const salvo = useRef(carregarEstado()).current;
  const [textoProdutos, setTextoProdutos] = useState(salvo.textoProdutos ?? "");
  const [produtos, setProdutos] = useState<ItemProduto[]>(salvo.produtos ?? []);
  const [carregando, setCarregando] = useState(false);
  const [confirmado, setConfirmado] = useState(salvo.confirmado ?? false);

  // Etapa 3: modal de criativos + config gerada
  const [showCriativos, setShowCriativos] = useState(false);
  const [criativosConfig, setCriativosConfig] = useState<CriativosConfig | null>(salvo.criativosConfig ?? null);
  const [exportando, setExportando] = useState(false);

  // Etapa 2: lightbox para conferir a foto do produto
  const [produtoZoom, setProdutoZoom] = useState<ItemProduto | null>(null);

  // Salva o fluxo sempre que algo relevante muda
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ textoProdutos, produtos, confirmado, criativosConfig }));
    } catch {
      // localStorage cheio (imagens grandes) — ignora silenciosamente
    }
  }, [textoProdutos, produtos, confirmado, criativosConfig]);

  // Começa um fluxo novo, limpando o que estava salvo
  function novoFluxo() {
    // Só pede confirmação se houver trabalho pra perder
    const temTrabalho = produtos.length > 0 || textoProdutos.trim().length > 0;
    if (temTrabalho && !confirm("Começar um novo fluxo? Isso apaga os produtos e criativos atuais.")) return;
    setTextoProdutos("");
    setProdutos([]);
    setConfirmado(false);
    setCriativosConfig(null);
    try { localStorage.removeItem(CHAVE_ESTADO); } catch { /* noop */ }
    toast.success("Novo fluxo iniciado.");
  }

  const jaIdentificou = produtos.length > 0;
  const produtosEncontrados = produtos.filter((p) => p.status === "encontrado");
  const criativosProntos = criativosConfig !== null;

  function abrirCriativos() {
    if (!confirmado) { toast.error("Confirme os itens na etapa 2 primeiro."); return; }
    if (produtosEncontrados.length === 0) { toast.error("Nenhum produto encontrado para gerar criativos."); return; }
    setShowCriativos(true);
  }

  function concluirCriativos(config: CriativosConfig) {
    // aplica os preços editados aos produtos
    setProdutos((prev) => prev.map((p) => ({ ...p, preco: config.precos[p.id] ?? p.preco })));
    setCriativosConfig(config);
    setShowCriativos(false);
    toast.success("Criativos gerados!");
  }

  // Rasteriza cada criativo em PNG (alta resolução) e leva para o wizard de campanha
  async function subirNaCampanha() {
    if (!criativosConfig) return;
    setExportando(true);
    try {
      const criativos = await Promise.all(
        produtosEncontrados.map(async (p) => {
          const preco = criativosConfig.precos[p.id] ?? p.preco;
          const png = await exportarCriativoPng({
            layout: criativosConfig.layout,
            enquadramento: criativosConfig.enquadramento,
            nome: p.nome,
            preco,
            imagem: p.imagem,
            localizacao: criativosConfig.localizacao,
            titulo: criativosConfig.titulo,
            subtitulo: criativosConfig.subtitulo,
          });
          return {
            id: p.id, nome: p.nome, preco, imagem: p.imagem,
            localizacao: criativosConfig.localizacao,
            layout: criativosConfig.layout, enquadramento: criativosConfig.enquadramento,
            titulo: criativosConfig.titulo, subtitulo: criativosConfig.subtitulo,
            png,  // PNG achatado pronto para o Meta
          };
        }),
      );
      sessionStorage.setItem("campanha_criativos", JSON.stringify(criativos));
      navigate({ to: "/campanhas/nova" });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao preparar os criativos.");
    } finally {
      setExportando(false);
    }
  }

  // Baixa um criativo individual como PNG
  async function baixarCriativo(p: ItemProduto) {
    if (!criativosConfig) return;
    try {
      const png = await exportarCriativoPng({
        layout: criativosConfig.layout,
        enquadramento: criativosConfig.enquadramento,
        nome: p.nome,
        preco: criativosConfig.precos[p.id] ?? p.preco,
        imagem: p.imagem,
        localizacao: criativosConfig.localizacao,
        titulo: criativosConfig.titulo,
        subtitulo: criativosConfig.subtitulo,
      });
      baixarPng(png, p.nome);
    } catch {
      toast.error("Erro ao baixar o PNG.");
    }
  }

  // ── Identificação via API (casa nomes com o catálogo do banco) ───────────────

  async function identificar(lista: { nome: string; preco?: string }[]) {
    if (lista.length === 0) { toast.error("Nenhum produto para identificar"); return; }
    setCarregando(true);
    setConfirmado(false);
    try {
      const { produtos: resultado } = await identificarCatalogo(lista);
      setProdutos(resultado.map((p) => ({ ...p, id: crypto.randomUUID() })));
      const achados = resultado.filter((p) => p.status === "encontrado").length;
      toast.success(`${achados} de ${resultado.length} produto(s) identificado(s)!`);
    } catch (err) {
      toast.error("Erro ao identificar produtos no catálogo.");
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  // ── Upload de planilha ───────────────────────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
        const lista = rows
          .map((row) => ({
            nome: String(row.Nome || row.Produto || row.nome || row.produto || "").trim(),
            preco: String(row.Preço || row.preco || row.preço || "").trim() || undefined,
          }))
          .filter((p) => p.nome.length > 0);
        if (lista.length === 0) { toast.error("Nenhum produto encontrado na planilha"); return; }
        identificar(lista);
      } catch {
        toast.error("Erro ao processar planilha");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  // ── Texto manual ─────────────────────────────────────────────────────────────

  function identificarDoTexto() {
    const lista = textoProdutos
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((linha) => {
        const [nome, preco] = linha.split(/\s+-\s+/);
        return { nome: (nome || "").trim(), preco: preco?.trim() };
      })
      .filter((p) => p.nome.length > 0);
    identificar(lista);
  }

  const totalEncontrados = produtos.filter((p) => p.status === "encontrado").length;

  return (
    <AppShell title="Criativos e Campanhas" hideHeader>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Criativos e Campanhas</h1>
          <p className="text-zinc-500 mt-1">Fluxo guiado para montar peças e publicar ações</p>
        </div>
        <button
          onClick={novoFluxo}
          className="bg-brand hover:bg-brand/90 text-white font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          <Plus className="size-4" /> Novo Fluxo
        </button>
      </div>

      {/* ── ETAPA 1 ──────────────────────────────────────────────────────────── */}
      <EtapaRow
        numero={1}
        titulo="Informações dos produtos"
        descricao="Você pode iniciar de duas formas."
        left={
          <>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-4 border border-zinc-200 rounded-xl hover:border-brand hover:bg-brand/5 transition flex flex-col items-center gap-2 text-center"
              >
                <FileSpreadsheet className="size-6 text-emerald-600" />
                <span className="text-sm font-semibold text-zinc-800">Subir Planilha</span>
              </button>
              <button
                onClick={() => document.getElementById("txt-produtos")?.focus()}
                className="p-4 border border-zinc-200 rounded-xl hover:border-brand hover:bg-brand/5 transition flex flex-col items-center gap-2 text-center"
              >
                <Pencil className="size-6 text-brand" />
                <span className="text-sm font-semibold text-zinc-800">Escrever Produtos</span>
              </button>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-zinc-400 mt-4">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              Informe os produtos e preços para gerar os criativos automaticamente.
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          </>
        }
        right={
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            {/* Exemplo: Subir Planilha */}
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Exemplo: Subir Planilha</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-zinc-300 rounded-xl p-6 flex flex-col items-center gap-1.5 hover:border-brand hover:bg-white transition"
              >
                <UploadCloud className="size-8 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-600 mt-1">Arraste a planilha aqui</span>
                <span className="text-xs text-zinc-400">ou clique para enviar</span>
                <span className="text-[11px] text-zinc-400 mt-2">Formatos aceitos: .xlsx, .xls, .csv</span>
                <span className="text-[11px] text-zinc-400">Máx. 5MB</span>
              </button>
            </div>

            {/* Divisor "ou" */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="w-px h-10 bg-zinc-200" />
              <span className="text-xs text-zinc-400 my-2">ou</span>
              <div className="w-px h-10 bg-zinc-200" />
            </div>

            {/* Exemplo: Escrever Produtos */}
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Exemplo: Escrever Produtos</p>
              <textarea
                id="txt-produtos"
                value={textoProdutos}
                onChange={(e) => setTextoProdutos(e.target.value)}
                placeholder={EXEMPLO_TEXTO}
                rows={5}
                className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-xl p-3 resize-none focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-zinc-400">Um produto por linha com o preço.</p>
                {textoProdutos.trim() && (
                  <button
                    onClick={identificarDoTexto}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Identificar →
                  </button>
                )}
              </div>
            </div>
          </div>
        }
      />

      {/* ── ETAPA 2 ──────────────────────────────────────────────────────────── */}
      <EtapaRow
        numero={2}
        titulo="Produtos identificados"
        descricao="Encontramos os produtos correspondentes automaticamente."
        left={
          jaIdentificou ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900 text-sm">
                  {totalEncontrados} produtos identificados com sucesso!
                </p>
                <p className="text-xs text-emerald-700 mt-1">Revise os itens e confirme para continuar.</p>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
              <p className="text-sm text-zinc-500">
                Suba uma planilha ou escreva os produtos na etapa 1 para identificá-los aqui.
              </p>
            </div>
          )
        }
        right={
          <div className="flex flex-col">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
                <Loader2 className="size-5 animate-spin" /> Identificando produtos...
              </div>
            ) : !jaIdentificou ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-zinc-400">
                <ImageIcon className="size-8 text-zinc-300" />
                <p className="text-sm">Os produtos identificados aparecerão aqui.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[10px] text-zinc-400 uppercase tracking-wide">
                      <th className="py-1.5 font-semibold">Produto</th>
                      <th className="py-1.5 font-semibold">Preço</th>
                      <th className="py-1.5 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => p.imagem && setProdutoZoom(p)}
                        className={`border-t border-zinc-100 ${p.imagem ? "cursor-zoom-in hover:bg-zinc-50" : ""}`}
                        title={p.imagem ? "Clique para ver a foto" : undefined}
                      >
                        <td className="py-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className="relative size-7 rounded-md bg-white border border-zinc-200 grid place-items-center overflow-hidden shrink-0 group">
                              {p.imagem
                                ? <img src={p.imagem} alt={p.nome} className="size-full object-cover" />
                                : <ImageIcon className="size-3.5 text-zinc-300" />}
                              {p.imagem && (
                                <span className="absolute inset-0 bg-black/30 grid place-items-center opacity-0 group-hover:opacity-100 transition">
                                  <ZoomIn className="size-3.5 text-white" />
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-zinc-800">{p.nome}</span>
                          </div>
                        </td>
                        <td className="py-1.5 text-zinc-700 font-medium">{p.preco}</td>
                        <td className="py-1.5 text-right">
                          {p.status === "encontrado" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-medium">
                              Encontrado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[11px] font-medium">
                              Não encontrado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={`flex justify-end mt-3 ${jaIdentificou ? "" : "hidden"}`}>
              <button
                onClick={() => { setConfirmado(true); toast.success("Itens confirmados!"); }}
                disabled={carregando}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-lg transition shadow-sm flex items-center gap-2 text-sm"
              >
                {confirmado && <CheckCircle2 className="size-4" />}
                {confirmado ? "Itens Confirmados" : "Confirmar Itens"}
              </button>
            </div>
          </div>
        }
      />

      {/* ── ETAPA 3 ──────────────────────────────────────────────────────────── */}
      <EtapaRow
        numero={3}
        titulo="Gerar criativos"
        descricao="Vamos preparar os criativos com base nos produtos e preços confirmados."
        left={
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600">
              <LayoutTemplate className="size-3.5 text-brand" /> Modelos prontos
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600">
              <Tags className="size-3.5 text-orange-500" /> Ofertas organizadas
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600">
              <ImageIcon className="size-3.5 text-blue-500" /> Imagens preparadas
            </span>
          </div>
        }
        right={
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
            <LayoutTemplate className="size-6 text-blue-500 mx-auto mb-3" />
            <p className="font-bold text-blue-900">Monte os criativos a partir de modelos prontos.</p>
            <p className="text-sm text-blue-700 mt-1 mb-5">
              Escolha o layout e o enquadramento, edite o preço — mesmo padrão para todos.
            </p>
            <button
              onClick={abrirCriativos}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-sm"
            >
              <LayoutTemplate className="size-4" /> {criativosProntos ? "Editar Criativos" : "Gerar Criativos"}
            </button>
          </div>
        }
      />

      {/* ── ETAPA 4 ──────────────────────────────────────────────────────────── */}
      <EtapaRow
        numero={4}
        titulo="Criativos prontos"
        descricao="Seus criativos foram gerados com sucesso!"
        left={
          criativosProntos ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-emerald-800">Tudo pronto para impulsionar suas vendas.</p>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
              <p className="text-sm text-zinc-500">Gere os criativos na etapa 3 para vê-los aqui.</p>
            </div>
          )
        }
        right={
          !criativosProntos ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-zinc-400">
              <LayoutTemplate className="size-8 text-zinc-300" />
              <p className="text-sm">Os criativos aparecerão aqui após gerados.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {produtosEncontrados.map((p) => (
                  <div key={p.id} className="group relative">
                    <CriativoCard
                      layout={criativosConfig!.layout}
                      enquadramento={criativosConfig!.enquadramento}
                      nome={p.nome}
                      preco={criativosConfig!.precos[p.id] ?? p.preco}
                      imagem={p.imagem}
                      localizacao={criativosConfig!.localizacao}
                      titulo={criativosConfig!.titulo}
                      subtitulo={criativosConfig!.subtitulo}
                    />
                    {/* Baixar PNG */}
                    <button
                      onClick={() => baixarCriativo(p)}
                      title="Baixar PNG"
                      className="absolute top-2 right-2 size-8 rounded-lg bg-white/90 border border-zinc-200 grid place-items-center text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-brand hover:text-white hover:border-brand transition shadow-sm"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={subirNaCampanha}
                  disabled={exportando}
                  className="flex-1 bg-brand hover:bg-brand/90 disabled:opacity-60 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-sm"
                >
                  {exportando
                    ? <><Loader2 className="size-4 animate-spin" /> Preparando criativos...</>
                    : <><PlusCircle className="size-4" /> Subir na Campanha</>}
                </button>
                <button className="flex-1 border border-brand text-brand hover:bg-brand/5 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition">
                  <Send className="size-4" /> Enviar no Grupo de Ofertas
                </button>
              </div>
            </div>
          )
        }
      />

      {/* Modal de edição de criativos (etapa 3) */}
      {showCriativos && (
        <CriativosModal
          produtos={produtosEncontrados.map((p) => ({ id: p.id, nome: p.nome, preco: p.preco, imagem: p.imagem }))}
          configInicial={criativosConfig ?? undefined}
          onConcluir={concluirCriativos}
          onClose={() => setShowCriativos(false)}
        />
      )}

      {/* Lightbox — conferir a foto do produto (etapa 2) */}
      {produtoZoom && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setProdutoZoom(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <p className="font-semibold text-zinc-900 truncate pr-2">{produtoZoom.nome}</p>
              <button
                onClick={() => setProdutoZoom(null)}
                className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition shrink-0"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="bg-zinc-50 grid place-items-center p-4">
              {produtoZoom.imagem
                ? <img src={produtoZoom.imagem} alt={produtoZoom.nome} className="max-h-[60vh] w-auto object-contain rounded-lg" />
                : <ImageIcon className="size-16 text-zinc-300" />}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100">
              <span className="text-sm text-zinc-500">Preço</span>
              <span className="font-bold text-zinc-900">{produtoZoom.preco}</span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
