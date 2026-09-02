import { useState } from "react";
import { X, MapPin, Check, LayoutTemplate, Crop, ArrowRight, ArrowLeft } from "lucide-react";
import { CriativoCard, ModeloThumb, type LayoutCriativo, type Enquadramento } from "@/components/CriativoCard";

export interface ProdutoCriativo {
  id: string;
  nome: string;
  preco: string;
  imagem?: string | null;
}

export interface CriativosConfig {
  layout: LayoutCriativo;
  enquadramento: Enquadramento;
  localizacao: string;
  precos: Record<string, string>;  // id do produto -> preço editado
  titulo?: string;                 // layout banner: faixa do topo
  subtitulo?: string;              // layout banner: datas
}

interface CriativosModalProps {
  produtos: ProdutoCriativo[];
  configInicial?: Partial<CriativosConfig>;
  onConcluir: (config: CriativosConfig) => void;
  onClose: () => void;
}

const LAYOUTS: { id: LayoutCriativo; nome: string; desc: string }[] = [
  { id: "azul",   nome: "Azul",          desc: "Preço no topo, barra da farmácia embaixo." },
  { id: "banner", nome: "Banner Oferta", desc: "Faixa no topo, datas e preço em destaque." },
  { id: "destaque", nome: "Destaque",     desc: "Preço grande no meio, farmácia e validade no rodapé." },
];

const ENQUADRAMENTOS: { id: Enquadramento; nome: string; desc: string }[] = [
  { id: "4:5",  nome: "Feed Retrato",  desc: "1080×1350 — ocupa mais o feed." },
  { id: "1:1",  nome: "Quadrado",      desc: "1080×1080 — padrão do feed." },
  { id: "9:16", nome: "Story / Reels", desc: "1080×1920 — tela cheia." },
];

type Etapa = "layout" | "enquadramento" | "editar";

