import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Search, Check, Rocket, Loader2, ChevronLeft, ChevronRight,
  Megaphone, MousePointerClick, MessageCircle, Users, ShoppingCart,
  User, Instagram, Facebook, Layers, Globe, Newspaper, Square, Film, Calendar, LayoutGrid,
  UploadCloud, CheckCircle2, ImageIcon, Wallet, Download,
} from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CriativoCard, type LayoutCriativo, type Enquadramento } from "@/components/CriativoCard";
import { exportarCriativoPng, baixarPng } from "@/lib/exportarCriativo";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  getContasAnuncio, publicarCampanha, getConjuntosDaConta, publicarNovosAnuncios,
  type ContaAnuncio, type PublicarCampanhaResultado, type ConjuntoMeta, type NovosAnunciosResultado,
} from "@/lib/api";

export const Route = createFileRoute("/campanhas/nova")({
  component: NovaCampanhaPage,
  head: () => ({ meta: [{ title: "Nova Campanha — GrupoSymbol" }] }),
});

// ── Etapas do wizard ──────────────────────────────────────────────────────────

/** "nova" = cria campanha do zero. "conjunto" = parte de um conjunto que já roda. */
type Modo = "nova" | "conjunto";

const ETAPAS = (modo: Modo) => [
  { n: 1, titulo: "Cliente",   sub: "Selecione o cliente" },
  modo === "nova"
    ? { n: 2, titulo: "Configuração", sub: "Defina o objetivo" }
    : { n: 2, titulo: "Conjunto",     sub: "Escolha o conjunto" },
  { n: 3, titulo: "Público",   sub: modo === "nova" ? "Defina o público" : "Revise o público" },
  { n: 4, titulo: "Criativos", sub: "Selecione os criativos" },
  { n: 5, titulo: "Revisão",   sub: "Revise e publique" },
];

// Subtítulo do cabeçalho por etapa
const SUBTITULOS = (modo: Modo): Record<number, string> => ({
  1: "Selecione o cliente que receberá esta campanha",
  2: modo === "nova"
    ? "Defina o objetivo da campanha"
    : "Escolha o conjunto que servirá de base para os novos anúncios",
  3: modo === "nova"
    ? "Defina o público e os posicionamentos da campanha"
    : "Revise as configurações herdadas do conjunto",
  4: "Selecione os criativos e gere as copys da campanha",
  5: "Revise tudo e publique",
});

const TOTAL = 5;

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

