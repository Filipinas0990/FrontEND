import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Search, Check, Rocket, Loader2, ChevronLeft, ChevronRight,
  Megaphone, MousePointerClick, MessageCircle, Users, ShoppingCart,
  User, Instagram, Facebook, Layers, Globe, Newspaper, Square, Film, Calendar, LayoutGrid,
  UploadCloud, Sparkles, CheckCircle2, ImageIcon, Wallet, Download,
} from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CriativoCard, type LayoutCriativo, type Enquadramento } from "@/components/CriativoCard";
import { exportarCriativoPng, baixarPng } from "@/lib/exportarCriativo";
import { getContasAnuncio, publicarCampanha, type ContaAnuncio, type PublicarCampanhaResultado } from "@/lib/api";

export const Route = createFileRoute("/campanhas/nova")({
  component: NovaCampanhaPage,
  head: () => ({ meta: [{ title: "Nova Campanha — GrupoSymbol" }] }),
});

// ── Etapas do wizard ──────────────────────────────────────────────────────────

const ETAPAS = [
  { n: 1, titulo: "Cliente",      sub: "Selecione o cliente" },
  { n: 2, titulo: "Configuração", sub: "Defina o objetivo" },
  { n: 3, titulo: "Público",      sub: "Defina o público" },
  { n: 4, titulo: "Criativos",    sub: "Selecione os criativos" },
  { n: 5, titulo: "Revisão",      sub: "Revise e publique" },
] as const;

// Subtítulo do cabeçalho por etapa
const SUBTITULOS: Record<number, string> = {
  1: "Selecione o cliente que receberá esta campanha",
  2: "Defina o objetivo da campanha",
  3: "Defina o público e os posicionamentos da campanha",
  4: "Selecione os criativos e gere as copys da campanha",
  5: "Revise tudo e publique",
};

const TOTAL = ETAPAS.length;

const POR_PAGINA = 5;

// ── Objetivos de campanha (padrão Meta ODAX) ──────────────────────────────────

interface Objetivo {
  codigo: string;        // código oficial do Meta (vai no JSON para a IA)
  nome: string;
  descricao: string;
  icon: typeof Megaphone;
}

const OBJETIVOS: Objetivo[] = [
  { codigo: "OUTCOME_AWARENESS",  nome: "Reconhecimento", descricao: "Mostrar a marca para o máximo de pessoas na região.", icon: Megaphone },
  { codigo: "OUTCOME_TRAFFIC",    nome: "Tráfego",        descricao: "Levar pessoas ao WhatsApp, site ou perfil da farmácia.", icon: MousePointerClick },
  { codigo: "OUTCOME_ENGAGEMENT", nome: "Engajamento",    descricao: "Gerar mensagens, curtidas e interações nas ofertas.", icon: MessageCircle },
  { codigo: "OUTCOME_LEADS",      nome: "Cadastros",      descricao: "Coletar contatos de clientes interessados.", icon: Users },
  { codigo: "OUTCOME_SALES",      nome: "Vendas",         descricao: "Incentivar compras e conversões dos produtos.", icon: ShoppingCart },
];

// ── Timeline (stepper) ─────────────────────────────────────────────────────────