export function CriativosModal({ produtos, configInicial, onConcluir, onClose }: CriativosModalProps) {
  const [etapa, setEtapa] = useState<Etapa>(configInicial?.layout ? "editar" : "layout");
  const [layout, setLayout] = useState<LayoutCriativo>(configInicial?.layout ?? "azul");
  const [enquadramento, setEnquadramento] = useState<Enquadramento>(configInicial?.enquadramento ?? "4:5");
  const [localizacao, setLocalizacao] = useState(configInicial?.localizacao ?? "");
  const [titulo, setTitulo] = useState(configInicial?.titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(configInicial?.subtitulo ?? "");
  const [precos, setPrecos] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    produtos.forEach((p) => {
      const inicial = configInicial?.precos?.[p.id] ?? p.preco;
      base[p.id] = inicial === "—" ? "" : inicial;
    });
    return base;
  });

  const setPreco = (id: string, v: string) => setPrecos((prev) => ({ ...prev, [id]: v }));
  function concluir() {
    onConcluir({ layout, enquadramento, localizacao: localizacao.trim(), precos, titulo: titulo.trim(), subtitulo: subtitulo.trim() });
  }

  const nomeLayout = LAYOUTS.find((l) => l.id === layout)?.nome ?? "";
  const nomeEnq = ENQUADRAMENTOS.find((e) => e.id === enquadramento)?.nome ?? "";

  const cabecalho: Record<Etapa, { titulo: string; sub: string }> = {
    layout:        { titulo: "Escolha o layout do criativo", sub: "Passo 1 de 3 — o design aplicado a todos." },
    enquadramento: { titulo: "Escolha o enquadramento",      sub: "Passo 2 de 3 — o formato/proporção do criativo." },
    editar:        { titulo: "Editar criativos",             sub: "Passo 3 de 3 — ajuste preço e textos." },
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{cabecalho[etapa].titulo}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{cabecalho[etapa].sub}</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
            <X className="size-5" />
          </button>
        </div>

        {/* ── PASSO 1: layout ──────────────────────────────────────────────── */}
        {etapa === "layout" && (
          <>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-2xl mx-auto grid grid-cols-2 gap-6">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`rounded-2xl p-4 border-2 transition text-center ${layout === l.id ? "border-brand ring-2 ring-brand/20 bg-brand/5" : "border-zinc-200 hover:border-zinc-300"}`}
                  >
                    <div className="max-w-[220px] mx-auto"><ModeloThumb layout={l.id} enquadramento="4:5" /></div>
                    <div className="flex items-center justify-center gap-1.5 mt-4">
                      {layout === l.id && <Check className="size-4 text-brand" />}
                      <span className={`font-semibold ${layout === l.id ? "text-brand" : "text-zinc-700"}`}>{l.nome}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{l.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <RodapeModal onClose={onClose} direita={
              <button onClick={() => setEtapa("enquadramento")} className="bg-brand hover:bg-brand/90 text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm">
                Continuar <ArrowRight className="size-4" />
              </button>
            } />
          </>
        )}

        {/* ── PASSO 2: enquadramento ───────────────────────────────────────── */}
        {etapa === "enquadramento" && (
          <>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto grid grid-cols-3 gap-5 items-end">
                {ENQUADRAMENTOS.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEnquadramento(e.id)}
                    className={`rounded-2xl p-3 border-2 transition text-center ${enquadramento === e.id ? "border-brand ring-2 ring-brand/20 bg-brand/5" : "border-zinc-200 hover:border-zinc-300"}`}
                  >
                    {/* mostra o layout escolhido em cada formato */}
                    <div className="mx-auto" style={{ maxWidth: e.id === "9:16" ? 110 : 170 }}>
                      <ModeloThumb layout={layout} enquadramento={e.id} />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      {enquadramento === e.id && <Check className="size-4 text-brand" />}
                      <span className={`text-sm font-semibold ${enquadramento === e.id ? "text-brand" : "text-zinc-700"}`}>{e.nome}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{e.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <RodapeModal
              esquerda={<button onClick={() => setEtapa("layout")} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition flex items-center gap-1.5"><ArrowLeft className="size-4" /> Voltar</button>}
              direita={<button onClick={() => setEtapa("editar")} className="bg-brand hover:bg-brand/90 text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm">Continuar <ArrowRight className="size-4" /></button>}
            />
          </>
        )}

        {/* ── PASSO 3: editar ──────────────────────────────────────────────── */}
        {etapa === "editar" && (
          <>
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_1fr]">
              {/* Config */}
              <div className="border-r border-zinc-100 p-5 space-y-6 overflow-y-auto">
                {/* Layout + enquadramento escolhidos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5 text-sm text-zinc-800"><LayoutTemplate className="size-3.5 text-zinc-400" /> {nomeLayout}</span>
                    <button onClick={() => setEtapa("layout")} className="text-xs font-semibold text-brand hover:underline">Trocar</button>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5 text-sm text-zinc-800"><Crop className="size-3.5 text-zinc-400" /> {nomeEnq}</span>
                    <button onClick={() => setEtapa("enquadramento")} className="text-xs font-semibold text-brand hover:underline">Trocar</button>
                  </div>
                </div>

                {/* Cada layout pede o seu: o banner tem faixa e datas; o destaque
                    tem a farmácia no rodapé e a validade da oferta; o azul, só a
                    farmácia. Mostrar campo que o layout não desenha é convidar o
                    gestor a preencher algo que não vai aparecer. */}
                {layout === "banner" && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">Título (faixa do topo)</label>
                      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: FECHA MÊS"
                        className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">Datas / subtítulo</label>
                      <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} placeholder="Ex: DIAS 29 A 31 DE JUNHO"
                        className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                    </div>
                  </>
                )}

                {layout !== "banner" && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                      <MapPin className="size-3.5" /> Farmácia / Localização
                    </label>
                    <input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex: Farmácia dos Aposentados"
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                  </div>
                )}

                {layout === "destaque" && (
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">Oferta válida até</label>
                    <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} placeholder="Ex: 23/08"
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                    <p className="text-[11px] text-zinc-400 mt-1.5">Em branco, a faixa do rodapé não aparece.</p>
                  </div>
                )}
              </div>

              {/* Previews + preço */}
              <div className="p-5 overflow-y-auto bg-zinc-50/60">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Criativos ({produtos.length})</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {produtos.map((p) => (
                    <div key={p.id} className="space-y-2">
                      <CriativoCard layout={layout} enquadramento={enquadramento} nome={p.nome} preco={precos[p.id] ?? p.preco} imagem={p.imagem} localizacao={localizacao} titulo={titulo} subtitulo={subtitulo} />
                      <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-md px-2 py-1">
                        <span className="text-[11px] font-semibold text-zinc-400">R$</span>
                        <input value={precos[p.id] ?? p.preco} onChange={(e) => setPreco(p.id, e.target.value)} placeholder="0,00"
                          className="w-full text-sm text-zinc-800 focus:outline-none bg-transparent" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <RodapeModal
              esquerda={<button onClick={() => setEtapa("enquadramento")} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition flex items-center gap-1.5"><ArrowLeft className="size-4" /> Voltar</button>}
              direita={<button onClick={concluir} className="bg-brand hover:bg-brand/90 text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"><Check className="size-4" /> Concluir criativos</button>}
            />
          </>
        )}
      </div>
    </div>
  );
}

function RodapeModal({ esquerda, direita, onClose }: { esquerda?: React.ReactNode; direita: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
      {esquerda ?? (onClose ? <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition">Cancelar</button> : <span />)}
      {direita}
    </div>
  );
}