function Stepper({ atual, modo }: { atual: number; modo: Modo }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-6 py-6 mb-6">
      <div className="flex items-start">
        {ETAPAS(modo).map((e, i) => {
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
  selecionado, onSelect, nome, onNomeChange, pedirNome,
}: {
  selecionado: string | null;
  onSelect: (c: ContaAnuncio) => void;
  nome: string;
  onNomeChange: (v: string) => void;
  /** No modo "conjunto" a campanha já existe — não há nome a definir. */
  pedirNome: boolean;
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
      <div className={`mt-6 pt-6 border-t border-zinc-100 ${pedirNome ? "" : "hidden"}`}>
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

// ── Modal: campanha nova ou partir de um conjunto existente? ──────────────────

function ModalEscolhaFluxo({ conta, onEscolher }: {
  conta: ContaAnuncio;
  onEscolher: (m: Modo) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="size-12 rounded-full bg-brand/10 grid place-items-center mx-auto mb-4">
            <Rocket className="size-6 text-brand" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Criar uma nova campanha?</h3>
          <p className="text-sm text-zinc-500 mt-1.5">
            Para <b className="text-zinc-700">{conta.nome}</b>.
          </p>
          <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
            Escolhendo “Não”, você parte de um conjunto que já está rodando:
            revisa as configurações dele e sobe só os criativos novos.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 px-6 pb-6">
          <button
            onClick={() => onEscolher("conjunto")}
            className="px-4 py-3 rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition"
          >
            Não, usar um conjunto
          </button>
          <button
            onClick={() => onEscolher("nova")}
            className="px-4 py-3 rounded-lg bg-brand hover:bg-brand/90 text-white text-sm font-semibold transition shadow-sm"
          >
            Sim, criar nova
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Etapa 2 (modo "conjunto"): escolher o conjunto de origem ──────────────────

function EtapaConjunto({ contaId, selecionado, onSelect }: {
  contaId: string;
  selecionado: string | null;
  onSelect: (c: ConjuntoMeta) => void;
}) {
  const [busca, setBusca] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["conjuntos-conta", contaId],
    queryFn: () => getConjuntosDaConta(contaId),
  });

  const b = busca.toLowerCase();
  const conjuntos = (data?.conjuntos ?? []).filter(
    (c) => c.nome.toLowerCase().includes(b) || c.campanhaNome.toLowerCase().includes(b),
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-zinc-900">De qual conjunto vamos partir?</h2>
      <p className="text-sm text-zinc-500 mt-1 mb-5">
        As configurações dele (público, orçamento, destino) serão herdadas. O conjunto
        original continua rodando intacto — criamos uma cópia para os anúncios novos.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por conjunto ou campanha..."
          className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
          <Loader2 className="size-5 animate-spin" /> Carregando conjuntos do Meta...
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-600">{(error as Error).message}</p>
      ) : conjuntos.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          {busca ? "Nenhum conjunto bate com a busca." : "Esta conta não tem conjuntos ativos."}
        </p>
      ) : (
        <div className="space-y-3">
          {conjuntos.map((c) => {
            const ativo = selecionado === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition ${
                  ativo ? "border-brand ring-1 ring-brand" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className={`shrink-0 size-5 rounded-full border-2 grid place-items-center ${ativo ? "border-brand" : "border-zinc-300"}`}>
                  {ativo && <span className="size-2.5 rounded-full bg-brand" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 truncate">{c.nome}</p>
                  {c.campanhaNome && (
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">em {c.campanhaNome}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1"><Wallet className="size-3" />{brl(c.orcamentoDiario)}/dia</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />{c.generos}
                      {c.idadeMin !== null && ` · ${c.idadeMin}–${c.idadeMax}`}
                    </span>
                    {c.destinoWhatsapp && (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <MessageCircle className="size-3" />WhatsApp
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                  c.ativa ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                }`}>
                  {c.status}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-semibold text-zinc-800 text-sm">Qual faixa etária é o seu alvo?</p>
              <p className="text-xs text-zinc-500">Arraste as bolinhas para definir a idade mínima e máxima.</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-brand bg-brand/5 border border-brand/10 rounded-lg px-3 py-1.5">
              {labelIdade(valor.idadeMin)} a {labelIdade(valor.idadeMax)} anos
            </span>
          </div>

          {/* Slider duplo */}
          <SliderPrimitive.Root
            className="relative flex items-center select-none touch-none w-full h-5 mt-6"
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
          <CampoOrcamento valor={valor.orcamentoDiario} onChange={(v) => set({ orcamentoDiario: v })} />

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

// ── Formatação de moeda (pt-BR) ───────────────────────────────────────────────

const FMT_BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FMT_NUM = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Formata reais para exibição — R$ 1.234,56
function brl(v: number): string {
  return FMT_BRL.format(v);
}

const ORCAMENTO_MINIMO = 5;

/**
 * Campo de orçamento com máscara automática de moeda.
 * O gestor digita só números e o valor é formatado como reais na hora
 * (ex: 2000 → 20,00). Nunca fica em estado vazio ou inválido.
 */
function CampoOrcamento({ valor, onChange }: { valor: number; onChange: (reais: number) => void }) {
  const [texto, setTexto] = useState(() => FMT_NUM.format(valor));
  const abaixoDoMinimo = valor < ORCAMENTO_MINIMO;

  function digitar(bruto: string) {
    // Só os dígitos importam; os 2 últimos são os centavos. Teto evita overflow visual.
    const centavos = Number(bruto.replace(/\D/g, "").slice(0, 9));
    const reais = centavos / 100;
    setTexto(FMT_NUM.format(reais));
    onChange(reais);
  }

  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">Orçamento diário</span>
      <div className={`mt-1 flex items-center gap-1 border rounded-lg px-3 transition focus-within:ring-2 ${
        abaixoDoMinimo
          ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-400"
          : "border-zinc-200 focus-within:ring-brand/20 focus-within:border-brand"
      }`}>
        <span className="text-sm font-semibold text-zinc-400">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={texto}
          onChange={(e) => digitar(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-full py-2.5 text-sm text-zinc-800 text-right tabular-nums focus:outline-none bg-transparent"
        />
      </div>
      <span className={`text-[11px] mt-1 block ${abaixoDoMinimo ? "text-red-500" : "text-zinc-400"}`}>
        {abaixoDoMinimo ? `O Meta exige no mínimo ${brl(ORCAMENTO_MINIMO)}/dia.` : `Serão investidos ${brl(valor)} por dia.`}
      </span>
    </label>
  );
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
  selecionados: {
    id: string; nome: string; preco: string | null; tipo: string; pngBase64: string | null;
    // copy padrão já expandida ({produto}/{preco}/{cidade}) para ESTE criativo
    textoPrincipal: string; titulo: string; descricao: string;
  }[];
  // representativo (1º criativo) — usado na revisão / copyUsada
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

// ── Copy padrão (template) ────────────────────────────────────────────────────
// A mesma copy vale para todos os criativos. Marcadores aceitos (case-insensitive):
//   por criativo:  {produto}  {preco} / {preço}
//   por campanha:  {cidade}  {bairro}  {instagram}
const TOKENS_COPY = ["{produto}", "{preco}", "{cidade}", "{bairro}", "{instagram}"] as const;

const COPY_PADRAO = {
  textoPrincipal:
    "🌟 Descubra a Nova Linha de Produtos da Farmácia em {cidade}, {bairro}! Opções exclusivas para todos os gostos! 🌟\n\n" +
    "✨ Qualidade Premium\n✨ Variedade de Opções\n✨ Resultados Incríveis\n\n" +
    "📱 Siga-nos: {instagram}\n\n" +
    "Venha conhecer e se surpreender!",
  titulo: "",
  descricao: "",
};

/** Dados que preenchem os marcadores de uma copy. */
interface CopyCtx {
  produto: string;
  preco: string;
  cidade: string;
  bairro: string;
  instagram: string;
}

/** Substitui os marcadores da copy pelos dados de um criativo/campanha. */
function expandirCopy(tpl: string, ctx: CopyCtx): string {
  return tpl
    .replace(/\{\s*produto\s*\}/gi, ctx.produto)
    .replace(/\{\s*pre(?:c|ç)o\s*\}/gi, ctx.preco)
    .replace(/\{\s*cidade\s*\}/gi, ctx.cidade)
    .replace(/\{\s*bairro\s*\}/gi, ctx.bairro)
    .replace(/\{\s*instagram\s*\}/gi, ctx.instagram);
}

function EtapaCriativos({ onChange }: { onChange: (r: CriativosResultado) => void }) {
  const [criativos, setCriativos] = useState<CriativoWizard[]>(() => lerCriativosPuxados());
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set(lerCriativosPuxados().map((c) => c.id)));

  // Copy padrão (modelo). {produto}/{preco} trocam por criativo; {cidade}/{bairro}/{instagram} valem p/ a campanha.
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tplTexto, setTplTexto] = useState(COPY_PADRAO.textoPrincipal);
  const [tplTitulo, setTplTitulo] = useState(COPY_PADRAO.titulo);
  const [tplDescricao, setTplDescricao] = useState(COPY_PADRAO.descricao);

  // Reporta o resultado ao parent sempre que algo muda — expande a copy por criativo
  useEffect(() => {
    const selArr = criativos
      .filter((c) => selecionados.has(c.id))
      .map((c) => {
        const ctx: CopyCtx = { produto: c.nome, preco: c.preco ?? "", cidade, bairro, instagram };
        return {
          id: c.id, nome: c.nome, preco: c.preco ?? null, tipo: c.tipo,
          pngBase64: c.png ?? c.arquivoUrl ?? null,
          textoPrincipal: expandirCopy(tplTexto, ctx),
          titulo: expandirCopy(tplTitulo, ctx),
          descricao: expandirCopy(tplDescricao, ctx),
        };
      });
    const primeiro = selArr[0];
    onChange({
      selecionados: selArr,
      textoPrincipal: primeiro?.textoPrincipal ?? "",
      titulo: primeiro?.titulo ?? "",
      descricao: primeiro?.descricao ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criativos, selecionados, cidade, bairro, instagram, tplTexto, tplTitulo, tplDescricao]);

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

  // Prévia da copy expandida para cada criativo selecionado
  const previews = criativos
    .filter((c) => selecionados.has(c.id))
    .map((c) => {
      const ctx: CopyCtx = {
        produto: c.nome, preco: c.preco ?? "—",
        cidade: cidade || "…", bairro: bairro || "…", instagram: instagram || "…",
      };
      return { id: c.id, nome: c.nome, texto: expandirCopy(tplTexto, ctx) };
    });

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

      {/* ── Copy padrão ──────────────────────────────────────────────────── */}
      <div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Copy padrão dos anúncios</h2>
          <p className="text-sm text-zinc-500 mt-1">
            A mesma copy vale para todos os criativos — só o <b>produto</b> e o <b>preço</b> mudam em cada um.
          </p>
        </div>

        {/* Marcadores disponíveis */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
          <span className="font-medium">Marcadores:</span>
          {TOKENS_COPY.map((t) => (
            <code key={t} className="bg-white ring-1 ring-zinc-200 rounded px-1.5 py-0.5 text-brand font-semibold">{t}</code>
          ))}
          <span className="text-zinc-400">
            — {"{produto}"} e {"{preco}"} trocam por criativo; {"{cidade}"}, {"{bairro}"} e {"{instagram}"} valem para a campanha toda.
          </span>
        </div>

        {/* Dados da campanha (valem para todos os criativos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Cidade</label>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: Fortaleza"
              className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Bairro</label>
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Ex: Aldeota"
              className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Instagram</label>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Ex: @suafarmacia"
              className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1.5">Preenchem {"{cidade}"}, {"{bairro}"} e {"{instagram}"} em todos os criativos.</p>

        {/* Modelos de copy */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Texto Principal</label>
            <textarea
              value={tplTexto}
              onChange={(e) => setTplTexto(e.target.value)}
              maxLength={600}
              rows={6}
              placeholder="Ex: Farmácia na {cidade} está com promoção de {produto} por {preco}..."
              className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <p className="text-right text-[11px] text-zinc-400 mt-1">{tplTexto.length} / 600</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Título</label>
            <textarea
              value={tplTitulo}
              onChange={(e) => setTplTitulo(e.target.value)}
              maxLength={200}
              rows={6}
              placeholder="Ex: {produto} em promoção"
              className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <p className="text-right text-[11px] text-zinc-400 mt-1">{tplTitulo.length} / 200</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Descrição</label>
            <textarea
              value={tplDescricao}
              onChange={(e) => setTplDescricao(e.target.value)}
              maxLength={200}
              rows={6}
              placeholder="Ex: Solicite seu orçamento pelo WhatsApp."
              className="w-full text-sm text-zinc-700 bg-white border border-zinc-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <p className="text-right text-[11px] text-zinc-400 mt-1">{tplDescricao.length} / 200</p>
          </div>
        </div>

        {/* Prévia da copy expandida por criativo */}
        {previews.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Prévia por criativo ({previews.length})
            </p>
            <div className="space-y-2">
              {previews.map((p) => (
                <div key={p.id} className="flex items-start gap-3 bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                  <span className="text-xs font-semibold text-zinc-700 bg-white ring-1 ring-zinc-200 rounded px-2 py-0.5 shrink-0 max-w-[160px] truncate" title={p.nome}>
                    {p.nome}
                  </span>
                  <p className="text-sm text-zinc-600 whitespace-pre-line">{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Etapa 5: revisão — mostra o JSON detalhado que irá para a IA ──────────────

function EtapaRevisao({ payload, resultado, modo }: {
  payload: object;
  resultado: PublicarCampanhaResultado | NovosAnunciosResultado | null;
  modo: Modo;
}) {
  if (resultado) {
    const novaCampanha = "campanhaId" in resultado;
    return (
      <div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-emerald-900">
              {novaCampanha ? "Campanha criada no Meta! 🎉" : "Novos anúncios publicados! 🎉"}
            </p>
            <p className="text-sm text-emerald-700 mt-1">
              {novaCampanha ? (
                <>ID: <span className="font-mono">{resultado.campanhaId}</span> — está <b>ativa</b>.</>
              ) : (
                <>
                  Cópia do conjunto: <span className="font-mono">{resultado.conjuntoId}</span> —
                  criada <b>pausada</b>. O conjunto original segue rodando intacto.
                </>
              )}
            </p>
            <p className="text-sm text-emerald-700 mt-1">
              {resultado.anuncioIds.length === 1
                ? "1 anúncio criado no conjunto."
                : `${resultado.anuncioIds.length} anúncios criados no mesmo conjunto — o Meta vai rotacionar e entregar mais o que performar melhor.`}
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
        {modo === "conjunto"
          ? "Vamos criar uma cópia do conjunto escolhido com estas configurações e subir os criativos novos dentro dela. O conjunto original não será alterado."
          : "Estas são todas as informações que o sistema enviará ao Meta para criar a campanha."}
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

// Nome sugerido a partir da conta ("BM02 - Fulano" → "Fulano — Ofertas")
function sugerirNomeCampanha(c: ContaAnuncio): string {
  const base = (c.cliente || c.nome || "Campanha").replace(/^BM\d+\s*-\s*/i, "").trim();
  return `${base} — Ofertas`;
}

function NovaCampanhaPage() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(1);

  // ── Estado central da campanha (vira o JSON detalhado no final) ──────────────
  const [cliente, setCliente] = useState<ContaAnuncio | null>(null);
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);

  // Fluxo escolhido no modal que abre logo após selecionar o cliente.
  const [modo, setModo] = useState<Modo>("nova");
  const [perguntando, setPerguntando] = useState<ContaAnuncio | null>(null);
  const [conjunto, setConjunto] = useState<ConjuntoMeta | null>(null);

  // Ao selecionar a conta, sugere um nome e pergunta qual fluxo seguir
  function selecionarConta(c: ContaAnuncio) {
    setCliente(c);
    if (!nomeCampanha.trim()) setNomeCampanha(sugerirNomeCampanha(c));
    setPerguntando(c);
  }

  /** Conjunto escolhido: herda as configurações dele na etapa de público. */
  function selecionarConjunto(c: ConjuntoMeta) {
    setConjunto(c);
    setPublico((p) => ({
      ...p,
      genero:          c.genero,
      idadeMin:        c.idadeMin ?? p.idadeMin,
      idadeMax:        c.idadeMax ?? p.idadeMax,
      orcamentoDiario: c.orcamentoDiario || p.orcamentoDiario,
      dataInicio:      c.dataInicio || p.dataInicio,
      dataFim:         c.dataFim || "",
    }));
  }
  const [publico, setPublico] = useState<Publico>(PUBLICO_PADRAO);
  const [criativosData, setCriativosData] = useState<CriativosResultado>(CRIATIVOS_DATA_VAZIO);

  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<PublicarCampanhaResultado | NovosAnunciosResultado | null>(null);
  const [confirmarAberto, setConfirmarAberto] = useState(false);

  const progresso = Math.round((passo / TOTAL) * 100);

  async function publicar() {
    if (publicando) return;
    setConfirmarAberto(false);
    setPublicando(true);
    try {
      if (modo === "conjunto" && conjunto) {
        const r = await publicarNovosAnuncios(conjunto.id, montarPayloadConjunto());
        setResultado(r);
        toast.success("Novos anúncios publicados!");
      } else {
        const r = await publicarCampanha(montarPayload(true));
        setResultado(r);
        toast.success("Campanha criada no Meta!");
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Erro ao publicar.");
    } finally {
      setPublicando(false);
    }
  }

  /** Payload do modo "conjunto": cópia do conjunto + configs revisadas + criativos. */
  function montarPayloadConjunto() {
    return {
      conta: cliente && {
        id: cliente.id, nome: cliente.nome, cliente: cliente.cliente,
      },
      conjuntoOrigem:  conjunto && { id: conjunto.id, nome: conjunto.nome, campanha: conjunto.campanhaNome },
      nomeConjunto:    conjunto?.nome,
      destinoWhatsapp: conjunto?.destinoWhatsapp ?? false,
      publico: {
        genero:   publico.genero,
        idadeMin: publico.idadeMin,
        idadeMax: publico.idadeMax,
      },
      orcamento: {
        diarioReais:    publico.orcamentoDiario,
        diarioCentavos: Math.round(publico.orcamentoDiario * 100),
        dataInicio:     publico.dataInicio,
        dataFim:        publico.dataFim || null,
      },
      criativos: {
        itens: criativosData.selecionados.map((c) => ({
          nome: c.nome, preco: c.preco, pngBase64: c.pngBase64,
          textoPrincipal: c.textoPrincipal, titulo: c.titulo, descricao: c.descricao,
        })),
        copy: {
          textoPrincipal: criativosData.textoPrincipal,
          titulo:         criativosData.titulo,
          descricao:      criativosData.descricao,
        },
      },
      ativar: false,   // a cópia nasce pausada para o gestor conferir
    };
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
            ? { nome: c.nome, preco: c.preco, pngBase64: c.pngBase64,
                textoPrincipal: c.textoPrincipal, titulo: c.titulo, descricao: c.descricao }
            : { nome: c.nome, preco: c.preco,
                textoPrincipal: c.textoPrincipal, titulo: c.titulo, descricao: c.descricao }),
        copy: {
          textoPrincipal: criativosData.textoPrincipal,
          titulo:         criativosData.titulo,
          descricao:      criativosData.descricao,
        },
      },
    };
  }

  function podeAvancar(): boolean {
    if (passo === 1) {
      if (cliente === null) return false;
      return modo === "conjunto" || nomeCampanha.trim().length > 0;
    }
    if (passo === 2) return modo === "conjunto" ? conjunto !== null : objetivo !== null;
    if (passo === 3) return publico.orcamentoDiario >= ORCAMENTO_MINIMO && publico.dataInicio !== "";
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
          <h1 className="text-2xl font-bold text-zinc-900">Campanhas</h1>
          <p className="text-zinc-500 mt-1">{SUBTITULOS(modo)[passo]}</p>
        </div>
        <button
          onClick={() => navigate({ to: "/anuncios" })}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
        >
          <ArrowLeft className="size-4" /> Voltar
        </button>
      </div>

      {/* Timeline */}
      <Stepper atual={passo} modo={modo} />

      {/* Conteúdo da etapa */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 md:p-8 mb-6">
        {passo === 1 && (
          <EtapaCliente
            selecionado={cliente?.id ?? null}
            onSelect={selecionarConta}
            nome={nomeCampanha}
            onNomeChange={setNomeCampanha}
            pedirNome={modo === "nova"}
          />
        )}
        {passo === 2 && (modo === "conjunto"
          ? <EtapaConjunto contaId={cliente!.id} selecionado={conjunto?.id ?? null} onSelect={selecionarConjunto} />
          : <EtapaObjetivo selecionado={objetivo?.codigo ?? null} onSelect={setObjetivo} />)}
        {passo === 3 && <EtapaPublico valor={publico} onChange={setPublico} />}
        {passo === 4 && <EtapaCriativos onChange={setCriativosData} />}
        {passo === 5 && (
          <EtapaRevisao
            payload={modo === "conjunto" ? montarPayloadConjunto() : montarPayload()}
            resultado={resultado}
            modo={modo}
          />
        )}
      </div>

      {perguntando && (
        <ModalEscolhaFluxo
          conta={perguntando}
          onEscolher={(m) => {
            setModo(m);
            setPerguntando(null);
            // "Não" já pula para a escolha do conjunto — o cliente foi definido
            // no clique que abriu este modal, não há mais nada a fazer na etapa 1.
            if (m === "conjunto") setPasso(2);
          }}
        />
      )}

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
            onClick={() => navigate({ to: "/anuncios" })}
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
              onClick={() => setConfirmarAberto(true)}
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

      <Dialog open={confirmarAberto} onOpenChange={setConfirmarAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tem certeza que deseja publicar essas alterações?</DialogTitle>
            <DialogDescription>
              {modo === "conjunto"
                ? "Uma cópia do conjunto será criada no Meta com os novos anúncios."
                : "A campanha será criada no Meta e entrará no ar."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmarAberto(false)}
              className="px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition"
            >
              Cancelar
            </button>
            <button
              onClick={publicar}
              className="bg-brand hover:bg-brand/90 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Rocket className="size-4" /> Sim, publicar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