function Stepper({ atual }: { atual: number }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-6 py-6 mb-6">
      <div className="flex items-start">
        {ETAPAS.map((e, i) => {
          const completa = e.n < atual;
          const ativa = e.n === atual;
          return (
            <div key={e.n} className="flex-1 flex flex-col items-center relative">
              {/* Linha conectora */}
              {i > 0 && (
                <div
                  className={`absolute top-5 right-1/2 w-full h-0.5 ${e.n <= atual ? "bg-brand" : "bg-zinc-200"}`}
                  style={{ zIndex: 0 }}
                />
              )}
              {/* Bolinha */}
              <div
                className={`relative z-10 size-10 rounded-full grid place-items-center font-bold text-sm transition ${
                  ativa
                    ? "bg-brand text-white shadow-md"
                    : completa
                      ? "bg-brand/90 text-white"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {completa ? <Check className="size-5" /> : e.n}
              </div>
              {/* Rótulos */}
              <p className={`mt-2 text-sm font-semibold ${ativa || completa ? "text-zinc-900" : "text-zinc-400"}`}>
                {e.titulo}
              </p>
              <p className={`text-xs ${ativa ? "text-zinc-500" : "text-zinc-400"}`}>{e.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Etapa 1: seleção de cliente ────────────────────────────────────────────────

function EtapaCliente({
  selecionado, onSelect, nome, onNomeChange,
}: {
  selecionado: string | null;
  onSelect: (c: ContaAnuncio) => void;
  nome: string;
  onNomeChange: (v: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["campanha-contas"],
    queryFn: getContasAnuncio,
  });
  const contas = data?.contas ?? [];

  const b = busca.toLowerCase();
  const filtrados = contas.filter(
    (c) =>
      c.nome.toLowerCase().includes(b) ||
      c.cliente.toLowerCase().includes(b) ||
      c.accountId.includes(busca),
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <div>
      <h2 className="text-xl font-bold text-zinc-900">Em qual conta será subida a campanha?</h2>
      <p className="text-sm text-zinc-500 mt-1 mb-5">
        Selecione a conta de anúncios do cliente que receberá esta campanha de tráfego.
      </p>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <input
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
          placeholder="Buscar por nome da conta, cliente ou ID..."
          className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
          <Loader2 className="size-5 animate-spin" /> Carregando contas de anúncios...
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-sm text-zinc-400 py-12">Nenhuma conta encontrada.</p>
      ) : (
        <>
          <p className="text-xs text-zinc-400 mb-3">{filtrados.length} contas encontradas</p>
          <div className="space-y-3">
            {visiveis.map((c) => {
              const ativo = selecionado === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition ${
                    ativo ? "border-brand ring-1 ring-brand" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {/* Radio */}
                  <span className={`shrink-0 size-5 rounded-full border-2 grid place-items-center ${ativo ? "border-brand" : "border-zinc-300"}`}>
                    {ativo && <span className="size-2.5 rounded-full bg-brand" />}
                  </span>

                  {/* Logo (iniciais) */}
                  <div className="shrink-0 w-16 h-11 rounded-lg bg-zinc-50 border border-zinc-200 grid place-items-center">
                    <span className="text-[11px] font-bold text-zinc-500">{iniciaisCliente(c.cliente || c.nome)}</span>
                  </div>

                  {/* Nome da conta + cliente/ID + pagamento */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 truncate">{c.nome}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {c.cliente || "Sem Business Manager"} · {c.accountId}
                    </p>
                    <p className={`text-[11px] mt-1 truncate ${c.temPagamento ? "text-emerald-600" : "text-red-500"}`}>
                      {c.temPagamento
                        ? `💳 ${c.formaPagamento || "Forma de pagamento OK"}`
                        : "⚠️ Sem forma de pagamento"}
                    </p>
                  </div>

                  {/* Status + moeda */}
                  <div className="shrink-0 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      c.temPagamento ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                    }`}>
                      {c.temPagamento ? "Pronta" : "Sem pagamento"}
                    </span>
                    <p className="text-xs text-zinc-400 mt-1.5">{c.moeda}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="size-9 rounded-lg border border-zinc-200 grid place-items-center text-zinc-500 disabled:opacity-30 hover:bg-zinc-50 transition"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPagina(n)}
                  className={`size-9 rounded-lg text-sm font-medium transition ${
                    n === paginaAtual ? "bg-brand text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                className="size-9 rounded-lg border border-zinc-200 grid place-items-center text-zinc-500 disabled:opacity-30 hover:bg-zinc-50 transition"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Nome da campanha */}
      <div className="mt-6 pt-6 border-t border-zinc-100">
        <label className="block">
          <span className="text-sm font-semibold text-zinc-800">Nome da campanha</span>
          <p className="text-xs text-zinc-500 mb-2">Como a campanha vai aparecer no Gerenciador de Anúncios.</p>
          <input
            value={nome}
            onChange={(e) => onNomeChange(e.target.value)}
            placeholder="Ex: Drogavaz — Ofertas da Semana"
            className="w-full px-4 py-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </label>
      </div>
    </div>
  );
}

function iniciaisCliente(nome: string): string {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// ── Etapa 2: objetivo da campanha ─────────────────────────────────────────────

function EtapaObjetivo({
  selecionado, onSelect,
}: { selecionado: string | null; onSelect: (o: Objetivo) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-zinc-900">Qual o objetivo da campanha?</h2>
      <p className="text-sm text-zinc-500 mt-1 mb-5">
        Escolha o que você quer alcançar. Isso define como o Meta vai otimizar as entregas.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {OBJETIVOS.map((o) => {
          const ativo = selecionado === o.codigo;
          const Icon = o.icon;
          return (
            <button
              key={o.codigo}
              onClick={() => onSelect(o)}
              className={`text-left p-5 rounded-xl border transition ${
                ativo ? "border-brand ring-1 ring-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`size-10 rounded-lg grid place-items-center ${ativo ? "bg-brand text-white" : "bg-zinc-100 text-zinc-500"}`}>
                  <Icon className="size-5" />
                </div>
                {ativo && <Check className="size-5 text-brand" />}
              </div>
              <p className="font-semibold text-zinc-900">{o.nome}</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{o.descricao}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Etapa 3: público e posicionamentos ────────────────────────────────────────

type Genero = "todos" | "mulheres" | "homens";
type Plataforma = "todas" | "instagram" | "facebook";
type Posicionamento = "todos" | "feed" | "story" | "feed_story" | "story_reels";

interface Publico {
  genero: Genero;
  idadeMin: number;
  idadeMax: number;
  plataforma: Plataforma;
  posicionamento: Posicionamento;
  orcamentoDiario: number;   // em reais
  dataInicio: string;        // YYYY-MM-DD
  dataFim: string;           // YYYY-MM-DD ou "" (sem data de término)
}

const hojeISO = () => new Date().toISOString().split("T")[0];

const PUBLICO_PADRAO: Publico = {
  genero: "todos", idadeMin: 25, idadeMax: 55, plataforma: "todas", posicionamento: "feed_story",
  orcamentoDiario: 20, dataInicio: hojeISO(), dataFim: "",
};

const IDADES = [18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
const labelIdade = (n: number) => (n >= 65 ? "65+" : String(n));

const GENEROS: { valor: Genero; nome: string; icon: typeof User }[] = [
  { valor: "mulheres", nome: "Mulheres", icon: User },
  { valor: "homens",   nome: "Homens",   icon: User },
  { valor: "todos",    nome: "Todos",    icon: Users },
];

const PLATAFORMAS: { valor: Plataforma; nome: string; icon: typeof Layers }[] = [
  { valor: "todas",     nome: "Todas as plataformas", icon: Layers },
  { valor: "instagram", nome: "Somente Instagram",    icon: Instagram },
  { valor: "facebook",  nome: "Somente Facebook",     icon: Facebook },
];

const POSICIONAMENTOS: { valor: Posicionamento; nome: string; icon: typeof Globe }[] = [
  { valor: "todos",        nome: "Todos os lugares",     icon: Globe },
  { valor: "feed",         nome: "Somente Feed",         icon: Newspaper },
  { valor: "story",        nome: "Somente Story",        icon: Square },
  { valor: "feed_story",   nome: "Feed e Story",         icon: Layers },
  { valor: "story_reels",  nome: "Somente Story e Reels",icon: Film },
];

const nomeGenero = (g: Genero) => GENEROS.find((x) => x.valor === g)!.nome;
const nomePlataforma = (p: Plataforma) => PLATAFORMAS.find((x) => x.valor === p)!.nome;
const nomePosicionamento = (p: Posicionamento) => POSICIONAMENTOS.find((x) => x.valor === p)!.nome;

function BlocoNumerado({ n, titulo, desc, children }: {
  n: number; titulo: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      <div className="flex items-start gap-3">
        <div className="shrink-0 size-7 rounded-full border-2 border-brand text-brand grid place-items-center font-bold text-sm">{n}</div>
        <div>
          <h3 className="font-bold text-zinc-900 leading-tight">{titulo}</h3>
          <p className="text-xs text-zinc-500 mt-1">{desc}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function EtapaPublico({ valor, onChange }: { valor: Publico; onChange: (p: Publico) => void }) {
  const set = (patch: Partial<Publico>) => onChange({ ...valor, ...patch });
  const minIdx = IDADES.indexOf(valor.idadeMin);
  const maxIdx = IDADES.indexOf(valor.idadeMax);

  return (
    <div className="space-y-8">
      {/* ── 1) Perfil do público ─────────────────────────────────────────── */}
      <BlocoNumerado n={1} titulo="Quais pessoas devem ver o seu anúncio?" desc="Escolha o perfil principal do público.">
        {/* Gênero */}
        <div className="grid grid-cols-3 gap-3">
          {GENEROS.map((g) => {
            const ativo = valor.genero === g.valor;
            const Icon = g.icon;
            return (
              <button
                key={g.valor}
                onClick={() => set({ genero: g.valor })}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                  ativo ? "border-brand ring-1 ring-brand" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className={`size-5 rounded-full border-2 grid place-items-center ${ativo ? "border-brand" : "border-zinc-300"}`}>
                  {ativo && <span className="size-2.5 rounded-full bg-brand" />}
                </span>
                <Icon className={`size-7 ${ativo ? "text-brand" : "text-zinc-400"}`} />
                <span className="text-sm font-medium text-zinc-700">{g.nome}</span>
              </button>
            );
          })}
        </div>

        {/* Idade */}
        <div className="mt-6">
          <p className="font-semibold text-zinc-800 text-sm">Qual faixa etária é o seu alvo?</p>
          <p className="text-xs text-zinc-500 mb-3">Selecione a idade mínima e máxima.</p>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-zinc-500">Idade mínima</span>
              <select
                value={valor.idadeMin}
                onChange={(e) => set({ idadeMin: Math.min(Number(e.target.value), valor.idadeMax) })}
                className="mt-1 w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                {IDADES.filter((a) => a <= valor.idadeMax).map((a) => <option key={a} value={a}>{labelIdade(a)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-500">Idade máxima</span>
              <select
                value={valor.idadeMax}
                onChange={(e) => set({ idadeMax: Math.max(Number(e.target.value), valor.idadeMin) })}
                className="mt-1 w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                {IDADES.filter((a) => a >= valor.idadeMin).map((a) => <option key={a} value={a}>{labelIdade(a)}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-zinc-400 mt-3">Faixas disponíveis: 18, 20, 25, 30, 35… até 65+</p>

          {/* Slider duplo */}
          <SliderPrimitive.Root
            className="relative flex items-center select-none touch-none w-full h-5 mt-2"
            min={0}
            max={IDADES.length - 1}
            step={1}
            minStepsBetweenThumbs={1}
            value={[minIdx, maxIdx]}
            onValueChange={([lo, hi]) => set({ idadeMin: IDADES[lo], idadeMax: IDADES[hi] })}
          >
            <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-zinc-200">
              <SliderPrimitive.Range className="absolute h-full rounded-full bg-brand" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block size-5 rounded-full bg-white border-2 border-brand shadow focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <SliderPrimitive.Thumb className="block size-5 rounded-full bg-white border-2 border-brand shadow focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </SliderPrimitive.Root>
          <div className="flex justify-between mt-1.5">
            {IDADES.map((a) => <span key={a} className="text-[10px] text-zinc-400">{labelIdade(a)}</span>)}
          </div>
        </div>
      </BlocoNumerado>

      <div className="border-t border-zinc-100" />

      {/* ── 2) Posicionamentos ───────────────────────────────────────────── */}
      <BlocoNumerado n={2} titulo="Posicionamentos" desc="Defina em quais plataformas e locais o anúncio será exibido.">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-6">
          <div className="space-y-5">
            {/* Aplicativo */}
            <div>
              <p className="text-sm font-medium text-zinc-700 mb-2">Em qual aplicativo o anúncio vai aparecer?</p>
              <div className="grid grid-cols-3 gap-3">
                {PLATAFORMAS.map((p) => {
                  const ativo = valor.plataforma === p.valor;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.valor}
                      onClick={() => set({ plataforma: p.valor })}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                        ativo ? "border-brand ring-1 ring-brand" : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <span className={`size-4 rounded-full border-2 grid place-items-center ${ativo ? "border-brand" : "border-zinc-300"}`}>
                        {ativo && <span className="size-2 rounded-full bg-brand" />}
                      </span>
                      <Icon className={`size-6 ${ativo ? "text-brand" : "text-zinc-500"}`} />
                      <span className="text-xs font-medium text-zinc-700 text-center">{p.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Onde aparece */}
            <div>
              <p className="text-sm font-medium text-zinc-700 mb-2">Onde o anúncio vai aparecer?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POSICIONAMENTOS.map((p) => {
                  const ativo = valor.posicionamento === p.valor;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.valor}
                      onClick={() => set({ posicionamento: p.valor })}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition ${
                        ativo ? "border-brand ring-1 ring-brand" : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <span className={`size-4 rounded-full border-2 grid place-items-center shrink-0 ${ativo ? "border-brand" : "border-zinc-300"}`}>
                        {ativo && <span className="size-2 rounded-full bg-brand" />}
                      </span>
                      <Icon className={`size-4 ${ativo ? "text-brand" : "text-zinc-400"}`} />
                      <span className="text-sm font-medium text-zinc-700">{p.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Resumo do público */}
          <div className="bg-brand/5 border border-brand/10 rounded-xl p-4 h-fit">
            <p className="text-sm font-bold text-brand mb-4">Resumo do público</p>
            <ResumoItem icon={Users}     rotulo="Gênero"          valor={nomeGenero(valor.genero)} />
            <ResumoItem icon={Calendar}  rotulo="Idade"           valor={`${labelIdade(valor.idadeMin)} a ${labelIdade(valor.idadeMax)}`} />
            <ResumoItem icon={LayoutGrid} rotulo="Aplicativos"    valor={nomePlataforma(valor.plataforma)} />
            <ResumoItem icon={Layers}    rotulo="Posicionamentos" valor={nomePosicionamento(valor.posicionamento)} />
            <ResumoItem icon={Wallet}    rotulo="Orçamento/dia"   valor={brl(valor.orcamentoDiario)} />
          </div>
        </div>
      </BlocoNumerado>

      <div className="border-t border-zinc-100" />

      {/* ── 3) Orçamento e período ───────────────────────────────────────── */}
      <BlocoNumerado n={3} titulo="Orçamento e período" desc="Defina quanto investir por dia e quando a campanha vai rodar.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Orçamento diário */}
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">Orçamento diário</span>
            <div className="mt-1 flex items-center gap-1 border border-zinc-200 rounded-lg px-3 focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand">
              <span className="text-sm font-semibold text-zinc-400">R$</span>
              <input
                type="number" min={5} step={1}
                value={valor.orcamentoDiario}
                onChange={(e) => set({ orcamentoDiario: Math.max(0, Number(e.target.value)) })}
                className="w-full py-2.5 text-sm text-zinc-800 focus:outline-none bg-transparent"
              />
            </div>
            <span className="text-[11px] text-zinc-400 mt-1 block">Mínimo recomendado: R$ 5/dia.</span>
          </label>

          {/* Data de início */}
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">Data de início</span>
            <input
              type="date"
              value={valor.dataInicio}
              min={hojeISO()}
              onChange={(e) => set({ dataInicio: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </label>

          {/* Data de fim (opcional) */}
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">Data de término <span className="text-zinc-400">(opcional)</span></span>
            <input
              type="date"
              value={valor.dataFim}
              min={valor.dataInicio}
              onChange={(e) => set({ dataFim: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <span className="text-[11px] text-zinc-400 mt-1 block">Vazio = sem data de término.</span>
          </label>
        </div>
      </BlocoNumerado>
    </div>
  );
}

// Formata reais para exibição
function brl(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function ResumoItem({ icon: Icon, rotulo, valor }: { icon: typeof Users; rotulo: string; valor: string }) {
  return (
    <div className="flex items-start gap-2.5 mb-3.5 last:mb-0">
      <Icon className="size-4 text-brand/70 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-500">{rotulo}</p>
        <p className="text-sm font-semibold text-zinc-800 truncate">{valor}</p>
      </div>
    </div>
  );
}

// ── Etapa 4: criativos + copys ────────────────────────────────────────────────

interface CriativoWizard {
  id: string;
  tipo: "gerado" | "upload";
  nome: string;
  preco?: string;
  imagem?: string | null;
  localizacao?: string;
  layout?: LayoutCriativo;
  enquadramento?: Enquadramento;
  titulo?: string;
  subtitulo?: string;
  arquivoUrl?: string;   // para uploads
  png?: string;          // PNG achatado (data URI) pronto para o Meta
}

export interface CriativosResultado {
  selecionados: { id: string; nome: string; preco: string | null; tipo: string; pngBase64: string | null }[];
  textoPrincipal: string;
  titulo: string;
  descricao: string;
}

const CRIATIVOS_DATA_VAZIO: CriativosResultado = {
  selecionados: [], textoPrincipal: "", titulo: "", descricao: "",
};

// Lê os criativos "puxados" do fluxo de Anúncios (salvos ao clicar em "Subir na Campanha")
function lerCriativosPuxados(): CriativoWizard[] {
  try {
    const raw = sessionStorage.getItem("campanha_criativos");
    if (!raw) return [];
    const arr = JSON.parse(raw) as Array<{ id: string; nome: string; preco: string; imagem?: string | null; localizacao: string; layout?: LayoutCriativo; enquadramento?: Enquadramento; titulo?: string; subtitulo?: string; png?: string }>;
    return arr.map((c) => ({ ...c, tipo: "gerado" as const }));
  } catch {
    return [];
  }
}

// Gera copys de exemplo com base nos produtos selecionados (será a chamada de IA no futuro)
function gerarCopysExemplo(nomes: string[]): { textoPrincipal: string; titulos: string[]; descricoes: string[] } {
  const lista = nomes.length ? nomes.join(", ") : "nossos produtos";
  return {
    textoPrincipal:
      `Ofertas que cuidam de você! 💊\n${lista} com preços especiais para o seu dia a dia.\n\n` +
      `Alívio e bem-estar com qualidade e economia.\n\nAproveite agora e cuide da sua saúde!\n` +
      `Somos a PharmaFarma, sua saúde, nossa prioridade.`,
    titulos: [
      "Alívio e economia para o seu dia",
      "Cuide da sua saúde e economize",
      "Preços especiais para você!",
    ],
    descricoes: [
      "Medicamentos essenciais com preços que cabem no seu bolso.",
      `${lista} com qualidade e confiança.`,
      "Ofertas imperdíveis na PharmaFarma. Sua saúde, nossa prioridade.",
    ],
  };
}

function EtapaCriativos({ onChange }: { onChange: (r: CriativosResultado) => void }) {
  const [criativos, setCriativos] = useState<CriativoWizard[]>(() => lerCriativosPuxados());
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set(lerCriativosPuxados().map((c) => c.id)));

  const [gerando, setGerando] = useState(false);
  const [gerado, setGerado] = useState(false);
  const [titulos, setTitulos] = useState<string[]>([]);
  const [descricoes, setDescricoes] = useState<string[]>([]);
  const [textoPrincipal, setTextoPrincipal] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");

  // Reporta o resultado ao parent sempre que algo muda
  useEffect(() => {
    onChange({
      selecionados: criativos
        .filter((c) => selecionados.has(c.id))
        .map((c) => ({
          id: c.id, nome: c.nome, preco: c.preco ?? null, tipo: c.tipo,
          pngBase64: c.png ?? c.arquivoUrl ?? null,
        })),
      textoPrincipal, titulo, descricao,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criativos, selecionados, textoPrincipal, titulo, descricao]);

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function baixarCriativoWizard(c: CriativoWizard) {
    try {
      if (c.png) { baixarPng(c.png, c.nome); return; }              // PNG já pronto
      if (c.arquivoUrl) { baixarPng(c.arquivoUrl, c.nome); return; } // upload
      // fallback: rasteriza na hora
      const png = await exportarCriativoPng({
        layout: c.layout ?? "azul", enquadramento: c.enquadramento ?? "4:5",
        nome: c.nome, preco: c.preco ?? "",
        imagem: c.imagem, localizacao: c.localizacao ?? "",
        titulo: c.titulo, subtitulo: c.subtitulo,
      });
      baixarPng(png, c.nome);
    } catch {
      toast.error("Erro ao baixar o PNG.");
    }
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: CriativoWizard = {
          id: crypto.randomUUID(), tipo: "upload", nome: file.name, arquivoUrl: reader.result as string,
        };
        setCriativos((prev) => [...prev, item]);
        setSelecionados((prev) => new Set(prev).add(item.id));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function gerarCopys() {
    setGerando(true);
    setTimeout(() => {
      const nomes = criativos.filter((c) => selecionados.has(c.id)).map((c) => c.nome);
      const r = gerarCopysExemplo(nomes);
      setTextoPrincipal(r.textoPrincipal);
      setTitulos(r.titulos);
      setDescricoes(r.descricoes);
      setTitulo(r.titulos[0]);
      setDescricao(r.descricoes[0]);
      setGerando(false);
      setGerado(true);
      toast.success("Copys geradas!");
    }, 700);
  }

  return (
    <div className="space-y-8">
      {/* ── Seleção de criativos ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-zinc-900">Quais criativos serão subidos?</h2>
        <p className="text-sm text-zinc-500 mt-1 mb-4">Selecione os criativos que serão utilizados na campanha.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Dropzone */}
          <label className="aspect-[4/5] border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-2 text-center p-4 cursor-pointer hover:border-brand hover:bg-brand/5 transition">
            <UploadCloud className="size-8 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-600">Arraste imagens ou vídeos aqui</span>
            <span className="text-xs text-zinc-400">ou clique para enviar</span>
            <span className="text-[11px] text-zinc-400 mt-1">Formatos: JPG, PNG, MP4</span>
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onUpload} />
          </label>

          {/* Criativos */}
          {criativos.map((c) => {
            const sel = selecionados.has(c.id);
            return (
              <div key={c.id} className="group relative">
                <button onClick={() => toggle(c.id)} className="block w-full text-left">
                  {/* Checkbox */}
                  <span className={`absolute top-2 left-2 z-10 size-6 rounded-md grid place-items-center border-2 ${
                    sel ? "bg-brand border-brand text-white" : "bg-white/80 border-zinc-300"
                  }`}>
                    {sel && <Check className="size-4" />}
                  </span>
                  <div className={`rounded-xl overflow-hidden transition ${sel ? "ring-2 ring-brand" : "ring-1 ring-zinc-200"}`}>
                    {c.tipo === "gerado" ? (
                      <CriativoCard
                        layout={c.layout ?? "azul"}
                        enquadramento={c.enquadramento ?? "4:5"}
                        nome={c.nome}
                        preco={c.preco ?? ""}
                        imagem={c.imagem}
                        localizacao={c.localizacao ?? ""}
                        titulo={c.titulo}
                        subtitulo={c.subtitulo}
                      />
                    ) : (
                      <div className="aspect-[4/5] bg-zinc-100 grid place-items-center overflow-hidden">
                        {c.arquivoUrl?.startsWith("data:image")
                          ? <img src={c.arquivoUrl} alt={c.nome} className="size-full object-cover" />
                          : <ImageIcon className="size-8 text-zinc-300" />}
                      </div>
                    )}
                  </div>
                </button>
                {/* Baixar PNG */}
                <button
                  onClick={() => baixarCriativoWizard(c)}
                  title="Baixar PNG"
                  className="absolute top-2 right-2 z-10 size-8 rounded-lg bg-white/90 border border-zinc-200 grid place-items-center text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-brand hover:text-white hover:border-brand transition shadow-sm"
                >
                  <Download className="size-4" />
                </button>
              </div>
            );
          })}
        </div>

        {criativos.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <ImageIcon className="size-4" />
            Nenhum criativo puxado. Gere criativos em <b>Anúncios</b> e clique em “Subir na Campanha”, ou envie pelo campo acima.
          </div>
        ) : (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
            <CheckCircle2 className="size-4" /> Criativos carregados com sucesso
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100" />

      {/* ── Copys ────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Textos Principais, Títulos e Descrições</h2>
            <p className="text-sm text-zinc-500 mt-1">Geraremos automaticamente as copys com base na análise dos criativos selecionados.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={gerarCopys}
              disabled={gerando}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm"
            >
              {gerando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Gerar Copys
            </button>
            {gerado && (
              <span className="text-xs text-zinc-400 bg-zinc-100 px-3 py-2 rounded-lg">Gerado automaticamente</span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <Sparkles className="size-3.5 shrink-0 mt-0.5" />
          O prompt irá gerar as copys dos produtos com base na análise do criativo inserido para maior personalização e assertividade.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {/* Texto Principal */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-1.5">
              Texto Principal <Sparkles className="size-3.5 text-blue-500" />
            </label>
            <textarea
              value={textoPrincipal}
              onChange={(e) => setTextoPrincipal(e.target.value)}
              maxLength={600}
              rows={8}
              placeholder="Clique em “Gerar Copys” ou escreva o texto principal..."
              className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <p className="text-right text-[11px] text-zinc-400 mt-1">{textoPrincipal.length} / 600</p>
          </div>

          {/* Título */}
          <OpcoesCopy
            rotulo="Título"
            opcoes={titulos}
            selecionado={titulo}
            onSelect={setTitulo}
            vazio="As opções de título aparecerão aqui após gerar."
          />

          {/* Descrição */}
          <OpcoesCopy
            rotulo="Descrição"
            opcoes={descricoes}
            selecionado={descricao}
            onSelect={setDescricao}
            vazio="As opções de descrição aparecerão aqui após gerar."
          />
        </div>
      </div>
    </div>
  );
}

function OpcoesCopy({ rotulo, opcoes, selecionado, onSelect, vazio }: {
  rotulo: string; opcoes: string[]; selecionado: string; onSelect: (v: string) => void; vazio: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-1.5">
        {rotulo} <Sparkles className="size-3.5 text-blue-500" />
      </label>
      {opcoes.length === 0 ? (
        <div className="h-full min-h-[120px] grid place-items-center text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-lg p-4">
          {vazio}
        </div>
      ) : (
        <div className="space-y-2">
          {opcoes.map((op, i) => {
            const ativo = selecionado === op;
            return (
              <button
                key={i}
                onClick={() => onSelect(op)}
                className={`w-full text-left flex items-start gap-2.5 p-3 rounded-lg border transition ${
                  ativo ? "border-brand ring-1 ring-brand" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className={`shrink-0 size-4 rounded-full border-2 grid place-items-center mt-0.5 ${ativo ? "border-brand" : "border-zinc-300"}`}>
                  {ativo && <span className="size-2 rounded-full bg-brand" />}
                </span>
                <span className="text-sm text-zinc-700">{op}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Etapa 5: revisão — mostra o JSON detalhado que irá para a IA ──────────────

function EtapaRevisao({ payload, resultado }: { payload: object; resultado: PublicarCampanhaResultado | null }) {
  if (resultado) {
    return (
      <div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-emerald-900">Campanha criada no Meta! 🎉</p>
            <p className="text-sm text-emerald-700 mt-1">
              ID: <span className="font-mono">{resultado.campanhaId}</span> — está <b>ativa</b>.
            </p>
            <a
              href={resultado.linkGerenciador} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-brand hover:underline"
            >
              Abrir no Gerenciador de Anúncios →
            </a>
            {resultado.avisos.length > 0 && (
              <ul className="mt-3 space-y-1">
                {resultado.avisos.map((a, i) => (
                  <li key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠️ {a}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <details className="mt-5">
          <summary className="text-xs text-zinc-400 cursor-pointer">Ver copy usada</summary>
          <div className="mt-2 text-sm text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
            <p><b>Texto:</b> {resultado.copyUsada.textoPrincipal}</p>
            <p><b>Título:</b> {resultado.copyUsada.titulo}</p>
            <p><b>Descrição:</b> {resultado.copyUsada.descricao}</p>
          </div>
        </details>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-xl font-bold text-zinc-900">Revise antes de publicar</h2>
      <p className="text-sm text-zinc-500 mt-1 mb-5">
        Estas são todas as informações que o sistema enviará para a IA criar a campanha.
      </p>
      <div className="rounded-xl border border-zinc-200 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-2 border-b border-zinc-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">payload da campanha (JSON)</span>
          <span className="text-[10px] text-zinc-500">enviado ao publicar</span>
        </div>
        <pre className="p-4 text-xs text-emerald-300 overflow-x-auto leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

function NovaCampanhaPage() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(1);

  // ── Estado central da campanha (vira o JSON detalhado no final) ──────────────
  const [cliente, setCliente] = useState<ContaAnuncio | null>(null);
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);

  // Ao selecionar a conta, sugere um nome (se ainda não foi digitado)
  function selecionarConta(c: ContaAnuncio) {
    setCliente(c);
    if (!nomeCampanha.trim()) {
      const base = (c.cliente || c.nome || "Campanha").replace(/^BM\d+\s*-\s*/i, "").trim();
      setNomeCampanha(`${base} — Ofertas`);
    }
  }
  const [publico, setPublico] = useState<Publico>(PUBLICO_PADRAO);
  const [criativosData, setCriativosData] = useState<CriativosResultado>(CRIATIVOS_DATA_VAZIO);

  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<PublicarCampanhaResultado | null>(null);

  const progresso = Math.round((passo / TOTAL) * 100);

  async function publicar() {
    if (publicando) return;
    setPublicando(true);
    try {
      const r = await publicarCampanha(montarPayload(true));
      setResultado(r);
      toast.success("Campanha criada no Meta!");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao publicar a campanha.");
    } finally {
      setPublicando(false);
    }
  }

  // Monta o JSON da campanha. incluirPng=true anexa os PNGs (para publicar);
  // false = versão limpa para exibir na revisão.
  function montarPayload(incluirPng = false) {
    return {
      nomeCampanha: nomeCampanha.trim(),
      conta: cliente && {
        id:        cliente.id,          // "act_..."
        accountId: cliente.accountId,
        nome:      cliente.nome,
        cliente:   cliente.cliente,     // Business Manager
        moeda:     cliente.moeda,
      },
      objetivo: objetivo && {
        codigo:    objetivo.codigo,     // código oficial do Meta
        nome:      objetivo.nome,
        descricao: objetivo.descricao,
      },
      publico: {
        genero:         publico.genero,           // todos | homens | mulheres
        idadeMin:       publico.idadeMin,
        idadeMax:       publico.idadeMax,
        plataforma:     publico.plataforma,       // todas | instagram | facebook
        posicionamento: publico.posicionamento,   // feed | story | feed_story | ...
      },
      orcamento: {
        diarioReais:    publico.orcamentoDiario,
        diarioCentavos: Math.round(publico.orcamentoDiario * 100),  // Meta usa centavos
        dataInicio:     publico.dataInicio,
        dataFim:        publico.dataFim || null,
      },
      criativos: {
        itens: criativosData.selecionados.map((c) =>
          incluirPng
            ? { nome: c.nome, preco: c.preco, pngBase64: c.pngBase64 }
            : { nome: c.nome, preco: c.preco }),
        copy: {
          textoPrincipal: criativosData.textoPrincipal,
          titulo:         criativosData.titulo,
          descricao:      criativosData.descricao,
        },
      },
    };
  }

  function podeAvancar(): boolean {
    if (passo === 1) return cliente !== null && nomeCampanha.trim().length > 0;
    if (passo === 2) return objetivo !== null;
    if (passo === 3) return publico.orcamentoDiario >= 5 && publico.dataInicio !== "";
    if (passo === 4) return criativosData.selecionados.length > 0;
    return true;
  }

  function proximo() {
    if (!podeAvancar()) return;
    if (passo < TOTAL) setPasso(passo + 1);
  }

  function voltar() {
    if (passo > 1) setPasso(passo - 1);
  }

  return (
    <AppShell title="Nova Campanha" hideHeader>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Nova Campanha</h1>
          <p className="text-zinc-500 mt-1">{SUBTITULOS[passo]}</p>
        </div>
        <button
          onClick={() => navigate({ to: "/acoes" })}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
        >
          <ArrowLeft className="size-4" /> Voltar para Ações
        </button>
      </div>

      {/* Timeline */}
      <Stepper atual={passo} />

      {/* Conteúdo da etapa */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 md:p-8 mb-6">
        {passo === 1 && <EtapaCliente selecionado={cliente?.id ?? null} onSelect={selecionarConta} nome={nomeCampanha} onNomeChange={setNomeCampanha} />}
        {passo === 2 && <EtapaObjetivo selecionado={objetivo?.codigo ?? null} onSelect={setObjetivo} />}
        {passo === 3 && <EtapaPublico valor={publico} onChange={setPublico} />}
        {passo === 4 && <EtapaCriativos onChange={setCriativosData} />}
        {passo === 5 && <EtapaRevisao payload={montarPayload()} resultado={resultado} />}
      </div>

      {/* Footer com progresso */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-6 py-4 flex items-center gap-4 sticky bottom-4">
        <div className="flex-1">
          <p className="text-xs font-medium text-zinc-500 mb-1.5">Passo {passo} de {TOTAL}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <span className="text-xs text-zinc-400 shrink-0">{progresso}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {passo > 1 && (
            <button
              onClick={voltar}
              className="px-4 py-2.5 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
            >
              Voltar
            </button>
          )}
          <button
            onClick={() => navigate({ to: "/acoes" })}
            className="px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition"
          >
            Cancelar
          </button>
          {passo < TOTAL ? (
            <button
              onClick={proximo}
              disabled={!podeAvancar()}
              className="bg-brand hover:bg-brand/90 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
            >
              Próximo passo <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={publicar}
              disabled={publicando || resultado !== null}
              className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
            >
              {publicando
                ? <><Loader2 className="size-4 animate-spin" /> Publicando...</>
                : resultado
                  ? <><Check className="size-4" /> Publicada</>
                  : <><Rocket className="size-4" /> Publicar campanha</>}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
